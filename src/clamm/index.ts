import {
  TransactionBlock,
  TransactionObjectArgument,
} from '@mysten/sui.js/transactions';
import invariant from 'tiny-invariant';
import { CoinMetadata, SuiClient } from '@mysten/sui.js/client';
import {
  ClammNewStableArgs,
  ClammNewPoolReturn,
  ClammNewVolatileArgs,
  SharePoolArgs,
} from './clamm.types';
import { SUI_CLOCK_OBJECT_ID } from '@mysten/sui.js/utils';

const NEW_POOL_FUNCTION_NAME_MAP = {
  3: 'new_2_pool',
  4: 'new_3_pool',
  5: 'new_4_pool',
  6: 'new_5_pool',
} as Record<number, string>;

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

    const promises: Promise<CoinMetadata | null>[] = [];

    typeArguments.forEach(async coinType => {
      promises.push(this.#client.getCoinMetadata({ coinType }));
    });

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