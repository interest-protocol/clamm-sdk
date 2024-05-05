import {
  CLAMM,
  log,
  COINS,
  VOLATILE_POOL_USDC_ETH_OBJECT_ID,
} from './utils.script';

(async () => {
  try {
    const pool = await CLAMM.getPool(VOLATILE_POOL_USDC_ETH_OBJECT_ID);
    const result = await CLAMM.getPools();
    const result1 = await CLAMM.getPools({ pageSize: 1 });
    const result2 = await CLAMM.getPools({
      coinTypes: [COINS.eth.coinType],
    });
    const result3 = await CLAMM.getPoolsMetadata();
    const result4 = await CLAMM.getPoolsFromMetadata(result3.pools);

    log({
      pool,
      result,
      result1,
      result2,
      result3,
      result4,
    });
  } catch (e) {
    console.log(e);
  }
})();
