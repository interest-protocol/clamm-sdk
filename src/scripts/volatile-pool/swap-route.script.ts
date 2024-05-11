import { TransactionBlock } from '@mysten/sui.js/transactions';

import { CLAMM, executeTx, keypair, log } from '../utils.script';

(async () => {
  try {
    const { routes, poolsMap } = await CLAMM.getRoutes({
      coinIn:
        '0xc179ea5266d66726abd4ddbaa2d54cd69acef3de43734a1aeafdbf14470e0592::eth::ETH',
      coinOut:
        '0x328ffb64d7562fbca80203bccd4f4e548edb80e0abb7bebebe05d93503b835e5::pepe::PEPE',
    });

    const initTxb = new TransactionBlock();

    const coinIn = initTxb.moveCall({
      target: '0x2::coin::mint',
      typeArguments: [
        '0xc179ea5266d66726abd4ddbaa2d54cd69acef3de43734a1aeafdbf14470e0592::eth::ETH',
      ],
      arguments: [
        initTxb.object(
          '0xa13ad40fa947760297fc581af6886a18c19e39e0c2777e7d657e4a6161decb75',
        ),
        initTxb.pure(100_000_000n),
      ],
    });

    const { coinOut, txb } = await CLAMM.swapRoute({
      txb: initTxb,
      coinIn,
      route: routes[0],
      poolsMap,
      minAmount: 0n,
    });

    const coinIn2 = txb.moveCall({
      target: '0x2::coin::mint',
      typeArguments: [
        '0xc179ea5266d66726abd4ddbaa2d54cd69acef3de43734a1aeafdbf14470e0592::eth::ETH',
      ],
      arguments: [
        txb.object(
          '0xa13ad40fa947760297fc581af6886a18c19e39e0c2777e7d657e4a6161decb75',
        ),
        txb.pure(100_000_000n),
      ],
    });

    const { coinOut: coinOut2, txb: txb2 } = await CLAMM.swapRoute({
      txb: txb,
      coinIn: coinIn2,
      route: routes[0],
      poolsMap,
      slippage: 3,
    });

    txb2.transferObjects(
      [coinOut, coinOut2],
      txb2.pure(keypair.toSuiAddress()),
    );

    const response = await executeTx(txb2);
    log(response);
  } catch (e) {
    console.log(e);
  }
})();
