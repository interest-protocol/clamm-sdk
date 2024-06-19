import { Transaction } from '@mysten/sui/transactions';
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

    const initTx = new Transaction();

    // USDC has 6 decimals
    const coinUSDC = initTx.moveCall({
      target: '0x2::coin::mint',
      typeArguments: [COINS.usdc.coinType],
      arguments: [
        initTx.object(COINS.usdc.treasuryCap),
        initTx.pure.u64(1_000_000_000_000n),
      ],
    });

    // USDT has 9 decimals
    const coinUSDT = initTx.moveCall({
      target: '0x2::coin::mint',
      typeArguments: [COINS.usdt.coinType],
      arguments: [
        initTx.object(COINS.usdt.treasuryCap),
        initTx.pure.u64(1_000_000_000_000_000n),
      ],
    });

    let { pool, poolAdmin, lpCoin, tx } = await CLAMM.newStable({
      tx: initTx,
      coins: [coinUSDC, coinUSDT],
      lpCoinTreasuryCap: lpCoinData.treasuryCap,
      typeArguments: [
        COINS.usdc.coinType,
        COINS.usdt.coinType,
        lpCoinData.coinType,
      ],
    });

    tx.transferObjects(
      [poolAdmin, lpCoin],
      tx.pure.address(keypair.toSuiAddress()),
    );

    tx = CLAMM.shareStablePool({ tx, pool });

    const result = await executeTx(tx);

    log(result);
  } catch (e) {
    console.log(e);
  }
})();
