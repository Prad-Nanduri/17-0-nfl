'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { TeamLogo } from '../ui/team-logo';
import type { Team } from '../../lib/teams/types';
import type { DraftSpin } from './types';

const ITEM_HEIGHT = 88;
const VISIBLE_ITEMS = 3;
const LEAD_ITEMS = 27;
const TRAIL_ITEMS = 1;
/** Index the pointer rests on — the resolved pick — with one item visible below it. */
const LAND_INDEX = LEAD_ITEMS;
const SPIN_SECONDS = 2.6;
const EASE_OUT: [number, number, number, number] = [0.1, 0.85, 0.2, 1];

function teamForSpin(teams: readonly Team[], spin: DraftSpin): Team | undefined {
  return teams.find(
    (team) => team.abbreviation === spin.franchise.abbreviation || team.id === spin.franchise.key,
  );
}

/**
 * A short filmstrip that rests on the resolved team at LAND_INDEX. Random
 * near-misses are fine — only the resting logo must match the server-resolved
 * pick. The last few lead items prefer same-conference programs for a stronger
 * near-miss beat, and one trailing item sits below the landed logo.
 */
function buildStrip(teams: readonly Team[], resolved: Team): readonly Team[] {
  const pool = teams.filter((team) => team.id !== resolved.id);
  const conferencePool = pool.filter((team) => team.group === resolved.group);
  const strip: Team[] = [];
  let previous: Team | null = null;
  for (let index = 0; index < LEAD_ITEMS; index += 1) {
    const nearMiss = index >= LEAD_ITEMS - 3 && conferencePool.length > 0;
    const source = nearMiss ? conferencePool : pool;
    const draw = () => {
      const team = source[Math.floor(Math.random() * source.length)];
      if (team === undefined) throw new Error('Reel strip source pool was empty');
      return team;
    };
    let pick = draw();
    for (let guard = 0; guard < 4 && previous !== null && pick.id === previous.id; guard += 1) {
      pick = draw();
    }
    strip.push(pick);
    previous = pick;
  }
  for (let index = 0; index < TRAIL_ITEMS; index += 1) {
    const trail = pool[Math.floor(Math.random() * pool.length)];
    if (trail !== undefined) strip.push(trail);
  }
  strip.splice(LAND_INDEX, 0, resolved);
  return strip;
}

export function SpinReel({
  teams,
  spin,
  onLanded,
}: {
  teams: readonly Team[];
  spin: DraftSpin | null;
  onLanded: () => void;
}) {
  const reduce = useReducedMotion();
  const [landedAbbreviation, setLandedAbbreviation] = useState<string | null>(null);
  const resolved = spin === null ? undefined : teamForSpin(teams, spin);
  const strip = useMemo(
    () => (resolved === undefined || spin === null ? null : buildStrip(teams, resolved)),
    [resolved, spin, teams],
  );
  const duration = reduce ? 0 : SPIN_SECONDS;
  // Safety: a resolved pick with no matching static team must never strand the spin.
  useEffect(() => {
    if (spin !== null && strip === null) onLanded();
  }, [spin, strip, onLanded]);
  // A new spin clears the previous landed marker so it can't be read as current.
  useEffect(() => {
    setLandedAbbreviation(null);
  }, [spin]);
  return (
    <div
      className="relative mx-auto w-full max-w-[23rem] overflow-hidden rounded-2xl border-2 border-sport/40 bg-subtle"
      style={{ height: ITEM_HEIGHT * VISIBLE_ITEMS }}
      role="img"
      aria-label="FBS program slot reel"
      data-testid="cfb-spin-reel"
      data-landed-abbreviation={landedAbbreviation ?? ''}
    >
      {strip === null || spin === null ? (
        <div
          className="absolute inset-x-0 top-0 opacity-40"
          style={{ paddingTop: ((VISIBLE_ITEMS - 1) / 2) * ITEM_HEIGHT }}
          aria-hidden="true"
        >
          {teams.slice(0, VISIBLE_ITEMS).map((team) => (
            <div
              key={team.id}
              className="flex items-center justify-center"
              style={{ height: ITEM_HEIGHT }}
            >
              <TeamLogo team={team} size="lg" />
            </div>
          ))}
        </div>
      ) : (
        <motion.div
          key={spin.spinSeed}
          className="absolute inset-x-0 top-0"
          style={{ paddingTop: ((VISIBLE_ITEMS - 1) / 2) * ITEM_HEIGHT }}
          initial={{ y: 0 }}
          animate={{ y: -LAND_INDEX * ITEM_HEIGHT }}
          transition={{ duration, ease: EASE_OUT }}
          onAnimationComplete={() => {
            setLandedAbbreviation(spin.franchise.abbreviation);
            onLanded();
          }}
        >
          <motion.div
            animate={{ filter: ['blur(7px)', 'blur(7px)', 'blur(0px)'] }}
            transition={{ duration, times: [0, 0.8, 1] }}
          >
            {strip.map((team, index) => {
              const isLanded = index === LAND_INDEX;
              return (
                <div
                  key={`${team.id}-${index}`}
                  data-reel-item
                  {...(isLanded
                    ? {
                        'data-testid': 'cfb-reel-landed-item',
                        'data-abbreviation': team.abbreviation,
                      }
                    : {})}
                  className="flex items-center justify-center"
                  style={{ height: ITEM_HEIGHT }}
                >
                  <TeamLogo team={team} size="lg" eager={index >= LAND_INDEX - 7} />
                </div>
              );
            })}
          </motion.div>
        </motion.div>
      )}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-subtle to-transparent"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-subtle to-transparent"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-4 top-1/2 -translate-y-1/2 border-t-2 border-sport"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-1 top-1/2 -translate-y-1/2 border-y-[7px] border-l-[10px] border-y-transparent border-l-sport"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 border-y-[7px] border-r-[10px] border-y-transparent border-r-sport"
      />
    </div>
  );
}
