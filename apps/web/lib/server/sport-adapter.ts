import type {
  CompletedRoster,
  DraftPoolUnit,
  EngineFacts,
  OpponentContext,
  PlayerCandidate,
  RosterSlot,
  SchemePreset,
  SportEngine,
  SportId,
} from '@perfect-season/sport-engine-core';
import type { ClientPick } from './draft-client';
import { createCfbAdapter } from './cfb-adapter';
import { createNflAdapter } from './nfl-adapter';
import type { DraftState, StoredResult } from './draft-store';

export interface SpinTeamView {
  readonly key: string;
  readonly name: string;
  readonly abbreviation: string;
  readonly conference: string;
  readonly logoUrl: string | null;
  readonly record: { readonly wins: number; readonly losses: number; readonly ties: number } | null;
  readonly eraTier: string;
  readonly color?: string | null;
  readonly alternateColor?: string | null;
}

export interface SportDraftAdapter {
  readonly sportId: SportId;
  engine(): SportEngine;
  buildCandidates(unit: DraftPoolUnit): PlayerCandidate[];
  availableSeasons(): { from: number; through: number };
  resolveSpinUnit(spinSeed: string, usedUnits: readonly DraftPoolUnit[]): Promise<DraftPoolUnit>;
  spinUnitView(unit: DraftPoolUnit): Promise<SpinTeamView>;
  opponentContext(unit: DraftPoolUnit | null): OpponentContext;
  simSeed(draftId: string): string;
  simulationOptions(input: Record<string, unknown>): EngineFacts;
  buildCompletedRoster(state: DraftState): CompletedRoster;
  toClientPick(pick: DraftState['picks'][string], ratingHidden: boolean): ClientPick;
  pickMvp(state: DraftState, scheme: SchemePreset): StoredResult['mvp'];
}

export function getSportAdapter(sportId: SportId): SportDraftAdapter {
  return sportId === 'nfl' ? getNflAdapter() : getCfbAdapter();
}

let nflAdapter: SportDraftAdapter | null = null;
let cfbAdapter: SportDraftAdapter | null = null;

function getNflAdapter(): SportDraftAdapter {
  nflAdapter ??= createNflAdapter();
  return nflAdapter;
}

function getCfbAdapter(): SportDraftAdapter {
  cfbAdapter ??= createCfbAdapter();
  return cfbAdapter;
}

export function registerSportAdapters(nfl: SportDraftAdapter, cfb: SportDraftAdapter): void {
  nflAdapter = nfl;
  cfbAdapter = cfb;
}

export function completedRosterFromAdapter(
  adapter: SportDraftAdapter,
  state: DraftState,
): CompletedRoster {
  return adapter.buildCompletedRoster(state);
}

export type { RosterSlot };
