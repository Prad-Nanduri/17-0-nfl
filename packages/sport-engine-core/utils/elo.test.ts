import { describe, expect, it } from 'vitest';
import { eloWinProbability, updateEloRating } from './index';

describe('Elo math', () => {
  it('matches even odds and the reference 400-point, ten-to-one odds difference', () => {
    expect(eloWinProbability(1500, 1500)).toBe(0.5);
    expect(eloWinProbability(1900, 1500)).toBeCloseTo(10 / 11, 14);
    expect(eloWinProbability(1500, 1900)).toBeCloseTo(1 / 11, 14);
    expect(eloWinProbability(2300, 1500)).toBeCloseTo(100 / 101, 14);
  });

  it('uses caller-supplied home advantage with complementary home and away probabilities', () => {
    const home = eloWinProbability(1500, 1500, 'home', 55);
    const away = eloWinProbability(1500, 1500, 'away', 55);
    expect(home).toBeCloseTo(0.5784967523447427, 14);
    expect(home + away).toBeCloseTo(1, 14);
    expect(eloWinProbability(1500, 1500, 'neutral', 55)).toBe(0.5);
    expect(eloWinProbability(1500, 1500, 'home')).toBe(0.5);
  });

  it('is translation-invariant and saturates instead of producing NaN at extreme gaps', () => {
    expect(eloWinProbability(1600, 1500)).toBe(eloWinProbability(100, 0));
    expect(eloWinProbability(1e6, -1e6)).toBe(1);
    expect(eloWinProbability(-1e6, 1e6)).toBe(0);
  });

  it('updates win, loss, draw, and frozen ratings with the configured K-factor', () => {
    expect(updateEloRating(1500, 1500, 1, 32)).toBe(1516);
    expect(updateEloRating(1500, 1500, 0, 32)).toBe(1484);
    expect(updateEloRating(1500, 1500, 0.5, 32)).toBe(1500);
    expect(updateEloRating(1500, 1500, 1, 0)).toBe(1500);
    expect(updateEloRating(1900, 1500, 1, 32)).toBeCloseTo(1902.909090909091);
    expect(updateEloRating(1500, 1500, 1, 32, 'home', 55)).toBeCloseTo(
      1500 + 32 * (1 - 0.5784967523447427),
    );
    const a = updateEloRating(1600, 1500, 0, 20);
    const b = updateEloRating(1500, 1600, 1, 20);
    expect(a + b).toBeCloseTo(3100);
  });

  it.each([NaN, Infinity, -Infinity])('rejects non-finite rating %s', (bad) => {
    expect(() => eloWinProbability(bad, 1500)).toThrow(RangeError);
    expect(() => eloWinProbability(1500, bad)).toThrow(RangeError);
  });

  it.each([NaN, Infinity, -1])('rejects invalid advantage and K-factor %s', (bad) => {
    expect(() => eloWinProbability(1500, 1500, 'home', bad)).toThrow(RangeError);
    expect(() => updateEloRating(1500, 1500, 1, bad)).toThrow(RangeError);
  });

  it('rejects a score outside the win/loss/draw contract', () => {
    // @ts-expect-error Exercise an invalid runtime score.
    expect(() => updateEloRating(1500, 1500, 2, 32)).toThrow(RangeError);
  });
});
