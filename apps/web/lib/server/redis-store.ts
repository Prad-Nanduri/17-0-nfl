import type { DraftStore, DraftState } from './draft-store';
import type { SessionRecord, SessionStore, UserRecord } from './session-store';

export interface RedisLike {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, opts?: { ex?: number }): Promise<unknown>;
  del(...keys: string[]): Promise<number>;
  sadd(key: string, ...members: string[]): Promise<number>;
  smembers(key: string): Promise<string[]>;
  incr(key: string): Promise<number>;
  mget<T>(...keys: string[]): Promise<(T | null)[]>;
  expire(key: string, seconds: number): Promise<number>;
}

const DRAFT_TTL_SECONDS = 7 * 24 * 60 * 60;
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

function draftKey(id: string): string {
  return `ps:nfl:draft:${id}`;
}

function guestDraftsKey(guestToken: string): string {
  return `ps:nfl:guest:${guestToken}:drafts`;
}

function sessionKey(guestToken: string): string {
  return `ps:session:${guestToken}`;
}

function userKey(id: number): string {
  return `ps:user:${id}`;
}

function userEmailKey(email: string): string {
  return `ps:user:email:${email.toLowerCase()}`;
}

export class RedisDraftStore implements DraftStore {
  constructor(private readonly redis: RedisLike) {}

  async create(state: DraftState): Promise<DraftState> {
    const key = draftKey(state.id);
    if ((await this.redis.get<DraftState>(key)) !== null) {
      throw new Error(`Draft already exists: ${state.id}`);
    }
    await this.redis.set(key, state, { ex: DRAFT_TTL_SECONDS });
    if (state.guestToken !== null) {
      const indexKey = guestDraftsKey(state.guestToken);
      await this.redis.sadd(indexKey, state.id);
      await this.redis.expire(indexKey, DRAFT_TTL_SECONDS);
    }
    return state;
  }

  async get(id: string): Promise<DraftState | undefined> {
    return (await this.redis.get<DraftState>(draftKey(id))) ?? undefined;
  }

  async update(id: string, state: DraftState): Promise<DraftState> {
    const key = draftKey(id);
    if ((await this.redis.get<DraftState>(key)) === null) {
      throw new Error(`Draft not found: ${id}`);
    }
    await this.redis.set(key, state, { ex: DRAFT_TTL_SECONDS });
    if (state.guestToken !== null) {
      const indexKey = guestDraftsKey(state.guestToken);
      await this.redis.sadd(indexKey, state.id);
      await this.redis.expire(indexKey, DRAFT_TTL_SECONDS);
    }
    return state;
  }

  async listByGuest(guestToken: string): Promise<readonly DraftState[]> {
    const ids = await this.redis.smembers(guestDraftsKey(guestToken));
    if (ids.length === 0) return [];
    const drafts = await this.redis.mget<DraftState>(...ids.map((id) => draftKey(id)));
    return drafts.filter((draft): draft is DraftState => draft !== null);
  }
}

export class RedisSessionStore implements SessionStore {
  constructor(private readonly redis: RedisLike) {}

  async touch(guestToken: string, now = new Date()): Promise<SessionRecord> {
    const key = sessionKey(guestToken);
    const existing = await this.redis.get<SessionRecord>(key);
    const iso = now.toISOString();
    const next: SessionRecord =
      existing === null
        ? {
            id: await this.redis.incr('ps:seq:session'),
            userId: null,
            guestToken,
            createdAt: iso,
            lastSeenAt: iso,
          }
        : { ...existing, lastSeenAt: iso };
    await this.redis.set(key, next, { ex: SESSION_TTL_SECONDS });
    return next;
  }

  async getSession(guestToken: string): Promise<SessionRecord | undefined> {
    return (await this.redis.get<SessionRecord>(sessionKey(guestToken))) ?? undefined;
  }

  async getUser(id: number): Promise<UserRecord | undefined> {
    return (await this.redis.get<UserRecord>(userKey(id))) ?? undefined;
  }

  async findUserByEmail(email: string): Promise<UserRecord | undefined> {
    const id = await this.redis.get<string>(userEmailKey(email));
    if (id === null) return undefined;
    const user = await this.getUser(Number(id));
    return user ?? undefined;
  }

  async createUser(
    input: Omit<UserRecord, 'id' | 'createdAt'>,
    now = new Date(),
  ): Promise<UserRecord> {
    const user: UserRecord = {
      ...input,
      id: await this.redis.incr('ps:seq:user'),
      createdAt: now.toISOString(),
    };
    await this.redis.set(userKey(user.id), user);
    if (user.email !== null) await this.redis.set(userEmailKey(user.email), String(user.id));
    return user;
  }

  async updateUser(id: number, patch: Partial<Omit<UserRecord, 'id'>>): Promise<UserRecord> {
    const current = await this.getUser(id);
    if (current === undefined) throw new Error(`User not found: ${id}`);
    const next = { ...current, ...patch, id };
    await this.redis.set(userKey(id), next);
    if (current.email !== next.email) {
      if (current.email !== null) await this.redis.del(userEmailKey(current.email));
      if (next.email !== null) await this.redis.set(userEmailKey(next.email), String(id));
    }
    return next;
  }

  async attachUser(guestToken: string, userId: number): Promise<SessionRecord> {
    const session = await this.touch(guestToken);
    const next = { ...session, userId };
    await this.redis.set(sessionKey(guestToken), next, { ex: SESSION_TTL_SECONDS });
    return next;
  }
}
