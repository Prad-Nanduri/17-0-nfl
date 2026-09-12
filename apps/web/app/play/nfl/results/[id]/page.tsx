import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SeasonResults } from '../../../../../components/draft/season-results';
import { toClientDraft } from '../../../../../lib/server/draft-client';
import { getDraftStore } from '../../../../../lib/server/draft-store';
import { getNflData, getNflEngine } from '../../../../../lib/server/nfl-engine';

export const dynamic = 'force-dynamic';

interface ResultsPageProps {
  readonly params: { id: string };
}

export async function generateMetadata({ params }: ResultsPageProps): Promise<Metadata> {
  const state = await getDraftStore().get(params.id);
  if (state?.result === null || state === undefined) return { title: 'Season results' };
  const { wins, losses, ties } = state.result.season.record;
  const record = `${wins}-${losses}${ties > 0 ? `-${ties}` : ''}`;
  return {
    title: `${record} · Perfect Season`,
    openGraph: { images: [`/api/nfl/drafts/${params.id}/og`] },
  };
}

export default async function ResultsPage({ params }: ResultsPageProps) {
  const state = await getDraftStore().get(params.id);
  if (state?.result === null || state === undefined) notFound();
  const draft = toClientDraft(state, getNflEngine(), getNflData());
  return <SeasonResults draft={draft} result={state.result} />;
}
