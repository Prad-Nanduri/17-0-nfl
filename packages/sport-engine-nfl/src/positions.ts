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
  INTERIOR_LINE: 'DL',
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
  SAFETY: 'S',
  SLOT_CB: 'CB',
  K: 'K',
  P: 'P',
};

export interface RatingPositionInput {
  readonly position: string;
  readonly ngsPosition?: string | null;
  readonly depthChartPosition?: string | null;
}

export function toPositionGroup(position: string): PositionGroup | null {
  return POSITION_GROUPS[position.trim().toUpperCase()] ?? null;
}

export function toRatingPositionGroup({
  position,
  ngsPosition,
  depthChartPosition,
}: RatingPositionInput): PositionGroup | null {
  const normalizedPosition = position.trim().toUpperCase();
  const normalizedNgsPosition = ngsPosition?.trim().toUpperCase() ?? '';
  const normalizedDepthChartPosition = depthChartPosition?.trim().toUpperCase() ?? '';
  if (
    normalizedNgsPosition === 'EDGE' ||
    (normalizedPosition === 'LB' &&
      normalizedNgsPosition === '' &&
      normalizedDepthChartPosition === 'OLB')
  ) {
    return 'DL';
  }
  return toPositionGroup(position);
}
