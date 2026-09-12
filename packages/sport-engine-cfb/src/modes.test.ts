import { describe, expect, it } from 'vitest';
import { getAvailableModes, getModeRuleset } from './modes';

describe('getAvailableModes (spec §2A.7)', () => {
  it('lists the CFB mode set', () => {
    const ids = getAvailableModes().map((mode) => mode.id);
    expect(ids).toEqual([
      'core',
      'one_program',
      'blue_blood_bracket',
      'ranked_only',
      'daily_challenge',
      'conference_trophy',
      'mp_live_draft',
      'mp_leagues',
      'mp_last_one_standing',
    ]);
  });
});

describe('getModeRuleset (spec §2A.7)', () => {
  it('throws on an unknown mode', () => {
    expect(() => getModeRuleset('nope')).toThrow('Unknown CFB mode: nope');
  });

  it('one_program is squad-first but keeps Prime enabled', () => {
    const ruleset = getModeRuleset('one_program');
    expect(ruleset.draftOrders).toEqual(['squad_first']);
    expect(ruleset.ratingModes).toEqual(['career_season', 'prime']);
    expect(ruleset.constraints[0]?.parameters.requiresExactlyOneTeamId).toBe(true);
  });

  it('blue_blood_bracket defaults to a bracketed Full Campaign on the elite pool', () => {
    const ruleset = getModeRuleset('blue_blood_bracket');
    expect(ruleset.defaultSimulationOptions).toEqual({ fullCampaign: true, bracket: true });
    expect(ruleset.constraints[0]?.parameters.programPool).toBe('elite');
  });

  it('mp_leagues requires Full Campaign and carries scoring multipliers', () => {
    const ruleset = getModeRuleset('mp_leagues');
    expect(ruleset.defaultSimulationOptions.fullCampaign).toBe(true);
    const fullCampaign = ruleset.constraints.find((item) => item.code === 'full_campaign_only');
    expect(fullCampaign?.parameters.requiresFullCampaign).toBe(true);
    expect(fullCampaign?.parameters.leagueScoringMultipliers).toEqual([1, 1, 2, 3, 4, 6]);
  });

  it('shares the same difficulty rules as NFL', () => {
    const ruleset = getModeRuleset('core');
    expect(ruleset.difficultyRules.easy.rerolls).toBe(1);
    expect(ruleset.difficultyRules.hard.ratingsVisible).toBe(false);
    expect(ruleset.defaultSimulationOptions).toEqual({ fullCampaign: false });
  });

  it('returns copies so callers cannot mutate the ruleset', () => {
    const ruleset = getModeRuleset('core');
    expect(ruleset.constraints).not.toBe(getModeRuleset('core').constraints);
  });
});
