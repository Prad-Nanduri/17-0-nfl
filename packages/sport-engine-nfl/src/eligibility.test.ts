import type { PlayerCandidate, RosterSlot } from '@perfect-season/sport-engine-core';
import { describe, expect, it } from 'vitest';
import { validateSlotEligibility } from './eligibility';

const slot = (
  code: string,
  positionGroup: RosterSlot['positionGroup'],
  ...eligiblePositions: string[]
): RosterSlot => ({
  code,
  positionGroup,
  eligiblePositions,
});

const candidate = (
  primaryPosition: string,
  traits: Record<string, string | boolean | null> = {},
): PlayerCandidate => ({
  playerId: 'player',
  fullName: 'Test Player',
  primaryPosition,
  poolUnit: { sportId: 'nfl', franchiseId: 'KC', season: 2023 },
  seasons: [],
  traits,
});

describe('validateSlotEligibility', () => {
  it.each([
    ['QB', 'QB', ['QB']],
    ['RB', 'RB', ['RB', 'FB', 'HB']],
    ['FB', 'RB', ['RB', 'FB', 'HB']],
    ['WR', 'WR', ['WR']],
    ['TE', 'TE', ['TE']],
    ['T', 'OL', ['T', 'OT', 'OL']],
    ['C', 'OL', ['G', 'OG', 'C', 'OL']],
    ['DE', 'DL', ['DE', 'EDGE', 'DL']],
    ['DT', 'DL', ['DT', 'NT', 'DL']],
    ['NT', 'DL', ['DT', 'NT', 'DL']],
    ['OLB', 'LB', ['LB', 'OLB', 'ILB', 'MLB']],
    ['CB', 'CB', ['CB', 'DB']],
    ['S', 'S', ['S', 'FS', 'SS', 'SAF', 'DB']],
    ['K', 'K', ['K']],
    ['P', 'P', ['P']],
  ] as const)('accepts %s in its ordinary slot', (position, group, eligible) => {
    expect(
      validateSlotEligibility(
        candidate(` ${position.toLowerCase()} `),
        slot('X', group, ...eligible),
      ),
    ).toEqual({
      eligible: true,
      warnings: [],
    });
  });

  it('accepts OLB in both linebacker scheme slots', () => {
    expect(
      validateSlotEligibility(candidate('OLB'), slot('LB1', 'LB', 'LB', 'OLB', 'ILB', 'MLB'))
        .eligible,
    ).toBe(true);
    expect(
      validateSlotEligibility(candidate('OLB'), slot('OLB1', 'LB', 'OLB', 'EDGE')).eligible,
    ).toBe(true);
  });

  it('allows versatile safeties to fill nickel corner with a warning', () => {
    const result = validateSlotEligibility(
      candidate('SS', { versatile: true }),
      slot('NCB', 'CB', 'CB', 'DB'),
    );
    expect(result).toEqual({
      eligible: true,
      warnings: ['Test Player is listed at SS; filling NCB on positional versatility'],
    });
    expect(validateSlotEligibility(candidate('SS'), slot('NCB', 'CB', 'DB')).eligible).toBe(false);
  });

  it('allows the EDGE-tagged linebacker shape only when versatile', () => {
    const defensiveEnd = slot('DE1', 'DL', 'DE', 'EDGE', 'DL');
    expect(
      validateSlotEligibility(
        candidate('LB', { versatile: true, ngsPosition: null, depthChartPosition: 'OLB' }),
        defensiveEnd,
      ),
    ).toEqual({
      eligible: true,
      warnings: ['Test Player is listed at LB; filling DE1 on positional versatility'],
    });
    expect(
      validateSlotEligibility(
        candidate('LB', { ngsPosition: null, depthChartPosition: 'OLB' }),
        defensiveEnd,
      ).eligible,
    ).toBe(false);
  });

  it('does not allow specialists to cross-fill', () => {
    expect(validateSlotEligibility(candidate('K'), slot('P1', 'P', 'P'))).toEqual({
      eligible: false,
      reason: 'K cannot fill P1 (eligible: P)',
    });
  });
});
