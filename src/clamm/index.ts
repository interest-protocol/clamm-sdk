import { bcs } from '@mysten/sui.js/bcs';
import { MoveStruct, SuiClient } from '@mysten/sui.js/client';
import {
  TransactionBlock,
  TransactionObjectArgument,
} from '@mysten/sui.js/transactions';
import { isValidSuiObjectId, SUI_CLOCK_OBJECT_ID } from '@mysten/sui.js/utils';
import { pathOr } from 'ramda';
import invariant from 'tiny-invariant';

import {
  AddLiquidityArgs,
  AddLiquidityReturn,
  ClammConstructor,
  InterestPool,
  NewPoolReturn,
  NewStableArgs,
  NewVolatileArgs,
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
  VolatilePool,
  QueryPoolsArgs,
  QueryPoolsReturn,
  PoolMetadata,
} from './clamm.types';
import {
  ADD_LIQUIDITY_FUNCTION_NAME_MAP,
  NEW_POOL_FUNCTION_NAME_MAP,
  REMOVE_LIQUIDITY_FUNCTION_NAME_MAP,
} from './constants';
import {
  devInspectAndGetReturnValues,
  getCoinMetas,
  listToString,
  normalizeSuiCoinType,
  parseStableV1State,
  parseVolatileV1State,
} from './utils';

// Added this line to get all types into one file
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
  #END_POINT = 'https://www.suicoins.com/api/';
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

  constructor({
    packageAddress,
    suiClient,
    suiTearsAddress,
    network,
  }: ClammConstructor) {
    this.#client = suiClient;
    this.#package = packageAddress;
    this.#suiTears = suiTearsAddress;
    this.stableType = `${packageAddress}::curves::Stable`;
    this.volatileType = `${packageAddress}::curves::Volatile`;
    this.#network = network;
  }

  async getPools(args?: QueryPoolsArgs): Promise<QueryPoolsReturn> {
    let { page = 1, pageSize = 50, coinTypes = [] } = args ? args : {};

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

    return this.#fetch<QueryPoolsReturn>(
      `get-all-clamm-pools?page=${safePage}&limit=${pageSize}`,
    );
  }

  shareStablePool({ txb, pool }: SharePoolArgs) {
    txb.moveCall({
      target: `${this.#package}::${this.#poolModule}::share`,
      typeArguments: [this.stableType],
      arguments: [pool],
    });
    return txb;
  }

  shareVolatilePool({ txb, pool }: SharePoolArgs) {
    txb.moveCall({
      target: `${this.#package}::${this.#poolModule}::share`,
      typeArguments: [this.volatileType],
      arguments: [pool],
    });
    return txb;
  }

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
      this.MAX_FEE > midFee,
      `Mid Fee must be lower than: ${this.MAX_FEE}`,
    );
    invariant(
      this.MAX_FEE > outFee,
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

  async getPool(id: string): Promise<InterestPool> {
    invariant(isValidSuiObjectId(id), 'Invalid pool object id');
    const pool = await this.#client.getObject({
      id,
      options: { showContent: true, showType: true },
    });

    invariant(
      pool.data && pool.data.type && pool.data.content,
      'Pool not found',
    );

    const poolObjectId = pool.data.objectId;
    const isStable = pool.data.type.includes('curves::Stable');
    const coinTypes = pathOr(
      [] as MoveStruct[],
      ['fields', 'coins', 'fields', 'contents'],
      pool.data.content,
    ).map(x => normalizeSuiCoinType(pathOr('', ['fields', 'name'], x)));
    const stateVersionedId = pathOr(
      '',
      ['fields', 'state', 'fields', 'id', 'id'],
      pool.data.content,
    );
    const poolAdminAddress = pathOr(
      '',
      ['fields', 'pool_admin_address'],
      pool.data.content,
    );

    invariant(stateVersionedId, 'State Versioned id not found');

    const poolDyanmicFields = await this.#client.getDynamicFields({
      parentId: stateVersionedId,
    });

    const stateId = poolDyanmicFields.data[0].objectId;

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
        stateId,
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
      stateId,
    } as VolatilePool;
  }

  async addLiquidity({
    txb = new TransactionBlock(),
    pool: _pool,
    coinsIn,
    minAmount = 0n,
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

  async removeLiquidity({
    txb = new TransactionBlock(),
    pool: _pool,
    lpCoin,
    minAmounts: _minAmounts,
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

  async swap({
    txb = new TransactionBlock(),
    pool: _pool,
    coinIn,
    coinInType,
    coinOutType,
    minAmount = 0n,
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

  async removeLiquidityOneCoin({
    txb = new TransactionBlock(),
    pool: _pool,
    lpCoin,
    coinOutType,
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
    const response = await fetch(`${this.#END_POINT}${api}`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return (await response.json()) as T;
  }

  #object(txb: TransactionBlock, id: string | TransactionObjectArgument) {
    return typeof id === 'string' ? txb.object(id) : id;
  }
}
