import {
  TransactionArgument,
  TransactionBlock,
  TransactionObjectArgument,
  TransactionResult,
} from '@mysten/sui.js/transactions';

import { CoinMetadata } from '@mysten/sui.js/client';

interface MaybeTxb {
  txb?: TransactionBlock;
}

export type CoinMeta = CoinMetadata & {
  type: string;
};

export type MoveObjectArgument = string | TransactionObjectArgument;

export type TransactionNestedResult = Extract<
  TransactionArgument,
  { index: number; resultIndex: number; kind: 'NestedResult' }
>;

export interface ClammNewStableArgs extends MaybeTxb {
  typeArguments: string[];
  coins: MoveObjectArgument[];
  lpCoinTreasuryCap: MoveObjectArgument;
  a?: bigint;
}

export interface ClammNewVolatileArgs extends MaybeTxb {
  typeArguments: string[];
  coins: MoveObjectArgument[];
  lpCoinTreasuryCap: MoveObjectArgument;
  a?: bigint;
  gamma?: bigint;
  extraProfit?: bigint;
  adjustmentStep?: bigint;
  maHalfTime?: bigint;
  midFee?: bigint;
  outFee?: bigint;
  gammaFee?: bigint;
  prices: bigint[];
}

export interface SharePoolArgs {
  txb: TransactionBlock;
  pool: TransactionNestedResult;
}

export interface ClammNewPoolReturn {
  txb: TransactionBlock;
  pool: TransactionNestedResult;
  poolAdmin: TransactionNestedResult;
  lpCoin: TransactionNestedResult;
}

export interface AddLiquidityArgs extends MaybeTxb {
  pool?: Pool;
  poolObjectId?: string;
  minAmount?: bigint;
  coinsIn: MoveObjectArgument[];
}

export interface AddLiquidityReturn {
  txb: TransactionBlock;
  lpCoin: TransactionResult;
}

export interface SwapArgs extends MaybeTxb {
  coinInType: string;
  coinOutType: string;
  coinIn: MoveObjectArgument;
  minAmount?: bigint;
}

interface InterestPool<T> {
  poolObjectId: string;
  stateId: string;
  lpCoinType: string;
  isStable: boolean;
  coinTypes: readonly string[];
  poolAdminAddress: string;
  state: T;
}

export interface StableFees {
  feeInPercent: bigint;
  feeOutPercent: bigint;
  adminFeePercent: bigint;
}

export interface RebalancingParams {
  adjustmentStep: bigint;
  extraProfit: bigint;
  maHalfTime: bigint;
}

export interface VolatileFees {
  adminFee: bigint;
  gammaFee: bigint;
  midFee: bigint;
  outFee: bigint;
}

export interface StablePoolState {
  lpCoinSupply: bigint;
  lpCoinDecimals: number;
  balances: readonly bigint[];
  initialA: bigint;
  futureA: bigint;
  initialATime: bigint;
  futureATime: bigint;
  nCoins: number;
  fees: StableFees;
}

export interface CoinState {
  index: number;
  lastPrice: bigint;
  price: bigint;
  priceOracle: bigint;
  type: string;
}

export interface VolatilePoolState {
  a: bigint;
  futureA: bigint;
  gamma: bigint;
  initialTime: bigint;
  futureGamma: bigint;
  futureTime: bigint;
  adminBalance: bigint;
  balances: readonly bigint[];
  d: bigint;
  fees: VolatileFees;
  lastPriceTimestamp: bigint;
  lpCoinSupply: bigint;
  maxA: bigint;
  minA: bigint;
  nCoins: number;
  rebalancingParams: RebalancingParams;
  virtualPrice: bigint;
  xcpProfit: bigint;
  xcpProfitA: bigint;
  notAdjusted: boolean;
  coinStateMap: Record<string, CoinState>;
}

export type StablePool = InterestPool<StablePoolState>;
export type VolatilePool = InterestPool<VolatilePoolState>;
export type Pool = StablePool | VolatilePool;
