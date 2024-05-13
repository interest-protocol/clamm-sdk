import { bcs } from '@mysten/sui.js/bcs';
import { SuiClient } from '@mysten/sui.js/client';
import {
  TransactionBlock,
  TransactionObjectArgument,
  TransactionResult,
} from '@mysten/sui.js/transactions';
import {
  isValidSuiObjectId,
  normalizeSuiObjectId,
  SUI_CLOCK_OBJECT_ID,
} from '@mysten/sui.js/utils';
import { isEmpty } from 'ramda';
import invariant from 'tiny-invariant';

import {
  AddLiquidityArgs,
  AddLiquidityReturn,
  ClammConstructor,
  GetRouteQuotesArgs,
  GetRouteQuotesReturn,
  GetRoutesArgs,
  GetRoutesReturn,
  HandleCoinVectorArgs,
  HandleCoinVectorReturn,
  InterestPool,
  NewPoolReturn,
  NewStableArgs,
  NewVolatileArgs,
  PoolData,
  PoolMetadata,
  QueryPoolsArgs,
  QueryPoolsReturn,
  QuoteAddLiquidityArgs,
  QuoteRemoveLiquidityArgs,
  QuoteRemoveLiquidityOneCoiArgs,
  QuoteSwapArgs,
  QuoteSwapReturn,
  RemoveLiquidityArgs,
  RemoveLiquidityOneCoinArgs,
  RemoveLiquidityOneCoinReturn,
  RemoveLiquidityReturn,
  SharePoolArgs,
  StablePool,
  SwapArgs,
  SwapReturn,
  SwapRouteArgs,
  VolatilePool,
} from './clamm.types';
import {
  ADD_LIQUIDITY_FUNCTION_NAME_MAP,
  NEW_POOL_FUNCTION_NAME_MAP,
  PACKAGES,
  REMOVE_LIQUIDITY_FUNCTION_NAME_MAP,
  SuiCoinsNetwork,
} from './constants';
import { constructDex, findRoutes } from './router';
import {
  devInspectAndGetReturnValues,
  getCoinMetas,
  listToString,
  parseInterestPool,
  parseStableV1State,
  parseVolatileV1State,
} from './utils';

// @dev Added this line to get all types into one file
export * from './clamm.types.ts';

export class CLAMM {
  #client: SuiClient;
  #package: string;
  #suiTears: string;
  #poolModule = 'interest_pool' as const;
  #volatileModule = 'interest_clamm_volatile' as const;
  #stableModule = 'interest_clamm_stable' as const;
  #stableA = 1500n;
  #volatileA = 400000n;
  #gamma = 145000000000000n;
  #extraProfit = 2000000000000n;
  #adjustmentStep = 146000000000000n;
  #maHalfTime = 600_000n; // 10 minutes
  #midFee = 26000000n;
  #outFee = 45000000n;
  #gammaFee = 230000000000000n;
  #network: ClammConstructor['network'];
  #mainnetClammAddress =
    '0x429dbf2fc849c0b4146db09af38c104ae7a3ed746baf835fa57fee27fa5ff382';
  #END_POINT = 'https://www.suicoins.com/api/';
  #poolType: string;
  stableType: string;
  volatileType: string;
  // 1e18
  PRECISION = 1000000000000000000n;
  LP_COIN_DECIMALS = 9;
  LP_COIN_DECIMALS_SCALAR = 1_000_000_000n;
  // Max Stable Pool Values
  STABLE_MAX_A_VALUE = 1_000_000n;
  STABLE_MAX_A_CHANGE = 10n;
  STABLE_MIN_RAMP_TIME = 86_400_000n;
  // Max Volatile Pool Values
  MIN_FEE = 5n * 100_000n;
  MAX_FEE = 10n * 1_000_000_000n;
  MAX_MA_HALF_TIME = 7n * 86400000n;
  MAX_ADMIN_FEE = 10000000000n;
  MIN_GAMMA = 10_000_000_000n;
  MAX_GAMMA = 10_000_000_000_000_000n;

  /**
   * @note Constructs a new instance of the CLAMM class.
   *
   * @param {string} packageAddress - The address of the CLAMM package.
   * @param {'mainnet' | 'testnet'} network - The network. The options are 'mainnet' | 'testnet'
   */
  constructor({ suiClient, network }: ClammConstructor) {
    const pkgs = PACKAGES[network];

    const suiTearsAddress = normalizeSuiObjectId(pkgs.SUITEARS);
    const packageAddress = normalizeSuiObjectId(pkgs.CLAMM);

    invariant(
      isValidSuiObjectId(suiTearsAddress),
      'Invalid Sui Tears💧 address',
    );
    invariant(isValidSuiObjectId(packageAddress), 'Invalid CLAMM address');

    this.#client = suiClient;
    this.#package = packageAddress;
    this.#suiTears = suiTearsAddress;
    this.stableType = `${packageAddress}::curves::Stable`;
    this.volatileType = `${packageAddress}::curves::Volatile`;
    this.#poolType = `${packageAddress}::interest_pool::InterestPool`;
    this.#network = network;
  }

  /**
   * @note Retrieves {InterestPool[]} from the server based on the provided arguments.
   *
   * @dev if no `args` is passed. It will fetch the first page with 50 items.
   *
   * @param {QueryPoolsArgs} args - Optional arguments to paginate/filter the pools.
   * @param {number} args.page - It starts at 1.
   * @param {number} args.pageSize - The number of pools per page. It has a maximum of 50.
   * @param {string[]} args.coinTypes - An array of coin types.
   * @returns A promise that resolves to an object containing the retrieved pools and the total number of pages.
   */
  async getPools(
    args?: QueryPoolsArgs,
  ): Promise<QueryPoolsReturn<InterestPool>> {
    const { pools, totalPages } = await this.getPoolsMetadata(args);

    return {
      pools: await this.getPoolsFromMetadata(pools),
      totalPages,
    };
  }

  /**
   * @note Retrieves the {PoolMetadata[]} based on the provided arguments.
   * If the `coinTypes` are specified, it fetches pools with the specified coin types.
   * Otherwise, it fetches all pools with pagination support.
   *
   * @param args - Optional arguments for querying pools.
   * @param {number} args.page - It starts at 1.
   * @param {number} args.pageSize - The number of pools per page. It has a maximum of 50.
   * @param {string[]} args.coinTypes - An array of coin types.
   * @returns A promise that resolves to the pool metadata and total pages (if applicable).
   */
  async getPoolsMetadata(
    args?: QueryPoolsArgs,
  ): Promise<QueryPoolsReturn<PoolMetadata>> {
    const { page = 1, pageSize = 50, coinTypes = [] } = args ? args : {};

    if (coinTypes && coinTypes.length) {
      const pools = await this.#fetch<readonly PoolMetadata[]>(
        `get-clamm-pools-by-types?coinTypes=${coinTypes.toString()}`,
      );

      return {
        pools,
        totalPages: null,
      };
    }

    const safePage = !page ? 1 : page;

    return this.#fetch<QueryPoolsReturn<PoolMetadata>>(
      `get-all-clamm-pools?page=${safePage}&limit=${pageSize}`,
    );
  }

  /**
   * @note Retrieves the interest pools from the provided pools metadata.
   *
   * @param {PoolMetadata[]} poolsMetadata - An array of {PoolMetadata} objects.
   * @returns A promise that resolves to an array of {InterestPool[]}.
   */
  async getPoolsFromMetadata(
    poolsMetadata: readonly PoolMetadata[],
  ): Promise<readonly InterestPool[]> {
    const pools = await this.#client.multiGetObjects({
      ids: poolsMetadata.map(x => x.poolObjectId),
      options: { showContent: true, showType: true },
    });

    const metadatas: PoolData[] = [];
    const stateIds: string[] = [];

    pools.forEach(elem => {
      const { stateVersionedId, ...otherValues } = parseInterestPool(elem);
      metadatas.push(otherValues);
      stateIds.push(stateVersionedId);
    });

    const promises = stateIds.map(stateVersionedId =>
      this.#client.getDynamicFields({
        parentId: stateVersionedId,
      }),
    );

    const dynamicFields = await Promise.all(promises);

    const poolState = await this.#client.multiGetObjects({
      ids: dynamicFields.map(field => field.data[0].objectId),
      options: { showContent: true, showType: true },
    });

    return poolState.map((poolState, index) => {
      const { isStable, poolAdminAddress, poolObjectId, coinTypes } =
        metadatas[index];

      invariant(
        poolState.data &&
          poolState.data.content &&
          poolState.data.content.dataType === 'moveObject',
        'PoolState data not found',
      );

      if (isStable) {
        const { lpCoinType, state } = parseStableV1State(
          poolState.data.content.fields,
        );
        return {
          poolAdminAddress,
          poolObjectId,
          coinTypes,
          state,
          lpCoinType,
          isStable,
        } as StablePool;
      }

      const { lpCoinType, state } = parseVolatileV1State(
        poolState.data.content.fields,
      );

      return {
        poolAdminAddress,
        poolObjectId,
        coinTypes,
        state,
        lpCoinType,
        isStable,
      } as VolatilePool;
    });
  }

  /**
   * @note Retrieves the routes for swapping between two coins by passing the respective coin types.
   *
   * @param {GetRoutesArgs} args - The arguments for getting routes.
   * @param {string} args.coinIn - This is the coin type you wish to sell.  E.g. - `pkg::module_name::OTW`
   * @param {string} args.coinOut - This is the coin type you wish to buy.  E.g. - `pkg::module_name::OTW`
   * @returns {Promise<GetRoutesReturn>} - A promise that resolves to an object containing the pools map and the routes.
   */
  async getRoutes({
    coinIn,
    coinOut,
  }: GetRoutesArgs): Promise<GetRoutesReturn> {
    const { pools } = await this.getPoolsMetadata({
      coinTypes: [coinIn, coinOut],
    });

    if (!pools.length)
      return {
        poolsMap: {},
        routes: [],
      };

    const poolsMap = pools.reduce(
      (acc, pool) => ({
        ...acc,
        [pool.poolObjectId]: pool,
      }),
      {} as Record<string, PoolMetadata>,
    );

    return {
      poolsMap,
      routes: findRoutes(constructDex(pools), coinIn, coinOut),
    };
  }

  /**
   * @note Retrieves the routes with quotes for a given set of parameters.
   *
   * @param {GetRoutesArgs} args - The arguments for getting routes with the output amounts.
   * @param {string} args.coinIn - This is the coin type you wish to sell.  E.g. - `pkg::module_name::OTW`
   * @param {string} args.coinOut - This is the coin type you wish to buy.  E.g. - `pkg::module_name::OTW`
   * @param {bigint} amount - The amount of `args.coinIn` you wish to sell.
   * @returns A promise that resolves to an object containing the routes and pools map.
   */
  async getRoutesQuotes({
    coinIn,
    coinOut,
    amount,
  }: GetRouteQuotesArgs): Promise<GetRouteQuotesReturn> {
    if (!amount) return { routes: [], poolsMap: {} };

    const { pools } = await this.getPoolsMetadata({
      coinTypes: [coinIn, coinOut],
    });

    if (!pools.length) return { routes: [], poolsMap: {} };

    const routes = findRoutes(constructDex(pools), coinIn, coinOut);

    const poolsMap = pools.reduce(
      (acc, pool) => ({
        ...acc,
        [pool.poolObjectId]: pool,
      }),
      {} as Record<string, PoolMetadata>,
    );

    const routeQuote = [];

    if (!routes.length) return { routes: [], poolsMap: {} };

    for (const [coinsPath, idsPath] of routes) {
      const txb = new TransactionBlock();

      let amountIn: bigint | TransactionObjectArgument | any = amount;

      for (const poolId of idsPath) {
        const index = idsPath.indexOf(poolId);
        const isFirstCall = index === 0;
        const isLastCall = index + 1 === idsPath.length;

        const poolMetadata = poolsMap[poolId];

        const moduleName = poolMetadata.isStable
          ? this.#stableModule
          : this.#volatileModule;

        if (isLastCall || (isFirstCall && isLastCall)) {
          txb.moveCall({
            target: `${this.#package}::${moduleName}::quote_swap`,
            typeArguments: [
              coinsPath[index],
              coinsPath[index + 1],
              poolMetadata.lpCoinType,
            ],
            arguments: [
              txb.object(poolId),
              txb.object(SUI_CLOCK_OBJECT_ID),
              isFirstCall ? txb.pure.u64(amountIn.toString()) : amountIn,
            ],
          });

          const [result] = await devInspectAndGetReturnValues(
            this.#client,
            txb,
          );

          invariant(result.length, 'Result is empty');
          invariant(typeof result[0] === 'string', 'Value is not a string');
          invariant(typeof result[1] === 'string', 'Value is not a string');

          if (!poolMetadata.isStable)
            invariant(
              result.length === 2,
              'Failed to get volatile quote values',
            );

          if (poolMetadata.isStable) {
            invariant(result.length === 3, 'Failed to get stable quote values');
            invariant(typeof result[2] === 'string', 'Value is not a string');
          }

          const output = poolMetadata.isStable
            ? {
                amount: BigInt(result[0]),
                feeIn: BigInt(result[1]),
                feeOut: BigInt(result[2] as string),
              }
            : {
                amount: BigInt(result[0]),
                fee: BigInt(result[1]),
              };
          routeQuote.push([coinsPath, idsPath, output]);
          break;
        }

        [amountIn] = txb.moveCall({
          target: `${this.#package}::${moduleName}::quote_swap`,
          typeArguments: [
            coinsPath[index],
            coinsPath[index + 1],
            poolMetadata.lpCoinType,
          ],
          arguments: [
            txb.object(poolId),
            txb.object(SUI_CLOCK_OBJECT_ID),
            isFirstCall ? txb.pure.u64(amountIn.toString()) : amountIn,
          ],
        });
      }
    }

    return { routes: routeQuote, poolsMap } as GetRouteQuotesReturn;
  }

  /**
   * @note Executes a swap route by moving coins through multiple pools.
   *
   * @param {SwapRouteArgs} args - The arguments to swap using the `args.route` information.
   * @param {TransactionBlock} args.txb - The TransactionBlock instance.
   * @param {string | TransactionObjectArgument} args.coinIn - The input coin for the swap. This is the coin object with the exact value you wish to sell. Merge and split before this call.
   * @param {Record<string, PoolMetadata>} args.poolsMap - A map of pool metadata for the router.
   * @param {[CoinPath, PoolObjectIdPath, QuoteSwapReturn][]} args.route - The swap route, represented as an array of two elements: coinsPath and idsPath.
   * @param {bigint} args.minAmount - The minimum amount for the swap (default: 0).
   * @returns The TransactionBlock instance and the output coin of the swap.
   */
  swapRoute({
    txb = new TransactionBlock(),
    coinIn,
    poolsMap,
    route,
    minAmount = 0n,
    slippage = 2,
  }: SwapRouteArgs): SwapReturn {
    invariant(route.length === 2, 'Route must have a length of two');

    const [coinsPath, idsPath] = [route[0], route[1]];

    invariant(coinsPath?.length, 'Missing coins path');
    invariant(idsPath?.length, 'Missing pool ids paths');

    let min = undefined;
    if (minAmount) {
      min = txb.pure.u64(minAmount.toString());
    } else {
      for (const poolId of idsPath) {
        const index = idsPath.indexOf(poolId);

        const poolMetadata = poolsMap[poolId];

        const moduleName = poolMetadata.isStable
          ? this.#stableModule
          : this.#volatileModule;

        [min] = txb.moveCall({
          target: `${this.#package}::${moduleName}::quote_swap`,
          typeArguments: [
            coinsPath[index],
            coinsPath[index + 1],
            poolMetadata.lpCoinType,
          ],
          arguments: [
            txb.object(poolId),
            txb.object(SUI_CLOCK_OBJECT_ID),
            min ? min : this.#coinValue(txb, coinIn, coinsPath[index]),
          ],
        });
        min = this.#deductSlippage(txb, min, slippage);
      }
    }

    let input = coinIn;

    for (const poolId of idsPath) {
      const index = idsPath.indexOf(poolId);
      const isLastCall = index + 1 === idsPath.length;

      const poolMetadata = poolsMap[poolId];

      const moduleName = poolMetadata.isStable
        ? this.#stableModule
        : this.#volatileModule;

      input = txb.moveCall({
        target: `${this.#package}::${moduleName}::swap`,
        typeArguments: [
          coinsPath[index],
          coinsPath[index + 1],
          poolMetadata.lpCoinType,
        ],
        arguments: [
          txb.object(poolId),
          txb.object(SUI_CLOCK_OBJECT_ID),
          this.#object(txb, input),
          isLastCall ? min! : txb.pure.u64('0'),
        ],
      });
    }

    return {
      txb,
      coinOut: input as SwapReturn['coinOut'],
    };
  }

  /**
   * @note Shares a stable pool.
   *
   * @param {SharePoolArgs} args - The arguments for sharing the pool.
   * @param {TransactionBuilder} args.txb - A transaction block.
   * @param {NestedResult} args.pool - The pool to share.
   * @returns {TransactionBuilder} The updated transaction block.
   */
  shareStablePool({ txb, pool }: SharePoolArgs) {
    txb.moveCall({
      target: `${this.#package}::${this.#poolModule}::share`,
      typeArguments: [this.stableType],
      arguments: [pool],
    });
    return txb;
  }

  /**
   * Shares a volatile pool.
   *
   * @param {SharePoolArgs} args - The arguments for sharing the pool.
   * @param {TransactionBuilder} args.txb - The transaction block.
   * @param {NestedResult} args.pool - The pool to share.
   * @returns {TransactionBuilder} The updated transaction block.
   */
  shareVolatilePool({ txb, pool }: SharePoolArgs) {
    txb.moveCall({
      target: `${this.#package}::${this.#poolModule}::share`,
      typeArguments: [this.volatileType],
      arguments: [pool],
    });
    return txb;
  }

  /**
   * @note Creates a new stable pool.
   *
   * @param {NewStableArgs} args - The arguments to create a stable pool.
   * @param {TransactionBlock} args.txb - The transaction block.
   * @param {bigint} args.a - The value of A.
   * @param {TransactionObjectArgument | string} args.lpCoinTreasuryCap - The LP coin Treasury cap.
   * @param {TransactionObjectArgument[] | string[]} args.coins - A list of coins. These coins must have the correct value you wish to add and must be in the correct order.
   * @param {string[]} args.typeArguments - The type arguments. It is a list of of the coinTypes with the same order as args.coins. It should have an additional type for the LpCoin [...coinTypes[], lpCoinType]
   * @returns A promise that resolves to an object containing the new pool, pool admin, LP coin, and the updated transaction block.
   */
  async newStable({
    txb = new TransactionBlock(),
    a = this.#stableA,
    lpCoinTreasuryCap,
    coins,
    typeArguments,
  }: NewStableArgs): Promise<NewPoolReturn> {
    invariant(
      typeArguments.length === coins.length + 1 && typeArguments.length >= 3,
      'Type arguments and coin mismatch',
    );
    invariant(
      this.STABLE_MAX_A_VALUE > a,
      `A value must be lower than: ${this.STABLE_MAX_A_VALUE}`,
    );

    const supply = this.#treasuryIntoSupply(
      txb,
      typeArguments.slice(-1)[0],
      lpCoinTreasuryCap,
    );

    const [coinDecimals, cap] = await this.#handleCoinDecimals(
      txb,
      typeArguments,
    );

    const [pool, poolAdmin, lpCoin] = txb.moveCall({
      target: `${this.#package}::${this.#stableModule}::${NEW_POOL_FUNCTION_NAME_MAP[typeArguments.length]}`,
      typeArguments,
      arguments: [
        txb.object(SUI_CLOCK_OBJECT_ID),
        coinDecimals,
        ...coins.map(x => this.#object(txb, x)),
        supply,
        txb.pure.u256(a.toString()),
      ],
    });

    txb = this.#destroyCoinDecimalsAndCap(txb, coinDecimals, cap);

    return {
      pool,
      poolAdmin,
      lpCoin,
      txb,
    };
  }

  /**
   * @note Creates a new volatile pool.
   * @dev Only set the pool parameter values if you know what you are doing.
   *
   * @param {NewVolatileArgs} args - The arguments to create a volatile pool.
   * @param {TransactionBlock} args.txb - The transaction block.
   * @param {string[] | TransactionObjectArgument[]} args.coins - A list of coins. These coins must have the value you wish to add and must be in the correct order.
   * @param {string[]} args.typeArguments - The type arguments. It is a list of of the coinTypes with the same order as args.coins. It should have an additional type for the LpCoin [...coinTypes[], lpCoinType]
   * @param {String | TransactionObjectArgument} args.lpCoinTreasuryCap - The LP coin treasury cap.
   * @param {bigint} args.a - The value for the amplifier 'a'.
   * @param {bigint} args.gamma - The value of 'gamma'.
   * @param {bigint} args.extraProfit - The extra profit value.
   * @param {bigint} args.adjustmentStep - The adjustment step value.
   * @param {bigint} args.maHalfTime - The MA half time value.
   * @param {bigint} args.midFee - The mid fee value.
   * @param {bigint} args.outFee - The out fee value.
   * @param {bigint} args.gammaFee - The gamma fee value.
   * @param {bigint[]} args.prices - The list of prices. In Volatile pools coins are quoted based on the first coin. 1 unit is represented by 1e18. We advice the first coin to be USDC or the layer1 gas coin.
   * @returns A promise that resolves to an object containing the pool, pool admin, LP coin, and the updated transaction block.
   */
  async newVolatile({
    txb = new TransactionBlock(),
    coins,
    typeArguments,
    lpCoinTreasuryCap,
    a = this.#volatileA,
    gamma = this.#gamma,
    extraProfit = this.#extraProfit,
    adjustmentStep = this.#adjustmentStep,
    maHalfTime = this.#maHalfTime,
    midFee = this.#midFee,
    outFee = this.#outFee,
    gammaFee = this.#gammaFee,
    prices,
  }: NewVolatileArgs): Promise<NewPoolReturn> {
    invariant(
      typeArguments.length === coins.length + 1 && typeArguments.length >= 3,
      'Type arguments and coin mismatch',
    );
    invariant(prices.length > 0, 'You must provide prices');
    invariant(
      this.MAX_FEE > midFee && midFee >= this.MIN_FEE,
      `Mid Fee must be lower than: ${this.MAX_FEE}`,
    );
    invariant(
      this.MAX_FEE > outFee && outFee >= this.MIN_FEE,
      `Out Fee must be lower than: ${this.MAX_FEE}`,
    );
    invariant(
      !!gammaFee && this.PRECISION >= gammaFee,
      `Gamma fee must be lower of equal to: ${this.PRECISION}`,
    );
    invariant(
      this.PRECISION > extraProfit,
      `Extra profit must be lower of equal to: ${this.PRECISION}`,
    );
    invariant(
      this.PRECISION > adjustmentStep,
      `Adjustment step must be lower of equal to: ${this.PRECISION}`,
    );
    invariant(
      maHalfTime > 1000 && this.MAX_MA_HALF_TIME >= maHalfTime,
      `Ma half time must be lower than: ${this.MAX_MA_HALF_TIME}`,
    );
    invariant(
      this.MAX_GAMMA > gamma && gamma >= this.MIN_GAMMA,
      `Gamma must be lower than ${this.MAX_GAMMA} and higher than ${this.MIN_GAMMA}`,
    );

    const supply = this.#treasuryIntoSupply(
      txb,
      typeArguments.slice(-1)[0],
      lpCoinTreasuryCap,
    );

    const [coinDecimals, cap] = await this.#handleCoinDecimals(
      txb,
      typeArguments,
    );

    const [pool, poolAdmin, lpCoin] = txb.moveCall({
      target: `${this.#package}::${this.#volatileModule}::${NEW_POOL_FUNCTION_NAME_MAP[typeArguments.length]}`,
      typeArguments,
      arguments: [
        txb.object(SUI_CLOCK_OBJECT_ID),
        coinDecimals,
        ...coins.map(x => this.#object(txb, x)),
        supply,
        txb.pure(listToString([a, gamma])),
        txb.pure(listToString([extraProfit, adjustmentStep, maHalfTime])),
        txb.pure(
          typeArguments.length === 3
            ? prices[0].toString()
            : listToString(prices),
        ),
        txb.pure(listToString([midFee, outFee, gammaFee])),
      ],
    });

    txb = this.#destroyCoinDecimalsAndCap(txb, coinDecimals, cap);

    return {
      pool,
      poolAdmin,
      lpCoin,
      txb,
    };
  }

  /**
   * @note Retrieves an {InterestPool} by its object id from Sui Network.
   *
   * @param {string} id - The ID of the pool object.
   * @returns A promise that resolves to an `InterestPool` object representing the retrieved pool.
   * @throws {Error} If the pool object ID is invalid.
   * @throws {Error} If the retrieved pool is not an Interest Protocol pool.
   * @throws {Error} If the state versioned ID is not found.
   * @throws {Error} If the pool state data is not found.
   */
  async getPool(id: string): Promise<InterestPool> {
    invariant(isValidSuiObjectId(id), 'Invalid pool object id');
    const pool = await this.#client.getObject({
      id,
      options: { showContent: true, showType: true },
    });

    const {
      stateVersionedId,
      poolAdminAddress,
      poolObjectId,
      isStable,
      coinTypes,
      poolType,
      hooks,
    } = parseInterestPool(pool);

    invariant(
      poolType.startsWith(this.#poolType),
      'It is not an Interest Protocol pool',
    );

    invariant(stateVersionedId, 'State Versioned id not found');

    const poolDynamicFields = await this.#client.getDynamicFields({
      parentId: stateVersionedId,
    });

    const stateId = poolDynamicFields.data[0].objectId;

    const poolState = await this.#client.getObject({
      id: stateId,
      options: { showContent: true, showType: true },
    });

    invariant(
      poolState.data &&
        poolState.data.content &&
        poolState.data.content.dataType === 'moveObject',
      'PoolState data not found',
    );

    if (isStable) {
      const { lpCoinType, state } = parseStableV1State(
        poolState.data.content.fields,
      );
      return {
        poolAdminAddress,
        poolObjectId,
        coinTypes,
        state,
        lpCoinType,
        isStable,
        hooks: hooks && !isEmpty(hooks) ? hooks : null,
      } as StablePool;
    }

    const { lpCoinType, state } = parseVolatileV1State(
      poolState.data.content.fields,
    );

    return {
      poolAdminAddress,
      poolObjectId,
      coinTypes,
      state,
      lpCoinType,
      isStable,
      hooks: hooks && !isEmpty(hooks) ? hooks : null,
    } as VolatilePool;
  }

  /**
   * @note Saves a pool with the specified object id in the server.
   *
   * @param {string} id - The ID of the pool to save.
   * @returns A boolean indicating whether the pool was saved successfully.
   */
  async savePool(id: string) {
    invariant(isValidSuiObjectId(id), 'Invalid pool object id');

    await this.#post('save-clamm-pool', {
      network: SuiCoinsNetwork.MAINNET,
      poolId: id,
    });

    return true;
  }

  /**
   * @note Adds liquidity to the pool.
   *
   * @param args - The args for adding liquidity.
   * @param {TransactionBlock} args.txb - The transaction block (optional).
   * @param {String | TransactionObjectArgument} args.pool - The pool object or pool ID.
   * @param {String[] | TransactionObjectArgument[]} args.coinsIn - The list of coins. These coins must have the value you wish to add and must be in the correct order.
   * @param {bigint[]} args.minAmount - The minimum amount for the liquidity (default: 0).
   * @param {number} args.slippage - The slippage tolerance in percentage (default: 2). 2 represents 2%.
   * @returns A promise that resolves to the transaction block and the LP coin.
   */
  async addLiquidity({
    txb = new TransactionBlock(),
    pool: _pool,
    coinsIn,
    minAmount = 0n,
    slippage = 2,
  }: AddLiquidityArgs): Promise<AddLiquidityReturn> {
    let pool = _pool;

    // lazy fetch
    if (typeof pool === 'string') {
      pool = await this.getPool(pool);
    }

    invariant(
      pool.coinTypes.length === coinsIn.length,
      `This pool has ${pool.coinTypes.length} coins, you only passed ${coinsIn.length}`,
    );

    const moduleName = pool.isStable
      ? this.#stableModule
      : this.#volatileModule;

    let min = undefined;

    if (minAmount) {
      min = txb.pure.u64(minAmount.toString());
    } else {
      const minAmounts = txb.moveCall({
        target: '0x1::vector::empty',
        typeArguments: [bcs.U64.name],
      });

      pool.coinTypes.forEach((coinType, index) => {
        const value = this.#coinValue(txb, coinsIn[index], coinType);
        txb.moveCall({
          target: '0x1::vector::push_back',
          typeArguments: [bcs.U64.name],
          arguments: [minAmounts, value],
        });
      });

      min = txb.moveCall({
        target: `${this.#package}::${moduleName}::quote_add_liquidity`,
        typeArguments: [pool.lpCoinType],
        arguments: [
          txb.object(pool.poolObjectId),
          txb.object(SUI_CLOCK_OBJECT_ID),
          minAmounts,
        ],
      });

      min = this.#deductSlippage(txb, min, slippage);
    }

    const lpCoin = txb.moveCall({
      target: `${this.#package}::${moduleName}::${ADD_LIQUIDITY_FUNCTION_NAME_MAP[pool.coinTypes.length]}`,
      typeArguments: [...pool.coinTypes, pool.lpCoinType],
      arguments: [
        txb.object(pool.poolObjectId),
        txb.object(SUI_CLOCK_OBJECT_ID),
        ...coinsIn.map(x => this.#object(txb, x)),
        min,
      ],
    });

    return {
      txb,
      lpCoin,
    };
  }

  /**
   * @note Removes liquidity from a pool.
   *
   * @param {RemoveLiquidityArgs} args - The args for removing liquidity.
   * @param {TransactionBlock} args.txb - The transaction block to use for the operation.
   * @param {string | Pool} args.pool - The pool to remove liquidity from. Can be either the pool ID or the pool object.
   * @param {string} args.lpCoin - The LP coin to remove (should be splitted before).
   * @param {string[]} args.minAmounts - The minimum amounts of each coin to receive after removing liquidity. You must
   * @param {number} args.slippage - The slippage tolerance percentage. 2 represents 2%.
   * @returns {Promise<RemoveLiquidityReturn>} A promise that resolves to the result of the remove liquidity operation.
   */
  async removeLiquidity({
    txb = new TransactionBlock(),
    pool: _pool,
    lpCoin,
    minAmounts: _minAmounts,
    slippage = 2,
  }: RemoveLiquidityArgs): Promise<RemoveLiquidityReturn> {
    let pool = _pool;
    const minAmounts = _minAmounts;

    // lazy fetch
    if (typeof pool === 'string') {
      pool = await this.getPool(pool);
    }

    const moduleName = pool.isStable
      ? this.#stableModule
      : this.#volatileModule;

    let min = undefined;

    if (minAmounts && minAmounts.length === pool.coinTypes.length) {
      min = txb.pure(listToString(minAmounts));
    } else {
      const value = this.#coinValue(txb, lpCoin, pool.lpCoinType);

      min = txb.moveCall({
        target: `${this.#package}::${moduleName}::quote_remove_liquidity`,
        typeArguments: [pool.lpCoinType],
        arguments: [txb.object(pool.poolObjectId), value],
      });
      min = this.#deductSlippageFromVector(txb, min, slippage);
    }

    const numOfCoins = pool.coinTypes.length;

    const args = pool.isStable
      ? [
          txb.object(pool.poolObjectId),
          txb.object(SUI_CLOCK_OBJECT_ID),
          this.#object(txb, lpCoin),
          min,
        ]
      : [txb.object(pool.poolObjectId), this.#object(txb, lpCoin), min];

    const result = txb.moveCall({
      target: `${this.#package}::${moduleName}::${REMOVE_LIQUIDITY_FUNCTION_NAME_MAP[numOfCoins]}`,
      typeArguments: [...pool.coinTypes, pool.lpCoinType],
      arguments: args,
    });

    return {
      txb,
      coinsOut: Array(numOfCoins)
        .fill(0)
        .map((_, index) => result[index]),
    };
  }

  /**
   * @note Swaps one type of coin for another in a pool.
   *
   * @param {SwapArgs} args - The swap args.
   * @param {TransactionBlock} args.txb - The transaction block to use for the swap.
   * @param {string | InterestPool} args.pool - The pool to perform the swap in. Can be either an {InterestPool} or the object id.
   * @param {string | TransactionObjectArgument} args.coinIn - The input coin to swap (should be splitted before).
   * @param {string} args.coinInType - The type of the input coin.
   * @param {string} args.coinOutType - The type of the output coin.
   * @param {bigint} [args.minAmount=0n] - The minimum amount of output coin to receive from the swap.
   * @param {number} [args.slippage=2] - The slippage percentage to apply to the minimum amount. 2 represents 2%.
   * @returns {Promise<SwapReturn>} A promise that resolves to the swap result, including the transaction block and the output coin.
   */
  async swap({
    txb = new TransactionBlock(),
    pool: _pool,
    coinIn,
    coinInType,
    coinOutType,
    minAmount = 0n,
    slippage = 2,
  }: SwapArgs): Promise<SwapReturn> {
    let pool = _pool;

    // lazy fetch
    if (typeof pool === 'string') {
      pool = await this.getPool(pool);
    }

    invariant(
      pool.coinTypes.includes(coinInType),
      'Pool does not support the coin in',
    );

    invariant(
      pool.coinTypes.includes(coinOutType),
      'Pool does not support the coin out',
    );

    const moduleName = pool.isStable
      ? this.#stableModule
      : this.#volatileModule;

    let min = undefined;
    if (minAmount) {
      min = txb.pure.u64(minAmount.toString());
    } else {
      [min] = txb.moveCall({
        target: `${this.#package}::${moduleName}::quote_swap`,
        typeArguments: [coinInType, coinOutType, pool.lpCoinType],
        arguments: [
          txb.object(pool.poolObjectId),
          txb.object(SUI_CLOCK_OBJECT_ID),
          this.#coinValue(txb, coinIn, coinInType),
        ],
      });
      min = this.#deductSlippage(txb, min, slippage);
    }

    const coinOut = txb.moveCall({
      target: `${this.#package}::${moduleName}::swap`,
      typeArguments: [coinInType, coinOutType, pool.lpCoinType],
      arguments: [
        txb.object(pool.poolObjectId),
        txb.object(SUI_CLOCK_OBJECT_ID),
        this.#object(txb, coinIn),
        min,
      ],
    });

    return {
      txb,
      coinOut,
    };
  }

  /**
   * @note Removes liquidity from a pool and receives only one type of coin.
   *
   * @param {RemoveLiquidityOneCoinArgs} args - The options for removing liquidity.
   * @param {TransactionBlock} args.txb - The transaction block to use for the operation.
   * @param {string | Pool} args.pool - The pool to remove liquidity from. Can be either the pool object id or {InterestPool}.
   * @param {string | TransactionObjectArgument} args.lpCoin - The LP coin to remove (should be splitted before).
   * @param {string} args.coinOutType - The type of the output coin.
   * @param {bigint} [options.minAmount=0n] - The minimum amount for the liquidity (default: 0).
   * @returns {Promise<RemoveLiquidityOneCoinReturn>} A promise that resolves to the result of the remove liquidity operation.
   */
  async removeLiquidityOneCoin({
    txb = new TransactionBlock(),
    pool: _pool,
    lpCoin,
    coinOutType,
    slippage = 2,
    minAmount = 0n,
  }: RemoveLiquidityOneCoinArgs): Promise<RemoveLiquidityOneCoinReturn> {
    let pool = _pool;

    // lazy fetch
    if (typeof pool === 'string') {
      pool = await this.getPool(pool);
    }

    invariant(
      pool.coinTypes.includes(coinOutType),
      'Pool does not support the coin out',
    );

    const moduleName = pool.isStable
      ? this.#stableModule
      : this.#volatileModule;

    let min = undefined;
    if (minAmount) {
      min = txb.pure.u64(minAmount.toString());
    } else {
      min = txb.moveCall({
        target: `${this.#package}::${moduleName}::quote_remove_liquidity_one_coin`,
        typeArguments: [coinOutType, pool.lpCoinType],
        arguments: [
          txb.object(pool.poolObjectId),
          txb.object(SUI_CLOCK_OBJECT_ID),
          this.#coinValue(txb, lpCoin, pool.lpCoinType),
        ],
      });

      min = this.#deductSlippage(txb, min, slippage);
    }

    const coinOut = txb.moveCall({
      target: `${this.#package}::${moduleName}::remove_liquidity_one_coin`,
      typeArguments: [coinOutType, pool.lpCoinType],
      arguments: [
        txb.object(pool.poolObjectId),
        txb.object(SUI_CLOCK_OBJECT_ID),
        this.#object(txb, lpCoin),
        min,
      ],
    });

    return {
      txb,
      coinOut,
    };
  }

  /**
   * @note Quotes a swap operation between two coins.
   *
   * @param {QuoteSwapArgs} args - The options for the quote swap.
   * @param {string | InterestPool} args.pool - The pool to perform the swap on. Can be either the pool object id or {InterestPool}.
   * @param {string} args.coinInType - The type of the input coin.
   * @param {string} args.coinOutType - The type of the output coin.
   * @param {bigint} args.amount - The amount of the input coin to swap (splitted amount).
   * @returns {Promise<QuoteSwapReturn>} A promise that resolves to the result of the quote swap operation.
   */
  async quoteSwap({
    pool: _pool,
    coinInType,
    coinOutType,
    amount,
  }: QuoteSwapArgs): Promise<QuoteSwapReturn> {
    let pool = _pool;

    // lazy fetch
    if (typeof pool === 'string') {
      pool = await this.getPool(pool);
    }

    invariant(
      pool.coinTypes.includes(coinInType),
      'Pool does not support the coin in',
    );

    invariant(
      pool.coinTypes.includes(coinOutType),
      'Pool does not support the coin out',
    );

    if (!amount)
      return pool.isStable
        ? { amount: 0n, feeIn: 0n, feeOut: 0n }
        : { amount: 0n, fee: 0n };

    const txb = new TransactionBlock();

    const moduleName = pool.isStable
      ? this.#stableModule
      : this.#volatileModule;

    txb.moveCall({
      target: `${this.#package}::${moduleName}::quote_swap`,
      typeArguments: [coinInType, coinOutType, pool.lpCoinType],
      arguments: [
        txb.object(pool.poolObjectId),
        txb.object(SUI_CLOCK_OBJECT_ID),
        txb.pure.u64(amount.toString()),
      ],
    });

    const [result] = await devInspectAndGetReturnValues(this.#client, txb);

    invariant(result.length, 'Result is empty');
    invariant(typeof result[0] === 'string', 'Value is not a string');
    invariant(typeof result[1] === 'string', 'Value is not a string');

    if (!pool.isStable)
      invariant(result.length === 2, 'Failed to get volatile quote values');

    if (pool.isStable) {
      invariant(result.length === 3, 'Failed to get stable quote values');
      invariant(typeof result[2] === 'string', 'Value is not a string');
    }

    return pool.isStable
      ? {
          amount: BigInt(result[0]),
          feeIn: BigInt(result[1]),
          feeOut: BigInt(result[2] as string),
        }
      : {
          amount: BigInt(result[0]),
          fee: BigInt(result[1]),
        };
  }

  /**
   * @note Quotes adding liquidity to a pool.
   *
   * @param {Object} args - The options for quoting the number of LpCoins one will receive after adding liquidity.
   * @param {string | InterestPool} args.pool - The pool object id or {InterestPool}.
   * @param {bigint[]} args.amounts - The amounts of coins to add liquidity. It must follow the same order as the `pool.coinTypes`.
   * @returns {Promise<bigint>} - The result of adding liquidity as a bigint.
   */
  async quoteAddLiquidity({
    pool: _pool,
    amounts,
  }: QuoteAddLiquidityArgs): Promise<bigint> {
    if (!amounts.length) return 0n;

    let pool = _pool;

    // lazy fetch
    if (typeof pool === 'string') {
      pool = await this.getPool(pool);
    }

    const txb = new TransactionBlock();

    const moduleName = pool.isStable
      ? this.#stableModule
      : this.#volatileModule;

    txb.moveCall({
      target: `${this.#package}::${moduleName}::quote_add_liquidity`,
      typeArguments: [pool.lpCoinType],
      arguments: [
        txb.object(pool.poolObjectId),
        txb.object(SUI_CLOCK_OBJECT_ID),
        txb.pure(listToString(amounts)),
      ],
    });

    const [result] = await devInspectAndGetReturnValues(this.#client, txb);

    invariant(result.length, 'Result is empty');
    invariant(typeof result[0] === 'string', 'Invalid return type');

    return BigInt(result[0]);
  }

  /**
   * @note Quotes removing liquidity from a pool.
   *
   * @param {QuoteRemoveLiquidityArgs} args - The options to quote the number of coins to receive for burning `args.amount` of LpCoin.
   * @param {string | InterestPool} args.pool - The pool object id or {InterestPool}.
   * @param {bigint} args.amount - The amount of LpCoin to burn.
   * @returns {Promise<bigint[]>} - The result of removing liquidity as an array of bigints. It follows the same order as `pool.coinTypes`.
   */
  async quoteRemoveLiquidity({
    pool: _pool,
    amount,
  }: QuoteRemoveLiquidityArgs): Promise<readonly bigint[]> {
    let pool = _pool;

    // lazy fetch
    if (typeof pool === 'string') {
      pool = await this.getPool(pool);
    }

    if (!amount) return pool.coinTypes.map(() => 0n);

    const txb = new TransactionBlock();

    const moduleName = pool.isStable
      ? this.#stableModule
      : this.#volatileModule;

    txb.moveCall({
      target: `${this.#package}::${moduleName}::quote_remove_liquidity`,
      typeArguments: [pool.lpCoinType],
      arguments: [
        txb.object(pool.poolObjectId),
        txb.pure.u64(amount.toString()),
      ],
    });

    const [result] = await devInspectAndGetReturnValues(this.#client, txb);

    invariant(result.length, 'Result is empty');
    invariant(Array.isArray(result[0]), 'Value is not an array');

    return result[0].map(x => BigInt(x));
  }

  /**
   * @note Quotes removing liquidity from a pool and receiving only one type of coin.
   *
   * @param {QuoteRemoveLiquidityOneCoiArgs} args - The options for removing liquidity.
   * @param {string | InterestPool} args.pool - The pool object id or {InterestPool}.
   * @param {string} args.coinOutType - The type of the output coin.
   * @param {bigint} args.amount - The amount of LpCoin to burn.
   * @returns {Promise<bigint>} - The result of removing liquidity as a bigint.
   */
  async quoteRemoveLiquidityOneCoin({
    pool: _pool,
    coinOutType,
    amount,
  }: QuoteRemoveLiquidityOneCoiArgs): Promise<bigint> {
    if (!amount) return 0n;

    let pool = _pool;

    // lazy fetch
    if (typeof pool === 'string') {
      pool = await this.getPool(pool);
    }

    invariant(
      pool.coinTypes.includes(coinOutType),
      'The pool does not support this coin out type',
    );

    const txb = new TransactionBlock();

    const moduleName = pool.isStable
      ? this.#stableModule
      : this.#volatileModule;

    txb.moveCall({
      target: `${this.#package}::${moduleName}::quote_remove_liquidity_one_coin`,
      typeArguments: [coinOutType, pool.lpCoinType],
      arguments: [
        txb.object(pool.poolObjectId),
        txb.object(SUI_CLOCK_OBJECT_ID),
        txb.pure.u64(amount.toString()),
      ],
    });

    const [result] = await devInspectAndGetReturnValues(this.#client, txb);

    invariant(result.length, 'Result is empty');
    invariant(typeof result[0] === 'string', 'Invalid value');

    return BigInt(result[0]);
  }

  async getStablePoolVirtualPrice(id: string | InterestPool) {
    const txb = new TransactionBlock();

    let pool = id;

    // lazy fetch
    if (typeof pool === 'string') {
      pool = await this.getPool(pool);
    }

    txb.moveCall({
      target: `${this.#package}::${this.#stableModule}::virtual_price`,
      typeArguments: [pool.lpCoinType],
      arguments: [
        txb.object(pool.poolObjectId),
        txb.object(SUI_CLOCK_OBJECT_ID),
      ],
    });

    const [result] = await devInspectAndGetReturnValues(this.#client, txb);

    invariant(result.length, 'Result is empty');
    invariant(typeof result[0] === 'string', 'Invalid value');

    return BigInt(result[0]);
  }

  /**
   * @note Merges all coins into one and then splits into a new coin with `value`. It will destroy the first coin if it has a value of zero.
   *
   * @param {HandleCoinVectorArgs} args - The options for handling a vector of coins.
   * @param {string[] | TransactionObjectArgument[]} options.coins - The coin objects to merge and split.
   * @param {string} options.coinType - The type of the `args.coins`.
   * @param {bigint} options.amount - The split amount of the new coin created.
   * @returns {Promise<bigint>} - The result of merging and then splitting a coin.
   */
  handleCoinVector({
    txb = new TransactionBlock(),
    coins,
    coinType,
    value,
  }: HandleCoinVectorArgs): HandleCoinVectorReturn {
    const pkg = PACKAGES[this.#network];

    invariant(pkg, 'utils package not found');

    const result = txb.moveCall({
      target: `${pkg.UTILS}::utils::handle_coin_vector`,
      typeArguments: [coinType],
      arguments: [
        txb.makeMoveVec({
          objects: coins.map(x => this.#object(txb, x)),
        }),
        txb.pure.u64(value),
      ],
    });

    return {
      txb,
      coin: result,
    };
  }

  async #handleCoinDecimals(txb: TransactionBlock, typeArguments: string[]) {
    const cap = txb.moveCall({
      target: `${this.#suiTears}::coin_decimals::new_cap`,
    });

    const coinDecimals = txb.moveCall({
      target: `${this.#suiTears}::coin_decimals::new`,
      arguments: [cap],
    });

    if (this.#network === 'mainnet') {
      const metadataMap = await getCoinMetas(this.#client, typeArguments);

      typeArguments.forEach((coinType, index) => {
        const metadata = metadataMap.get(coinType);
        invariant(metadata, 'Coin must have a metadata');
        invariant(metadata.id, 'Metadata does not have an id');

        txb.moveCall({
          target: `${this.#suiTears}::coin_decimals::add`,
          typeArguments: [typeArguments[index]],
          arguments: [coinDecimals, txb.object(metadata.id)],
        });
      });
    } else {
      const promises = typeArguments.map(coinType =>
        this.#client.getCoinMetadata({ coinType }),
      );

      const metadatas = await Promise.all(promises);

      metadatas.forEach((metadata, index) => {
        invariant(metadata, 'Coin must have a metadata');
        invariant(metadata.id, 'Metadata does not have an id');

        txb.moveCall({
          target: `${this.#suiTears}::coin_decimals::add`,
          typeArguments: [typeArguments[index]],
          arguments: [coinDecimals, txb.object(metadata.id)],
        });
      });
    }

    return [coinDecimals, cap];
  }

  #treasuryIntoSupply(
    txb: TransactionBlock,
    type: string,
    lpCoinTreasuryCap: string | TransactionObjectArgument,
  ) {
    return txb.moveCall({
      target: '0x2::coin::treasury_into_supply',
      typeArguments: [type],
      arguments: [this.#object(txb, lpCoinTreasuryCap)],
    });
  }

  #destroyCoinDecimalsAndCap(
    txb: TransactionBlock,
    coinDecimals: TransactionObjectArgument,
    cap: TransactionObjectArgument,
  ) {
    txb.moveCall({
      target: `${this.#suiTears}::coin_decimals::destroy`,
      arguments: [coinDecimals, cap],
    });

    txb.moveCall({
      target: `${this.#suiTears}::owner::destroy`,
      typeArguments: [`${this.#suiTears}::coin_decimals::CoinDecimalsWitness`],
      arguments: [cap],
    });

    return txb;
  }

  #coinValue(
    txb: TransactionBlock,
    coinIn: string | TransactionObjectArgument,
    coinType: string,
  ) {
    return txb.moveCall({
      target: '0x2::coin::value',
      typeArguments: [coinType],
      arguments: [this.#object(txb, coinIn)],
    });
  }

  async #fetch<T>(api: string) {
    invariant(
      this.#network === 'mainnet',
      'This endpoint only supports mainnet',
    );
    invariant(
      this.#package === this.#mainnetClammAddress,
      `The endpoint only supports the following package: ${this.#mainnetClammAddress}`,
    );

    const response = await fetch(`${this.#END_POINT}${api}`, {
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return (await response.json()) as T;
  }

  async #post<T>(api: string, body: unknown) {
    invariant(
      this.#network === 'mainnet',
      'This endpoint only supports mainnet',
    );
    invariant(
      this.#package === this.#mainnetClammAddress,
      `The endpoint only supports the following package: ${this.#mainnetClammAddress}`,
    );

    const response = await fetch(`${this.#END_POINT}${api}`, {
      mode: 'cors',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    return (await response.json()) as T;
  }

  #deductSlippage(
    txb: TransactionBlock,
    amount: any,
    slippage: number,
  ): TransactionResult {
    invariant(
      slippage >= 0 && 100 >= slippage,
      'Slippage must be in between 0 and 100 inclusive',
    );
    invariant(!isNaN(slippage), 'Slippage must be a number');

    const pkg = PACKAGES[this.#network];

    invariant(pkg, 'utils package not found');

    return txb.moveCall({
      target: `${pkg.UTILS}::utils::deduct_slippage`,
      arguments: [amount, txb.pure.u64(slippage)],
    });
  }

  #deductSlippageFromVector(
    txb: TransactionBlock,
    amounts: any,
    slippage: number,
  ): TransactionResult {
    invariant(
      slippage >= 0 && 100 >= slippage,
      'Slippage must be in between 0 and 100 inclusive',
    );
    invariant(!isNaN(slippage), 'Slippage must be a number');

    const pkg = PACKAGES[this.#network];

    invariant(pkg, 'utils package not found');

    return txb.moveCall({
      target: `${pkg.UTILS}::utils::deduct_slippage_from_vector`,
      arguments: [amounts, txb.pure.u64(slippage)],
    });
  }

  #object(txb: TransactionBlock, id: string | TransactionObjectArgument) {
    return typeof id === 'string' ? txb.object(id) : id;
  }
}
