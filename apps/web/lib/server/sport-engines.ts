// Canonical registration point for every SportEngine. Add new sports here (and only here).
import {
  createSportEngineRegistry,
  type SportEngineRegistry,
} from '@perfect-season/sport-engine-core';
import { createNflSportEngine } from '@perfect-season/sport-engine-nfl';
import { createCfbSportEngine } from '@perfect-season/sport-engine-cfb';
import type { CfbFixtureData } from '@perfect-season/sport-engine-cfb';
import { loadCfbFixtureData } from '@perfect-season/sport-engine-cfb';
import { createCfbAdapter } from './cfb-adapter';
import { createNflAdapter } from './nfl-adapter';
import { registerSportAdapters } from './sport-adapter';

interface ServerGlobal {
  __perfectSeasonNflEngine?: ReturnType<typeof createNflSportEngine>;
  __perfectSeasonCfbData?: CfbFixtureData;
  __perfectSeasonCfbEngine?: ReturnType<typeof createCfbSportEngine>;
}

const serverGlobal = globalThis as typeof globalThis & ServerGlobal;
registerSportAdapters(createNflAdapter(), createCfbAdapter());

export function getNflEngine(): ReturnType<typeof createNflSportEngine> {
  serverGlobal.__perfectSeasonNflEngine ??= createNflSportEngine();
  return serverGlobal.__perfectSeasonNflEngine;
}

export function getCfbData(): CfbFixtureData {
  serverGlobal.__perfectSeasonCfbData ??= loadCfbFixtureData();
  return serverGlobal.__perfectSeasonCfbData;
}

export function getCfbEngine(): ReturnType<typeof createCfbSportEngine> {
  serverGlobal.__perfectSeasonCfbEngine ??= createCfbSportEngine();
  return serverGlobal.__perfectSeasonCfbEngine;
}

export function getSportEngineRegistry(): SportEngineRegistry {
  return createSportEngineRegistry({ nfl: getNflEngine(), cfb: getCfbEngine() });
}
