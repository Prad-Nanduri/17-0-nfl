import { NextResponse } from 'next/server';
import { toClientDraft } from '../../../../../../lib/server/draft-client';
import { getDraftStore } from '../../../../../../lib/server/draft-store';
import { getNflData, getNflEngine } from '../../../../../../lib/server/nfl-engine';
import { simulateDraft } from '../../../../../../lib/server/simulate';
import { draftBelongsTo } from '../../../../../../lib/server/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function errorResponse(message: string, status: 400 | 404 | 409) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request, context: { params: { id: string } }) {
  const store = getDraftStore();
  const current = await store.get(context.params.id);
  if (current === undefined || !draftBelongsTo(current, request)) {
    return errorResponse('Draft not found', 404);
  }
  if (current.status !== 'complete') return errorResponse('Draft is not complete', 409);
  if (current.result !== null) return errorResponse('Season already simulated', 409);

  let body: unknown = {};
  if (request.headers.get('content-type')?.includes('application/json')) {
    try {
      body = await request.json();
    } catch {
      return errorResponse('Request body must be valid JSON', 400);
    }
  }
  if (typeof body !== 'object' || body === null) {
    return errorResponse('Request body must be an object', 400);
  }
  const input = body as Record<string, unknown>;
  if (input.fullGauntlet !== undefined && typeof input.fullGauntlet !== 'boolean') {
    return errorResponse('fullGauntlet must be a boolean', 400);
  }
  const seed = input.seed;
  if (seed !== undefined) {
    if (typeof seed !== 'string') return errorResponse('seed must be a string', 400);
    if (process.env.PERFECT_SEASON_ALLOW_SEED_OVERRIDE !== '1') {
      return errorResponse('Seed override is disabled', 400);
    }
  }
  const result = await simulateDraft(current, getNflEngine(), getNflData(), {
    fullGauntlet: input.fullGauntlet ?? false,
    seed: typeof seed === 'string' ? seed : null,
  });
  const next = await store.update(current.id, { ...current, result });
  return NextResponse.json(
    { draft: toClientDraft(next, getNflEngine(), getNflData()), result },
    { status: 201 },
  );
}
