import { NextResponse } from 'next/server';
import { toClientDraft } from '../../../../../lib/server/draft-client';
import { getDraftStore } from '../../../../../lib/server/draft-store';
import { getNflData, getNflEngine } from '../../../../../lib/server/nfl-engine';
import { draftBelongsTo } from '../../../../../lib/server/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: { id: string } }) {
  const store = getDraftStore();
  const draft = store.get(context.params.id);
  if (draft === undefined || !draftBelongsTo(draft, request)) {
    return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
  }
  return NextResponse.json({
    draft: toClientDraft(draft, getNflEngine(), getNflData()),
  });
}
