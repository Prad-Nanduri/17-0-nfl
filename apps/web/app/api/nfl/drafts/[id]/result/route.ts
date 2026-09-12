import { NextResponse } from 'next/server';
import { toClientDraft } from '../../../../../../lib/server/draft-client';
import { getDraftStore } from '../../../../../../lib/server/draft-store';
import { getNflData, getNflEngine } from '../../../../../../lib/server/nfl-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: { params: { id: string } }) {
  const draft = getDraftStore().get(context.params.id);
  if (draft === undefined) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
  if (draft.result === null) {
    return NextResponse.json({ error: 'Season not simulated yet' }, { status: 404 });
  }
  return NextResponse.json({
    draft: toClientDraft(draft, getNflEngine(), getNflData()),
    result: draft.result,
  });
}
