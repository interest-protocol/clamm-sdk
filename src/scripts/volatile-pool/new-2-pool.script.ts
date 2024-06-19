import { Transaction } from '@mysten/sui/transactions';
import invariant from 'tiny-invariant';

import {
  CLAMM,
  COINS,
  createLPCoin,
  executeTx,
  keypair,
  log,
  PRECISION,
  sleep,
} from '../utils.script';

(async () => {
  try {
    const lpCoinData = await createLPCoin({
      name: 'USDC/ETH',
      symbol: 'ipx-v-usdc-eth',
      decimals: 9,
      totalSupply: 0n,
      imageUrl: 'https://www.interestprotocol.com/',
      recipient: keypair.toSuiAddress(),
      description: 'CLAMM Interest Protocol LpCoin',
    });

    invariant(
      lpCoinData.treasuryCap && lpCoinData.coinType,
      'LpCoin Cap not found',
    );

    await sleep(3000);

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

    // ETH has 9 decimals
    const coinETH = initTx.moveCall({
      target: '0x2::coin::mint',
      typeArguments: [COINS.eth.coinType],
      arguments: [
        initTx.object(COINS.eth.treasuryCap),
        initTx.pure.u64(333_000_000_000n),
      ],
    });

    let { pool, poolAdmin, lpCoin, tx } = await CLAMM.newVolatile({
      tx: initTx,
      coins: [coinUSDC, coinETH],
      lpCoinTreasuryCap: lpCoinData.treasuryCap,
      typeArguments: [
        COINS.usdc.coinType,
        COINS.eth.coinType,
        lpCoinData.coinType,
      ],
      prices: [3_000n * PRECISION],
    });

    tx.transferObjects(
      [poolAdmin, lpCoin],
      tx.pure.address(keypair.toSuiAddress()),
    );

    tx = CLAMM.shareVolatilePool({ tx, pool });

    const result = await executeTx(tx);

    log(result);
  } catch (e) {
    console.log(e);
  }
})();
