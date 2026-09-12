import { describe, expect, it } from 'vitest';
import { guestAlias } from './leaderboard';

describe('guestAlias', () => {
  it('is deterministic per draft id', () => {
    expect(guestAlias(42)).toBe(guestAlias(42));
    expect(guestAlias(42)).not.toBe(guestAlias(43));
  });

  it('produces a display name that contains no raw identifier', () => {
    const alias = guestAlias(7);
    expect(alias).toMatch(/^[A-Za-z-]+ [A-Za-z]+ \d{2}$/);
    expect(alias).not.toContain('7');
    // a long hex-looking guest token must never appear verbatim
    const aliasFromToken = guestAlias('guest_9f8e7d6c5b4a');
    expect(aliasFromToken).not.toContain('9f8e7d6c5b4a');
    expect(aliasFromToken).toMatch(/^[A-Za-z-]+ [A-Za-z]+ \d{2}$/);
  });
});
