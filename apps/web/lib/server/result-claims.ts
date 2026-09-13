import { createRedisClient } from '@perfect-season/db';
import type { RedisLike } from './redis-store';
import { isRedisConfigured } from './store-backend';

/** A guest's request to attach a display name to one completed draft, pending
 *  magic-link verification. Keyed by guest token so only the drafter's browser
 *  session can complete the claim. */
export interface PendingResultClaim {
  readonly draftId: string;
  readonly displayName: string;
}

const CLAIM_TTL_SECONDS = 3600;

function claimKey(guestToken: string): string {
  return `ps:result-claim:${guestToken}`;
}

interface ClaimGlobal {
  __perfectSeasonResultClaims?: Map<string, PendingResultClaim>;
}

const claimGlobal = globalThis as typeof globalThis & ClaimGlobal;

function memoryStore(): Map<string, PendingResultClaim> {
  claimGlobal.__perfectSeasonResultClaims ??= new Map();
  return claimGlobal.__perfectSeasonResultClaims;
}

let redisClient: RedisLike | null = null;
function redis(): RedisLike | null {
  if (!isRedisConfigured()) return null;
  redisClient ??= createRedisClient() as RedisLike;
  return redisClient;
}

export async function setPendingClaim(
  guestToken: string,
  claim: PendingResultClaim,
): Promise<void> {
  const client = redis();
  if (client !== null) {
    await client.set(claimKey(guestToken), claim, { ex: CLAIM_TTL_SECONDS });
    return;
  }
  memoryStore().set(guestToken, claim);
}

export async function takePendingClaim(guestToken: string): Promise<PendingResultClaim | null> {
  const client = redis();
  if (client !== null) {
    const key = claimKey(guestToken);
    const claim = await client.get<PendingResultClaim>(key);
    if (claim !== null) await client.del(key);
    return claim;
  }
  const store = memoryStore();
  const claim = store.get(guestToken) ?? null;
  store.delete(guestToken);
  return claim;
}
