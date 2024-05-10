import { CLAMM, log } from './utils.script';

(async () => {
  try {
    // call for a newly created pool to be saved to the DB instead of waiting for the indexer.
    // e.g. - 0xc327293beb3dad06ef8d49c825a2aafc0be96ff03dcd61dbdba7c8c3e0b27c5d
    const saved = await CLAMM.savePool('');

    log({
      saved,
    });
  } catch (e) {
    console.log(e);
  }
})();
