import { describe, expect, it } from 'vitest';
import type { NflLegacyPlayerCareer } from '../domain';
import { rateLegacyCareers } from './legacy';

const career = (
  pfrId: string,
  positionGroup: NflLegacyPlayerCareer['positionGroup'],
  stats: Record<string, number | null>,
): NflLegacyPlayerCareer => ({
  pfrId,
  gsisId: null,
  fullName: pfrId,
  positionGroup,
  draftYear: 1990,
  draftRound: 1,
  draftPick: 1,
  franchiseKey: 'TST',
  hof: false,
  careerFromSeason: 1990,
  careerThroughSeason: 1998,
  eraTier: 'legacy',
  stats,
});

describe('rateLegacyCareers', () => {
  it('uses the lighter career formula and legacy metadata', () => {
    const ratings = rateLegacyCareers([
      career('great', 'RB', { games: 150, carAv: 100, proBowls: 10, allPro: 8, rushYards: 15000 }),
      career('low', 'RB', { games: 20, carAv: 2, proBowls: 0, allPro: 0, rushYards: 100 }),
      career('short', 'RB', { games: 5, carAv: 200, proBowls: 20, allPro: 20, rushYards: 20000 }),
    ]);
    expect(ratings[0]?.overall).toBeGreaterThan(ratings[1]?.overall ?? 0);
    expect(ratings[0]).toMatchObject({
      qualified: true,
      confidenceTier: 'legacy',
      modelVersion: 'nfl-legacy-rating-v1',
    });
    expect(ratings[2]).toMatchObject({ overall: 40, qualified: false });
  });
});
