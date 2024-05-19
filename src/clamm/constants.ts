export const PACKAGES = {
  mainnet: {
    CLAMM: '0x429dbf2fc849c0b4146db09af38c104ae7a3ed746baf835fa57fee27fa5ff382',
    SUITEARS:
      '0x7ba65fa88ed4026304b7f95ee86f96f8169170efe84b56d465b4fe305e2486cb',
    UTILS: '0x935ccb91431a0b7dade86e968ad1df02e8d7c802de217015d77070b5e31e4e13',
  },
  testnet: {
    CLAMM: '',
    SUITEARS: '',
    UTILS: '0x8744a0ae6d4c57b721bea42261682ce81f66bf9ee7a8ef94a85c66445df23771',
  },
  devnet: {
    CLAMM: '',
    SUITEARS: '',
    UTILS: '',
  },
};

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
