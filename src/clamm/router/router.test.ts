import { findRoutes, constructDex } from './index.ts';

const pools = [
  {
    poolObjectId:
      '0xc327293beb3dad06ef8d49c825a2aafc0be96ff03dcd61dbdba7c8c3e0b27c5d',
    lpCoinType:
      '006cc59c6b5a9b48e8193ebee689b5d6572b63cb303ada7de309336b27c6b027::ipx_s_usdc_usdt::IPX_S_USDC_USDT',
    isStable: true,
    coinTypes: [
      '0xb97fc1bf5fb56a3b45dd312dbefbb5c9fb4453205ff67a05c73f3ba9964b5b66::usdc::USDC',
      '0xae870af23dda8285a5f11e8136190568796bb76a6e7f3b4061f7ded0c1ebe889::usdt::USDT',
    ],
  },
  {
    poolObjectId:
      '0x8fdc21ed6816810cf2c5008c88edba78fd7e5f17a44a267c36df4f3b748f70d8',
    lpCoinType:
      '17a4491a28ff6696f95071228c714fd1d0f8de947be74715ee35c9fb7f32bbd1::ipx_v_usdc_eth::IPX_V_USDC_ETH',
    isStable: false,
    coinTypes: [
      '0xb97fc1bf5fb56a3b45dd312dbefbb5c9fb4453205ff67a05c73f3ba9964b5b66::usdc::USDC',
      '0xc179ea5266d66726abd4ddbaa2d54cd69acef3de43734a1aeafdbf14470e0592::eth::ETH',
    ],
  },
  {
    poolObjectId:
      '0x2710403d3852257df01f1708d92b6317b1535c3b9dbba5258db872f516954ca3',
    coinTypes: [
      '0xae870af23dda8285a5f11e8136190568796bb76a6e7f3b4061f7ded0c1ebe889::usdt::USDT',
      '0xc179ea5266d66726abd4ddbaa2d54cd69acef3de43734a1aeafdbf14470e0592::eth::ETH',
    ],
    isStable: false,
    lpCoinType:
      'acd4ce261fe5861f51254c58efdcbe83ca208856923c8fa3795e4c04a0563542::ipx_v_usdt_eth::IPX_V_USDT_ETH',
  },
  {
    poolObjectId:
      '0xe15dae6f466151e24043d4d98825ba3123c0bc28584b5bbaa0dd5ac96c01af46',
    coinTypes: [
      '0xae870af23dda8285a5f11e8136190568796bb76a6e7f3b4061f7ded0c1ebe889::usdt::USDT',
      '0x62a807f396a729dfb9dd931bc6a49d840ede3ce058fe11e38d1f097d8466ee60::bonden::BONDEN',
    ],
    isStable: false,
    lpCoinType:
      'a28759498847c5eb71a1d9a861490192307daee4ba5abcb655d48076a1463eb5::ipx_v_usdt_eth::IPX_V_USDT_ETH',
  },
  {
    poolObjectId:
      '0x75fcad614f96e5e587ac357a3117a1d5941b3414805def62c666f8e92173305b',
    coinTypes: [
      '0xae870af23dda8285a5f11e8136190568796bb76a6e7f3b4061f7ded0c1ebe889::usdt::USDT',
      '0x328ffb64d7562fbca80203bccd4f4e548edb80e0abb7bebebe05d93503b835e5::pepe::PEPE',
    ],
    isStable: false,
    lpCoinType:
      'fb9ac0b07ff1dcb73778a1fa62584f595f3ec1addad6d6014a6c80aed9d90259::ipx_v_usdt_eth::IPX_V_USDT_ETH',
  },
];

const coins = {
  eth: '0xc179ea5266d66726abd4ddbaa2d54cd69acef3de43734a1aeafdbf14470e0592::eth::ETH',
  usdc: '0xb97fc1bf5fb56a3b45dd312dbefbb5c9fb4453205ff67a05c73f3ba9964b5b66::usdc::USDC',
  usdt: '0xae870af23dda8285a5f11e8136190568796bb76a6e7f3b4061f7ded0c1ebe889::usdt::USDT',
  boden:
    '0x62a807f396a729dfb9dd931bc6a49d840ede3ce058fe11e38d1f097d8466ee60::bonden::BONDEN',
  pepe: '0x328ffb64d7562fbca80203bccd4f4e548edb80e0abb7bebebe05d93503b835e5::pepe::PEPE',
};

describe(findRoutes.name, () => {
  it('finds all possible paths', () => {
    expect(findRoutes(constructDex(pools), coins.pepe, coins.eth)).toEqual([
      [
        [
          '0x328ffb64d7562fbca80203bccd4f4e548edb80e0abb7bebebe05d93503b835e5::pepe::PEPE',
          '0xae870af23dda8285a5f11e8136190568796bb76a6e7f3b4061f7ded0c1ebe889::usdt::USDT',
          '0xb97fc1bf5fb56a3b45dd312dbefbb5c9fb4453205ff67a05c73f3ba9964b5b66::usdc::USDC',
          '0xc179ea5266d66726abd4ddbaa2d54cd69acef3de43734a1aeafdbf14470e0592::eth::ETH',
        ],
        [
          '0x75fcad614f96e5e587ac357a3117a1d5941b3414805def62c666f8e92173305b',
          '0xc327293beb3dad06ef8d49c825a2aafc0be96ff03dcd61dbdba7c8c3e0b27c5d',
          '0x8fdc21ed6816810cf2c5008c88edba78fd7e5f17a44a267c36df4f3b748f70d8',
        ],
      ],
      [
        [
          '0x328ffb64d7562fbca80203bccd4f4e548edb80e0abb7bebebe05d93503b835e5::pepe::PEPE',
          '0xae870af23dda8285a5f11e8136190568796bb76a6e7f3b4061f7ded0c1ebe889::usdt::USDT',
          '0xc179ea5266d66726abd4ddbaa2d54cd69acef3de43734a1aeafdbf14470e0592::eth::ETH',
        ],
        [
          '0x75fcad614f96e5e587ac357a3117a1d5941b3414805def62c666f8e92173305b',
          '0x2710403d3852257df01f1708d92b6317b1535c3b9dbba5258db872f516954ca3',
        ],
      ],
    ]);
  });
});
