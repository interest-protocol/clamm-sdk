import { createCoin, keypair, log, sleep } from './utils.script';

(async () => {
  try {
    const usdtData = await createCoin({
      name: 'USD Tether',
      symbol: 'USDT',
      decimals: 9,
      totalSupply: 1_000_000_000n,
      imageUrl:
        'https://imagedelivery.net/cBNDGgkrsEA-b_ixIp9SkQ/usdt.png/public',
      recipient: keypair.toSuiAddress(),
      description: 'Largest stable coin',
    });

    await sleep(3000);

    const usdcData = await createCoin({
      name: 'USD Coin',
      symbol: 'USDC',
      decimals: 6,
      totalSupply: 1_000_000n,
      imageUrl:
        'https://imagedelivery.net/cBNDGgkrsEA-b_ixIp9SkQ/usdc.png/public',
      recipient: keypair.toSuiAddress(),
      description: 'Circle Stable coin',
    });

    await sleep(3000);

    const ethData = await createCoin({
      name: 'Ether',
      symbol: 'ETH',
      decimals: 9,
      totalSupply: 1_000_000_000n,
      imageUrl:
        'https://imagedelivery.net/cBNDGgkrsEA-b_ixIp9SkQ/eth.png/public',
      recipient: keypair.toSuiAddress(),
      description: 'First smart contract layer1',
    });

    await sleep(3000);

    const btcData = await createCoin({
      name: 'Bitcoin',
      symbol: 'BTC',
      decimals: 9,
      totalSupply: 1_000_000_000n,
      imageUrl:
        'https://imagedelivery.net/cBNDGgkrsEA-b_ixIp9SkQ/btc.png/public',
      recipient: keypair.toSuiAddress(),
      description: 'First crypto ever',
    });

    log({
      usdcData,
      usdtData,
      ethData,
      btcData,
    });
  } catch (e) {
    console.log(e);
  }
})();
