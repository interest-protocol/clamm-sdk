import { CLAMM, log, COINS } from './utils.script';

(async () => {
  try {
    const routes = await CLAMM.getRoutesQuotes({
      coinIn: COINS.usdc.coinType,
      coinOut: COINS.usdt.coinType,
      amount: 1_000_000_000n,
    });

    // const routes2 = await CLAMM.getRoutesQuotes({
    //   coinIn: COINS.usdc.coinType,
    //   coinOut: COINS.usdt.coinType,
    //   amount: 2_000_000_000n,
    // });

    // const routes3 = await CLAMM.getRoutesQuotes({
    //   coinIn: '0x2::sui::SUI',
    //   coinOut:
    //     '0x30a644c3485ee9b604f52165668895092191fcaf5489a846afa7fc11cdb9b24a::spam::SPAM',
    //   amount: 2_000_000_000n,
    // });

    log({ routes });
  } catch (e) {
    console.log(e);
  }
})();
