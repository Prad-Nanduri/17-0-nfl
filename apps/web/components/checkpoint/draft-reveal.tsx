'use client';

import Image from 'next/image';
import { useState } from 'react';
import { ArrowClockwise, ArrowRight, LockSimple } from '@phosphor-icons/react';
import { leagues, requireTeam } from '../../lib/teams';
import { CardFlipReveal } from '../motion/card-flip-reveal';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card } from '../ui/card';
import { TeamLogo } from '../ui/team-logo';
import { useToast } from '../ui/toast';

// Fixed sample for the motion reference; a real draw arrives with the wheel-spin feature.
const sampleTeam = requireTeam('nfl', 'green-bay-packers');

export function DraftReveal() {
  const [revealed, setRevealed] = useState(false);
  const notify = useToast();

  function toggleReveal() {
    setRevealed((value) => !value);
    if (!revealed)
      notify({
        title: 'Reveal preview',
        description: 'This is a motion sample. Your draft has not changed.',
        tone: 'info',
      });
  }

  return (
    <section aria-labelledby="reveal-heading" className="min-w-0">
      <div className="flex items-center justify-between gap-3">
        <h2 id="reveal-heading" className="text-small font-bold">
          The next pick
        </h2>
        <Badge tone="sport">Team reveal</Badge>
      </div>
      <div className="mt-5 rounded-panel bg-subtle px-5 pb-7 pt-7 sm:px-8 sm:py-8">
        <div className="mx-auto w-full max-w-[22rem]">
          <CardFlipReveal
            label="Sample team reveal"
            revealed={revealed}
            className="aspect-[0.88]"
            front={
              <Card
                elevation="raised"
                className="flex h-full flex-col overflow-hidden !rounded-control !bg-primary-900 !text-neutral-50 shadow-card"
              >
                <div className="flex items-center justify-between p-5 text-micro font-semibold uppercase tracking-wider">
                  <span>Perfect Season</span>
                  <Image
                    src={leagues.nfl.logoDark}
                    alt="NFL"
                    width={36}
                    height={24}
                    unoptimized
                    className="h-6 w-9 object-contain"
                  />
                </div>
                <div className="flex flex-1 flex-col items-center justify-center px-5">
                  <span
                    aria-hidden="true"
                    className="font-display text-[7rem] font-semibold leading-none tracking-tighter text-neutral-50"
                  >
                    PS<span className="text-accent-300">.</span>
                  </span>
                  <span className="mt-2 text-caption text-neutral-300">A new possibility.</span>
                </div>
                <div className="mx-5 border-t border-primary-500 py-5 text-center text-small font-semibold">
                  Who will shape your season?
                </div>
              </Card>
            }
            back={
              <Card
                elevation="raised"
                className="flex h-full flex-col overflow-hidden !rounded-control shadow-card"
              >
                <div
                  className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden"
                  style={{ backgroundColor: sampleTeam.color }}
                >
                  <TeamLogo
                    team={sampleTeam}
                    size="xl"
                    eager
                    className="drop-shadow-[0_12px_24px_rgb(0_0_0/0.35)]"
                  />
                </div>
                <div className="border-t-4 border-sport p-5">
                  <p className="text-caption text-muted">Illustrative franchise pool</p>
                  <h3 className="display-heading mt-1 text-heading">{sampleTeam.location}</h3>
                  <p className="mt-3 text-caption text-muted">
                    {sampleTeam.name} · {sampleTeam.group}. Your next possibility.
                  </p>
                </div>
              </Card>
            }
          />
          <Button className="mt-7 w-full" onClick={toggleReveal} aria-pressed={revealed}>
            {revealed ? (
              <>
                <ArrowClockwise size={18} aria-hidden="true" />
                Reset preview
              </>
            ) : (
              <>
                Preview reveal
                <ArrowRight size={18} aria-hidden="true" />
              </>
            )}
          </Button>
          <p className="mt-3 text-center text-caption text-muted">
            Animation sample only. No spin or selection logic.
          </p>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-caption text-muted">
          <LockSimple size={16} aria-hidden="true" />
          Player selection is not connected.
        </span>
        <Button variant="secondary" size="small" disabled>
          Lock pick
        </Button>
      </div>
    </section>
  );
}
