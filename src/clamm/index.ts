import {
  TransactionBlock,
  TransactionObjectArgument,
} from '@mysten/sui.js/transactions';
import invariant from 'tiny-invariant';
import { SuiClient } from '@mysten/sui.js/client';
import {
  ClammNewStableArgs,
  ClammNewPoolReturn,
  ClammNewVolatileArgs,
  SharePoolArgs,
  AddLiquidityArgs,
  Pool,
  StablePool,
  VolatilePool,
  AddLiquidityReturn,
} from './clamm.types';
import { SUI_CLOCK_OBJECT_ID, isValidSuiObjectId } from '@mysten/sui.js/utils';
import {
  NEW_POOL_FUNCTION_NAME_MAP,
  ADD_LIQUIDITY_FUNCTION_NAME_MAP,
} from './constants';
import {
  getCoinMetas,
  parseStableV1State,
  parseVolatileV1State,
  createCoinStateMap,
  normalizeSuiCoinType,
} from './utils';
import { pathOr } from 'ramda';
import { MoveStruct } from '@mysten/sui.js/client';

export class CLAMM {
  #client: SuiClient;
  #package: string;
  #suiTears: string;
  #poolModule = 'interest_pool' as const;
  #volatileModule = 'interest_clamm_volatile' as const;
  #stableModule = 'interest_clamm_stable' as const;
  #coinDecimal: string | null;
  #stableA = 1500n;
  #volatileA = 400000n;
  #gamma = 145000000000000n;
  #extraProfit = 2000000000000n;
  #adjustmentStep = 146000000000000n;
  #maHalfTime = 600_000n; // 10 minutes
  #midFee = 26000000n;
  #outFee = 45000000n;
  #gammaFee = 230000000000000n;
  stableType: string;
  volatileType: string;

  constructor(
    suiClient: SuiClient,
    packageAddress: string,
    suiTearsAddress: string,
    coinDecimalAddress: string | null | undefined = null,
  ) {
    this.#client = suiClient;
    this.#package = packageAddress;
    this.#suiTears = suiTearsAddress;
    this.#coinDecimal = coinDecimalAddress;
    this.stableType = `${packageAddress}::curves::Stable`;
    this.volatileType = `${packageAddress}::curves::Volatile`;
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
    txb: _txb,
    a: _a,
    lpCoinTreasuryCap,
    coins,
    typeArguments,
  }: ClammNewStableArgs): Promise<ClammNewPoolReturn> {
    invariant(
      typeArguments.length === coins.length + 1 && typeArguments.length >= 3,
      'Type arguments and coin mismatch',
    );
    let txb = this.#valueOrDefault(_txb, new TransactionBlock());
    const a = this.#valueOrDefault(_a, this.#stableA);

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
        txb.pure(a),
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
    txb: _txb,
    coins,
    typeArguments,
    lpCoinTreasuryCap,
    a: _a,
    gamma: _gamma,
    extraProfit: _extraProfit,
    adjustmentStep: _adjustmentStep,
    maHalfTime: _maHalfTime,
    midFee: _midFee,
    outFee: _outFee,
    gammaFee: _gammaFee,
    prices,
  }: ClammNewVolatileArgs): Promise<ClammNewPoolReturn> {
    invariant(
      typeArguments.length === coins.length + 1 && typeArguments.length >= 3,
      'Type arguments and coin mismatch',
    );
    invariant(prices.length > 0, 'You must provide prices');

    let txb = this.#valueOrDefault(_txb, new TransactionBlock());
    const a = this.#valueOrDefault(_a, this.#volatileA);
    const gamma = this.#valueOrDefault(_gamma, this.#gamma);
    const extraProfit = this.#valueOrDefault(_extraProfit, this.#extraProfit);
    const adjustmentStep = this.#valueOrDefault(
      _adjustmentStep,
      this.#adjustmentStep,
    );
    const outFee = this.#valueOrDefault(_outFee, this.#outFee);
    const midFee = this.#valueOrDefault(_midFee, this.#midFee);
    const gammaFee = this.#valueOrDefault(_gammaFee, this.#gammaFee);
    const maHalfTime = this.#valueOrDefault(_maHalfTime, this.#maHalfTime);

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
        txb.pure([a, gamma]),
        txb.pure([extraProfit, adjustmentStep, maHalfTime]),
        txb.pure(typeArguments.length === 3 ? prices[0] : prices),
        txb.pure([midFee, outFee, gammaFee]),
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

  async getPool(id: string): Promise<Pool> {
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

    const { lpCoinType, state, coinStatesId } = parseVolatileV1State(
      poolState.data.content.fields,
    );

    const coinStatesFields = await this.#client.getDynamicFields({
      parentId: coinStatesId,
    });

    const coinStates = await this.#client.multiGetObjects({
      ids: coinStatesFields.data.map(x => x.objectId),
      options: {
        showContent: true,
      },
    });

    return {
      poolAdminAddress,
      poolObjectId,
      coinTypes,
      state: {
        ...state,
        coinStateMap: createCoinStateMap(coinStates),
      },
      lpCoinType,
      isStable,
      stateId,
    } as VolatilePool;
  }

  async addLiquidity({
    txb: _txb,
    pool: _pool,
    poolObjectId,
    coinsIn,
    minAmount: _minAmount,
  }: AddLiquidityArgs): Promise<AddLiquidityReturn> {
    let pool = _pool;

    if (!pool && !poolObjectId)
      invariant(false, 'Must give either pool or pool object id');

    // lazy fetch
    if (!pool) {
      pool = await this.getPool(poolObjectId!);
    }

    let txb = this.#valueOrDefault(_txb, new TransactionBlock());
    const minAmount = this.#valueOrDefault(_minAmount, 0n);

    const moduleName =
      !pool.isStable && 'gamma' in pool.state
        ? this.#volatileModule
        : this.#stableModule;

    const lpCoin = txb.moveCall({
      target: `${this.#package}::${moduleName}::${ADD_LIQUIDITY_FUNCTION_NAME_MAP[pool.coinTypes.length]}`,
      typeArguments: [...pool.coinTypes, pool.lpCoinType],
      arguments: [
        txb.object(pool.poolObjectId),
        txb.object(SUI_CLOCK_OBJECT_ID),
        ...coinsIn.map(x => this.#object(txb, x)),
        txb.pure(minAmount),
      ],
    });

    return {
      txb,
      lpCoin,
    };
  }

  async #handleCoinDecimals(txb: TransactionBlock, typeArguments: string[]) {
    const cap = txb.moveCall({
      target: `${this.#suiTears}::coin_decimals::new_cap`,
    });

    const coinDecimals = this.#coinDecimal
      ? txb.object(this.#coinDecimal)
      : txb.moveCall({
          target: `${this.#suiTears}::coin_decimals::new`,
          arguments: [cap],
        });

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

    return [coinDecimals, cap];
  }

  #valueOrDefault<T>(x: T | null | undefined, y: T) {
    return x ? x : y;
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

  #object(txb: TransactionBlock, id: string | TransactionObjectArgument) {
    return typeof id === 'string' ? txb.object(id) : id;
  }
}
