import { createNflSportEngine } from '@perfect-season/sport-engine-nfl';
import type { NflFixtureData } from '@perfect-season/sport-engine-nfl';
import { loadNflFixtureData } from '@perfect-season/sport-engine-nfl';

interface NflServerGlobal {
  __perfectSeasonNflData?: NflFixtureData;
  __perfectSeasonNflEngine?: ReturnType<typeof createNflSportEngine>;
}

const serverGlobal = globalThis as typeof globalThis & NflServerGlobal;

export function getNflData(): NflFixtureData {
  serverGlobal.__perfectSeasonNflData ??= loadNflFixtureData();
  return serverGlobal.__perfectSeasonNflData;
}

export function getNflEngine(): ReturnType<typeof createNflSportEngine> {
  serverGlobal.__perfectSeasonNflEngine ??= createNflSportEngine();
  return serverGlobal.__perfectSeasonNflEngine;
}
