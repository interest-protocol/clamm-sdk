import { Transaction } from '@mysten/sui/transactions';

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

    const initTx = new Transaction();

    // USDC has 6 decimals
    const coinIn = initTx.moveCall({
      target: '0x2::coin::mint',
      typeArguments: [COINS.usdc.coinType],
      arguments: [
        initTx.object(COINS.usdc.treasuryCap),
        initTx.pure.u64(10_000_000n),
      ],
    });

    const minAmount = await CLAMM.quoteSwap({
      pool,
      coinInType: pool.coinTypes[0],
      coinOutType: pool.coinTypes[1],
      amount: 10_000_000n,
    });

    const { coinOut, tx } = await CLAMM.swap({
      tx: initTx,
      pool,
      coinIn,
      coinInType: pool.coinTypes[0],
      coinOutType: pool.coinTypes[1],
    });

    tx.transferObjects([coinOut], tx.pure(keypair.toSuiAddress()));

    const response = await executeTx(tx);
    log(response);
    log(minAmount);
  } catch (e) {
    console.log(e);
  }
})();
