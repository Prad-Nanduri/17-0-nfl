import type { OpponentContext, SimulationMode } from '@perfect-season/sport-engine-core';
import { createSeed } from '@perfect-season/sport-engine-core/utils';
import type { NflFixtureData, NflSportEngine } from '@perfect-season/sport-engine-nfl';
import { completedRoster } from './draft-client';
import type { DraftState, StoredResult } from './draft-store';

export const NFL_SIMULATION_MODEL_VERSION = 'nfl-sim-v1';
export const NFL_SIMULATION_DATA_VERSION = '2023-fixtures';

export function nflOpponentContext(): OpponentContext {
  return {
    season: 2023,
    modelVersion: NFL_SIMULATION_MODEL_VERSION,
    dataVersion: NFL_SIMULATION_DATA_VERSION,
    opponents: [],
    facts: {},
  };
}

export function pickMvp(
  state: DraftState,
  scheme: ReturnType<NflSportEngine['getSchemePresets']>[number],
): StoredResult['mvp'] {
  const picks = scheme.slots
    .map((slot) => state.picks[slot.code])
    .filter((pick): pick is NonNullable<typeof pick> => pick !== undefined);
  const mvp = picks.reduce(
    (best, pick) => (best === null || pick.rating.overall > best.rating.overall ? pick : best),
    null as (typeof picks)[number] | null,
  );
  if (mvp === null) throw new Error('Cannot choose an MVP without completed picks');
  return {
    slotCode: mvp.slotCode,
    playerId: mvp.playerId,
    fullName: mvp.fullName,
    primaryPosition: mvp.primaryPosition,
    headshotUrl: mvp.headshotUrl,
    rating: mvp.rating.overall,
    unit: mvp.unit,
  };
}

export async function simulateDraft(
  state: DraftState,
  engine: NflSportEngine,
  data: NflFixtureData,
  opts: { readonly fullGauntlet: boolean; readonly seed: string | null },
): Promise<StoredResult> {
  const roster = completedRoster(state, engine, data);
  const seed = opts.seed ?? createSeed('nfl-sim', state.id);
  const mode: SimulationMode = {
    modeId: 'core',
    difficulty: state.difficulty,
    seed,
    options: { fullGauntlet: opts.fullGauntlet },
  };
  const season = await engine.simulateSeason(roster, mode, nflOpponentContext());
  const evaluatedAt = new Date().toISOString();
  const trophies = engine.evaluateTrophies(season, {
    userId: null,
    roster,
    priorResults: [],
    earnedTrophies: [],
    evaluatedAt,
    facts: {},
  });
  const scheme = engine.getSchemePresets().find((item) => item.id === state.schemeId);
  if (scheme === undefined) throw new Error(`Unknown NFL scheme: ${state.schemeId}`);
  return {
    season,
    trophies,
    mvp: pickMvp(state, scheme),
    fullGauntlet: opts.fullGauntlet,
    simulatedAt: evaluatedAt,
  };
}
