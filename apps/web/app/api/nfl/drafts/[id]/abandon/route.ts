import { NextResponse } from 'next/server';
import { toClientDraft } from '../../../../../../lib/server/draft-client';
import { getDraftStore } from '../../../../../../lib/server/draft-store';
import { getNflData, getNflEngine } from '../../../../../../lib/server/nfl-engine';
import { draftBelongsTo } from '../../../../../../lib/server/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request, context: { params: { id: string } }) {
  const store = getDraftStore();
  const current = await store.get(context.params.id);
  if (current === undefined || !draftBelongsTo(current, request)) {
    return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
  }
  if (current.result !== null) {
    return NextResponse.json({ error: 'Season already simulated' }, { status: 409 });
  }
  const next = await store.update(current.id, {
    ...current,
    status: 'abandoned',
    pendingSpin: null,
  });
  return NextResponse.json({ draft: toClientDraft(next, getNflEngine(), getNflData()) });
}
