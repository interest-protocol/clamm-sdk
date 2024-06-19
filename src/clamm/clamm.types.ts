import { CoinMetadata, SuiClient } from '@mysten/sui/client';
import {
  Transaction,
  TransactionResult,
  TransactionArgument,
} from '@mysten/sui/transactions';

import { CoinPath, PoolObjectIdPath } from './router/router.types.ts';

interface MaybeTxb {
  tx?: Transaction;
}

interface MaybeSlippage {
  slippage?: number;
}

export interface ClammConstructor {
  suiClient: SuiClient;
  network: 'testnet' | 'mainnet' | 'devnet';
}

export type CoinMeta = CoinMetadata & {
  type: string;
};

export type MoveObjectArgument = string | TransactionArgument;

export type TransactionNestedResult = {
  NestedResult: [number, number];
  $kind: 'NestedResult';
};

export interface NewStableArgs extends MaybeTxb {
  typeArguments: string[];
  coins: MoveObjectArgument[];
  lpCoinTreasuryCap: MoveObjectArgument;
  a?: bigint;
}

export interface NewVolatileArgs extends MaybeTxb {
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
  tx: Transaction;
  pool: TransactionArgument;
}

export interface NewPoolReturn {
  tx: Transaction;
  pool: TransactionNestedResult;
  poolAdmin: TransactionNestedResult;
  lpCoin: TransactionNestedResult;
}

export interface AddLiquidityArgs extends MaybeTxb, MaybeSlippage {
  pool: InterestPool | string;
  minAmount?: bigint;
  coinsIn: MoveObjectArgument[];
}

export interface AddLiquidityReturn {
  tx: Transaction;
  lpCoin: TransactionResult;
}

export interface RemoveLiquidityArgs extends MaybeTxb, MaybeSlippage {
  pool: InterestPool | string;
  minAmounts?: readonly bigint[];
  lpCoin: MoveObjectArgument;
}

export interface RemoveLiquidityReturn extends MaybeTxb {
  tx: Transaction;
  coinsOut: TransactionNestedResult[];
}

export interface SwapArgs extends MaybeTxb, MaybeSlippage {
  pool: InterestPool | string;
  coinInType: string;
  coinOutType: string;
  coinIn: MoveObjectArgument;
  minAmount?: bigint;
}

export interface SwapReturn {
  tx: Transaction;
  coinOut: TransactionResult;
}

export interface RemoveLiquidityOneCoinArgs extends MaybeTxb, MaybeSlippage {
  pool: InterestPool | string;
  coinOutType: string;
  lpCoin: MoveObjectArgument;
  minAmount?: bigint;
}

export interface RemoveLiquidityOneCoinReturn {
  tx: Transaction;
  coinOut: TransactionResult;
}

export interface QuoteSwapArgs {
  pool: InterestPool | string;
  coinInType: string;
  coinOutType: string;
  amount: bigint;
}

export interface QuoteSwapVolatileReturn {
  amount: bigint;
  fee: bigint;
}

export interface QuoteSwapStableReturn {
  amount: bigint;
  feeIn: bigint;
  feeOut: bigint;
}

export type QuoteSwapReturn = QuoteSwapVolatileReturn | QuoteSwapStableReturn;

export interface QuoteRemoveLiquidityOneCoiArgs {
  pool: InterestPool | string;
  coinOutType: string;
  amount: bigint;
}

export interface QuoteAddLiquidityArgs {
  pool: InterestPool | string;
  // Same order as coin types
  amounts: readonly bigint[];
}

export interface QuoteRemoveLiquidityArgs {
  pool: InterestPool | string;
  amount: bigint;
}

export interface PoolMetadata {
  poolObjectId: string;
  lpCoinType: string;
  isStable: boolean;
  coinTypes: string[];
  hooks?: Record<string, readonly string[]>;
}

export interface PoolData {
  poolObjectId: string;
  poolAdminAddress: string;
  isStable: boolean;
  coinTypes: readonly string[];
  hooks?: Record<string, readonly string[]> | null;
}

export interface QueryPoolsArgs {
  page?: number;
  pageSize?: number;
  coinTypes?: readonly string[];
}

export interface QueryPoolsReturn<T> {
  pools: readonly T[];
  totalPages: number | null | undefined;
}

export interface GetRoutesArgs {
  coinIn: string;
  coinOut: string;
}

export interface GetRouteQuotesArgs {
  coinIn: string;
  coinOut: string;
  amount: bigint;
}

export interface SwapRouteArgs extends MaybeTxb, MaybeSlippage {
  coinIn: MoveObjectArgument;
  route: [CoinPath, PoolObjectIdPath];
  poolsMap: Record<string, PoolMetadata>;
  minAmount?: bigint;
}

export interface GetRouteQuotesReturn {
  routes: [CoinPath, PoolObjectIdPath, QuoteSwapReturn][];
  poolsMap: Record<string, PoolMetadata>;
}

export interface GetRoutesReturn {
  routes: [CoinPath, PoolObjectIdPath][];
  poolsMap: Record<string, PoolMetadata>;
}

export interface HandleCoinVectorArgs extends MaybeTxb {
  coinType: string;
  coins: MoveObjectArgument[];
  value: bigint;
}

export interface HandleCoinVectorReturn {
  tx: Transaction;
  coin: TransactionResult;
}

interface Pool<T> extends PoolMetadata {
  poolAdminAddress?: string;
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
  virtualPrice: bigint;
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

export type StablePool = Pool<StablePoolState>;
export type VolatilePool = Pool<VolatilePoolState>;
export type InterestPool = StablePool | VolatilePool;
