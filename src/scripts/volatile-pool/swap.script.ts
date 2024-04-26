import { TransactionBlock } from '@mysten/sui.js/transactions';

import {
  CLAMM,
  executeTx,
  keypair,
  log,
  VOLATILE_POOL_USDC_BTC_OBJECT_ID,
  VOLATILE_POOL_USDC_TREASURY_CAP,
} from '../utils.script';

(async () => {
  try {
    const pool = await CLAMM.getPool(VOLATILE_POOL_USDC_BTC_OBJECT_ID);

    const initTxb = new TransactionBlock();
    const coinIn = initTxb.moveCall({
      target: '0x2::coin::mint',
      typeArguments: [pool.coinTypes[0]],
      arguments: [
        initTxb.object(VOLATILE_POOL_USDC_TREASURY_CAP),
        initTxb.pure(10_000_000_000n),
      ],
    });

    const { coinOut, txb } = await CLAMM.swap({
      txb: initTxb,
      pool,
      coinIn,
      coinInType: pool.coinTypes[0],
    });

    txb.transferObjects([coinOut], txb.pure(keypair.toSuiAddress()));

    const response = await executeTx(txb);
    log(response);
  } catch (e) {
    console.log(e);
  }
})();
