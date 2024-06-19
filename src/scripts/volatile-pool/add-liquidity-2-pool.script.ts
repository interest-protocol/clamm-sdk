import { Transaction } from '@mysten/sui/transactions';

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

    const initTx = new Transaction();

    // USDT has 9 decimals
    const coinA = initTx.moveCall({
      target: '0x2::coin::mint',
      typeArguments: [pool.coinTypes[0]],
      arguments: [
        initTx.object(COINS.usdc.treasuryCap),
        initTx.pure.u64(3_000_000_000n),
      ],
    });

    // BTC has 9 decimals
    const coinB = initTx.moveCall({
      target: '0x2::coin::mint',
      typeArguments: [pool.coinTypes[1]],
      arguments: [
        initTx.object(COINS.eth.treasuryCap),
        initTx.pure.u64(1_000_000_000n),
      ],
    });

    const minAmount = await CLAMM.quoteAddLiquidity({
      pool,
      amounts: [3_000_000_000n, 1_000_000_000n],
    });

    const { lpCoin, tx } = await CLAMM.addLiquidity({
      tx: initTx,
      pool,
      coinsIn: [coinA, coinB],
      minAmount,
    });

    tx.transferObjects([lpCoin], tx.pure.address(keypair.toSuiAddress()));

    const response = await executeTx(tx);
    log(minAmount);
    log(response);
  } catch (e) {
    console.log(e);
  }
})();
