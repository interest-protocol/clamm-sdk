import {
  TransactionArgument,
  TransactionBlock,
  TransactionObjectArgument,
} from '@mysten/sui.js/transactions';

interface MoveCall {
  txb?: TransactionBlock;
}

export interface ClammNewStableArgs extends MoveCall {
  typeArguments: string[];
  coins: string[] | TransactionObjectArgument[];
  lpCoinTreasuryCap: string | TransactionObjectArgument;
  a?: bigint;
}

export interface ClammNewVolatileArgs extends MoveCall {
  typeArguments: string[];
  coins: string[] | TransactionObjectArgument[];
  lpCoinTreasuryCap: string | TransactionObjectArgument;
  a?: bigint;
  gamma?: bigint;
  extraProfit?: bigint;
  adjustmentStep?: bigint;
  maHalfTime?: bigint;
  midFee?: bigint;
  outFee?: bigint;
  gammaFee?: bigint;
}

export interface SharePoolArgs {
  txb: TransactionBlock;
  pool: Extract<
    TransactionArgument,
    { index: number; resultIndex: number; kind: 'NestedResult' }
  >;
}

export interface ClammNewPoolReturn {
  pool: Extract<
    TransactionArgument,
    { index: number; resultIndex: number; kind: 'NestedResult' }
  >;
  poolAdmin: Extract<
    TransactionArgument,
    { index: number; resultIndex: number; kind: 'NestedResult' }
  >;
  lpCoin: Extract<
    TransactionArgument,
    { index: number; resultIndex: number; kind: 'NestedResult' }
  >;
}
