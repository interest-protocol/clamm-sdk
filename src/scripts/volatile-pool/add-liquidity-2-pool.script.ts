import { TransactionBlock } from '@mysten/sui.js/transactions';

import {
  CLAMM,
  executeTx,
  keypair,
  log,
  VOLATILE_POOL_BTC_TREASURY_CAP,
  VOLATILE_POOL_USDC_BTC_OBJECT_ID,
  VOLATILE_POOL_USDC_TREASURY_CAP,
} from '../utils.script';

(async () => {
  try {
    const pool = await CLAMM.getPool(VOLATILE_POOL_USDC_BTC_OBJECT_ID);

    const initTxb = new TransactionBlock();

    // USDC has 6 decimals
    const coinA = initTxb.moveCall({
      target: '0x2::coin::mint',
      typeArguments: [pool.coinTypes[0]],
      arguments: [
        initTxb.object(VOLATILE_POOL_USDC_TREASURY_CAP),
        initTxb.pure(65_000_000_000n),
      ],
    });

    // BTC has 9 decimals
    const coinB = initTxb.moveCall({
      target: '0x2::coin::mint',
      typeArguments: [pool.coinTypes[1]],
      arguments: [
        initTxb.object(VOLATILE_POOL_BTC_TREASURY_CAP),
        initTxb.pure(1_000_000_000n),
      ],
    });

    const { lpCoin, txb } = await CLAMM.addLiquidity({
      txb: initTxb,
      pool,
      coinsIn: [coinA, coinB],
    });

    txb.transferObjects([lpCoin], txb.pure(keypair.toSuiAddress()));

    const response = await executeTx(txb);
    log(response);
  } catch (e) {
    console.log(e);
  }
})();
