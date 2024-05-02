import { TransactionBlock } from '@mysten/sui.js/transactions';
import invariant from 'tiny-invariant';

import {
  CLAMM,
  createLPCoin,
  executeTx,
  keypair,
  log,
  sleep,
  COINS,
} from '../utils.script';

(async () => {
  try {
    const lpCoinData = await createLPCoin({
      name: 'iUSDC/USDT',
      symbol: 'ipx-s-usdc-usdt',
      decimals: 9,
      totalSupply: 0n,
      imageUrl: 'https://www.interestprotocol.com/',
      recipient: keypair.toSuiAddress(),
      description: 'CLAMM Interest Protocol LpCoin',
    });

    await sleep(3000);

    invariant(
      lpCoinData.treasuryCap && lpCoinData.coinType,
      'LpCoin Cap not found',
    );

    const initTxb = new TransactionBlock();

    // USDC has 6 decimals
    const coinUSDC = initTxb.moveCall({
      target: '0x2::coin::mint',
      typeArguments: [COINS.usdc.coinType],
      arguments: [
        initTxb.object(COINS.usdc.treasuryCap),
        initTxb.pure(1_000_000_000_000n),
      ],
    });

    // USDT has 9 decimals
    const coinUSDT = initTxb.moveCall({
      target: '0x2::coin::mint',
      typeArguments: [COINS.usdt.coinType],
      arguments: [
        initTxb.object(COINS.usdt.treasuryCap),
        initTxb.pure(1_000_000_000_000_000n),
      ],
    });

    let { pool, poolAdmin, lpCoin, txb } = await CLAMM.newStable({
      txb: initTxb,
      coins: [coinUSDC, coinUSDT],
      lpCoinTreasuryCap: lpCoinData.treasuryCap,
      typeArguments: [
        COINS.usdc.coinType,
        COINS.usdt.coinType,
        lpCoinData.coinType,
      ],
    });

    txb.transferObjects([poolAdmin, lpCoin], txb.pure(keypair.toSuiAddress()));

    txb = CLAMM.shareStablePool({ txb, pool });

    const result = await executeTx(txb);

    log(result);
  } catch (e) {
    console.log(e);
  }
})();
