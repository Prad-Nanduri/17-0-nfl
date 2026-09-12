import type { ClientDraft } from '../../lib/server/draft-client';

export interface DraftCandidate {
  readonly playerId: string;
  readonly fullName: string;
  readonly primaryPosition: string;
  readonly headshotUrl: string | null;
  readonly rating: number | null;
  readonly eligibleSlots: readonly { slotCode: string; warnings: readonly string[] }[];
}

export interface DraftSpin {
  readonly spinSeed: string;
  readonly unit: { sportId: 'nfl'; franchiseId: string; season: number };
  readonly franchise: {
    key: string;
    name: string;
    abbreviation: string;
    conference: 'AFC' | 'NFC';
    logoUrl: string;
  };
  readonly record: { wins: number; losses: number; ties: number } | null;
  readonly eraTier: 'full_feature' | 'legacy';
  readonly targetSlotCode: string | null;
  readonly candidates: readonly DraftCandidate[];
}

export type { ClientDraft };
