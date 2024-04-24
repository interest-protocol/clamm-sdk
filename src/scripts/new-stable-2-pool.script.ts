import invariant from 'tiny-invariant';
import {
  keypair,
  createCoin,
  createLPCoin,
  log,
  CLAMM,
  executeTx,
  sleep,
} from './utils.script';

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

    const usdcData = await createCoin({
      name: 'USD Coin',
      symbol: 'USDC',
      decimals: 6,
      totalSupply: 6_000_000n,
      imageUrl:
        'https://imagedelivery.net/cBNDGgkrsEA-b_ixIp9SkQ/usdc.png/public',
      recipient: keypair.toSuiAddress(),
      description: 'Circle Stable coin',
    });

    await sleep(3000);

    const usdtData = await createCoin({
      name: 'USD Tether',
      symbol: 'USDT',
      decimals: 9,
      totalSupply: 6_000_000n,
      imageUrl:
        'https://imagedelivery.net/cBNDGgkrsEA-b_ixIp9SkQ/usdt.png/public',
      recipient: keypair.toSuiAddress(),
      description: 'First crypto ever',
    });

    invariant(
      lpCoinData.treasuryCap && lpCoinData.coinType,
      'LpCoin Cap not found',
    );
    invariant(usdcData.coin && usdcData.coinType, 'Failed to create USDC');
    invariant(usdtData.coin && usdtData.coinType, 'Failed to create BTC');

    await sleep(3000);

    let { pool, poolAdmin, lpCoin, txb } = await CLAMM.newStable({
      coins: [usdcData.coin, usdtData.coin],
      lpCoinTreasuryCap: lpCoinData.treasuryCap,
      typeArguments: [
        usdcData.coinType,
        usdtData.coinType,
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
