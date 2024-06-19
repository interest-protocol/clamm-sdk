import { Transaction } from '@mysten/sui/transactions';

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

    const initTx = new Transaction();
    const coinIn = initTx.moveCall({
      target: '0x2::coin::mint',
      typeArguments: [pool.coinTypes[0]],
      arguments: [
        initTx.object(COINS.usdc.treasuryCap),
        initTx.pure.u64(100_000_000n),
      ],
    });

    const minAmount = await CLAMM.quoteSwap({
      pool,
      coinInType: pool.coinTypes[0],
      coinOutType: pool.coinTypes[1],
      amount: 100_000_000n,
    });

    const { coinOut, tx } = await CLAMM.swap({
      tx: initTx,
      pool,
      coinIn,
      coinInType: pool.coinTypes[0],
      coinOutType: pool.coinTypes[1],
      minAmount: 0n,
    });

    tx.transferObjects([coinOut], tx.pure.address(keypair.toSuiAddress()));

    const response = await executeTx(tx);
    log(minAmount);
    log(response);
  } catch (e) {
    console.log(e);
  }
})();
