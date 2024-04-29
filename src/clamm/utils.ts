import { bcs } from '@mysten/sui.js/bcs';
import {
  CoinMetadata,
  MoveStruct,
  SuiClient,
  SuiExecutionResult,
} from '@mysten/sui.js/client';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { normalizeStructTag, normalizeSuiAddress } from '@mysten/sui.js/utils';
import { path, pathOr, prop, propOr } from 'ramda';
import { map, toString } from 'ramda';
import invariant from 'tiny-invariant';

import { CoinMeta, StablePoolState, VolatilePoolState } from './clamm.types';
import data from './data/metadata.json';

export const listToString = map(toString);

export const ZERO_ADDRESS = normalizeSuiAddress('0x0');

const cache = new Map<string, CoinMetadata>(
  (data as CoinMeta[]).map(meta => [meta.type, meta]),
);

export async function getCoinMeta(
  client: SuiClient,
  coinType: string,
): Promise<CoinMetadata> {
  const normalizedType = normalizeStructTag(coinType);
  const cachedMeta = cache.get(normalizedType);
  if (cachedMeta) {
    return cachedMeta;
  }

  const coinMeta = await client.getCoinMetadata({ coinType: normalizedType });
  if (!coinMeta) {
    throw new Error(`CoinMetadata not found for type: ${normalizedType}`);
  }

  cache.set(normalizedType, coinMeta);

  return coinMeta;
}

export const normalizeSuiCoinType = (x: string) => {
  const arr = x.split('::');
  invariant(arr.length === 3, 'Not a coin type');
  return `${normalizeSuiAddress(arr[0], true)}::${arr[1]}::${arr[2]}`;
};

export async function getCoinMetas(
  client: SuiClient,
  coinTypes: string[],
): Promise<Map<string, CoinMetadata | null>> {
  // It's possible (but unlikely) that some duplicates remain if addresses are
  // inconsistently normalized, e.g. ['0x000...002::sui::SUI', '0x2::sui::SUI'].
  const uniqueTypes = Array.from(new Set(coinTypes));

  const results = await Promise.allSettled(
    uniqueTypes.map(coinType => getCoinMeta(client, coinType)),
  );

  const metas = new Map<string, CoinMetadata | null>();
  results.forEach((result, index) => {
    metas.set(
      uniqueTypes[index],
      result.status === 'fulfilled' ? result.value : null,
    );
  });

  return metas;
}

export const parseStableV1State = (struct: MoveStruct) => {
  const fields = path(['value', 'fields'], struct) as Record<string, any>;
  const lpCoinType = pathOr('', ['lp_coin_supply', 'type'], fields)
    .split('Supply<')[1]
    .slice(0, -1);

  const state = {
    lpCoinDecimals: 9,
    lpCoinSupply: BigInt(
      pathOr(0n, ['lp_coin_supply', 'fields', 'value'], fields),
    ),
    balances: prop('balances', fields).map((x: string) => BigInt(x)),
    initialA: BigInt(prop('initial_a', fields)),
    futureA: BigInt(prop('future_a', fields)),
    initialATime: BigInt(prop('initial_a_time', fields)),
    futureATime: BigInt(prop('future_a_time', fields)),
    nCoins: prop('balances', fields).map((x: string) => BigInt(x)).length,
    fees: {
      feeOutPercent: BigInt(
        pathOr(0n, ['fees', 'fields', 'fee_out_percent'], fields),
      ),
      feeInPercent: BigInt(
        pathOr(0n, ['fees', 'fields', 'fee_in_percent'], fields),
      ),
      adminFeePercent: BigInt(
        pathOr(0n, ['fees', 'fields', 'admin_fee_percent'], fields),
      ),
    },
  } as StablePoolState;

  return {
    state,
    lpCoinType,
  };
};

export const parseVolatileV1State = (struct: MoveStruct) => {
  const fields = path(['value', 'fields'], struct) as Record<string, any>;
  const lpCoinType = pathOr('', ['lp_coin_supply', 'type'], fields)
    .split('Supply<')[1]
    .slice(0, -1);

  const coinStates = pathOr([], ['coin_states', 'fields', 'contents'], fields);

  const state = {
    a: BigInt(pathOr(0n, ['a_gamma', 'fields', 'a'], fields)),
    futureA: BigInt(pathOr(0n, ['a_gamma', 'fields', 'future_a'], fields)),
    gamma: BigInt(pathOr(0n, ['a_gamma', 'fields', 'gamma'], fields)),
    futureGamma: BigInt(
      pathOr(0n, ['a_gamma', 'fields', 'future_gamma'], fields),
    ),
    initialTime: BigInt(
      pathOr(0n, ['a_gamma', 'fields', 'initial_time'], fields),
    ),
    futureTime: BigInt(
      pathOr(0n, ['a_gamma', 'fields', 'future_time'], fields),
    ),
    adminBalance: BigInt(propOr(0n, 'admin_balance', fields)),
    balances: prop('balances', fields).map((x: string) => BigInt(x)),
    d: BigInt(prop('d', fields)),
    lastPriceTimestamp: BigInt(prop('last_prices_timestamp', fields)),
    lpCoinSupply: BigInt(
      pathOr(0n, ['lp_coin_supply', 'fields', 'value'], fields),
    ),
    minA: BigInt(prop('min_a', fields)),
    maxA: BigInt(prop('max_a', fields)),
    nCoins: prop('balances', fields).length,
    notAdjusted: prop('not_adjusted', fields),
    virtualPrice: BigInt(prop('virtual_price', fields)),
    xcpProfit: BigInt(prop('xcp_profit', fields)),
    xcpProfitA: BigInt(prop('xcp_profit_a', fields)),
    rebalancingParams: {
      adjustmentStep: BigInt(
        pathOr(0n, ['rebalancing_params', 'fields', 'adjustment_step'], fields),
      ),
      extraProfit: BigInt(
        pathOr(0n, ['rebalancing_params', 'fields', 'extra_profit'], fields),
      ),
      maHalfTime: BigInt(
        pathOr(0n, ['rebalancing_params', 'fields', 'ma_half_time'], fields),
      ),
    },
    fees: {
      adminFee: BigInt(pathOr(0n, ['fees', 'fields', 'admin_fee'], fields)),
      gammaFee: BigInt(pathOr(0n, ['fees', 'fields', 'gamma_fee'], fields)),
      midFee: BigInt(pathOr(0n, ['fees', 'fields', 'mid_fee'], fields)),
      outFee: BigInt(pathOr(0n, ['fees', 'fields', 'out_fee'], fields)),
    },
    coinStateMap: createCoinStateMap(coinStates),
  } as VolatilePoolState;

  return {
    state,
    lpCoinType,
  };
};

export const createCoinStateMap = (struct: MoveStruct[]) =>
  struct.reduce(
    (acc: VolatilePoolState['coinStateMap'], elem: Record<string, any>) => {
      const content = path(['fields', 'value'], elem);
      const type = normalizeSuiCoinType(
        path(['fields', 'type_name', 'fields', 'name'], content) as string,
      );

      return {
        ...acc,
        [type]: {
          type,
          index: +pathOr(0, ['fields', 'index'], content),
          lastPrice: BigInt(pathOr(0n, ['fields', 'last_price'], content)),
          price: BigInt(pathOr(0n, ['fields', 'price'], content)),
          priceOracle: BigInt(pathOr(0n, ['fields', 'price_oracle'], content)),
        },
      };
    },
    {} as VolatilePoolState['coinStateMap'],
  );

async function devInspectAndGetResults(
  suiClient: SuiClient,
  txb: TransactionBlock,
  sender = ZERO_ADDRESS,
): Promise<SuiExecutionResult[]> {
  const resp = await suiClient.devInspectTransactionBlock({
    sender: sender,
    transactionBlock: txb,
  });
  if (resp.error) {
    throw Error(`response error: ${JSON.stringify(resp, null, 2)}`);
  }
  if (!resp.results?.length) {
    throw Error(`response has no results: ${JSON.stringify(resp, null, 2)}`);
  }
  return resp.results;
}

export async function devInspectAndGetReturnValues(
  suiClient: SuiClient,
  txb: TransactionBlock,
  sender = ZERO_ADDRESS,
): Promise<unknown[][]> {
  const results = await devInspectAndGetResults(suiClient, txb, sender);
  /** The values returned from each of the transactions in the TransactionBlock. */
  const blockReturnValues: unknown[][] = [];
  for (const txnResult of results) {
    if (!txnResult.returnValues?.length) {
      throw Error(
        `transaction didn't return any values: ${JSON.stringify(txnResult, null, 2)}`,
      );
    }
    /** The values returned from the transaction (a function can return multiple values). */
    const txnReturnValues: unknown[] = [];
    for (const value of txnResult.returnValues) {
      const valueData = Uint8Array.from(value[0]);
      const valueType = value[1];
      let valueDeserialized: unknown;
      if (valueType === '0x1::string::String') {
        valueDeserialized = bcs.string().parse(valueData);
      } else if (valueType === 'vector<0x1::string::String>') {
        valueDeserialized = bcs.vector(bcs.string()).parse(valueData);
      } else {
        valueDeserialized = bcs.de(valueType, valueData, 'hex');
      }
      txnReturnValues.push(valueDeserialized);
    }
    blockReturnValues.push(txnReturnValues);
  }
  return blockReturnValues;
}
