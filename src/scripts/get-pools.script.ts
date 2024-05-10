import { CLAMM, log } from './utils.script';

(async () => {
  try {
    const pool = await CLAMM.getPool(
      '0xecaf27d73b6c6447e8125b1143bf174c4022d74a28aba59a4b4d97682731dbac',
    );
    // const result = await CLAMM.getPools();
    // const result1 = await CLAMM.getPools({ pageSize: 1 });
    // const result2 = await CLAMM.getPools({
    //   coinTypes: [COINS.eth.coinType],
    // });
    // const result3 = await CLAMM.getPoolsMetadata();
    // const result4 = await CLAMM.getPoolsFromMetadata(result3.pools);

    log({
      pool,
    });
  } catch (e) {
    console.log(e);
  }
})();
