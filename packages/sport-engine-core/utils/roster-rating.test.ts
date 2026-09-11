import { describe, expect, it } from 'vitest';
import { makeRoster, lineup } from '../test/fixtures';
import { aggregateRosterRating, POSITION_WEIGHTS, type PositionWeights } from './index';

describe('roster-rating aggregation', () => {
  it.each([0, 40, 80, 99])('preserves a uniform rating of %s', (overall) => {
    const roster = makeRoster((pick) => ({ ...pick, rating: { ...pick.rating, overall } }));
    expect(aggregateRosterRating(roster)).toBeCloseTo(overall, 12);
  });

  it('uses the normalized per-slot weights, not a mean of position-group means', () => {
    const roster = makeRoster((pick, index) => ({
      ...pick,
      rating: { ...pick.rating, overall: index < 7 ? 90 : index < 22 ? 70 : 50 },
    }));
    expect(aggregateRosterRating(roster)).toBeCloseTo(
      (7 * 1.1 * 90 + 15 * 70 + 2 * 0.9 * 50) / (7 * 1.1 + 15 + 2 * 0.9),
      12,
    );
  });

  it('weights by the filled slot rather than the candidate position or original rating group', () => {
    const roster = makeRoster((pick, index) => ({
      ...pick,
      rating: { ...pick.rating, positionGroup: 'P', overall: index === 0 ? 99 : 0 },
    }));
    expect(aggregateRosterRating(roster)).toBeCloseTo((99 * 1.1) / 24.5, 12);
  });

  it('accepts explicit weights and stays invariant when they are uniformly scaled', () => {
    const roster = makeRoster((pick, index) => ({
      ...pick,
      rating: { ...pick.rating, overall: index === 0 ? 99 : 0 },
    }));
    const weights: PositionWeights = { ...POSITION_WEIGHTS, QB: 2 };
    expect(aggregateRosterRating(roster, weights)).toBeCloseTo(198 / 25.4, 12);
    const uniform: PositionWeights = {
      QB: 1,
      RB: 1,
      WR: 1,
      TE: 1,
      OL: 1,
      DL: 1,
      LB: 1,
      CB: 1,
      S: 1,
      K: 1,
      P: 1,
    };
    const scaled: PositionWeights = {
      QB: 1e308,
      RB: 1e308,
      WR: 1e308,
      TE: 1e308,
      OL: 1e308,
      DL: 1e308,
      LB: 1e308,
      CB: 1e308,
      S: 1e308,
      K: 1e308,
      P: 1e308,
    };
    expect(aggregateRosterRating(roster, uniform)).toBeCloseTo(99 / 24, 12);
    expect(aggregateRosterRating(roster, scaled)).toBe(aggregateRosterRating(roster, uniform));
    expect(Object.isFrozen(POSITION_WEIGHTS)).toBe(true);
  });

  it('uses the same calculation for either sport and is independent of pick order', () => {
    const roster = makeRoster();
    const other = makeRoster((pick) => pick, {
      sportId: 'cfb',
      programId: '1',
      season: 2000,
      conferenceId: null,
    });
    const reversed = {
      ...roster,
      picks: lineup((index) => roster.picks[23 - index] ?? roster.picks[0]),
    };
    expect(aggregateRosterRating(other)).toBe(aggregateRosterRating(roster));
    expect(aggregateRosterRating(reversed)).toBeCloseTo(aggregateRosterRating(roster), 12);
    expect(roster.picks[0].slot.code).toBe('QB1');
  });

  it('ignores unused groups when normalizing very small weights', () => {
    const roster = makeRoster((pick) => ({
      ...pick,
      slot: { ...pick.slot, positionGroup: 'QB' },
      rating: { ...pick.rating, overall: 80 },
    }));
    expect(aggregateRosterRating(roster, { ...POSITION_WEIGHTS, QB: Number.MIN_VALUE })).toBe(80);
  });

  it.each([NaN, Infinity, -1, 100])('rejects invalid player rating %s', (overall) => {
    const roster = makeRoster((pick) => ({ ...pick, rating: { ...pick.rating, overall } }));
    expect(() => aggregateRosterRating(roster)).toThrow(RangeError);
  });

  it.each([NaN, Infinity, -1, 0])('rejects invalid weight %s', (QB) => {
    expect(() => aggregateRosterRating(makeRoster(), { ...POSITION_WEIGHTS, QB })).toThrow(
      RangeError,
    );
  });

  it('rejects missing weights and incomplete or oversized runtime rosters', () => {
    const roster = makeRoster();
    // @ts-expect-error Exercise incomplete configuration from JSON.
    expect(() => aggregateRosterRating(roster, { QB: 1 })).toThrow(RangeError);
    for (const picks of [[], roster.picks.slice(1), [...roster.picks, roster.picks[0]]]) {
      // @ts-expect-error Exercise invalid runtime roster lengths.
      expect(() => aggregateRosterRating({ ...roster, picks })).toThrow(/24 picks/);
    }
  });

  it('rejects duplicate slots, mixed sports, and mixed rating modes', () => {
    const duplicate = makeRoster((pick) => ({ ...pick, slot: { ...pick.slot, code: 'same' } }));
    expect(() => aggregateRosterRating(duplicate)).toThrow(/Duplicate/);
    expect(() => aggregateRosterRating({ ...makeRoster(), sportId: 'cfb' })).toThrow(/mix sports/);
    expect(() => aggregateRosterRating({ ...makeRoster(), ratingMode: 'prime' })).toThrow(
      /rating modes/,
    );
  });
});
