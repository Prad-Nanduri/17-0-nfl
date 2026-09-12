import type { PositionGroup } from '@perfect-season/sport-engine-core';

const POSITION_TO_GROUP = new Map<string, PositionGroup>(
  Object.entries({
    QB: 'QB',
    RB: 'RB',
    FB: 'RB',
    HB: 'RB',
    WR: 'WR',
    TE: 'TE',
    OL: 'OL',
    OT: 'OL',
    OG: 'OL',
    C: 'OL',
    DL: 'DL',
    DE: 'DL',
    DT: 'DL',
    NT: 'DL',
    LB: 'LB',
    ILB: 'LB',
    OLB: 'LB',
    MLB: 'LB',
    EDGE: 'LB',
    CB: 'CB',
    S: 'S',
    FS: 'S',
    SS: 'S',
    SAF: 'S',
    DB: 'S',
    K: 'K',
    PK: 'K',
    P: 'P',
  }),
);

const POSITION_ALIASES = new Map<string, string>(
  Object.entries({
    PK: 'K',
    HB: 'RB',
    SAF: 'S',
  }),
);

export function normalizeCfbPosition(position: string): string {
  const normalized = position.trim().toUpperCase();
  return POSITION_ALIASES.get(normalized) ?? normalized;
}

export function toPositionGroup(position: string | null | undefined): PositionGroup | null {
  if (position === null || position === undefined || position.trim() === '') return null;
  return POSITION_TO_GROUP.get(normalizeCfbPosition(position)) ?? null;
}

// Retained as the name the ETL transform imports.
export const cfbPositionGroup = toPositionGroup;
