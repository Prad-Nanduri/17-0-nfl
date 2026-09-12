import { loadNflFixtureData } from '@perfect-season/sport-engine-nfl';
import type { NflFixtureData } from '@perfect-season/sport-engine-nfl';

interface NflServerGlobal {
  __perfectSeasonNflData?: NflFixtureData;
}

const serverGlobal = globalThis as typeof globalThis & NflServerGlobal;

export function getNflData(): NflFixtureData {
  serverGlobal.__perfectSeasonNflData ??= loadNflFixtureData();
  return serverGlobal.__perfectSeasonNflData;
}

export { getNflEngine } from './sport-engines';
