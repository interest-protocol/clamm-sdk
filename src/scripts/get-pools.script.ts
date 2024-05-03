import {
  CLAMM,
  log,
  COINS,
  VOLATILE_POOL_USDC_ETH_OBJECT_ID,
} from './utils.script';

(async () => {
  try {
    const pool = await CLAMM.getPool(VOLATILE_POOL_USDC_ETH_OBJECT_ID);
    const getPoolsResult = await CLAMM.getPools();
    const getPoolsResult1 = await CLAMM.getPools({ pageSize: 1 });
    const getPoolsResult2 = await CLAMM.getPools({
      coinTypes: [COINS.eth.coinType],
    });
    log({
      pool,
      getPoolsResult,
      getPoolsResult1,
      getPoolsResult2,
    });
  } catch (e) {
    console.log(e);
  }
})();
