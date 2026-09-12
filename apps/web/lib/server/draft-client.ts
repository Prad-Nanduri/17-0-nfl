import type { CompletedRoster, PositionRating, SportId } from '@perfect-season/sport-engine-core';
import { aggregateRosterRating } from '@perfect-season/simulation';
import { resolveProgramTheme } from '../cfb-theme';
import { getCfbData } from './sport-engines';
import { getSportAdapter } from './sport-adapter';
import type { DraftState, StoredPick, StoredResult } from './draft-store';

export interface ClientPick extends Omit<StoredPick, 'rating'> {
  readonly rating: PositionRating | null;
}

export interface ClientDraft {
  readonly id: string;
  readonly sportId: SportId;
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
  readonly theme?: {
    readonly primary: string;
    readonly secondary: string;
    readonly source: 'cfbd' | 'static' | 'fallback';
  };
}

function majorityUnit(state: DraftState) {
  const counts = new Map<string, { unit: DraftState['usedUnits'][number]; count: number }>();
  for (const pick of Object.values(state.picks)) {
    const key = JSON.stringify(pick.unit);
    const entry = counts.get(key) ?? { unit: pick.unit, count: 0 };
    entry.count += 1;
    counts.set(key, entry);
  }
  return [...counts.values()].sort((a, b) => b.count - a.count)[0]?.unit;
}

export function completedRoster(state: DraftState): CompletedRoster {
  return getSportAdapter(state.sportId).buildCompletedRoster(state);
}

export function toClientDraft(state: DraftState): ClientDraft {
  const adapter = getSportAdapter(state.sportId);
  const complete = state.status === 'complete';
  const aggregateRating = complete
    ? aggregateRosterRating(adapter.buildCompletedRoster(state))
    : null;
  const picks = Object.fromEntries(
    Object.entries(state.picks).map(([slotCode, pick]) => [
      slotCode,
      adapter.toClientPick(pick, state.difficulty === 'hard' && !complete),
    ]),
  );
  const unit = majorityUnit(state);
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
    ...(state.sportId === 'cfb' && unit?.sportId === 'cfb'
      ? (() => {
          const team = getCfbData().teams.find(
            (entry) => entry.cfbdTeamId === Number(unit.programId),
          );
          return {
            theme: resolveProgramTheme({
              color: team?.color ?? null,
              alternateColor: team?.alternateColor ?? null,
              abbreviation: team?.abbreviation ?? '',
            }),
          };
        })()
      : {}),
  };
}
