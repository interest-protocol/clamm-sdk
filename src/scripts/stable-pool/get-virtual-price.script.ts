import { CLAMM, log, STABLE_POOL_USDC_USDT_OBJECT_ID } from '../utils.script';

(async () => {
  try {
    const result = await CLAMM.getStablePoolVirtualPrice(
      STABLE_POOL_USDC_USDT_OBJECT_ID,
    );

    log({
      result,
    });
  } catch (e) {
    console.log(e);
  }
})();
