import { TransactionBlock } from '@mysten/sui.js/transactions';
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

    // ETH has 9 decimals
    const coinETH = initTxb.moveCall({
      target: '0x2::coin::mint',
      typeArguments: [COINS.eth.coinType],
      arguments: [
        initTxb.object(COINS.eth.treasuryCap),
        initTxb.pure(333_000_000_000n),
      ],
    });

    let { pool, poolAdmin, lpCoin, txb } = await CLAMM.newVolatile({
      txb: initTxb,
      coins: [coinUSDC, coinETH],
      lpCoinTreasuryCap: lpCoinData.treasuryCap,
      typeArguments: [
        COINS.usdc.coinType,
        COINS.eth.coinType,
        lpCoinData.coinType,
      ],
      prices: [3_000n * PRECISION],
    });

    txb.transferObjects([poolAdmin, lpCoin], txb.pure(keypair.toSuiAddress()));

    txb = CLAMM.shareVolatilePool({ txb, pool });

    const result = await executeTx(txb);

    log(result);
  } catch (e) {
    console.log(e);
  }
})();
