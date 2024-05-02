import { TransactionBlock } from '@mysten/sui.js/transactions';

import {
  CLAMM,
  executeTx,
  keypair,
  log,
  VOLATILE_POOL_USDC_ETH_OBJECT_ID,
  COINS,
} from '../utils.script';

(async () => {
  try {
    const pool = await CLAMM.getPool(VOLATILE_POOL_USDC_ETH_OBJECT_ID);

    const initTxb = new TransactionBlock();
    const coinIn = initTxb.moveCall({
      target: '0x2::coin::mint',
      typeArguments: [pool.coinTypes[0]],
      arguments: [
        initTxb.object(COINS.usdc.treasuryCap),
        initTxb.pure(100_000_000n),
      ],
    });

    const minAmount = await CLAMM.quoteSwap({
      pool,
      coinInType: pool.coinTypes[0],
      coinOutType: pool.coinTypes[1],
      amount: 100_000_000n,
    });

    const { coinOut, txb } = await CLAMM.swap({
      txb: initTxb,
      pool,
      coinIn,
      coinInType: pool.coinTypes[0],
      coinOutType: pool.coinTypes[1],
      minAmount: 0n,
    });

    txb.transferObjects([coinOut], txb.pure(keypair.toSuiAddress()));

    const response = await executeTx(txb);
    log(minAmount);
    log(response);
  } catch (e) {
    console.log(e);
  }
})();
