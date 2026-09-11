import { Redis } from '@upstash/redis';
import { requireEnv } from './env';

// Upstash Redis over REST — leaderboard sorted sets, live-draft turn state,
// rate limiting (docs/spec.md §5.1)
export function createRedisClient() {
  return new Redis({
    url: requireEnv('UPSTASH_REDIS_REST_URL'),
    token: requireEnv('UPSTASH_REDIS_REST_TOKEN'),
  });
}
