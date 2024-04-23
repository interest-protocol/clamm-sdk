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
} from './clamm.types';
import { SUI_CLOCK_OBJECT_ID } from '@mysten/sui.js/utils';

const FUNCTION_NAME_MAP = {
  3: ' new_2_pool',
  4: ' new_3_pool',
  5: ' new_4_pool',
  6: ' new_5_pool',
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
  }

  shareVolatilePool({ txb, pool }: SharePoolArgs) {
    txb.moveCall({
      target: `${this.#package}::${this.#poolModule}::share`,
      typeArguments: [this.volatileType],
      arguments: [pool],
    });
  }

  async newStable({
    txb: _txb,
    a: _a,
    lpCoinTreasuryCap,
    coins,
    typeArguments,
  }: ClammNewStableArgs): Promise<ClammNewPoolReturn> {
    invariant(
      typeArguments.length === coins.length + 1 && typeArguments.length != 0,
      'Type arguments and coin mismatch',
    );
    const txb = _txb ? _txb : new TransactionBlock();
    const a = _a ? _a : this.#stableA;

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
      target: `${this.#package}::${this.#stableModule}::${FUNCTION_NAME_MAP[typeArguments.length]}`,
      typeArguments,
      arguments: [
        txb.object(SUI_CLOCK_OBJECT_ID),
        coinDecimals,
        ...coins.map(x => this.#object(txb, x)),
        supply,
        txb.pure(a),
      ],
    });

    txb.moveCall({
      target: `${this.#suiTears}::coin_decimals::destroy`,
      arguments: [coinDecimals, cap],
    });

    txb.moveCall({
      target: `${this.#suiTears}::owner::destroy`,
      typeArguments: [`${this.#suiTears}::coin_decimals::CoinDecimalsWitness`],
      arguments: [cap],
    });

    return {
      pool,
      poolAdmin,
      lpCoin,
    };
  }

  // #VolatileA = 400000n;
  // #Gamme = 145000000000000n;
  // #extraProfit = 2000000000000n;
  // #adjustmentStep = 146000000000000n;
  // #maHalfTime = 600_000n; // 10 minutes
  // #midFee = 26000000n;
  // #outFee = 45000000n;
  // #gammaFee = 230000000000000n;

  async newVolatile({
    txb,
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
  }: ClammNewVolatileArgs): Promise<ClammNewPoolReturn> {
    const a = _a ? _a : this.#volatileA;
    const gamma = _gamma ? _gamma : this.#gamma;
    const extraProfit = _extraProfit ? _extraProfit : this.#extraProfit;
    const adjustmentStep = _adjustmentStep
      ? _adjustmentStep
      : this.#adjustmentStep;
    const outFee = _outFee ? _outFee : this.#outFee;
    const midFee = _midFee ? _midFee : this.#midFee;
    const gammaFee = _gammaFee ? _gammaFee : this.#gammaFee;

    // TODO
    throw new Error('');
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

    typeArguments.forEach(async coinType => {
      const metadata = await this.#client.getCoinMetadata({ coinType });

      invariant(metadata, 'Coin must have a metadata');
      invariant(metadata.id, 'Metadata does not have an id');

      return txb.moveCall({
        target: `${this.#suiTears}::coin_decimals::add`,
        typeArguments: [coinType],
        arguments: [coinDecimals, txb.object(metadata.id)],
      });
    });

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

  #object(txb: TransactionBlock, id: string | TransactionObjectArgument) {
    return typeof id === 'string' ? txb.object(id) : id;
  }
}
