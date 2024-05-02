import { TransactionBlock } from '@mysten/sui.js/transactions';

import {
  CLAMM,
  executeTx,
  keypair,
  log,
  COINS,
  VOLATILE_POOL_USDC_ETH_OBJECT_ID,
} from '../utils.script';

(async () => {
  try {
    const pool = await CLAMM.getPool(VOLATILE_POOL_USDC_ETH_OBJECT_ID);

    const initTxb = new TransactionBlock();

    // USDT has 9 decimals
    const coinA = initTxb.moveCall({
      target: '0x2::coin::mint',
      typeArguments: [pool.coinTypes[0]],
      arguments: [
        initTxb.object(COINS.usdc.treasuryCap),
        initTxb.pure(3_000_000_000n),
      ],
    });

    // BTC has 9 decimals
    const coinB = initTxb.moveCall({
      target: '0x2::coin::mint',
      typeArguments: [pool.coinTypes[1]],
      arguments: [
        initTxb.object(COINS.eth.treasuryCap),
        initTxb.pure(1_000_000_000n),
      ],
    });

    const minAmount = await CLAMM.quoteAddLiquidity({
      pool,
      amounts: [3_000_000_000n, 1_000_000_000n],
    });

    const { lpCoin, txb } = await CLAMM.addLiquidity({
      txb: initTxb,
      pool,
      coinsIn: [coinA, coinB],
      minAmount,
    });

    txb.transferObjects([lpCoin], txb.pure(keypair.toSuiAddress()));

    const response = await executeTx(txb);
    log(minAmount);
    log(response);
  } catch (e) {
    console.log(e);
  }
})();
