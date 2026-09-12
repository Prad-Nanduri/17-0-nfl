import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CfbSeasonResults } from '../../../../../components/draft/cfb-season-results';
import { toClientDraft } from '../../../../../lib/server/draft-client';
import { getDraftStore } from '../../../../../lib/server/draft-store';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'CFB season results' };

export default function CfbResultsPage({ params }: { params: { id: string } }) {
  const state = getDraftStore().get(params.id);
  if (state?.sportId !== 'cfb' || state.result === null || state === undefined) notFound();
  return <CfbSeasonResults draft={toClientDraft(state)} result={state.result} />;
}
