import { randomUUID } from 'node:crypto';
import type {
  DraftOrder,
  Difficulty,
  RatingMode,
  SchemeId,
} from '@perfect-season/sport-engine-core';
import { NextResponse } from 'next/server';
import { toClientDraft } from '../../../../lib/server/draft-client';
import type { DraftState } from '../../../../lib/server/draft-store';
import { getDraftStore } from '../../../../lib/server/draft-store';
import { getNflData, getNflEngine } from '../../../../lib/server/nfl-engine';
import { readGuestToken } from '../../../../lib/server/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isChoice<T extends string>(value: unknown, choices: readonly T[]): value is T {
  return typeof value === 'string' && choices.includes(value as T);
}

function errorResponse(message: string, status: 400 | 404 | 409) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
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
  const engine = getNflEngine();
  const ruleset = engine.getModeRuleset('core');
  const draftOrders: readonly DraftOrder[] = ruleset.draftOrders;
  const ratingModes: readonly RatingMode[] = ruleset.ratingModes;
  const schemes: readonly SchemeId[] = ruleset.schemeIds;
  const difficulties: readonly Difficulty[] = ['easy', 'normal', 'hard'];
  if (!isChoice(input.draftOrder, draftOrders)) {
    return errorResponse('Invalid draftOrder', 400);
  }
  if (!isChoice(input.difficulty, difficulties)) {
    return errorResponse('Invalid difficulty', 400);
  }
  if (!isChoice(input.ratingMode, ratingModes)) {
    return errorResponse('Invalid ratingMode', 400);
  }
  if (!isChoice(input.schemeId, schemes)) {
    return errorResponse('Invalid schemeId', 400);
  }
  const state: DraftState = {
    id: randomUUID(),
    sportId: 'nfl',
    modeId: 'core',
    draftOrder: input.draftOrder,
    difficulty: input.difficulty,
    ratingMode: input.ratingMode,
    schemeId: input.schemeId,
    status: 'in_progress',
    guestToken: readGuestToken(request),
    spinCount: 0,
    rerollsRemaining: ruleset.difficultyRules[input.difficulty].rerolls,
    pendingSpin: null,
    picks: {},
    usedUnits: [],
    createdAt: new Date().toISOString(),
    result: null,
  };
  const draft = getDraftStore().create(state);
  return NextResponse.json({ draft: toClientDraft(draft, engine, getNflData()) }, { status: 201 });
}
