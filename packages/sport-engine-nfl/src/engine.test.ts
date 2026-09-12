import type {
  CompletedRoster,
  PlayerCandidate,
  SeasonResult,
  TrophyEvalContext,
} from '@perfect-season/sport-engine-core';
import { describe, expect, it } from 'vitest';
import { NflSportEngine } from './engine';

const franchise = {
  franchiseKey: 'KC',
  name: 'Kansas City Chiefs',
  currentName: 'Kansas City Chiefs',
  abbreviation: 'KC',
  nflverseTeamId: 12,
  logoUrl: 'https://logo',
  conference: 'AFC' as const,
};
const candidate: PlayerCandidate = {
  playerId: 'p',
  fullName: 'Player',
  primaryPosition: 'QB',
  poolUnit: { sportId: 'nfl', franchiseId: 'KC', season: 2023 },
  seasons: [
    {
      poolUnit: { sportId: 'nfl', franchiseId: 'KC', season: 2023 },
      position: 'QB',
      confidenceTier: 'full_feature',
      stats: {},
    },
  ],
  traits: {},
};
const baseRating = {
  gsisId: 'p',
  franchiseKey: 'KC',
  season: 2023,
  positionGroup: 'QB' as const,
  ratingMode: 'career_season' as const,
  overall: 94,
  percentile: 0.94,
  compositeScore: 2,
  qualified: true,
  confidenceTier: 'full_feature' as const,
  isTeamLevelProxy: false,
  modelVersion: 'nfl-rating-v1',
};
const engine = new NflSportEngine({
  franchises: [franchise],
  franchiseSeasons: [
    { franchiseKey: 'KC', season: 2023, wins: 11, losses: 6, ties: 0, eraTier: 'full_feature' },
  ],
  ratings: [baseRating],
});
const simulationRoster: CompletedRoster = {
  draftId: 'simulation-draft',
  sportId: 'nfl',
  schemeId: '4-3',
  ratingMode: 'career_season',
  picks: Array.from({ length: 24 }, (_, index) => ({
    slot: { code: `slot-${index}`, positionGroup: 'QB', eligiblePositions: ['QB'] },
    candidate,
    rating: {
      positionGroup: 'QB',
      mode: 'career_season',
      overall: 94,
      sourceSeason: 2023,
      confidenceTier: 'full_feature',
      isTeamLevelProxy: false,
      modelVersion: 'nfl-rating-v1',
    },
    spinSeed: `seed-${index}`,
  })) as unknown as CompletedRoster['picks'],
};

describe('NflSportEngine', () => {
  it('implements core identity, schemes, spin, eligibility, modes, and rating lookup', async () => {
    expect(engine.sportId).toBe('nfl');
    expect(engine.displayName).toBe('NFL');
    expect(engine.rosterSlotCount).toBe(24);
    expect(engine.getSchemePresets()).toHaveLength(3);
    const unit = await engine.resolveSpinUnit('seed', { modeId: 'core', criteria: {} });
    expect(unit.sportId).toBe('nfl');
    if (unit.sportId === 'nfl') expect(unit.franchiseId).toBe('KC');
    expect(
      engine.validateSlotEligibility(candidate, engine.getSchemePresets()[0]!.slots[0]!),
    ).toEqual({
      eligible: true,
      warnings: [],
    });
    expect(engine.computeRating(candidate, 'career_season').overall).toBe(94);
    expect(engine.getAvailableModes().map((mode) => mode.id)).toContain('core');
  });

  it('uses prime ratings across candidate history and a 40 fallback', () => {
    const primeCandidate = {
      ...candidate,
      seasons: [
        ...candidate.seasons,
        {
          poolUnit: { sportId: 'nfl' as const, franchiseId: 'KC', season: 2022 },
          position: 'QB',
          confidenceTier: 'full_feature' as const,
          stats: {},
        },
      ],
    };
    const primeEngine = new NflSportEngine({
      franchises: [franchise],
      franchiseSeasons: [],
      ratings: [
        baseRating,
        {
          gsisId: 'p',
          franchiseKey: 'KC',
          season: 2022,
          positionGroup: 'QB',
          ratingMode: 'career_season',
          overall: 97,
          percentile: 0.97,
          compositeScore: 3,
          qualified: true,
          confidenceTier: 'full_feature',
          isTeamLevelProxy: true,
          modelVersion: 'nfl-rating-v1',
        },
      ],
    });
    expect(primeEngine.computeRating(primeCandidate, 'prime')).toMatchObject({
      overall: 97,
      sourceSeason: 2022,
      isTeamLevelProxy: true,
    });
    const fallback = primeEngine.computeRating(
      { ...candidate, playerId: 'missing' },
      'career_season',
    );
    expect(fallback).toMatchObject({ overall: 40, sourceSeason: 2023, positionGroup: 'QB' });
  });

  it('uses franchise logo data and simulates a regular season', async () => {
    await expect(engine.getFranchiseLogo('KC')).resolves.toEqual({
      url: 'https://logo',
      source: 'espn',
    });
    const result = await engine.simulateSeason(
      simulationRoster,
      { modeId: 'core', difficulty: 'normal', seed: 'engine-test', options: {} },
      {
        season: 2023,
        modelVersion: 'test',
        dataVersion: 'test',
        opponents: [{ id: 'opponent', name: 'Opponent', rating: 1500, site: 'neutral', facts: {} }],
        facts: {},
      },
    );
    expect(result.record.wins + result.record.losses + result.record.ties).toBe(17);
    expect(result.stages[0]?.games).toHaveLength(17);
  });

  it('throws for unsupported future trophy methods', () => {
    expect(() => engine.getTrophyDefinitions()).toThrow(
      'Not implemented: docs/spec.md §1.4/§1.7 land in a later PR',
    );
    expect(() => engine.evaluateTrophies({} as SeasonResult, {} as TrophyEvalContext)).toThrow(
      'Not implemented: docs/spec.md §1.4/§1.7 land in a later PR',
    );
  });
});
