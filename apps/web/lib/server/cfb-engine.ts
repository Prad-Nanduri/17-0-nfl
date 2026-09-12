import { createCfbSportEngine } from '@perfect-season/sport-engine-cfb';
import type { CfbFixtureData } from '@perfect-season/sport-engine-cfb';
import { loadCfbFixtureData } from '@perfect-season/sport-engine-cfb';

interface CfbServerGlobal {
  __perfectSeasonCfbData?: CfbFixtureData;
  __perfectSeasonCfbEngine?: ReturnType<typeof createCfbSportEngine>;
}

const serverGlobal = globalThis as typeof globalThis & CfbServerGlobal;

export function getCfbData(): CfbFixtureData {
  serverGlobal.__perfectSeasonCfbData ??= loadCfbFixtureData();
  return serverGlobal.__perfectSeasonCfbData;
}

export function getCfbEngine(): ReturnType<typeof createCfbSportEngine> {
  serverGlobal.__perfectSeasonCfbEngine ??= createCfbSportEngine();
  return serverGlobal.__perfectSeasonCfbEngine;
}
