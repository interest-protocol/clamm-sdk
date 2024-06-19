import { Transaction } from '@mysten/sui/transactions';

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

    const initTx = new Transaction();

    const lpCoin = await getCoinOfValue(initTx, pool.lpCoinType, 100_000_000n);

    const minAmount = await CLAMM.quoteRemoveLiquidity({
      pool,
      amount: 100_000_000n,
    });

    const { tx, coinsOut } = await CLAMM.removeLiquidity({
      tx: initTx,
      pool,
      lpCoin,
    });

    tx.transferObjects(coinsOut, tx.pure.address(keypair.toSuiAddress()));

    const response = await executeTx(tx);
    log(minAmount);
    log(response);
  } catch (e) {
    console.log(e);
  }
})();
