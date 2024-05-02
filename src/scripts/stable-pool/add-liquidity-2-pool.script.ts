import { TransactionBlock } from '@mysten/sui.js/transactions';

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
    const initTxb = new TransactionBlock();

    // USDC has 6 decimals
    const coinUSDC = initTxb.moveCall({
      target: '0x2::coin::mint',
      typeArguments: [COINS.usdc.coinType],
      arguments: [
        initTxb.object(COINS.usdc.treasuryCap),
        initTxb.pure(1_000_000_000n),
      ],
    });

    // USDT has 9 decimals
    const coinUSDT = initTxb.moveCall({
      target: '0x2::coin::mint',
      typeArguments: [COINS.usdt.coinType],
      arguments: [
        initTxb.object(COINS.usdt.treasuryCap),
        initTxb.pure(1_000_000_000_000n),
      ],
    });

    const minAmount = await CLAMM.quoteAddLiquidity({
      pool,
      amounts: [1_000_000_000n, 1_000_000_000_000n],
    });

    const { lpCoin, txb } = await CLAMM.addLiquidity({
      txb: initTxb,
      pool,
      coinsIn: [coinUSDC, coinUSDT],
    });

    txb.transferObjects([lpCoin], txb.pure(keypair.toSuiAddress()));

    const response = await executeTx(txb);
    log(response);
    console.log(minAmount);
  } catch (e) {
    console.log(e);
  }
})();
