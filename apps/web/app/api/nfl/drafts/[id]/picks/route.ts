import { NextResponse } from 'next/server';
import { buildCandidates } from '../../../../../../lib/server/candidates';
import { toClientDraft } from '../../../../../../lib/server/draft-client';
import type { StoredPick } from '../../../../../../lib/server/draft-store';
import { getDraftStore } from '../../../../../../lib/server/draft-store';
import { getNflData, getNflEngine } from '../../../../../../lib/server/nfl-engine';
import { draftBelongsTo } from '../../../../../../lib/server/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function errorResponse(message: string, status: 400 | 404 | 409) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request, context: { params: { id: string } }) {
  const store = getDraftStore();
  const current = store.get(context.params.id);
  if (current === undefined || !draftBelongsTo(current, request)) {
    return errorResponse('Draft not found', 404);
  }
  if (current.status !== 'in_progress') return errorResponse('Draft is not in progress', 409);
  if (current.pendingSpin === null) return errorResponse('There is no pending spin', 409);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Request body must be valid JSON', 400);
  }
  if (typeof body !== 'object' || body === null) {
    return errorResponse('Request body must be an object', 400);
  }
  const input = body as Record<string, unknown>;
  if (
    typeof input.slotCode !== 'string' ||
    typeof input.playerId !== 'string' ||
    typeof input.spinSeed !== 'string'
  ) {
    return errorResponse('slotCode, playerId, and spinSeed are required', 400);
  }
  if (input.spinSeed !== current.pendingSpin.spinSeed) {
    return errorResponse('Spin seed does not match the pending spin', 409);
  }
  const engine = getNflEngine();
  const data = getNflData();
  const scheme = engine.getSchemePresets().find((item) => item.id === current.schemeId);
  if (scheme === undefined) return errorResponse('Invalid draft scheme', 400);
  const slot = scheme.slots.find((item) => item.code === input.slotCode);
  if (slot === undefined) return errorResponse('Unknown roster slot', 400);
  if (current.picks[slot.code] !== undefined)
    return errorResponse('Roster slot is already filled', 409);
  if (current.draftOrder === 'position_first' && current.pendingSpin.targetSlotCode !== slot.code) {
    return errorResponse('Position-first draft requires the target slot', 400);
  }
  const candidate = buildCandidates(current.pendingSpin.unit, data).find(
    (item) => item.playerId === input.playerId,
  );
  if (candidate === undefined) return errorResponse('Player is not in the pending spin pool', 400);
  const eligibility = engine.validateSlotEligibility(candidate, slot);
  if (!eligibility.eligible) return errorResponse(eligibility.reason, 400);
  const rating = engine.computeRating(candidate, current.ratingMode);
  const storedPick: StoredPick = {
    slotCode: slot.code,
    playerId: candidate.playerId,
    fullName: candidate.fullName,
    primaryPosition: candidate.primaryPosition,
    headshotUrl:
      typeof candidate.traits.headshotUrl === 'string' ? candidate.traits.headshotUrl : null,
    unit: current.pendingSpin.unit,
    spinSeed: current.pendingSpin.spinSeed,
    rating,
  };
  const picks = { ...current.picks, [slot.code]: storedPick };
  const usedUnits = [...current.usedUnits, current.pendingSpin.unit];
  const status = Object.keys(picks).length === scheme.slots.length ? 'complete' : 'in_progress';
  const next = store.update(current.id, {
    ...current,
    status,
    spinCount: current.spinCount + 1,
    pendingSpin: null,
    picks,
    usedUnits,
  });
  return NextResponse.json({
    draft: toClientDraft(next, engine, data),
    warnings: eligibility.warnings,
  });
}
