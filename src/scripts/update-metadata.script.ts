import { TransactionBlock } from '@mysten/sui.js/transactions';
import { log, executeTx } from './utils.script';

(async () => {
  try {
    const txb = new TransactionBlock();

    txb.moveCall({
      target: `0x2::coin::update_name`,
      typeArguments: [],
      arguments: [],
    });

    txb.moveCall({
      target: `0x2::coin::update_symbol`,
      typeArguments: [],
      arguments: [],
    });

    txb.moveCall({
      target: `0x2::coin::update_icon_url`,
      typeArguments: [],
      arguments: [],
    });

    const response = await executeTx(txb);

    log(response);
  } catch (e) {
    console.log(e);
  }
})();
