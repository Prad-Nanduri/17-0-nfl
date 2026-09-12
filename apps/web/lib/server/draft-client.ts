import type { CompletedRoster, PositionRating } from '@perfect-season/sport-engine-core';
import { aggregateRosterRating } from '@perfect-season/simulation';
import type { NflSportEngine } from '@perfect-season/sport-engine-nfl';
import type { NflFixtureData } from '@perfect-season/sport-engine-nfl';
import { buildCandidates } from './candidates';
import type { DraftState, StoredPick, StoredResult } from './draft-store';

export interface ClientPick extends Omit<StoredPick, 'rating'> {
  readonly rating: PositionRating | null;
}

export interface ClientDraft {
  readonly id: string;
  readonly sportId: 'nfl';
  readonly modeId: 'core';
  readonly draftOrder: DraftState['draftOrder'];
  readonly difficulty: DraftState['difficulty'];
  readonly ratingMode: DraftState['ratingMode'];
  readonly schemeId: DraftState['schemeId'];
  readonly status: DraftState['status'];
  readonly spinCount: number;
  readonly rerollsRemaining: number;
  readonly picks: Readonly<Record<string, ClientPick>>;
  readonly usedUnits: DraftState['usedUnits'];
  readonly aggregateRating: number | null;
  readonly result: StoredResult | null;
}

export function completedRoster(
  state: DraftState,
  engine: NflSportEngine,
  data: NflFixtureData,
): CompletedRoster {
  const scheme = engine.getSchemePresets().find((item) => item.id === state.schemeId);
  if (scheme === undefined) throw new Error(`Unknown NFL scheme: ${state.schemeId}`);
  const picks = scheme.slots.map((slot) => {
    const stored = state.picks[slot.code];
    if (stored === undefined) throw new Error(`Missing completed pick for ${slot.code}`);
    const candidate = buildCandidates(stored.unit, data).find(
      (item) => item.playerId === stored.playerId,
    );
    if (candidate === undefined) throw new Error(`Missing candidate for ${stored.playerId}`);
    return {
      slot,
      candidate,
      rating: stored.rating,
      spinSeed: stored.spinSeed,
    };
  });
  return {
    draftId: state.id,
    sportId: 'nfl',
    schemeId: state.schemeId,
    ratingMode: state.ratingMode,
    picks: picks as unknown as CompletedRoster['picks'],
  };
}

export function toClientDraft(
  state: DraftState,
  engine: NflSportEngine,
  data: NflFixtureData,
): ClientDraft {
  const complete = state.status === 'complete';
  const aggregateRating = complete
    ? aggregateRosterRating(completedRoster(state, engine, data))
    : null;
  const picks = Object.fromEntries(
    Object.entries(state.picks).map(([slotCode, pick]) => [
      slotCode,
      {
        ...pick,
        rating: state.difficulty === 'hard' && !complete ? null : pick.rating,
      },
    ]),
  );
  return {
    id: state.id,
    sportId: state.sportId,
    modeId: state.modeId,
    draftOrder: state.draftOrder,
    difficulty: state.difficulty,
    ratingMode: state.ratingMode,
    schemeId: state.schemeId,
    status: state.status,
    spinCount: state.spinCount,
    rerollsRemaining: state.rerollsRemaining,
    picks,
    usedUnits: state.usedUnits,
    aggregateRating,
    result: state.result,
  };
}
