import { bcs } from '@mysten/sui/bcs';
import {
  getFullnodeUrl,
  SuiClient,
  SuiObjectResponse,
} from '@mysten/sui/client';
import { OwnedObjectRef } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction, TransactionResult } from '@mysten/sui/transactions';
import { fromHEX, normalizeSuiAddress, toHEX } from '@mysten/sui/utils';
import dotenv from 'dotenv';
import { pathOr } from 'ramda';
import invariant from 'tiny-invariant';
import util from 'util';

import { CLAMM as CLAMM_ } from '../clamm';
import * as template from '@interest-protocol/move-bytecode-template';

dotenv.config();

export const keypair = Ed25519Keypair.fromSecretKey(
  Uint8Array.from(Buffer.from(process.env.KEY!, 'base64')).slice(1),
);

const getCoinTemplateByteCode = () =>
  'a11ceb0b060000000a01000c020c1e032a2d04570a05616307c401e70108ab0360068b04570ae204050ce704360007010d02060212021302140000020001020701000002010c01000102030c0100010404020005050700000a000100011105060100020808090102020b0c010100030e0501010c030f0e01010c04100a0b00050c030400010402070307050d040f02080007080400020b020108000b03010800010a02010805010900010b01010900010800070900020a020a020a020b01010805070804020b030109000b0201090001060804010504070b030109000305070804010b0301080002090005010b020108000d434f494e5f54454d504c4154450c436f696e4d65746164617461064f7074696f6e0b5472656173757279436170095478436f6e746578740355726c04636f696e0d636f696e5f74656d706c6174650f6372656174655f63757272656e63790b64756d6d795f6669656c6404696e6974116d696e745f616e645f7472616e73666572156e65775f756e736166655f66726f6d5f6279746573066f7074696f6e137075626c69635f73686172655f6f626a6563740f7075626c69635f7472616e736665720673656e64657204736f6d65087472616e736665720a74785f636f6e746578740375726c0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000020201090a02070653594d424f4c0a0205044e414d450a020c0b4445534352495054494f4e0a02040375726c030800000000000000000520000000000000000000000000000000000000000000000000000000000000000000020109010000000002190b0007000701070207030704110738000a0138010c020c030d0307050a012e11060b0138020b03070638030b0238040200';

const getLpCoinTemplateByteCode = () =>
  'a11ceb0b060000000a01000c020c1e032a2704510805594c07a501c90108ee026006ce032b0af903050cfe0328000a010c02060211021202130001020001020701000002000c01000102030c01000104040200050507000009000100011005060100020708090102030d0501010c030e0d01010c040f0a0b00050b03040001040207040c030202080007080400010b02010800010a02010805010900010b01010900010800070900020a020a020a020b01010805070804020b030109000b02010900010608040105010b03010800020900050c436f696e4d65746164617461074c505f434f494e064f7074696f6e0b5472656173757279436170095478436f6e746578740355726c04636f696e0f6372656174655f63757272656e63790b64756d6d795f6669656c6404696e6974076c705f636f696e156e65775f756e736166655f66726f6d5f6279746573066f7074696f6e137075626c69635f73686172655f6f626a6563740f7075626c69635f7472616e736665720673656e64657204736f6d65087472616e736665720a74785f636f6e746578740375726c0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000020201090a02070653594d424f4c0a0205044e414d450a020c0b4445534352495054494f4e0a02040375726c00020108010000000002120b0007000701070207030704110638000a0138010c020b012e110538020b0238030200';

const Address = bcs.bytes(32).transform({
  // To change the input type, you need to provide a type definition for the input
  input: (val: string) => fromHEX(val),
  output: val => toHEX(val),
});

const updateDecimals = (modifiedByteCode: Uint8Array, decimals: number = 9) =>
  template.update_constants(
    modifiedByteCode,
    bcs.u8().serialize(decimals).toBytes(),
    bcs.u8().serialize(9).toBytes(),
    'U8',
  );

const updateSymbol = (modifiedByteCode: Uint8Array, symbol: string) =>
  template.update_constants(
    modifiedByteCode,
    bcs.string().serialize(symbol.trim()).toBytes(),
    bcs.string().serialize('SYMBOL').toBytes(),
    'Vector(U8)',
  );

const updateName = (modifiedByteCode: Uint8Array, name: string) => {
  return template.update_constants(
    modifiedByteCode,
    bcs.string().serialize(name.trim()).toBytes(),
    bcs.string().serialize('NAME').toBytes(),
    'Vector(U8)',
  );
};

const updateDescription = (modifiedByteCode: Uint8Array, description: string) =>
  template.update_constants(
    modifiedByteCode,
    bcs.string().serialize(description.trim()).toBytes(),
    bcs.string().serialize('DESCRIPTION').toBytes(),
    'Vector(U8)',
  );

const updateUrl = (modifiedByteCode: Uint8Array, url: string) =>
  template.update_constants(
    modifiedByteCode,
    bcs.string().serialize(url).toBytes(),
    bcs.string().serialize('url').toBytes(),
    'Vector(U8)',
  );

const updateMintAmount = (modifiedByteCode: Uint8Array, supply: bigint) =>
  template.update_constants(
    modifiedByteCode,
    bcs.u64().serialize(supply.toString()).toBytes(),
    bcs.u64().serialize(0).toBytes(),
    'U64',
  );

const updateTreasuryCapRecipient = (
  modifiedByteCode: Uint8Array,
  recipient: string,
) =>
  template.update_constants(
    modifiedByteCode,
    Address.serialize(recipient).toBytes(),
    Address.serialize(normalizeSuiAddress('0x0')).toBytes(),
    'Address',
  );

export const client = new SuiClient({ url: getFullnodeUrl('mainnet') });

invariant(process.env.CLAMM && process.env.SUI_TEARS, 'env not set');

export const CLAMM = new CLAMM_({
  suiClient: client,
  network: 'mainnet',
});

interface GetByteCodeArgs {
  decimals: number;
  totalSupply: bigint;
  name: string;
  imageUrl: string;
  symbol: string;
  recipient: string;
  description: string;
}

export const getCoinBytecode = (info: GetByteCodeArgs) => {
  const templateByteCode = fromHEX(getCoinTemplateByteCode());

  const modifiedByteCode = template.update_identifiers(templateByteCode, {
    COIN_TEMPLATE: info.symbol.toUpperCase(),
    coin_template: info.symbol.toLowerCase(),
  });

  let updated = updateDecimals(modifiedByteCode, info.decimals);

  updated = updateSymbol(updated, info.symbol);
  updated = updateName(updated, info.name);

  updated = updateDescription(updated, info.description ?? '');
  updated = updateUrl(updated, info.imageUrl ?? '');

  const supply = info.totalSupply * 10n ** BigInt(info.decimals || 9);

  updated = updateMintAmount(updated, supply);
  updated = updateTreasuryCapRecipient(updated, info.recipient);

  return updated;
};

const getLpCoinBytecode = (info: GetByteCodeArgs) => {
  const templateByteCode = fromHEX(getLpCoinTemplateByteCode());

  const modifiedByteCode = template.update_identifiers(templateByteCode, {
    LP_COIN: info.symbol.toUpperCase().replaceAll('-', '_'),
    lp_coin: info.symbol.toLowerCase().replaceAll('-', '_'),
  });

  let updated = updateDecimals(modifiedByteCode, 9);

  updated = updateSymbol(updated, info.symbol);
  updated = updateName(updated, info.name);

  updated = updateDescription(updated, info.description ?? '');
  updated = updateUrl(updated, info.imageUrl ?? '');

  return updated;
};

export const executeTx = async (tx: Transaction) => {
  const result = await client.signAndExecuteTransaction({
    signer: keypair,
    transaction: tx,
    options: {
      showEffects: true,
    },
    requestType: 'WaitForLocalExecution',
  });

  // return if the tx hasn't succeed
  if (result.effects?.status?.status !== 'success') {
    console.log('\n\nCreating a new stable pool failed');
    return;
  }

  console.log('SUCCESS!');

  // get all created objects IDs
  const createdObjectIds = result.effects.created!.map(
    (item: OwnedObjectRef) => item.reference.objectId,
  );

  // fetch objects data
  return client.multiGetObjects({
    ids: createdObjectIds,
    options: { showContent: true, showType: true, showOwner: true },
  });
};

interface CoinData {
  treasuryCap: null | string;
  coinMetadata: null | string;
  coin: string;
  coinType: string;
}

const getCoinType = (x: string) =>
  x.split('0x2::coin::CoinMetadata<')[1].slice(0, -1);

const extractCoinData = (x: SuiObjectResponse[]) =>
  x.reduce(
    (acc, elem) => {
      if (elem.data?.content?.dataType === 'moveObject') {
        const type = elem.data.content.type;

        const isCoinMetadata = type.startsWith('0x2::coin::CoinMetadata<');
        const isCoin = type.startsWith('0x2::coin::Coin<');
        const isTreasuryCap = type.startsWith('0x2::coin::TreasuryCap<');

        if (isCoinMetadata)
          return {
            ...acc,
            coinMetadata: pathOr('', ['id', 'id'], elem.data.content.fields),
            coinType: getCoinType(elem.data.content.type),
          };
        if (isCoin)
          return {
            ...acc,
            coin: pathOr('', ['id', 'id'], elem.data.content.fields),
          };
        if (isTreasuryCap)
          return {
            ...acc,
            treasuryCap: pathOr('', ['id', 'id'], elem.data.content.fields),
          };

        return acc;
      } else {
        return acc;
      }
    },
    { treasuryCap: '', coinMetadata: '', coin: '', coinType: '' } as CoinData,
  );

export const createCoin = async (info: GetByteCodeArgs) => {
  await template.start();
  const txb = new Transaction();

  txb.setGasBudget(50_000_000);

  const [upgradeCap] = txb.publish({
    modules: [[...getCoinBytecode(info)]],
    dependencies: [normalizeSuiAddress('0x1'), normalizeSuiAddress('0x2')],
  });

  txb.transferObjects([upgradeCap], txb.pure.address(keypair.toSuiAddress()));

  const result = await executeTx(txb);
  return extractCoinData(result || []);
};

export const createLPCoin = async (info: GetByteCodeArgs) => {
  const txb = new Transaction();
  txb.setGasBudget(50_000_000);

  const [upgradeCap] = txb.publish({
    modules: [[...getLpCoinBytecode(info)]],
    dependencies: [normalizeSuiAddress('0x1'), normalizeSuiAddress('0x2')],
  });

  txb.transferObjects([upgradeCap], txb.pure.u64(keypair.toSuiAddress()));

  const result = await executeTx(txb);
  return extractCoinData(result || []);
};

export const log = (x: unknown) =>
  console.log(util.inspect(x, false, null, true));

export const sleep = async (ms = 0) =>
  new Promise(resolve => setTimeout(resolve, ms));

export const PRECISION = 1000000000000000000n;

export const COINS = {
  usdc: {
    treasuryCap:
      '0x18eed948bf31c15a7037627d36baa92abc9efd1f9c73375e751fc8f9378b7228',
    coinMetadata:
      '0xe27e853b616dea3ade022dd82e8775e9f292bb8a60fc3f63b342ff29dba4c06e',
    coinType:
      '0xb97fc1bf5fb56a3b45dd312dbefbb5c9fb4453205ff67a05c73f3ba9964b5b66::usdc::USDC',
  },
  usdt: {
    treasuryCap:
      '0x972f12ed506e246062c73e84dad2e7281f5061ae7328f523c38c8e3da49f63a5',
    coinMetadata:
      '0x40004811f4803ba906b88b03af50cbafb8d71a1c070b7af9991f4e1ac626899e',
    coinType:
      '0xae870af23dda8285a5f11e8136190568796bb76a6e7f3b4061f7ded0c1ebe889::usdt::USDT',
  },
  eth: {
    treasuryCap:
      '0xa13ad40fa947760297fc581af6886a18c19e39e0c2777e7d657e4a6161decb75',
    coinMetadata:
      '0x41b025bfca8120b0127381f8a828d553b5937acd0127be02b42aa634d6c39203',
    coinType:
      '0xc179ea5266d66726abd4ddbaa2d54cd69acef3de43734a1aeafdbf14470e0592::eth::ETH',
  },
};

export const STABLE_POOL_USDC_USDT_OBJECT_ID =
  '0xc327293beb3dad06ef8d49c825a2aafc0be96ff03dcd61dbdba7c8c3e0b27c5d';

export const VOLATILE_POOL_USDC_ETH_OBJECT_ID =
  '0x8fdc21ed6816810cf2c5008c88edba78fd7e5f17a44a267c36df4f3b748f70d8';

export const VOLATILE_POOL_USDT_ETH_OBJECT_ID =
  '0x2710403d3852257df01f1708d92b6317b1535c3b9dbba5258db872f516954ca3';

export function removeLeadingZeros(address: string): string {
  return (address as any).replaceAll(/0x0+/g, '0x');
}

export async function getCoinOfValue(
  tx: Transaction,
  coinType: string,
  coinValue: bigint,
): Promise<TransactionResult> {
  let coinOfValue: TransactionResult;
  coinType = removeLeadingZeros(coinType);
  if (coinType === '0x2::sui::SUI') {
    coinOfValue = tx.splitCoins(tx.gas, [tx.pure.u64(coinValue)]);
  } else {
    const paginatedCoins = await client.getCoins({
      owner: keypair.toSuiAddress(),
      coinType,
    });

    const [firstCoin, ...otherCoins] = paginatedCoins.data;

    const firstCoinInput = tx.object(firstCoin.coinObjectId);

    if (otherCoins.length > 0) {
      tx.mergeCoins(
        firstCoinInput,
        otherCoins.map(coin => coin.coinObjectId),
      );
    }
    coinOfValue = tx.splitCoins(firstCoinInput, [tx.pure.u64(coinValue)]);
  }
  return coinOfValue;
}
