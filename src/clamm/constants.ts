export const PACKAGES = {
  mainnet: {
    CLAMM: '0x429dbf2fc849c0b4146db09af38c104ae7a3ed746baf835fa57fee27fa5ff382',
    SUITEARS:
      '0x7ba65fa88ed4026304b7f95ee86f96f8169170efe84b56d465b4fe305e2486cb',
  },
  testnet: {
    CLAMM: '',
    SUITEARS: '',
  },
  devnet: {
    CLAMM: '',
    SUITEARS: '',
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

export const UTILS_PACKAGES = {
  mainnet: '0xb2e3014cc53bd1f53a947591114ca56ad5a05990f9c0d0734833a75884d04c69',
  testnet: '0x6201e31006640c39e77f2b7ef6e42ae8219045f3957da53b1280112dca2bd73e',
  devnet: '',
};
