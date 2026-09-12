'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useState } from 'react';
import { ArrowClockwise, Sparkle } from '@phosphor-icons/react';
import { CardFlipReveal } from '../motion/card-flip-reveal';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card } from '../ui/card';
import { TeamLogo } from '../ui/team-logo';
import { nflTeams } from '../../lib/teams/nfl';
import { motionTokens } from '../../lib/motion';
import type { DraftSpin } from './types';

export function SpinWheel({
  draftId,
  spin: spinState,
  rerollsRemaining,
  loading,
  onSpin,
  onError,
}: {
  draftId: string;
  spin: DraftSpin | null;
  rerollsRemaining: number;
  loading: boolean;
  onSpin: (reroll: boolean) => Promise<DraftSpin>;
  onError: (message: string) => void;
}) {
  const reduce = useReducedMotion();
  const [rotation, setRotation] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [spinning, setSpinning] = useState(false);

  async function spin(reroll: boolean) {
    setSpinning(true);
    setRevealed(false);
    try {
      const result = await onSpin(reroll);
      const index = nflTeams.findIndex(
        (team) =>
          team.abbreviation === result.franchise.abbreviation || team.id === result.franchise.key,
      );
      const segment = index >= 0 ? index * (360 / nflTeams.length) : Math.random() * 360;
      setRotation((previous) => previous + (reduce ? 0 : 720) + segment - (previous % 360));
      setRevealed(true);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not spin');
    } finally {
      setSpinning(false);
    }
  }

  const teamForSpin = spinState
    ? nflTeams.find(
        (team) =>
          team.abbreviation === spinState.franchise.abbreviation ||
          team.id === spinState.franchise.key,
      )
    : undefined;
  return (
    <div className="grid gap-5">
      <Card className="relative overflow-hidden p-5">
        <div className="pointer-events-none absolute left-1/2 top-2 z-10 -translate-x-1/2 text-sport">
          <Sparkle size={25} weight="fill" aria-label="Spin pointer" />
        </div>
        <motion.div
          className="relative mx-auto aspect-square w-full max-w-[23rem] rounded-full border-2 border-sport/40 bg-subtle"
          animate={{ rotate: rotation }}
          transition={reduce ? { duration: 0 } : { duration: 1.8, ease: [...motionTokens.ease] }}
          aria-label="NFL franchise spin wheel"
          role="img"
        >
          {nflTeams.map((team, index) => {
            const angle = index * (360 / nflTeams.length);
            return (
              <span
                key={team.id}
                className="absolute left-1/2 top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
                style={{
                  transform: `rotate(${angle}deg) translateY(-9.5rem) rotate(-${angle}deg)`,
                }}
              >
                <TeamLogo team={team} size="xs" />
              </span>
            );
          })}
          <span className="absolute inset-1/4 rounded-full border border-line bg-surface/80" />
          <span className="absolute inset-[43%] rounded-full bg-sport" />
        </motion.div>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <Button
            onClick={() => void spin(false)}
            loading={loading || spinning}
            disabled={spinState !== null}
          >
            Spin
          </Button>
          {rerollsRemaining > 0 ? (
            <Button
              variant="secondary"
              onClick={() => void spin(true)}
              disabled={loading || spinning || spinState === null}
            >
              <ArrowClockwise size={17} aria-hidden="true" />
              Reroll ({rerollsRemaining})
            </Button>
          ) : null}
        </div>
      </Card>
      <CardFlipReveal
        revealed={revealed && spinState !== null}
        label="Franchise-season reveal"
        className="min-h-56"
        front={
          <Card className="flex min-h-56 items-center justify-center border-dashed p-5 text-center">
            <p className="text-small text-muted">Spin the wheel to reveal a franchise season.</p>
          </Card>
        }
        back={
          <Card className="min-h-56 p-5">
            {spinState ? (
              <div className="flex items-start gap-4">
                {teamForSpin ? <TeamLogo team={teamForSpin} size="lg" eager /> : null}
                <div>
                  <p className="eyebrow text-sport">Franchise season</p>
                  <h2 className="display-heading mt-2 text-title">{spinState.franchise.name}</h2>
                  <p className="mt-2 font-display text-scoreboard font-semibold">
                    {spinState.unit.season}
                  </p>
                  <p className="mt-2 text-small text-muted">
                    {spinState.record
                      ? `${spinState.record.wins}-${spinState.record.losses}${spinState.record.ties ? `-${spinState.record.ties}` : ''}`
                      : 'Legacy era'}
                  </p>
                  <Badge tone="sport" className="mt-3">
                    {spinState.eraTier.replace('_', ' ')}
                  </Badge>
                </div>
              </div>
            ) : null}
          </Card>
        }
      />
      <span className="sr-only">Draft {draftId}</span>
    </div>
  );
}
