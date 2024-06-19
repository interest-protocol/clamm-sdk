import { Transaction } from '@mysten/sui/transactions';

import {
  CLAMM,
  executeTx,
  getCoinOfValue,
  keypair,
  log,
  VOLATILE_POOL_USDC_ETH_OBJECT_ID,
} from '../utils.script';

(async () => {
  try {
    const pool = await CLAMM.getPool(VOLATILE_POOL_USDC_ETH_OBJECT_ID);

    const initTx = new Transaction();

    const lpCoin = await getCoinOfValue(initTx, pool.lpCoinType, 100_000_000n);

    const minAmounts = await CLAMM.quoteRemoveLiquidity({
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
    log(response);
    log(minAmounts);
  } catch (e) {
    console.log(e);
  }
})();
