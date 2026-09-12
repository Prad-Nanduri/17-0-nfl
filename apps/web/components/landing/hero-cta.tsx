'use client';

import Link from 'next/link';
import { ArrowUpRight } from '@phosphor-icons/react';
import { SPORTS } from '../../lib/sport';
import { buttonStyles } from '../ui/button';
import { useSession } from '../session/session-provider';

/** Hero headline + primary action follow the session's sport: "Chase 17-0" for NFL (spec §8). */
export function HeroHeadline() {
  const { sport } = useSession();
  const option = SPORTS[sport];
  const [lead, ...rest] = option.chase.split(' ');
  return (
    <h1 id="hero-title" className="display-heading text-display">
      {lead}
      <br />
      <span className="text-action">{rest.join(' ')}.</span>
    </h1>
  );
}

export function HeroCta() {
  const { sport, activeDraft, sportLocked, user } = useSession();
  const option = SPORTS[sport];
  const resume = sportLocked && activeDraft?.sportId === sport;
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <Link href={`/play/${sport}`} className={buttonStyles()} data-sport={sport}>
        {!option.available
          ? `${option.longLabel} — coming soon`
          : resume
            ? 'Resume your draft'
            : 'Start drafting'}
        <ArrowUpRight size={20} aria-hidden="true" />
      </Link>
      <p className="text-caption text-muted">
        {user ? `Signed in as ${user.email}.` : 'No signup. No account. Just draft.'}
      </p>
    </div>
  );
}
