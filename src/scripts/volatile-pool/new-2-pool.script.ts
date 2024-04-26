import invariant from 'tiny-invariant';

import {
  CLAMM,
  createCoin,
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
      name: 'BTC/USDT',
      symbol: 'ipx-v-btc-usdt',
      decimals: 9,
      totalSupply: 0n,
      imageUrl: 'https://www.interestprotocol.com/',
      recipient: keypair.toSuiAddress(),
      description: 'CLAMM Interest Protocol LpCoin',
    });

    await sleep(3000);

    const usdcData = await createCoin({
      name: 'USD Coin',
      symbol: 'USDC',
      decimals: 6,
      totalSupply: 6_500_000n,
      imageUrl:
        'https://imagedelivery.net/cBNDGgkrsEA-b_ixIp9SkQ/usdc.png/public',
      recipient: keypair.toSuiAddress(),
      description: 'Circle Stable coin',
    });

    await sleep(3000);

    const btcData = await createCoin({
      name: 'Bitcoin',
      symbol: 'BTC',
      decimals: 9,
      totalSupply: 100n,
      imageUrl:
        'https://imagedelivery.net/cBNDGgkrsEA-b_ixIp9SkQ/wbtc.png/public',
      recipient: keypair.toSuiAddress(),
      description: 'First crypto ever',
    });

    invariant(
      lpCoinData.treasuryCap && lpCoinData.coinType,
      'LpCoin Cap not found',
    );
    invariant(usdcData.coin && usdcData.coinType, 'Failed to create USDC');
    invariant(btcData.coin && btcData.coinType, 'Failed to create BTC');

    await sleep(3000);

    let { pool, poolAdmin, lpCoin, txb } = await CLAMM.newVolatile({
      coins: [usdcData.coin, btcData.coin],
      lpCoinTreasuryCap: lpCoinData.treasuryCap,
      typeArguments: [usdcData.coinType, btcData.coinType, lpCoinData.coinType],
      prices: [65_000n * PRECISION],
    });

    txb.transferObjects([poolAdmin, lpCoin], txb.pure(keypair.toSuiAddress()));

    txb = CLAMM.shareVolatilePool({ txb, pool });

    const result = await executeTx(txb);

    log(result);
  } catch (e) {
    console.log(e);
  }
})();
