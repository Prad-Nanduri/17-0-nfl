import type { SportId } from '@perfect-season/sport-engine-core';
import { createRedisClient } from '@perfect-season/db';
import { RedisSessionStore } from './redis-store';
import { isRedisConfigured } from './store-backend';

/** Mirrors the `users` row in docs/spec.md §5.2. */
export interface UserRecord {
  readonly id: number;
  readonly email: string | null;
  readonly displayName: string;
  readonly defaultSport: SportId | null;
  readonly isGuest: boolean;
  readonly createdAt: string;
}

/** Mirrors the `sessions` row in docs/spec.md §5.2 — `guest_token` is the cookie identity. */
export interface SessionRecord {
  readonly id: number;
  readonly userId: number | null;
  readonly guestToken: string;
  readonly createdAt: string;
  readonly lastSeenAt: string;
}

export interface SessionStore {
  touch(guestToken: string, now?: Date): Promise<SessionRecord>;
  getSession(guestToken: string): Promise<SessionRecord | undefined>;
  getUser(id: number): Promise<UserRecord | undefined>;
  findUserByEmail(email: string): Promise<UserRecord | undefined>;
  createUser(input: Omit<UserRecord, 'id' | 'createdAt'>, now?: Date): Promise<UserRecord>;
  updateUser(id: number, patch: Partial<Omit<UserRecord, 'id'>>): Promise<UserRecord>;
  attachUser(guestToken: string, userId: number): Promise<SessionRecord>;
}

export class InMemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly users = new Map<number, UserRecord>();
  private nextSessionId = 1;
  private nextUserId = 1;

  async touch(guestToken: string, now = new Date()): Promise<SessionRecord> {
    const iso = now.toISOString();
    const existing = this.sessions.get(guestToken);
    const next: SessionRecord = existing
      ? { ...existing, lastSeenAt: iso }
      : { id: this.nextSessionId++, userId: null, guestToken, createdAt: iso, lastSeenAt: iso };
    this.sessions.set(guestToken, next);
    return next;
  }

  async getSession(guestToken: string): Promise<SessionRecord | undefined> {
    return this.sessions.get(guestToken);
  }

  async getUser(id: number): Promise<UserRecord | undefined> {
    return this.users.get(id);
  }

  async findUserByEmail(email: string): Promise<UserRecord | undefined> {
    const needle = email.toLowerCase();
    for (const user of this.users.values()) {
      if (user.email?.toLowerCase() === needle) return user;
    }
    return undefined;
  }

  async createUser(
    input: Omit<UserRecord, 'id' | 'createdAt'>,
    now = new Date(),
  ): Promise<UserRecord> {
    const user: UserRecord = { ...input, id: this.nextUserId++, createdAt: now.toISOString() };
    this.users.set(user.id, user);
    return user;
  }

  async updateUser(id: number, patch: Partial<Omit<UserRecord, 'id'>>): Promise<UserRecord> {
    const current = this.users.get(id);
    if (current === undefined) throw new Error(`User not found: ${id}`);
    const next = { ...current, ...patch, id };
    this.users.set(id, next);
    return next;
  }

  async attachUser(guestToken: string, userId: number): Promise<SessionRecord> {
    const session = await this.touch(guestToken);
    const next = { ...session, userId };
    this.sessions.set(guestToken, next);
    return next;
  }
}

/**
 * Guest → account upgrade (spec §0.5). The verified email becomes (or resolves to) a non-guest
 * user; the guest session is attached to it and the sport the guest was playing becomes the
 * account's `default_sport` unless one is already set.
 */
export async function linkGuestToAccount(
  store: SessionStore,
  guestToken: string,
  email: string,
  currentSport: SportId,
): Promise<{ user: UserRecord; session: SessionRecord }> {
  const normalized = email.trim().toLowerCase();
  const existing = await store.findUserByEmail(normalized);
  const user = existing
    ? await store.updateUser(existing.id, {
        isGuest: false,
        defaultSport: existing.defaultSport ?? currentSport,
      })
    : await store.createUser({
        email: normalized,
        displayName: normalized.split('@')[0] ?? normalized,
        defaultSport: currentSport,
        isGuest: false,
      });
  const session = await store.attachUser(guestToken, user.id);
  return { user, session };
}

interface SessionStoreGlobal {
  __perfectSeasonSessionStore?: SessionStore;
}

const serverGlobal = globalThis as typeof globalThis & SessionStoreGlobal;

export function getSessionStore(): SessionStore {
  serverGlobal.__perfectSeasonSessionStore ??= isRedisConfigured()
    ? new RedisSessionStore(createRedisClient())
    : new InMemorySessionStore();
  return serverGlobal.__perfectSeasonSessionStore;
}
