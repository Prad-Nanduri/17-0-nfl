import { createSeed } from '@perfect-season/sport-engine-core/utils';
import { NextResponse } from 'next/server';
import { buildCandidates, availableSeasons } from '../../../../lib/server/candidates';
import { toClientDraft } from '../../../../lib/server/draft-client';
import { getDraftStore } from '../../../../lib/server/draft-store';
import { getNflData, getNflEngine } from '../../../../lib/server/nfl-engine';
import type { NflDraftPoolUnit } from '../../../../lib/server/draft-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface ClientCandidate {
  readonly playerId: string;
  readonly fullName: string;
  readonly primaryPosition: string;
  readonly headshotUrl: string | null;
  readonly rating: number | null;
  readonly eligibleSlots: readonly { slotCode: string; warnings: readonly string[] }[];
}

function errorResponse(message: string, status: 400 | 404 | 409) {
  return NextResponse.json({ error: message }, { status });
}

function isReroll(request: Request): boolean {
  return new URL(request.url).searchParams.get('reroll') === '1';
}

export async function GET(request: Request) {
  const draftId = new URL(request.url).searchParams.get('draftId');
  if (!draftId) return errorResponse('draftId is required', 400);
  const store = getDraftStore();
  const current = store.get(draftId);
  if (current === undefined) return errorResponse('Draft not found', 404);
  if (current.status === 'complete') return errorResponse('Draft is complete', 409);
  const reroll = isReroll(request);
  if (current.pendingSpin !== null && !reroll) {
    return errorResponse('Pick or reroll the pending spin first', 409);
  }
  if (reroll && current.pendingSpin === null) {
    return errorResponse('There is no pending spin to reroll', 409);
  }
  if (reroll && current.rerollsRemaining <= 0) {
    return errorResponse('No rerolls remaining', 409);
  }

  const data = getNflData();
  const engine = getNflEngine();
  const scheme = engine.getSchemePresets().find((item) => item.id === current.schemeId);
  if (scheme === undefined) return errorResponse('Invalid draft scheme', 400);
  const openSlots = scheme.slots.filter((slot) => current.picks[slot.code] === undefined);
  const targetSlotCode =
    current.draftOrder === 'position_first' ? (openSlots[0]?.code ?? null) : null;
  if (openSlots.length === 0) return errorResponse('Draft has no open slots', 409);
  const ruleset = engine.getModeRuleset('core');
  const rerollsUsed =
    ruleset.difficultyRules[current.difficulty].rerolls - current.rerollsRemaining;
  const spinSeed = createSeed('nfl-spin', current.id, current.spinCount, rerollsUsed);
  const unit = (await engine.resolveSpinUnit(spinSeed, {
    modeId: 'core',
    seasonRange: availableSeasons(data),
    excludedUnits: current.usedUnits,
    criteria: {},
  })) as NflDraftPoolUnit;
  const franchise = data.franchises.find((item) => item.franchiseKey === unit.franchiseId);
  if (franchise === undefined) return errorResponse('Franchise not found', 404);
  const season = data.franchiseSeasons.find(
    (item) => item.franchiseKey === unit.franchiseId && item.season === unit.season,
  );
  const candidates = buildCandidates(unit, data);
  const clientCandidates = candidates
    .map((candidate) => {
      const rating = engine.computeRating(candidate, current.ratingMode);
      const slots = openSlots.flatMap((slot) => {
        if (targetSlotCode !== null && slot.code !== targetSlotCode) return [];
        const eligibility = engine.validateSlotEligibility(candidate, slot);
        return eligibility.eligible
          ? [{ slotCode: slot.code, warnings: eligibility.warnings }]
          : [];
      });
      return {
        playerId: candidate.playerId,
        fullName: candidate.fullName,
        primaryPosition: candidate.primaryPosition,
        headshotUrl:
          typeof candidate.traits.headshotUrl === 'string' ? candidate.traits.headshotUrl : null,
        rating: current.difficulty === 'hard' ? null : rating.overall,
        eligibleSlots: slots,
        positionGroup: rating.positionGroup,
      };
    })
    .filter((candidate) => candidate.eligibleSlots.length > 0)
    .sort((left, right) => {
      const positionOrder = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S', 'K', 'P'];
      const groupDifference =
        positionOrder.indexOf(left.positionGroup) - positionOrder.indexOf(right.positionGroup);
      if (groupDifference !== 0) return groupDifference;
      if (current.difficulty === 'hard') return left.fullName.localeCompare(right.fullName);
      return (
        (right.rating ?? 0) - (left.rating ?? 0) || left.fullName.localeCompare(right.fullName)
      );
    })
    .map((candidate) => {
      const { positionGroup, ...clientCandidate } = candidate;
      void positionGroup;
      return clientCandidate satisfies ClientCandidate;
    });
  const pending = {
    spinSeed,
    unit,
    targetSlotCode,
  };
  const next = store.update(current.id, {
    ...current,
    rerollsRemaining: reroll ? current.rerollsRemaining - 1 : current.rerollsRemaining,
    pendingSpin: pending,
  });
  return NextResponse.json({
    spin: {
      spinSeed,
      unit,
      franchise: {
        key: franchise.franchiseKey,
        name: franchise.name,
        abbreviation: franchise.abbreviation,
        conference: franchise.conference,
        logoUrl: (await engine.getFranchiseLogo(franchise.franchiseKey)).url,
      },
      record:
        season === undefined || season.wins === null
          ? null
          : {
              wins: season.wins,
              losses: season.losses ?? 0,
              ties: season.ties ?? 0,
            },
      eraTier: season?.eraTier ?? 'legacy',
      targetSlotCode,
      candidates: clientCandidates,
    },
    draft: toClientDraft(next, engine, data),
  });
}
