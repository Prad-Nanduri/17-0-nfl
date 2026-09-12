import type {
  EligibilityResult,
  PlayerCandidate,
  RosterSlot,
} from '@perfect-season/sport-engine-core';
import { normalizeCfbPosition, toPositionGroup } from './positions';

const ADJACENT_GROUPS: Readonly<
  Record<RosterSlot['positionGroup'], readonly RosterSlot['positionGroup'][]>
> = {
  QB: [],
  RB: [],
  WR: [],
  TE: [],
  OL: ['OL'],
  DL: ['LB'],
  LB: ['DL'],
  CB: ['S'],
  S: ['CB'],
  K: [],
  P: [],
};

export function validateSlotEligibility(
  candidate: PlayerCandidate,
  slot: RosterSlot,
): EligibilityResult {
  const rawPosition = candidate.primaryPosition.trim().toUpperCase();
  const normalized = normalizeCfbPosition(candidate.primaryPosition);
  const altPosition =
    typeof candidate.traits.cfbdPosition === 'string'
      ? normalizeCfbPosition(candidate.traits.cfbdPosition)
      : null;

  if (
    slot.eligiblePositions.includes(normalized) ||
    slot.eligiblePositions.includes(rawPosition) ||
    (altPosition !== null && slot.eligiblePositions.includes(altPosition))
  ) {
    return { eligible: true, warnings: [] };
  }

  // An alternate listed position that still maps into the slot's position
  // group is eligible with a versatility warning (CFB rosters list e.g. "DB").
  if (
    altPosition !== null &&
    toPositionGroup(altPosition) === slot.positionGroup &&
    toPositionGroup(normalized) !== slot.positionGroup
  ) {
    return {
      eligible: true,
      warnings: [
        `${candidate.fullName} is listed at ${rawPosition}; filling ${slot.code} on positional versatility`,
      ],
    };
  }

  if (candidate.traits.versatile !== true) {
    return {
      eligible: false,
      reason: `${normalized} cannot fill ${slot.code} (eligible: ${slot.eligiblePositions.join(', ')})`,
    };
  }

  const candidateGroup = toPositionGroup(normalized);
  const adjacent =
    candidateGroup !== null && ADJACENT_GROUPS[slot.positionGroup].includes(candidateGroup);
  if (adjacent) {
    return {
      eligible: true,
      warnings: [
        `${candidate.fullName} is listed at ${rawPosition}; filling ${slot.code} on positional versatility`,
      ],
    };
  }

  return {
    eligible: false,
    reason: `${normalized} cannot fill ${slot.code} (eligible: ${slot.eligiblePositions.join(', ')})`,
  };
}
