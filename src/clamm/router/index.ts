import { normalizeStructTag } from '@mysten/sui.js/utils';
import { PoolMetadata } from '../clamm.types.ts';
import { Dex, Routes } from './router.types.ts';

export const constructDex = (pools: readonly PoolMetadata[]): Dex => {
  const dex: Dex = {};
  for (const pool of pools) {
    const coins = pool.coinTypes;
    coins.forEach((coinA, i) => {
      if (!dex[coinA]) dex[coinA] = [];

      for (let j = i + 1; j < coins.length; j++) {
        const coinB = coins[j];
        if (!dex[coinB]) dex[coinB] = [];

        dex[coinA].push(pool.poolObjectId);
        if (coinB !== coinA) {
          dex[coinB].push(pool.poolObjectId);
        }
      }
    });
  }
  return dex;
};

export const findRoutes = (
  Dex: Dex,
  startCoin: string,
  endCoin: string,
): Routes => {
  startCoin = normalizeStructTag(startCoin);
  endCoin = normalizeStructTag(endCoin);

  const allPaths: [string[], string[]][] = [];
  const visited: { [key: string]: boolean } = {};

  function backtrack(currentCoin: string, path: string[], poolIds: string[]) {
    visited[currentCoin] = true;
    path.push(currentCoin);

    if (currentCoin === endCoin) {
      allPaths.push([path.slice(), poolIds.slice()]);
    } else {
      for (const pool of Dex[currentCoin]) {
        for (const neighborCoin of Object.keys(Dex)) {
          if (Dex[neighborCoin].includes(pool) && !visited[neighborCoin]) {
            backtrack(neighborCoin, path, [...poolIds, pool]);
          }
        }
      }
    }

    visited[currentCoin] = false;
    path.pop();
  }

  backtrack(startCoin, [], []);
  return allPaths;
};
