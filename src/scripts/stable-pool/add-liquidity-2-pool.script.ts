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
    const coinUSDC = initTx.moveCall({
      target: '0x2::coin::mint',
      typeArguments: [COINS.usdc.coinType],
      arguments: [
        initTx.object(COINS.usdc.treasuryCap),
        initTx.pure.u64(1_000_000_000n),
      ],
    });

    // USDT has 9 decimals
    const coinUSDT = initTx.moveCall({
      target: '0x2::coin::mint',
      typeArguments: [COINS.usdt.coinType],
      arguments: [
        initTx.object(COINS.usdt.treasuryCap),
        initTx.pure.u64(1_000_000_000_000n),
      ],
    });

    const minAmount = await CLAMM.quoteAddLiquidity({
      pool,
      amounts: [1_000_000_000n, 1_000_000_000_000n],
    });

    const { lpCoin, tx } = await CLAMM.addLiquidity({
      tx: initTx,
      pool,
      coinsIn: [coinUSDC, coinUSDT],
    });

    tx.transferObjects([lpCoin], tx.pure.address(keypair.toSuiAddress()));

    const response = await executeTx(tx);
    log(response);
    log(minAmount);
  } catch (e) {
    console.log(e);
  }
})();
