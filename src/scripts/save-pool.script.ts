import { CLAMM, log } from './utils.script';

(async () => {
  try {
    const saved = await CLAMM.savePool(
      '0xc327293beb3dad06ef8d49c825a2aafc0be96ff03dcd61dbdba7c8c3e0b27c5d',
    );

    log({
      saved,
    });
  } catch (e) {
    console.log(e);
  }
})();
