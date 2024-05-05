import { CLAMM, log } from './utils.script';

(async () => {
  try {
    const routes = await CLAMM.getRoutesQuotes({
      coinIn:
        '0x328ffb64d7562fbca80203bccd4f4e548edb80e0abb7bebebe05d93503b835e5::pepe::PEPE',
      coinOut:
        '0xc179ea5266d66726abd4ddbaa2d54cd69acef3de43734a1aeafdbf14470e0592::eth::ETH',
      amount: 1_000_000_000n,
    });

    const routes2 = await CLAMM.getRoutesQuotes({
      coinIn:
        '0xc179ea5266d66726abd4ddbaa2d54cd69acef3de43734a1aeafdbf14470e0592::eth::ETH',
      coinOut:
        '0x328ffb64d7562fbca80203bccd4f4e548edb80e0abb7bebebe05d93503b835e5::pepe::PEPE',
      amount: 2_000_000_000n,
    });

    log({ routes, routes2 });
  } catch (e) {
    console.log(e);
  }
})();
