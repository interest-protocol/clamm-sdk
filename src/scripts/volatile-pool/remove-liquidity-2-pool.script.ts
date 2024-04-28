import { TransactionBlock } from '@mysten/sui.js/transactions';

import {
  CLAMM,
  executeTx,
  getCoinOfValue,
  keypair,
  log,
  VOLATILE_POOL_USDC_BTC_OBJECT_ID,
} from '../utils.script';

(async () => {
  try {
    const pool = await CLAMM.getPool(VOLATILE_POOL_USDC_BTC_OBJECT_ID);

    const initTxb = new TransactionBlock();

    const lpCoin = await getCoinOfValue(initTxb, pool.lpCoinType, 100_000_000n);

    const minAmounts = await CLAMM.quoteRemoveLiquidity({
      pool,
      amount: 100_000_000n,
    });

    const { txb, coinsOut } = await CLAMM.removeLiquidity({
      txb: initTxb,
      pool,
      lpCoin,
    });

    txb.transferObjects(coinsOut, txb.pure(keypair.toSuiAddress()));

    const response = await executeTx(txb);
    log(response);
    log(minAmounts);
  } catch (e) {
    console.log(e);
  }
})();
