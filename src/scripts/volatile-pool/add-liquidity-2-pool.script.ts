import { CLAMM, VOLATILE_POOL_USDC_BTC_OBJECT_ID, log } from '../utils.script';

(async () => {
  try {
    const pool = await CLAMM.getPool(VOLATILE_POOL_USDC_BTC_OBJECT_ID);
    log(pool);
  } catch (e) {
    console.log(e);
  }
})();
