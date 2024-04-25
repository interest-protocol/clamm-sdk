import {
  TransactionArgument,
  TransactionBlock,
  TransactionObjectArgument,
} from '@mysten/sui.js/transactions';

interface MaybeTxb {
  txb?: TransactionBlock;
}

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
  poolObjectId: string;
  minAmount: bigint;
}

export interface SwapArgs extends MaybeTxb {
  coinInType: string;
  coinOutType: string;
  coinIn: MoveObjectArgument;
  minAmount?: bigint;
}
