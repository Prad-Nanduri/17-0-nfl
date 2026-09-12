import type {
  CompletedRoster,
  SeasonResult,
  TrophyEvalContext,
} from '@perfect-season/sport-engine-core';
import { describe, expect, it } from 'vitest';
import { evaluateCfbTrophies, getCfbTrophyDefinitions } from './index';

const roster = {
  draftId: 'd1',
  sportId: 'cfb',
  schemeId: '4-3',
  ratingMode: 'career_season',
  picks: [],
} as unknown as CompletedRoster;

const ctx: TrophyEvalContext = {
  userId: null,
  roster,
  priorResults: [],
  earnedTrophies: [],
  evaluatedAt: '2024-01-15T00:00:00Z',
  facts: {},
};

const result = (overrides: Partial<SeasonResult>): SeasonResult => ({
  draftId: 'd1',
  sportId: 'cfb',
  modeId: 'core',
  seed: 'seed',
  modelVersion: 'test',
  dataVersion: 'test',
  record: { wins: 9, losses: 3, ties: 0 },
  pointsFor: 300,
  pointsAgainst: 200,
  postseasonResult: null,
  stages: [],
  facts: {},
  ...overrides,
});

const codes = (season: SeasonResult) =>
  evaluateCfbTrophies(season, ctx).map((trophy) => trophy.code);

describe('CFB trophies (spec §2A.5, §2A.7)', () => {
  it('defines the five result trophies', () => {
    expect(getCfbTrophyDefinitions().map((definition) => definition.code)).toEqual([
      'perfect_regular_season',
      'undefeated_untied',
      'drafted_national_champions',
      'bowl_bound',
      'worst_in_show',
    ]);
  });

  it('awards Undefeated & Untied only for 12-0 + conf title + national champion', () => {
    const perfect = result({
      record: { wins: 12, losses: 0, ties: 0 },
      postseasonResult: 'national_champion',
      facts: { conferenceChampion: true },
    });
    expect(codes(perfect)).toEqual(['perfect_regular_season', 'undefeated_untied']);
    // Missing the conference championship does not count.
    expect(
      codes(
        result({
          record: { wins: 12, losses: 0, ties: 0 },
          postseasonResult: 'national_champion',
          facts: { conferenceChampion: false },
        }),
      ),
    ).toEqual(['perfect_regular_season']);
  });

  it('scopes Drafted National Champions to blue_blood_bracket', () => {
    const definition = getCfbTrophyDefinitions().find(
      (item) => item.code === 'drafted_national_champions',
    );
    expect(definition?.modeExclusiveTo).toBe('blue_blood_bracket');
    expect(
      codes(
        result({
          record: { wins: 12, losses: 0, ties: 0 },
          postseasonResult: 'national_champion',
          facts: { conferenceChampion: true },
        }),
      ),
    ).not.toContain('drafted_national_champions');
    expect(
      codes(
        result({
          modeId: 'blue_blood_bracket',
          record: { wins: 9, losses: 3, ties: 0 },
          postseasonResult: 'national_champion',
        }),
      ),
    ).toContain('drafted_national_champions');
  });

  it('awards Bowl Bound on a bowl win only', () => {
    expect(codes(result({ postseasonResult: 'bowl_won' }))).toEqual(['bowl_bound']);
    expect(codes(result({ postseasonResult: 'bowl_lost' }))).toEqual([]);
  });

  it('awards Worst in Show for 0-12', () => {
    expect(codes(result({ record: { wins: 0, losses: 12, ties: 0 } }))).toEqual(['worst_in_show']);
  });
});
