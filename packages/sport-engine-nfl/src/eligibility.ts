import type {
  EligibilityResult,
  PlayerCandidate,
  RosterSlot,
} from '@perfect-season/sport-engine-core';
import { toPositionGroup, toRatingPositionGroup } from './positions';

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
  const primaryPosition = candidate.primaryPosition.trim().toUpperCase();
  if (slot.eligiblePositions.includes(primaryPosition)) {
    return { eligible: true, warnings: [] };
  }

  if (candidate.traits.versatile !== true) {
    return {
      eligible: false,
      reason: `${primaryPosition} cannot fill ${slot.code} (eligible: ${slot.eligiblePositions.join(', ')})`,
    };
  }

  const candidateGroup = toRatingPositionGroup({
    position: primaryPosition,
    ngsPosition:
      typeof candidate.traits.ngsPosition === 'string' ? candidate.traits.ngsPosition : null,
    depthChartPosition:
      typeof candidate.traits.depthChartPosition === 'string'
        ? candidate.traits.depthChartPosition
        : null,
  });
  const primaryGroup = toPositionGroup(primaryPosition);
  const adjacent =
    candidateGroup !== null && ADJACENT_GROUPS[slot.positionGroup]?.includes(candidateGroup);
  const remappedSameGroup =
    candidateGroup === slot.positionGroup && primaryGroup !== slot.positionGroup;
  if (adjacent || remappedSameGroup) {
    return {
      eligible: true,
      warnings: [
        `${candidate.fullName} is listed at ${primaryPosition}; filling ${slot.code} on positional versatility`,
      ],
    };
  }

  return {
    eligible: false,
    reason: `${primaryPosition} cannot fill ${slot.code} (eligible: ${slot.eligiblePositions.join(', ')})`,
  };
}
