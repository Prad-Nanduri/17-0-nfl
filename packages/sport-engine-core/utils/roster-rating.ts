import type { CompletedRoster, PositionGroup } from '../src/types';

export type PositionWeights = Readonly<Record<PositionGroup, number>>;

// §5.3 leaves exact weights open: skill slots 1.1, other slots 1, specialists 0.9.
export const POSITION_WEIGHTS: PositionWeights = Object.freeze({
  QB: 1.1,
  RB: 1.1,
  WR: 1.1,
  TE: 1.1,
  OL: 1,
  DL: 1,
  LB: 1,
  CB: 1,
  S: 1,
  K: 0.9,
  P: 0.9,
});

export function aggregateRosterRating(
  roster: CompletedRoster,
  weights: PositionWeights = POSITION_WEIGHTS,
): number {
  if (roster.picks.length !== 24) {
    throw new RangeError('A completed roster must contain 24 picks');
  }
  for (const group of Object.keys(POSITION_WEIGHTS) as PositionGroup[]) {
    if (!Number.isFinite(weights[group]) || weights[group] <= 0) {
      throw new RangeError('Position weights must be finite and positive');
    }
  }
  const scale = Math.max(...roster.picks.map((pick) => weights[pick.slot.positionGroup]));
  const slotCodes = new Set<string>();
  let total = 0;
  let totalWeight = 0;
  for (const pick of roster.picks) {
    if (slotCodes.has(pick.slot.code)) {
      throw new Error(`Duplicate roster slot: ${pick.slot.code}`);
    }
    slotCodes.add(pick.slot.code);
    if (pick.candidate.poolUnit.sportId !== roster.sportId) {
      throw new Error('A roster cannot mix sports');
    }
    if (pick.rating.mode !== roster.ratingMode) {
      throw new Error('A roster cannot mix rating modes');
    }
    if (
      !Number.isFinite(pick.rating.overall) ||
      pick.rating.overall < 0 ||
      pick.rating.overall > 99
    ) {
      throw new RangeError('Player ratings must be finite and between 0 and 99');
    }
    const weight = weights[pick.slot.positionGroup] / scale;
    total += pick.rating.overall * weight;
    totalWeight += weight;
  }
  return total / totalWeight;
}
