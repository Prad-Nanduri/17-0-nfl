import type { NflFranchise, NflFranchiseSeason } from './domain';
import type { SpinFilters } from '@perfect-season/sport-engine-core';
import { describe, expect, it } from 'vitest';
import { resolveSpinUnit, NflSpinError } from './spin';

const franchises: NflFranchise[] = [
  'PIT',
  'NE',
  'SF',
  'DAL',
  'GB',
  'NYG',
  'KC',
  'MIA',
  'SEA',
  'DEN',
].map((franchiseKey, index) => ({
  franchiseKey,
  name: franchiseKey,
  currentName: franchiseKey,
  abbreviation: franchiseKey,
  nflverseTeamId: index,
  logoUrl: null,
  conference: ['PIT', 'NE', 'KC', 'MIA', 'DEN'].includes(franchiseKey) ? 'AFC' : 'NFC',
}));

const pool: NflFranchiseSeason[] = franchises.flatMap((franchise) =>
  [1985, 1990, 2000, 2023].map((season) => ({
    franchiseKey: franchise.franchiseKey,
    season,
    wins: season < 1999 ? null : 10,
    losses: season < 1999 ? null : 7,
    ties: 0,
    eraTier: season < 1999 ? ('legacy' as const) : ('full_feature' as const),
  })),
);

const filters = (criteria: SpinFilters['criteria'] = {}): SpinFilters => ({
  modeId: 'core',
  criteria,
});

describe('resolveSpinUnit', () => {
  it('filters seasons, teams, exclusions, eras, conferences, and elite pool', () => {
    expect(
      resolveSpinUnit('season', filters({ eraTier: 'legacy' }), pool, franchises).season,
    ).toBeLessThan(1999);
    expect(
      resolveSpinUnit('team', { ...filters(), teamIds: ['KC'] }, pool, franchises).franchiseId,
    ).toBe('KC');
    const excluded = { sportId: 'nfl' as const, franchiseId: 'KC', season: 2023 };
    expect(
      resolveSpinUnit(
        'excluded',
        { ...filters(), teamIds: ['KC'], excludedUnits: [excluded] },
        pool,
        franchises,
      ).season,
    ).toBe(2000);
    expect(
      resolveSpinUnit('elite', filters({ franchisePool: 'elite' }), pool, franchises).franchiseId,
    ).toMatch(/^(PIT|NE|SF|DAL|GB|NYG)$/);
    expect(
      resolveSpinUnit('conference', filters({ conference: 'AFC' }), pool, franchises).franchiseId,
    ).toMatch(/^(PIT|NE|KC|MIA|DEN)$/);
  });

  it('is deterministic for a seed', () => {
    const first = resolveSpinUnit('same', filters(), pool, franchises);
    expect(resolveSpinUnit('same', filters(), pool, franchises)).toEqual(first);
  });

  it('samples broadly across the full pool', () => {
    const results = new Set<string>();
    const eras = new Set<string>();
    for (let i = 0; i < 200; i += 1) {
      const unit = resolveSpinUnit(`seed-${i}`, filters(), pool, franchises);
      results.add(unit.franchiseId);
      eras.add(unit.season < 1999 ? 'legacy' : 'full_feature');
    }
    expect(results.size).toBeGreaterThanOrEqual(10);
    expect(eras).toEqual(new Set(['legacy', 'full_feature']));
  });

  it('enforces mode constraints and reports an empty pool', () => {
    expect(() =>
      resolveSpinUnit('one', { ...filters(), modeId: 'one_franchise' }, pool, franchises),
    ).toThrow(NflSpinError);
    expect(() =>
      resolveSpinUnit(
        'conference',
        { ...filters(), modeId: 'conference_trophy' },
        pool,
        franchises,
      ),
    ).toThrow('conference_trophy mode requires criteria.conference');
    expect(() =>
      resolveSpinUnit(
        'empty',
        { ...filters(), seasonRange: { from: 1960, through: 1961 } },
        pool,
        franchises,
      ),
    ).toThrow('No franchise-season matches the spin filters');
  });
});
