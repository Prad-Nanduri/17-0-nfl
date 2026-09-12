import type { Metadata } from 'next';
import { Header } from '../../components/checkpoint/header';
import { Footer } from '../../components/checkpoint/footer';
import { LeaderboardBoard } from '../../components/leaderboard/leaderboard-board';

export const metadata: Metadata = { title: 'Leaderboard' };

export default function LeaderboardPage() {
  return (
    <>
      <Header page="leaderboard" />
      <main id="main" className="page-container pb-section pt-10">
        <p className="eyebrow mb-3">Global leaderboard</p>
        <h1 className="display-heading text-display">Closest to perfect.</h1>
        <p className="mt-3 max-w-copy text-body text-muted">
          Every completed draft, ranked by how near the run came to an unbeaten season — record
          first, then point differential. Anonymous drafters show up under a generated alias; link
          an email on the account page to claim your name.
        </p>
        <div className="mt-8">
          <LeaderboardBoard />
        </div>
      </main>
      <Footer />
    </>
  );
}
