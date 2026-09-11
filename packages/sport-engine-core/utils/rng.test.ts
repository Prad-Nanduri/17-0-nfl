import { describe, expect, it, vi } from 'vitest';
import { RNG_VERSION, createSeed, hashSeed, createRng } from './index';

describe('deterministic seeding', () => {
  it('has stable, ordered, type-preserving component encoding', () => {
    expect(createSeed(2000, '42', 'model-v1')).toBe('seed-v1:[2000,"42","model-v1"]');
    expect(createSeed()).toBe('seed-v1:[]');
    expect(createSeed(42)).not.toBe(createSeed('42'));
    expect(createSeed('ab', 'c')).not.toBe(createSeed('a', 'bc'));
    expect(createSeed('a', 'b')).not.toBe(createSeed('b', 'a'));
    expect(createSeed('a:b', 'c')).not.toBe(createSeed('a', 'b:c'));
    expect(createSeed(2000, '42', 'model-v1')).not.toBe(createSeed(2000, '42', 'model-v2'));
  });

  it.each([NaN, Infinity, -Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1])(
    'rejects unsafe numeric seed component %s',
    (part) => {
      expect(() => createSeed('model', part)).toThrow(RangeError);
    },
  );

  it('matches FNV-1a reference hashes and unsigned arithmetic', () => {
    expect(hashSeed('')).toBe(0x811c9dc5);
    expect(hashSeed('hello')).toBe(0x4f9f2cab);
    expect(hashSeed('hello')).not.toBe(hashSeed('Hello'));
  });
});

describe('deterministic RNG', () => {
  it('pins the algorithm and output sequence across runtime and implementation changes', () => {
    expect(RNG_VERSION).toBe('fnv1a-utf16-mulberry32-v1');
    const rng = createRng('hello');
    expect(Array.from({ length: 5 }, () => rng.nextUint32())).toEqual([
      2710968669, 3428883067, 1325549424, 1949480165, 212233533,
    ]);
    expect(createRng('').nextUint32()).toBe(2625274932);
    expect(createRng('hello').next()).toBe(2710968669 / 2 ** 32);
  });

  it('replays long streams without shared state, Math.random, or the clock', () => {
    const random = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('ambient RNG');
    });
    const now = vi.spyOn(Date, 'now').mockImplementation(() => {
      throw new Error('clock');
    });
    try {
      const seed = createSeed(2000, '42', 'model-v1');
      const first = createRng(seed);
      const second = createRng(seed);
      const unrelated = createRng('unrelated');
      for (let i = 0; i < 10000; i += 1) {
        const value = first.next();
        unrelated.next();
        expect(second.next()).toBe(value);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
      }
      expect(createRng('different').next()).not.toBe(createRng(seed).next());
    } finally {
      random.mockRestore();
      now.mockRestore();
    }
  });

  it('handles unicode seeds deterministically without implicit normalization', () => {
    expect(hashSeed('🏈')).toBe(690899785);
    expect(createRng('🏈').nextUint32()).toBe(3707178127);
    expect(hashSeed('é')).not.toBe(hashSeed('e\u0301'));
  });

  it('samples bounded integers including negative, singleton, and full uint32 intervals', () => {
    const rng = createRng('bounds');
    const values = Array.from({ length: 1000 }, () => rng.integer(-3, 4));
    expect(new Set(values)).toEqual(new Set([-3, -2, -1, 0, 1, 2, 3]));
    expect(values.every(Number.isInteger)).toBe(true);
    expect(rng.integer(7, 8)).toBe(7);
    expect(createRng('hello').integer(0, 2 ** 32)).toBe(2710968669);
    expect(createRng('hello').integer(Number.MAX_SAFE_INTEGER - 1, Number.MAX_SAFE_INTEGER)).toBe(
      Number.MAX_SAFE_INTEGER - 1,
    );
  });

  it('rejects the biased tail before mapping to an integer range', () => {
    const rng = createRng('hello');
    expect(rng.integer(0, 2147483649)).toBe(1325549424);
    expect(rng.nextUint32()).toBe(1949480165);
  });

  it.each([
    [0.5, 2],
    [0, 2.5],
    [NaN, 2],
    [0, Infinity],
    [0, 0],
    [2, 1],
    [0, 2 ** 32 + 1],
    [0, Number.MAX_SAFE_INTEGER + 1],
  ])('rejects invalid interval [%s, %s)', (min, max) => {
    const rng = createRng('hello');
    expect(() => rng.integer(min, max)).toThrow(RangeError);
    expect(rng.nextUint32()).toBe(2710968669);
  });
});
