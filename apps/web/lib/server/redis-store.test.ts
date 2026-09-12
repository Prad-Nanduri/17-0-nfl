import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DraftState } from './draft-store';
import { getDraftStore, InMemoryDraftStore } from './draft-store';
import { RedisDraftStore, RedisSessionStore, type RedisLike } from './redis-store';
import type { UserRecord } from './session-store';

class FakeRedis implements RedisLike {
  private readonly values = new Map<string, unknown>();
  private readonly sets = new Map<string, Set<string>>();
  private readonly counters = new Map<string, number>();

  async get<T>(key: string): Promise<T | null> {
    return (this.values.get(key) as T | undefined) ?? null;
  }

  async set(key: string, value: unknown): Promise<unknown> {
    this.values.set(key, value);
    return 'OK';
  }

  async del(...keys: string[]): Promise<number> {
    let deleted = 0;
    for (const key of keys) {
      if (this.values.delete(key)) deleted += 1;
    }
    return deleted;
  }

  async sadd(key: string, ...members: string[]): Promise<number> {
    const set = this.sets.get(key) ?? new Set<string>();
    const before = set.size;
    for (const member of members) set.add(member);
    this.sets.set(key, set);
    return set.size - before;
  }

  async smembers(key: string): Promise<string[]> {
    return [...(this.sets.get(key) ?? [])];
  }

  async incr(key: string): Promise<number> {
    const next = (this.counters.get(key) ?? 0) + 1;
    this.counters.set(key, next);
    return next;
  }

  async mget<T>(...keys: string[]): Promise<(T | null)[]> {
    return keys.map((key) => this.values.get(key) as T | null);
  }

  async expire(): Promise<number> {
    return 1;
  }
}

function draft(id: string, guestToken: string | null): DraftState {
  return {
    id,
    sportId: 'nfl',
    modeId: 'core',
    draftOrder: 'squad_first',
    difficulty: 'normal',
    ratingMode: 'prime',
    schemeId: '4-3',
    status: 'in_progress',
    guestToken,
    spinCount: 0,
    rerollsRemaining: 1,
    pendingSpin: null,
    picks: {},
    usedUnits: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    result: null,
  };
}

function userInput(): Omit<UserRecord, 'id' | 'createdAt'> {
  return {
    email: 'Fan@Example.com',
    displayName: 'Fan',
    defaultSport: 'nfl',
    isGuest: false,
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('RedisDraftStore', () => {
  it('creates, gets, updates, and lists drafts by guest', async () => {
    const store = new RedisDraftStore(new FakeRedis());
    const first = draft('one', 'guest-a');
    const second = draft('two', 'guest-a');
    const other = draft('three', 'guest-b');

    await store.create(first);
    await store.create(second);
    await store.create(other);
    expect(await store.get(first.id)).toEqual(first);
    expect(await store.listByGuest('guest-a')).toEqual([first, second]);
    expect(await store.listByGuest('guest-b')).toEqual([other]);

    const updated = { ...first, status: 'complete' as const };
    await expect(store.update(first.id, updated)).resolves.toEqual(updated);
    await expect(store.get(first.id)).resolves.toEqual(updated);
  });

  it('rejects duplicate creates and missing updates', async () => {
    const store = new RedisDraftStore(new FakeRedis());
    const state = draft('duplicate', null);
    await store.create(state);
    await expect(store.create(state)).rejects.toThrow('Draft already exists: duplicate');
    await expect(store.update('missing', state)).rejects.toThrow('Draft not found: missing');
  });
});

describe('RedisSessionStore', () => {
  it('persists sessions and users with case-insensitive email lookup', async () => {
    const store = new RedisSessionStore(new FakeRedis());
    const touched = await store.touch('guest', new Date('2026-01-01T00:00:00Z'));
    expect(await store.getSession('guest')).toEqual(touched);

    const user = await store.createUser(userInput(), new Date('2026-01-01T00:00:00Z'));
    expect(await store.findUserByEmail('fan@example.com')).toEqual(user);
    const attached = await store.attachUser('guest', user.id);
    expect(attached.userId).toBe(user.id);
    expect(await store.getSession('guest')).toEqual(attached);

    const updated = await store.updateUser(user.id, { displayName: 'Updated Fan' });
    expect(updated).toMatchObject({ id: user.id, displayName: 'Updated Fan' });
    await expect(store.getUser(user.id)).resolves.toEqual(updated);
  });
});

describe('store backend selection', () => {
  it('uses the in-memory draft store when Redis is not configured', () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
    expect(getDraftStore()).toBeInstanceOf(InMemoryDraftStore);
  });
});
