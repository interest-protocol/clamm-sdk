import {
  CoinMetadata,
  MoveStruct,
  SuiClient,
  SuiObjectResponse,
} from '@mysten/sui.js/client';
import { normalizeStructTag, normalizeSuiAddress } from '@mysten/sui.js/utils';
import { path, pathOr, prop, propOr } from 'ramda';
import invariant from 'tiny-invariant';
import { map, toString } from 'ramda';
import { CoinMeta, StablePoolState, VolatilePoolState } from './clamm.types';
import data from './data/metadata.json';

export const listToString = map(toString);

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
  const fields = path(['value', 'fields'], struct) as any;
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
  const fields = path(['value', 'fields'], struct) as any;
  const lpCoinType = pathOr('', ['lp_coin_supply', 'type'], fields)
    .split('Supply<')[1]
    .slice(0, -1);

  const coinStatesId = pathOr(
    '',
    ['coin_states', 'fields', 'id', 'id'],
    fields,
  );

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
  };

  return {
    state,
    lpCoinType,
    coinStatesId,
  };
};

export const createCoinStateMap = (response: SuiObjectResponse[]) => {
  const fields = response.map(x =>
    path(['data', 'content', 'fields', 'value', 'fields'], x),
  );

  const map = fields.reduce(
    (acc: VolatilePoolState['coinStateMap'], elem) => {
      const type = normalizeSuiCoinType(
        path(['type_name', 'fields', 'name'], elem) as string,
      );

      return {
        ...acc,
        [type]: {
          type,
          index: +pathOr(0, ['index'], elem),
          lastPrice: BigInt(pathOr(0n, ['last_price'], elem)),
          price: BigInt(pathOr(0n, ['price'], elem)),
          priceOracle: BigInt(pathOr(0n, ['price_oracle'], elem)),
        },
      };
    },
    {} as VolatilePoolState['coinStateMap'],
  );

  return map;
};
