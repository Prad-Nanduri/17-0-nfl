import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from '@phosphor-icons/react/dist/ssr';
import { Header } from '../../../components/checkpoint/header';
import { Footer } from '../../../components/checkpoint/footer';
import { LeagueWall } from '../../../components/checkpoint/league-wall';
import { Badge } from '../../../components/ui/badge';
import { buttonStyles } from '../../../components/ui/button';
import { LeagueMark } from '../../../components/ui/team-logo';
import { leagues } from '../../../lib/teams';
import { SPORTS } from '../../../lib/sport';

export const metadata: Metadata = { title: 'College Football — coming soon' };

export default function CfbPlayPage() {
  return (
    <div data-sport="cfb">
      <Header page="play" />
      <main id="main" className="page-container pb-section pt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="text-link">
            <ArrowLeft size={16} aria-hidden="true" /> Back to the game
          </Link>
          <Badge tone="sport">Coming soon</Badge>
        </div>
        <div className="mt-10 max-w-copy">
          <p className="eyebrow mb-4 flex items-center gap-3 text-sport">
            <LeagueMark league={leagues.cfb} size="sm" eager />
            College Football / FBS
          </p>
          <h1 className="display-heading text-heading">{SPORTS.cfb.chase}.</h1>
          <p className="mt-5 text-lead text-muted">
            The college engine is on the way: conference-aware seasons, AP-poll flavor, and a
            perfect season that ends with a national title, not a scoreline.
          </p>
          <p className="mt-3 text-small text-muted">
            Until then, the NFL draft room is open. Switch sports in the header any time you are not
            mid-draft.
          </p>
          <div className="mt-8">
            <Link href="/play/nfl" className={buttonStyles()}>
              Draft the NFL instead
            </Link>
          </div>
        </div>
        <section aria-labelledby="cfb-pool" className="mt-14 border-t border-line pt-8">
          <h2 id="cfb-pool" className="text-small font-bold">
            The program pool
          </h2>
          <div className="mt-6">
            <LeagueWall sport="cfb" />
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
