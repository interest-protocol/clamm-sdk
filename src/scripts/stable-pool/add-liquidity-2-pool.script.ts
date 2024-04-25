import { CLAMM, STABLE_POOL_USDC_USDT_OBJECT_ID, log } from '../utils.script';

(async () => {
  try {
    const pool = await CLAMM.getPool(STABLE_POOL_USDC_USDT_OBJECT_ID);
    log(pool);
  } catch (e) {
    console.log(e);
  }
})();
