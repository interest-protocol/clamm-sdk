import { TransactionBlock } from '@mysten/sui.js/transactions';

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

    const initTxb = new TransactionBlock();

    const lpCoin = await getCoinOfValue(initTxb, pool.lpCoinType, 100_000_000n);

    const minAmount = await CLAMM.quoteRemoveLiquidityOneCoin({
      pool,
      coinOutType: pool.coinTypes[0],
      amount: 100_000_000n,
    });

    const { txb, coinOut } = await CLAMM.removeLiquidityOneCoin({
      txb: initTxb,
      pool,
      coinOutType: pool.coinTypes[0],
      lpCoin,
    });

    txb.transferObjects([coinOut], txb.pure(keypair.toSuiAddress()));

    const response = await executeTx(txb);
    log(minAmount);
    log(response);
  } catch (e) {
    console.log(e);
  }
})();
