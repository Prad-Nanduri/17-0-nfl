import type { SportId } from '@perfect-season/sport-engine-core';

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
  touch(guestToken: string, now?: Date): SessionRecord;
  getSession(guestToken: string): SessionRecord | undefined;
  getUser(id: number): UserRecord | undefined;
  findUserByEmail(email: string): UserRecord | undefined;
  createUser(input: Omit<UserRecord, 'id' | 'createdAt'>, now?: Date): UserRecord;
  updateUser(id: number, patch: Partial<Omit<UserRecord, 'id'>>): UserRecord;
  attachUser(guestToken: string, userId: number): SessionRecord;
}

export class InMemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly users = new Map<number, UserRecord>();
  private nextSessionId = 1;
  private nextUserId = 1;

  touch(guestToken: string, now = new Date()): SessionRecord {
    const iso = now.toISOString();
    const existing = this.sessions.get(guestToken);
    const next: SessionRecord = existing
      ? { ...existing, lastSeenAt: iso }
      : { id: this.nextSessionId++, userId: null, guestToken, createdAt: iso, lastSeenAt: iso };
    this.sessions.set(guestToken, next);
    return next;
  }

  getSession(guestToken: string): SessionRecord | undefined {
    return this.sessions.get(guestToken);
  }

  getUser(id: number): UserRecord | undefined {
    return this.users.get(id);
  }

  findUserByEmail(email: string): UserRecord | undefined {
    const needle = email.toLowerCase();
    for (const user of this.users.values()) {
      if (user.email?.toLowerCase() === needle) return user;
    }
    return undefined;
  }

  createUser(input: Omit<UserRecord, 'id' | 'createdAt'>, now = new Date()): UserRecord {
    const user: UserRecord = { ...input, id: this.nextUserId++, createdAt: now.toISOString() };
    this.users.set(user.id, user);
    return user;
  }

  updateUser(id: number, patch: Partial<Omit<UserRecord, 'id'>>): UserRecord {
    const current = this.users.get(id);
    if (current === undefined) throw new Error(`User not found: ${id}`);
    const next = { ...current, ...patch, id };
    this.users.set(id, next);
    return next;
  }

  attachUser(guestToken: string, userId: number): SessionRecord {
    const session = this.touch(guestToken);
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
export function linkGuestToAccount(
  store: SessionStore,
  guestToken: string,
  email: string,
  currentSport: SportId,
): { user: UserRecord; session: SessionRecord } {
  const normalized = email.trim().toLowerCase();
  const existing = store.findUserByEmail(normalized);
  const user = existing
    ? store.updateUser(existing.id, {
        isGuest: false,
        defaultSport: existing.defaultSport ?? currentSport,
      })
    : store.createUser({
        email: normalized,
        displayName: normalized.split('@')[0] ?? normalized,
        defaultSport: currentSport,
        isGuest: false,
      });
  const session = store.attachUser(guestToken, user.id);
  return { user, session };
}

interface SessionStoreGlobal {
  __perfectSeasonSessionStore?: InMemorySessionStore;
}

const serverGlobal = globalThis as typeof globalThis & SessionStoreGlobal;

export function getSessionStore(): SessionStore {
  serverGlobal.__perfectSeasonSessionStore ??= new InMemorySessionStore();
  return serverGlobal.__perfectSeasonSessionStore;
}
