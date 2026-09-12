import type {
  Difficulty,
  DraftOrder,
  DraftPoolUnit,
  EarnedTrophy,
  PositionRating,
  RatingMode,
  SeasonResult,
  SchemeId,
} from '@perfect-season/sport-engine-core';

export type NflDraftPoolUnit = Extract<DraftPoolUnit, { sportId: 'nfl' }>;

export interface PendingSpin {
  readonly spinSeed: string;
  readonly unit: NflDraftPoolUnit;
  readonly targetSlotCode: string | null;
}

export interface StoredPick {
  readonly slotCode: string;
  readonly playerId: string;
  readonly fullName: string;
  readonly primaryPosition: string;
  readonly headshotUrl: string | null;
  readonly unit: NflDraftPoolUnit;
  readonly spinSeed: string;
  readonly rating: PositionRating;
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
    readonly unit: NflDraftPoolUnit;
  };
  readonly fullGauntlet: boolean;
  readonly simulatedAt: string;
}

export interface DraftState {
  readonly id: string;
  readonly sportId: 'nfl';
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
  readonly usedUnits: readonly NflDraftPoolUnit[];
  readonly createdAt: string;
  readonly result: StoredResult | null;
}

interface DraftStoreGlobal {
  __perfectSeasonDraftStore?: InMemoryDraftStore;
}

export interface DraftStore {
  create(state: DraftState): DraftState;
  get(id: string): DraftState | undefined;
  update(id: string, state: DraftState): DraftState;
  listByGuest(guestToken: string): readonly DraftState[];
}

export class InMemoryDraftStore implements DraftStore {
  private readonly drafts = new Map<string, DraftState>();

  create(state: DraftState): DraftState {
    if (this.drafts.has(state.id)) throw new Error(`Draft already exists: ${state.id}`);
    this.drafts.set(state.id, state);
    return state;
  }

  get(id: string): DraftState | undefined {
    return this.drafts.get(id);
  }

  update(id: string, state: DraftState): DraftState {
    if (!this.drafts.has(id)) throw new Error(`Draft not found: ${id}`);
    this.drafts.set(id, state);
    return state;
  }

  listByGuest(guestToken: string): readonly DraftState[] {
    return [...this.drafts.values()].filter((draft) => draft.guestToken === guestToken);
  }
}

const serverGlobal = globalThis as typeof globalThis & DraftStoreGlobal;

export function getDraftStore(): DraftStore {
  serverGlobal.__perfectSeasonDraftStore ??= new InMemoryDraftStore();
  return serverGlobal.__perfectSeasonDraftStore;
}
