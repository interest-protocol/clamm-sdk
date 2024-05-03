import { createCoin, keypair, log, sleep } from './utils.script';

(async () => {
  try {
    const usdt = await createCoin({
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

    const usdc = await createCoin({
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

    const eth = await createCoin({
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

    const btc = await createCoin({
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
      usdc,
      usdt,
      eth,
      btc,
    });
  } catch (e) {
    console.log(e);
  }
})();
