'use client';

import { motion, useReducedMotion, type Transition } from 'framer-motion';
import { useState, type CSSProperties } from 'react';
import { ArrowClockwise, Sparkle } from '@phosphor-icons/react';
import { CardFlipReveal } from '../motion/card-flip-reveal';
import { SpinReel } from './spin-reel';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card } from '../ui/card';
import { TeamLogo } from '../ui/team-logo';
import type { SportId } from '@perfect-season/sport-engine-core';
import type { Team } from '../../lib/teams/types';
import { motionTokens } from '../../lib/motion';
import { resolveProgramTheme, themeTextColor } from '../../lib/cfb-theme';
import type { DraftSpin } from './types';

export function SpinWheel({
  draftId,
  spin: spinState,
  rerollsRemaining,
  loading,
  onSpin,
  onError,
  teams,
  sport,
}: {
  teams: readonly Team[];
  sport: SportId;
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
      const index = teams.findIndex(
        (team) =>
          team.abbreviation === result.franchise.abbreviation || team.id === result.franchise.key,
      );
      if (sport === 'cfb') return; // the reel reveals + clears `spinning` on landing
      const segment = index >= 0 ? index * (360 / teams.length) : Math.random() * 360;
      // The pointer sits at 12 o'clock; a logo placed at `segment` reaches it at -segment.
      const landing = (360 - segment) % 360;
      setRotation((previous) => previous - (previous % 360) + (reduce ? 0 : 720) + landing);
      setRevealed(true);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not spin');
      setSpinning(false);
    } finally {
      if (sport === 'nfl') setSpinning(false);
    }
  }

  const teamForSpin = spinState
    ? teams.find(
        (team) =>
          team.abbreviation === spinState.franchise.abbreviation ||
          team.id === spinState.franchise.key,
      )
    : undefined;
  // The reveal takes the *currently revealed* program's colors; the majority
  // program theme on the draft only exists once picks land.
  const revealTheme =
    sport === 'cfb' && spinState !== null
      ? resolveProgramTheme({
          color: spinState.franchise.color ?? null,
          alternateColor: spinState.franchise.alternateColor ?? null,
          abbreviation: spinState.franchise.abbreviation,
        })
      : null;
  const wheelTransition: Transition = reduce
    ? { duration: 0 }
    : { duration: 1.8, ease: [...motionTokens.ease] };
  return (
    <div className="grid min-w-0 grid-cols-1 gap-5">
      <Card className="relative overflow-hidden p-5">
        {sport === 'nfl' ? (
          <div className="pointer-events-none absolute left-1/2 top-2 z-10 -translate-x-1/2 text-sport">
            <Sparkle size={25} weight="fill" aria-label="Spin pointer" />
          </div>
        ) : null}
        {sport === 'cfb' ? (
          <SpinReel
            teams={teams}
            spin={spinState}
            onLanded={() => {
              setRevealed(true);
              setSpinning(false);
            }}
          />
        ) : (
          <motion.div
            className="relative mx-auto aspect-square w-full max-w-[23rem] rounded-full border-2 border-sport/40 bg-subtle"
            animate={{ rotate: rotation }}
            transition={wheelTransition}
            aria-label={sport === 'nfl' ? 'NFL franchise spin wheel' : 'FBS program spin wheel'}
            role="img"
          >
            {teams.map((team, index) => {
              const angle = (index * (360 / teams.length) * Math.PI) / 180;
              const radius = 42;
              return (
                <motion.span
                  key={team.id}
                  className="pointer-events-none absolute -ml-4 -mt-4 flex h-8 w-8 items-center justify-center"
                  style={{
                    left: `${50 + radius * Math.sin(angle)}%`,
                    top: `${50 - radius * Math.cos(angle)}%`,
                  }}
                  animate={{ rotate: -rotation }}
                  transition={wheelTransition}
                >
                  <TeamLogo team={team} size="xs" />
                </motion.span>
              );
            })}
            <span className="absolute inset-1/4 rounded-full border border-line bg-surface/80" />
            <span className="absolute inset-[43%] rounded-full bg-sport" />
          </motion.div>
        )}
        <div className="relative z-10 mt-5 flex flex-wrap items-center justify-center gap-3">
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
        label={sport === 'nfl' ? 'Franchise-season reveal' : 'Program-season reveal'}
        className="min-h-56"
        front={
          <Card className="flex min-h-56 items-center justify-center border-dashed p-5 text-center">
            <p className="text-small text-muted">
              {sport === 'nfl'
                ? 'Spin the wheel to reveal a franchise season.'
                : 'Spin the reel to reveal a program season.'}
            </p>
          </Card>
        }
        back={
          <Card
            className="relative min-h-56 overflow-hidden p-5"
            style={
              revealTheme
                ? ({
                    borderLeft: `4px solid ${revealTheme.primary}`,
                    '--program-primary': revealTheme.primary,
                    '--program-secondary': revealTheme.secondary,
                  } as CSSProperties)
                : undefined
            }
          >
            {revealTheme ? (
              <span
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-0.5"
                style={{ backgroundColor: revealTheme.secondary }}
              />
            ) : null}
            {spinState ? (
              <div className="flex items-start gap-4">
                {teamForSpin ? <TeamLogo team={teamForSpin} size="lg" eager /> : null}
                <div>
                  <p className="eyebrow text-sport">
                    {sport === 'nfl' ? 'Franchise season' : 'Program season'}
                  </p>
                  <h2 className="display-heading mt-2 text-title">{spinState.franchise.name}</h2>
                  <p className="mt-2 font-display text-scoreboard font-semibold">
                    {spinState.unit.season}
                  </p>
                  {spinState.franchise.conference !== '' ? (
                    <p className="mt-1 text-small text-muted">{spinState.franchise.conference}</p>
                  ) : null}
                  <p className="mt-2 text-small text-muted">
                    {spinState.record
                      ? `${spinState.record.wins}-${spinState.record.losses}${spinState.record.ties ? `-${spinState.record.ties}` : ''}`
                      : 'Legacy era'}
                  </p>
                  <Badge
                    tone="sport"
                    className="mt-3"
                    style={
                      revealTheme
                        ? {
                            backgroundColor: revealTheme.primary,
                            color: themeTextColor(revealTheme.primary),
                            border: `1px solid ${revealTheme.secondary}`,
                          }
                        : undefined
                    }
                  >
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
