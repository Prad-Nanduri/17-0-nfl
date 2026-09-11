import { describe, expect, it } from 'vitest';
import { getAvailableModes, getModeRuleset } from './modes';

describe('NFL modes', () => {
  it('lists all supported modes', () => {
    expect(getAvailableModes().map((mode) => mode.id)).toEqual([
      'core',
      'one_franchise',
      'playoff_draft',
      'daily_challenge',
      'conference_trophy',
      'mp_live_draft',
      'mp_leagues',
      'mp_last_one_standing',
    ]);
  });

  it('enforces one-franchise and difficulty rules', () => {
    expect(getModeRuleset('one_franchise')).toMatchObject({
      draftOrders: ['squad_first'],
      ratingModes: ['career_season'],
      constraints: [{ code: 'one_franchise', parameters: { requiresExactlyOneTeamId: true } }],
    });
    expect(getModeRuleset('core').difficultyRules).toEqual({
      easy: { rerolls: 3, ratingsVisible: true, facts: {} },
      normal: { rerolls: 1, ratingsVisible: true, facts: {} },
      hard: { rerolls: 0, ratingsVisible: false, facts: {} },
    });
  });

  it('exposes spin constraints', () => {
    expect(getModeRuleset('playoff_draft').constraints[0]?.parameters).toEqual({
      franchisePool: 'elite',
    });
    expect(getModeRuleset('conference_trophy').constraints[0]?.parameters).toEqual({
      requiresConference: true,
    });
  });

  it('rejects unknown modes', () => {
    expect(() => getModeRuleset('unknown')).toThrow('Unknown NFL mode: unknown');
  });
});
