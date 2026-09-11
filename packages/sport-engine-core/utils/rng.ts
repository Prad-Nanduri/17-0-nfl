import type { SpinSeed } from '../src/types';

export const RNG_VERSION = 'fnv1a-utf16-mulberry32-v1';
const UINT32_RANGE = 2 ** 32;

export function createSeed(...parts: readonly (string | number)[]): SpinSeed {
  for (const part of parts) {
    if (typeof part === 'number' && !Number.isSafeInteger(part)) {
      throw new RangeError('Numeric seed components must be safe integers');
    }
  }
  return `seed-v1:${JSON.stringify(parts)}`;
}

export function hashSeed(seed: SpinSeed): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash = Math.imul(hash ^ seed.charCodeAt(index), 0x01000193);
  }
  return hash >>> 0;
}

export interface DeterministicRng {
  nextUint32(): number;
  next(): number;
  integer(minInclusive: number, maxExclusive: number): number;
}

// FNV-1a over UTF-16 code units followed by Mulberry32; no clock or global random state.
export function createRng(seed: SpinSeed): DeterministicRng {
  let state = hashSeed(seed);
  const nextUint32 = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return (value ^ (value >>> 14)) >>> 0;
  };
  return {
    nextUint32,
    next: () => nextUint32() / UINT32_RANGE,
    integer(minInclusive, maxExclusive) {
      const span = maxExclusive - minInclusive;
      if (
        !Number.isSafeInteger(minInclusive) ||
        !Number.isSafeInteger(maxExclusive) ||
        span <= 0 ||
        span > UINT32_RANGE
      ) {
        throw new RangeError('Integer bounds must be safe integers spanning 1 to 2^32 values');
      }
      // Rejection sampling avoids modulo bias when the interval does not divide 2^32.
      const limit = UINT32_RANGE - (UINT32_RANGE % span);
      let value = nextUint32();
      while (value >= limit) {
        value = nextUint32();
      }
      return minInclusive + (value % span);
    },
  };
}
