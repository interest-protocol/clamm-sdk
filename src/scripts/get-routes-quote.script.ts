import { CLAMM, log, COINS } from './utils.script';

(async () => {
  try {
    const routes = await CLAMM.getRoutesQuotes({
      coinIn: COINS.usdc.coinType,
      coinOut: COINS.usdt.coinType,
      amount: 1_000_000_000n,
    });

    const routes2 = await CLAMM.getRoutesQuotes({
      coinIn: COINS.usdc.coinType,
      coinOut: COINS.usdt.coinType,
      amount: 2_000_000_000n,
    });

    log({ routes, routes2 });
  } catch (e) {
    console.log(e);
  }
})();
