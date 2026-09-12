import type {
  Difficulty,
  DraftOrder,
  DraftPoolUnit as CoreDraftPoolUnit,
  EarnedTrophy,
  PositionRating,
  RatingMode,
  SeasonResult,
  SchemeId,
  SportId,
} from '@perfect-season/sport-engine-core';
import { createRedisClient } from '@perfect-season/db';
import { isRedisConfigured } from './store-backend';
import { RedisDraftStore } from './redis-store';

export type NflDraftPoolUnit = Extract<CoreDraftPoolUnit, { sportId: 'nfl' }>;
export type CfbDraftPoolUnit = Extract<CoreDraftPoolUnit, { sportId: 'cfb' }>;

export interface PendingSpin {
  readonly spinSeed: string;
  readonly unit: CoreDraftPoolUnit;
  readonly targetSlotCode: string | null;
}

export interface StoredPick {
  readonly slotCode: string;
  readonly playerId: string;
  readonly fullName: string;
  readonly primaryPosition: string;
  readonly headshotUrl: string | null;
  readonly unit: CoreDraftPoolUnit;
  readonly spinSeed: string;
  readonly rating: PositionRating;
  readonly badges?: readonly string[];
}

export interface StoredResult {
  readonly season: SeasonResult;
  readonly trophies: readonly EarnedTrophy[];
  readonly mvp: {
    readonly slotCode: string;
    readonly playerId: string;
    readonly fullName: string;
    readonly primaryPosition: string;
    readonly headshotUrl: string | null;
    readonly rating: number;
    readonly unit: CoreDraftPoolUnit;
  };
  readonly fullGauntlet: boolean;
  readonly simulatedAt: string;
}

export interface DraftState {
  readonly id: string;
  readonly sportId: SportId;
  readonly modeId: 'core';
  readonly draftOrder: DraftOrder;
  readonly difficulty: Difficulty;
  readonly ratingMode: RatingMode;
  readonly schemeId: SchemeId;
  readonly status: 'in_progress' | 'complete' | 'abandoned';
  readonly guestToken: string | null;
  readonly spinCount: number;
  readonly rerollsRemaining: number;
  readonly pendingSpin: PendingSpin | null;
  readonly picks: Readonly<Record<string, StoredPick>>;
  readonly usedUnits: readonly CoreDraftPoolUnit[];
  // Units resolved by a spin that produced zero slot-eligible candidates —
  // excluded from future spins so a sparse roster can't dead-end the draft.
  readonly deadUnits?: readonly CoreDraftPoolUnit[];
  readonly createdAt: string;
  readonly result: StoredResult | null;
}

interface DraftStoreGlobal {
  __perfectSeasonDraftStore?: DraftStore;
}

export interface DraftStore {
  create(state: DraftState): Promise<DraftState>;
  get(id: string): Promise<DraftState | undefined>;
  update(id: string, state: DraftState): Promise<DraftState>;
  listByGuest(guestToken: string): Promise<readonly DraftState[]>;
}

export class InMemoryDraftStore implements DraftStore {
  private readonly drafts = new Map<string, DraftState>();

  async create(state: DraftState): Promise<DraftState> {
    if (this.drafts.has(state.id)) throw new Error(`Draft already exists: ${state.id}`);
    this.drafts.set(state.id, state);
    return state;
  }

  async get(id: string): Promise<DraftState | undefined> {
    return this.drafts.get(id);
  }

  async update(id: string, state: DraftState): Promise<DraftState> {
    if (!this.drafts.has(id)) throw new Error(`Draft not found: ${id}`);
    this.drafts.set(id, state);
    return state;
  }

  async listByGuest(guestToken: string): Promise<readonly DraftState[]> {
    return [...this.drafts.values()].filter((draft) => draft.guestToken === guestToken);
  }
}

const serverGlobal = globalThis as typeof globalThis & DraftStoreGlobal;

export function getDraftStore(): DraftStore {
  serverGlobal.__perfectSeasonDraftStore ??= isRedisConfigured()
    ? new RedisDraftStore(createRedisClient())
    : new InMemoryDraftStore();
  return serverGlobal.__perfectSeasonDraftStore;
}
