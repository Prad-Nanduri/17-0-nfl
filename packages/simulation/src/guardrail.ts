import type { DeterministicRng } from '@perfect-season/sport-engine-core/utils';

export const GUARDRAIL_WEIGHTS = Object.freeze({ roster: 0.8, opponent: 0.2 });

export function normal(rng: DeterministicRng): number {
  const first = Math.max(Number.MIN_VALUE, rng.next());
  const second = rng.next();
  return Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second);
}

export function varianceInjection(
  opponentRating: number,
  sigma: number,
  rng: DeterministicRng,
): number {
  if (!Number.isFinite(opponentRating) || !Number.isFinite(sigma) || sigma < 0) {
    throw new RangeError('Opponent rating and sigma must be finite, with non-negative sigma');
  }
  if (sigma === 0) return opponentRating;
  return Math.min(99, Math.max(0, opponentRating + normal(rng) * sigma));
}

export function effectiveRosterRating(
  rosterRating: number,
  injectedOpponentRating: number,
): number {
  return (
    GUARDRAIL_WEIGHTS.roster * rosterRating + GUARDRAIL_WEIGHTS.opponent * injectedOpponentRating
  );
}
