import { TransactionBlock } from '@mysten/sui.js/transactions';

import {
  CLAMM,
  executeTx,
  keypair,
  log,
  STABLE_POOL_USDC_TREASURY_CAP,
  STABLE_POOL_USDC_USDT_OBJECT_ID,
  STABLE_POOL_USDT_TREASURY_CAP,
} from '../utils.script';

(async () => {
  try {
    const pool = await CLAMM.getPool(STABLE_POOL_USDC_USDT_OBJECT_ID);

    const initTxb = new TransactionBlock();

    // USDC has 6 decimals
    const coinA = initTxb.moveCall({
      target: '0x2::coin::mint',
      typeArguments: [pool.coinTypes[0]],
      arguments: [
        initTxb.object(STABLE_POOL_USDC_TREASURY_CAP),
        initTxb.pure(10_000_000n),
      ],
    });

    // USDT has 9 decimals
    const coinB = initTxb.moveCall({
      target: '0x2::coin::mint',
      typeArguments: [pool.coinTypes[1]],
      arguments: [
        initTxb.object(STABLE_POOL_USDT_TREASURY_CAP),
        initTxb.pure(10_000_000_000n),
      ],
    });

    const minAmount = await CLAMM.quoteAddLiquidity({
      pool,
      amounts: [10_000_000n, 10_000_000_000n],
    });

    const { lpCoin, txb } = await CLAMM.addLiquidity({
      txb: initTxb,
      pool,
      coinsIn: [coinA, coinB],
    });

    txb.transferObjects([lpCoin], txb.pure(keypair.toSuiAddress()));

    const response = await executeTx(txb);
    log(response);
    console.log(minAmount);
  } catch (e) {
    console.log(e);
  }
})();
