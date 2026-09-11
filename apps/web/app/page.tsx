import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from '@phosphor-icons/react/dist/ssr';
import { Header } from '../components/checkpoint/header';
import { Footer } from '../components/checkpoint/footer';
import { GameExplainer } from '../components/checkpoint/game-explainer';
import { Enter } from '../components/motion/enter';
import { buttonStyles } from '../components/ui/button';

export default function Page() {
  return (
    <>
      <Header page="home" />
      <main id="main">
        <section
          aria-labelledby="hero-title"
          className="page-container pb-12 pt-10 md:pb-16 md:pt-14"
        >
          <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-[0.92fr_1.08fr] md:gap-10">
            <Enter className="relative py-2 md:py-8">
              <p className="eyebrow mb-6 flex items-center gap-3 text-action">
                <span className="h-px w-7 bg-current" aria-hidden="true" />
                Your roster. Your legacy.
              </p>
              <h1 id="hero-title" className="display-heading text-display">
                Greatness.
                <br />
                <span className="text-action">Your call.</span>
              </h1>
              <p className="mt-7 max-w-[23rem] text-lead text-muted">
                Draft across eras. Build your dream roster. Find out if it has a perfect season in
                it.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-2">
                <Link href="/draft" className={buttonStyles()}>
                  Explore the draft
                  <ArrowUpRight size={20} aria-hidden="true" />
                </Link>
                <GameExplainer />
              </div>
            </Enter>
            <div className="relative aspect-[1.2] overflow-hidden rounded-badge md:aspect-[1.04]">
              <Image
                src="/images/tunnel.webp"
                alt="A football player at the stadium tunnel, ready to take the field."
                fill
                priority
                sizes="(min-width: 1440px) 665px, (min-width: 768px) 52vw, 100vw"
                className="object-cover object-[62%_center]"
              />
            </div>
          </div>
          <dl className="mt-10 grid grid-cols-3 border-y border-line py-6 md:mt-12 md:py-7">
            <div className="flex flex-col gap-2 border-r border-line pr-4 md:flex-row md:items-center md:gap-5">
              <dt className="order-2 text-caption text-muted md:text-small">
                Roster slots.
                <br className="md:hidden" /> Every pick matters.
              </dt>
              <dd className="font-display text-scoreboard font-semibold tabular-nums">24</dd>
            </div>
            <div className="flex flex-col gap-2 border-r border-line px-5 md:flex-row md:items-center md:gap-5 md:px-10">
              <dt className="order-2 text-caption text-muted md:text-small">
                NFL games.
                <br className="md:hidden" /> One unbeaten run.
              </dt>
              <dd className="font-display text-scoreboard font-semibold tabular-nums">17</dd>
            </div>
            <div className="flex flex-col gap-2 pl-5 md:flex-row md:items-center md:gap-5 md:pl-10">
              <dt className="order-2 text-caption text-muted md:text-small">
                Losses.
                <br className="md:hidden" /> The ultimate goal.
              </dt>
              <dd className="font-display text-scoreboard font-semibold tabular-nums text-action">
                0
              </dd>
            </div>
          </dl>
        </section>
        <section
          id="the-idea"
          aria-labelledby="idea-title"
          className="page-container pb-12 pt-4 md:pb-20"
        >
          <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-[1.15fr_0.85fr] md:gap-20">
            <div className="relative aspect-[1.8] overflow-hidden rounded-badge">
              <Image
                src="/images/equipment.webp"
                alt="A worn football helmet and leather football on a locker-room bench."
                fill
                sizes="(min-width: 768px) 52vw, 100vw"
                className="object-cover"
              />
            </div>
            <div>
              <h2 id="idea-title" className="display-heading max-w-[20rem] text-heading">
                Every era.
                <br />
                One roster.
              </h2>
              <p className="mt-5 max-w-copy text-small text-muted">
                The legends you watched. The ones you wish you had. Bring them together and put your
                football instincts to the test.
              </p>
              <Link href="/draft" className="text-link mt-5">
                Explore the draft
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
