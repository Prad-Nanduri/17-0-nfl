import type { DraftPoolUnit } from '@perfect-season/sport-engine-core';
import type { ClientDraft } from '../../lib/server/draft-client';

export interface DraftCandidate {
  readonly playerId: string;
  readonly fullName: string;
  readonly primaryPosition: string;
  readonly headshotUrl: string | null;
  readonly rating: number | null;
  readonly badges?: readonly string[];
  readonly eligibleSlots: readonly { slotCode: string; warnings: readonly string[] }[];
}

export interface DraftSpin {
  readonly spinSeed: string;
  readonly unit: DraftPoolUnit;
  readonly franchise: {
    key: string;
    name: string;
    abbreviation: string;
    conference: string;
    logoUrl: string | null;
    color?: string | null;
    alternateColor?: string | null;
  };
  readonly record: { wins: number; losses: number; ties: number } | null;
  readonly eraTier: string;
  readonly targetSlotCode: string | null;
  readonly candidates: readonly DraftCandidate[];
}

export type { ClientDraft };
