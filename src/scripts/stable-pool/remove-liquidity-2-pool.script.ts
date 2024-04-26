import { TransactionBlock } from '@mysten/sui.js/transactions';

import {
  CLAMM,
  executeTx,
  getCoinOfValue,
  keypair,
  log,
  STABLE_POOL_USDC_USDT_OBJECT_ID,
} from '../utils.script';

(async () => {
  try {
    const pool = await CLAMM.getPool(STABLE_POOL_USDC_USDT_OBJECT_ID);

    const initTxb = new TransactionBlock();

    const lpCoin = await getCoinOfValue(initTxb, pool.lpCoinType, 100_000_000n);

    const { txb, coinsOut } = await CLAMM.removeLiquidity({
      txb: initTxb,
      pool,
      lpCoin,
    });

    txb.transferObjects(coinsOut, txb.pure(keypair.toSuiAddress()));

    const response = await executeTx(txb);
    log(response);
  } catch (e) {
    console.log(e);
  }
})();
