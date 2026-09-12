import { describe, expect, it } from 'vitest';
import { getModeRuleset } from '@perfect-season/sport-engine-nfl';
import { DIFFICULTY_COPY } from './draft-setup';

describe('NFL draft setup difficulty copy', () => {
  it('matches the core mode rules', () => {
    const rules = getModeRuleset('core').difficultyRules;
    expect(DIFFICULTY_COPY).toEqual({
      easy: `${rules.easy.rerolls} reroll`,
      normal: rules.normal.rerolls === 0 ? 'No rerolls' : `${rules.normal.rerolls} rerolls`,
      hard:
        rules.hard.rerolls === 0
          ? 'No rerolls · ratings hidden'
          : `${rules.hard.rerolls} rerolls · ratings hidden`,
    });
  });
});
