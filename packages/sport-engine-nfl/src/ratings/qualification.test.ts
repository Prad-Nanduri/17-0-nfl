import { describe, expect, it } from 'vitest';
import type { NflPlayerSeasonStats } from '../domain';
import { isQualified } from './qualification';

const row = (
  positionGroup: NflPlayerSeasonStats['positionGroup'],
  statKey: string,
  value: number,
): NflPlayerSeasonStats => ({
  gsisId: 'id',
  franchiseKey: 'TST',
  season: 2023,
  position: positionGroup,
  positionGroup,
  eraTier: 'full_feature',
  games: 1,
  stats: { [statKey]: value },
  isTeamLevelProxy: false,
});

describe('isQualified', () => {
  it('applies the configured position-specific volume floors', () => {
    expect(isQualified(row('QB', 'passAttempts', 100))).toBe(true);
    expect(isQualified(row('RB', 'carries', 49))).toBe(false);
    expect(isQualified(row('K', 'fgAtt', 10))).toBe(true);
  });

  it('rejects missing volume values', () => {
    expect(isQualified({ ...row('P', 'punts', 20), stats: { punts: null } })).toBe(false);
  });
});
