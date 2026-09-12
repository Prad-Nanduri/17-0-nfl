import { describe, expect, it } from 'vitest';
import { isSportId, isSportLocked } from './sport';

describe('isSportLocked (spec §0.5 immutable sport_id)', () => {
  const base = { sportId: 'nfl', status: 'in_progress', pickCount: 0, simulated: false } as const;

  it('is unlocked with no draft or a draft without picks', () => {
    expect(isSportLocked(null)).toBe(false);
    expect(isSportLocked(base)).toBe(false);
  });

  it('locks once the first pick exists', () => {
    expect(isSportLocked({ ...base, pickCount: 1 })).toBe(true);
    expect(isSportLocked({ ...base, status: 'complete', pickCount: 24 })).toBe(true);
  });

  it('unlocks when the draft is abandoned or the season has been simulated', () => {
    expect(isSportLocked({ ...base, pickCount: 5, status: 'abandoned' })).toBe(false);
    expect(isSportLocked({ ...base, pickCount: 24, status: 'complete', simulated: true })).toBe(
      false,
    );
  });
});

describe('isSportId', () => {
  it('accepts only known sport ids', () => {
    expect(isSportId('nfl')).toBe(true);
    expect(isSportId('cfb')).toBe(true);
    expect(isSportId('mls')).toBe(false);
    expect(isSportId(undefined)).toBe(false);
  });
});
