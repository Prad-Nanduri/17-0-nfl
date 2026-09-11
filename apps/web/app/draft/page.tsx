import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Check } from '@phosphor-icons/react/dist/ssr';
import { Header } from '../../components/checkpoint/header';
import { Footer } from '../../components/checkpoint/footer';
import { GameExplainer } from '../../components/checkpoint/game-explainer';
import { DraftReveal } from '../../components/checkpoint/draft-reveal';
import { SampleRoster } from '../../components/checkpoint/sample-roster';
import { Badge } from '../../components/ui/badge';

export const metadata: Metadata = { title: 'Draft room preview' };

export default function DraftPage() {
  return (
    <div data-sport="nfl">
      <Header page="draft" />
      <main id="main" className="page-container pb-8 pt-7 md:pt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="text-link">
            <ArrowLeft size={16} aria-hidden="true" />
            Back to the game
          </Link>
          <Badge>Design preview</Badge>
        </div>
        <div className="mt-7 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="eyebrow mb-3 text-sport">NFL / Solo draft</p>
            <h1 className="display-heading text-heading">Draft in progress.</h1>
            <p className="mt-4 text-small text-muted">Six picks in. A whole season ahead of you.</p>
          </div>
          <GameExplainer compact />
        </div>
        <ol
          aria-label="Illustrative draft stages"
          className="my-8 grid grid-cols-3 border-y border-line py-4 text-caption sm:my-10 sm:text-small"
        >
          <li className="flex items-center justify-center gap-2 text-muted">
            <Check size={16} aria-hidden="true" />
            Set the rules
          </li>
          <li
            aria-current="step"
            className="flex items-center justify-center gap-2 border-x border-line font-bold text-sport"
          >
            Build your roster
          </li>
          <li className="text-center text-muted">Play the season</li>
        </ol>
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:gap-16">
          <DraftReveal />
          <SampleRoster />
        </div>
      </main>
      <Footer />
    </div>
  );
}
