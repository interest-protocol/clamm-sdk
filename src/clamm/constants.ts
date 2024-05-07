export const NEW_POOL_FUNCTION_NAME_MAP = {
  3: 'new_2_pool',
  4: 'new_3_pool',
  5: 'new_4_pool',
  6: 'new_5_pool',
} as Record<number, string>;

export const ADD_LIQUIDITY_FUNCTION_NAME_MAP = {
  2: 'add_liquidity_2_pool',
  3: 'add_liquidity_3_pool',
  4: 'add_liquidity_4_pool',
  5: 'add_liquidity_5_pool',
} as Record<number, string>;

export const REMOVE_LIQUIDITY_FUNCTION_NAME_MAP = {
  2: 'remove_liquidity_2_pool',
  3: 'remove_liquidity_3_pool',
  4: 'remove_liquidity_4_pool',
  5: 'remove_liquidity_5_pool',
} as Record<number, string>;

export enum SuiCoinsNetwork {
  MAINNET = 'sui:mainnet',
  TESTNET = 'sui:testnet',
}
