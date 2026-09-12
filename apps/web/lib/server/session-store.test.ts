import { describe, expect, it } from 'vitest';
import { InMemorySessionStore, linkGuestToAccount } from './session-store';

describe('InMemorySessionStore', () => {
  it('creates a session on first touch and only bumps last_seen_at afterwards', () => {
    const store = new InMemorySessionStore();
    const first = store.touch('tok', new Date('2026-01-01T00:00:00Z'));
    const second = store.touch('tok', new Date('2026-01-02T00:00:00Z'));
    expect(second.id).toBe(first.id);
    expect(second.userId).toBeNull();
    expect(second.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(second.lastSeenAt).toBe('2026-01-02T00:00:00.000Z');
  });
});

describe('linkGuestToAccount (spec §0.5 guest → account)', () => {
  it('creates a non-guest user with default_sport from the current sport', () => {
    const store = new InMemorySessionStore();
    store.touch('tok');
    const { user, session } = linkGuestToAccount(store, 'tok', ' Fan@Example.com ', 'nfl');
    expect(user).toMatchObject({
      email: 'fan@example.com',
      displayName: 'fan',
      isGuest: false,
      defaultSport: 'nfl',
    });
    expect(session.userId).toBe(user.id);
    expect(store.getSession('tok')?.userId).toBe(user.id);
  });

  it('re-links a returning email to the same user and keeps its default_sport', () => {
    const store = new InMemorySessionStore();
    const first = linkGuestToAccount(store, 'a', 'fan@example.com', 'nfl');
    const second = linkGuestToAccount(store, 'b', 'FAN@example.com', 'cfb');
    expect(second.user.id).toBe(first.user.id);
    expect(second.user.defaultSport).toBe('nfl');
    expect(store.getSession('b')?.userId).toBe(first.user.id);
  });
});
