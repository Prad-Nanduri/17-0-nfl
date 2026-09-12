import { describe, expect, it } from 'vitest';
import type { PlayerCandidate, RosterSlot } from '@perfect-season/sport-engine-core';
import { validateSlotEligibility } from './eligibility';

const candidate = (
  primaryPosition: string,
  traits: Record<string, string | number | boolean> = {},
): PlayerCandidate => ({
  playerId: 'p1',
  fullName: 'Test Player',
  primaryPosition,
  poolUnit: { sportId: 'cfb', programId: '1', season: 2023, conferenceId: 'acc' },
  seasons: [],
  traits,
});

const slot = (
  code: string,
  positionGroup: RosterSlot['positionGroup'],
  eligible: string[],
): RosterSlot => ({
  code,
  positionGroup,
  eligiblePositions: eligible,
});

const K1 = slot('K1', 'K', ['K']);
const CB1 = slot('CB1', 'CB', ['CB', 'DB']);
const LB1 = slot('LB1', 'LB', ['LB', 'OLB', 'ILB', 'MLB']);

describe('validateSlotEligibility (spec §2A.6)', () => {
  it('accepts a direct position match', () => {
    expect(validateSlotEligibility(candidate('QB'), slot('QB1', 'QB', ['QB']))).toEqual({
      eligible: true,
      warnings: [],
    });
  });

  it('maps PK to K1 via the position alias', () => {
    expect(validateSlotEligibility(candidate('PK'), K1)).toEqual({
      eligible: true,
      warnings: [],
    });
  });

  it('accepts DB at CB1 directly because DB is in the eligible list', () => {
    expect(validateSlotEligibility(candidate('DB'), CB1)).toEqual({
      eligible: true,
      warnings: [],
    });
  });

  it('allows a versatile DL to fill LB with a warning', () => {
    const result = validateSlotEligibility(candidate('DL', { versatile: true }), LB1);
    expect(result).toEqual({
      eligible: true,
      warnings: ['Test Player is listed at DL; filling LB1 on positional versatility'],
    });
  });

  it('rejects a non-versatile DL at LB with the eligible-position reason', () => {
    const result = validateSlotEligibility(candidate('DL'), LB1);
    expect(result).toEqual({
      eligible: false,
      reason: 'DL cannot fill LB1 (eligible: LB, OLB, ILB, MLB)',
    });
  });

  it('rejects a QB at K even when versatile', () => {
    const result = validateSlotEligibility(candidate('QB', { versatile: true }), K1);
    expect(result).toEqual({
      eligible: false,
      reason: 'QB cannot fill K1 (eligible: K)',
    });
  });

  it('uses traits.cfbdPosition as an alternate listed position', () => {
    const result = validateSlotEligibility(candidate('ATH', { cfbdPosition: 'DB' }), CB1);
    expect(result.eligible).toBe(true);
  });
});
