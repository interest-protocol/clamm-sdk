import { TransactionBlock } from '@mysten/sui.js/transactions';

import {
  CLAMM,
  executeTx,
  keypair,
  log,
  COINS,
  STABLE_POOL_USDC_USDT_OBJECT_ID,
} from '../utils.script';

(async () => {
  try {
    const pool = await CLAMM.getPool(STABLE_POOL_USDC_USDT_OBJECT_ID);

    const initTxb = new TransactionBlock();

    // USDC has 6 decimals
    const coinIn = initTxb.moveCall({
      target: '0x2::coin::mint',
      typeArguments: [COINS.usdc.coinType],
      arguments: [
        initTxb.object(COINS.usdc.treasuryCap),
        initTxb.pure(10_000_000n),
      ],
    });

    const minAmount = await CLAMM.quoteSwap({
      pool,
      coinInType: pool.coinTypes[0],
      coinOutType: pool.coinTypes[1],
      amount: 10_000_000n,
    });

    const { coinOut, txb } = await CLAMM.swap({
      txb: initTxb,
      pool,
      coinIn,
      coinInType: pool.coinTypes[0],
      coinOutType: pool.coinTypes[1],
    });

    txb.transferObjects([coinOut], txb.pure(keypair.toSuiAddress()));

    const response = await executeTx(txb);
    log(response);
    log(minAmount);
  } catch (e) {
    console.log(e);
  }
})();
