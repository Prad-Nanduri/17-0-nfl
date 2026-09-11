import type { PositionGroup } from '@perfect-season/sport-engine-core';
import type { NflPlayerSeasonStats } from '../domain';

export const MIN_VOLUME: Readonly<
  Record<PositionGroup, { readonly statKey: string; readonly min: number }>
> = {
  QB: { statKey: 'passAttempts', min: 100 },
  RB: { statKey: 'carries', min: 50 },
  WR: { statKey: 'targets', min: 25 },
  TE: { statKey: 'targets', min: 20 },
  OL: { statKey: 'offenseSnaps', min: 300 },
  DL: { statKey: 'defenseSnaps', min: 200 },
  LB: { statKey: 'defenseSnaps', min: 200 },
  CB: { statKey: 'defenseSnaps', min: 200 },
  S: { statKey: 'defenseSnaps', min: 200 },
  K: { statKey: 'fgAtt', min: 10 },
  P: { statKey: 'punts', min: 20 },
};

export function isQualified(row: NflPlayerSeasonStats): boolean {
  const requirement = MIN_VOLUME[row.positionGroup];
  const value = row.stats[requirement.statKey] ?? null;
  return value !== null && value >= requirement.min;
}
