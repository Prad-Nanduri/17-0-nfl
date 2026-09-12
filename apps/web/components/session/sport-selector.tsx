'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Lock } from '@phosphor-icons/react';
import {
  SPORTS,
  SPORT_IDS,
  SPORT_LOCK_MESSAGE,
  routeSportFromPathname,
  type SportId,
} from '../../lib/sport';
import { useToast } from '../ui/toast';
import { useSession } from './session-provider';

/**
 * Always-visible header sport toggle (spec §0.5). Greys out once the live draft has picks;
 * the API enforces the same rule, so the disabled state is a courtesy, not the guard.
 */
export function SportSelector({ className = '' }: { className?: string }) {
  const { sport, sportLocked, activeDraft, chooseSport, loaded } = useSession();
  const notify = useToast();
  const router = useRouter();
  const pathname = usePathname();
  // The header toggle must highlight the sport the page is actually on (e.g.
  // /play/cfb) even before the session cookie catches up.
  const routeSport = routeSportFromPathname(pathname);
  const [busy, setBusy] = useState(false);
  const lockedTo = sportLocked ? activeDraft?.sportId : undefined;
  const hint = sportLocked ? SPORT_LOCK_MESSAGE : undefined;

  async function select(next: SportId) {
    if (next === sport || busy) return;
    if (sportLocked && lockedTo !== next) {
      notify({ title: 'Sport locked', description: SPORT_LOCK_MESSAGE, tone: 'error' });
      return;
    }
    setBusy(true);
    try {
      await chooseSport(next);
      if (pathname.startsWith('/play/')) router.push(`/play/${next}`);
      router.refresh();
    } catch (error) {
      notify({
        title: 'Sport locked',
        description: error instanceof Error ? error.message : SPORT_LOCK_MESSAGE,
        tone: 'error',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div
        role="radiogroup"
        aria-label="Sport"
        aria-disabled={sportLocked || undefined}
        title={hint}
        data-locked={sportLocked ? 'true' : undefined}
        className={`inline-flex rounded-control border border-line bg-surface p-0.5 transition-opacity ${
          sportLocked ? 'opacity-50' : ''
        }`}
      >
        {SPORT_IDS.map((id) => {
          const option = SPORTS[id];
          const selected = (routeSport ?? sport) === id;
          const disabled = !loaded || busy;
          const locked = sportLocked && lockedTo !== id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={option.available ? option.longLabel : `${option.longLabel} (coming soon)`}
              disabled={disabled}
              aria-disabled={locked || undefined}
              onClick={() => void select(id)}
              data-sport={id}
              className={`inline-flex min-h-9 items-center gap-1.5 rounded-badge px-3 text-caption font-bold uppercase tracking-wide transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action disabled:cursor-not-allowed aria-disabled:cursor-not-allowed ${
                selected
                  ? 'bg-sport text-on-action'
                  : locked
                    ? 'text-muted'
                    : 'text-muted hover:text-ink'
              }`}
            >
              {option.label}
              {!option.available ? (
                <span
                  className={`rounded-badge px-1 text-micro normal-case tracking-normal ${
                    selected ? 'bg-on-action/20' : 'bg-subtle'
                  }`}
                  aria-hidden="true"
                >
                  Soon
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {sportLocked ? (
        <span className="hidden items-center gap-1 text-micro text-muted lg:inline-flex">
          <Lock size={12} aria-hidden="true" />
          Locked
        </span>
      ) : null}
    </div>
  );
}
