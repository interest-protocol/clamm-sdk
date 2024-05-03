import { CLAMM, log, COINS } from './utils.script';

(async () => {
  try {
    const getPoolsResult = await CLAMM.getPools();
    const getPoolsResult1 = await CLAMM.getPools({ pageSize: 1 });
    const getPoolsResult2 = await CLAMM.getPools({
      coinTypes: [COINS.eth.coinType],
    });

    log({
      getPoolsResult,
      getPoolsResult1,
      getPoolsResult2,
    });
  } catch (e) {
    console.log(e);
  }
})();
