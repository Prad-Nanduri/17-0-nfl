import type { PositionGroup } from '@perfect-season/sport-engine-core';

const POSITION_GROUPS: Readonly<Record<string, PositionGroup>> = {
  QB: 'QB',
  RB: 'RB',
  FB: 'RB',
  HB: 'RB',
  WR: 'WR',
  TE: 'TE',
  T: 'OL',
  OT: 'OL',
  G: 'OL',
  OG: 'OL',
  C: 'OL',
  OL: 'OL',
  DE: 'DL',
  DT: 'DL',
  NT: 'DL',
  DL: 'DL',
  EDGE: 'DL',
  LB: 'LB',
  OLB: 'LB',
  ILB: 'LB',
  MLB: 'LB',
  CB: 'CB',
  DB: 'CB',
  S: 'S',
  FS: 'S',
  SS: 'S',
  SAF: 'S',
  K: 'K',
  P: 'P',
};

export function toPositionGroup(position: string): PositionGroup | null {
  return POSITION_GROUPS[position.trim().toUpperCase()] ?? null;
}
