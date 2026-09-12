import Link from 'next/link';
import { ArrowUpRight } from '@phosphor-icons/react/dist/ssr';
import { AccountLink } from '../session/account-link';
import { PlayLink } from '../session/play-link';
import { SportSelector } from '../session/sport-selector';
import { AppearanceMenu } from './appearance-menu';

export function Header({ page }: { page: 'home' | 'draft' | 'play' | 'account' }) {
  const inDraftRoom = page === 'draft' || page === 'play';
  return (
    <header className="page-container">
      <a
        href="#main"
        className="sr-only z-modal focus:not-sr-only focus:absolute focus:left-5 focus:top-5 focus:rounded-control focus:bg-surface focus:p-4"
      >
        Skip to content
      </a>
      <div className="flex min-h-20 items-center justify-between gap-3 border-b border-line">
        <div className="flex min-w-0 items-center gap-3 sm:gap-5">
          <Link
            href="/"
            aria-label="Perfect Season home"
            className="flex shrink-0 items-center gap-2.5"
          >
            <span
              aria-hidden="true"
              className="flex h-10 w-10 items-center justify-center rounded-badge bg-action font-display text-title font-bold leading-none tracking-tighter text-on-action"
            >
              PS
            </span>
            <span className="hidden font-display text-[1.1875rem] font-bold uppercase leading-[0.9] tracking-wide sm:block">
              Perfect
              <br />
              Season
            </span>
          </Link>
          <SportSelector className="border-l border-line pl-3 sm:pl-5" />
        </div>
        <nav aria-label="Main navigation" className="flex items-center gap-4 lg:gap-8">
          <Link
            href="/"
            aria-current={page === 'home' ? 'page' : undefined}
            className={`hidden min-h-11 items-center text-small font-semibold transition-colors hover:text-action md:inline-flex ${page === 'home' ? 'text-action' : 'text-muted'}`}
          >
            The game
          </Link>
          <PlayLink
            aria-current={inDraftRoom ? 'page' : undefined}
            className={`inline-flex min-h-11 items-center gap-2 text-small font-semibold transition-colors hover:text-action ${inDraftRoom ? 'text-action' : 'text-ink'}`}
          >
            Draft room
            <ArrowUpRight size={16} aria-hidden="true" />
          </PlayLink>
          <AccountLink active={page === 'account'} />
          <div className="hidden border-l border-line pl-4 md:block">
            <AppearanceMenu />
          </div>
        </nav>
      </div>
    </header>
  );
}
