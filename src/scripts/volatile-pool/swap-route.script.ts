import { Transaction } from '@mysten/sui/transactions';

import { CLAMM, executeTx, keypair, log } from '../utils.script';

(async () => {
  try {
    const { routes, poolsMap } = await CLAMM.getRoutes({
      coinIn:
        '0xc179ea5266d66726abd4ddbaa2d54cd69acef3de43734a1aeafdbf14470e0592::eth::ETH',
      coinOut:
        '0x328ffb64d7562fbca80203bccd4f4e548edb80e0abb7bebebe05d93503b835e5::pepe::PEPE',
    });

    const initTx = new Transaction();

    const coinIn = initTx.moveCall({
      target: '0x2::coin::mint',
      typeArguments: [
        '0xc179ea5266d66726abd4ddbaa2d54cd69acef3de43734a1aeafdbf14470e0592::eth::ETH',
      ],
      arguments: [
        initTx.object(
          '0xa13ad40fa947760297fc581af6886a18c19e39e0c2777e7d657e4a6161decb75',
        ),
        initTx.pure.u64(100_000_000n),
      ],
    });

    const { coinOut, tx } = await CLAMM.swapRoute({
      tx: initTx,
      coinIn,
      route: routes[0],
      poolsMap,
      minAmount: 0n,
    });

    const coinIn2 = tx.moveCall({
      target: '0x2::coin::mint',
      typeArguments: [
        '0xc179ea5266d66726abd4ddbaa2d54cd69acef3de43734a1aeafdbf14470e0592::eth::ETH',
      ],
      arguments: [
        tx.object(
          '0xa13ad40fa947760297fc581af6886a18c19e39e0c2777e7d657e4a6161decb75',
        ),
        tx.pure.u64(100_000_000n),
      ],
    });

    const { coinOut: coinOut2, tx: txb2 } = await CLAMM.swapRoute({
      tx: tx,
      coinIn: coinIn2,
      route: routes[0],
      poolsMap,
      slippage: 3,
    });

    txb2.transferObjects(
      [coinOut, coinOut2],
      txb2.pure.address(keypair.toSuiAddress()),
    );

    const response = await executeTx(txb2);
    log(response);
  } catch (e) {
    console.log(e);
  }
})();
