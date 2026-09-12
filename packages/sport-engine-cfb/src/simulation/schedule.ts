import type { Opponent } from '@perfect-season/sport-engine-core';
import type { DeterministicRng } from '@perfect-season/sport-engine-core/utils';
import { normal, ratingToElo, type SportSimulationConfig } from '@perfect-season/simulation';
import type { CfbProgramSeason, CfbTeam } from '../domain';
import type { CfbDraftPoolUnit } from '../spin';
import { CFB_SIMULATION_CONFIG } from './config';
import { programStrengthRating } from './strength';

// The §2A.4 slate shape: a couple of rivalry-flavored games, a tougher
// non-conference matchup, several winnable conference games.
export type CfbGameFlavor = 'rivalry' | 'nonconference_marquee' | 'nonconference' | 'conference';

export const CFB_SLATE_SHAPE = {
  rivalry: 2,
  nonconference_marquee: 1,
  nonconference: 1,
  conference: 8,
} as const; // sums to 12

interface SlateCandidate {
  readonly row: CfbProgramSeason;
  readonly team: CfbTeam | undefined;
  readonly strength: number;
}

export function buildCfbOpponentSlate(input: {
  readonly unit: CfbDraftPoolUnit;
  readonly programSeasons: readonly CfbProgramSeason[];
  readonly teams: readonly CfbTeam[];
  readonly rng: DeterministicRng;
  readonly config?: SportSimulationConfig;
}): readonly Opponent[] {
  const config = input.config ?? CFB_SIMULATION_CONFIG;
  const { meanRating, sdRating } = config.opponentDistribution;
  const teamsById = new Map(input.teams.map((team) => [team.cfbdTeamId, team]));
  const conferenceKey = input.unit.conferenceId;

  const sampled = () => Math.min(99, Math.max(0, normal(input.rng) * sdRating + meanRating));

  const pool: SlateCandidate[] = input.programSeasons
    .filter(
      (row) =>
        row.membershipStatus === 'fbs' &&
        row.season === input.unit.season &&
        String(row.cfbdTeamId) !== input.unit.programId,
    )
    .map((row) => ({
      row,
      team: teamsById.get(row.cfbdTeamId),
      strength: programStrengthRating(row, config) ?? sampled(),
    }));

  const used = new Set<number>();
  const slate: Opponent[] = [];
  let syntheticCount = 0;

  const toOpponent = (candidate: SlateCandidate, flavor: CfbGameFlavor): Opponent => ({
    id: String(candidate.row.cfbdTeamId),
    name: candidate.team?.school ?? String(candidate.row.cfbdTeamId),
    rating: ratingToElo(candidate.strength, config.ratingScale),
    site: 'neutral',
    facts: {
      flavor,
      conferenceKey: candidate.row.conferenceKey,
      strengthRating: candidate.strength,
    },
  });

  const synthetic = (flavor: CfbGameFlavor): Opponent => {
    syntheticCount += 1;
    const strength = sampled();
    return {
      id: `cfb-synth-${flavor}-${syntheticCount}`,
      name: `Synthetic ${flavor} opponent ${syntheticCount}`,
      rating: ratingToElo(strength, config.ratingScale),
      site: 'neutral',
      facts: { flavor, conferenceKey: null, strengthRating: strength, synthetic: true },
    };
  };

  const available = (predicate: (candidate: SlateCandidate) => boolean): SlateCandidate[] =>
    pool.filter((candidate) => !used.has(candidate.row.cfbdTeamId) && predicate(candidate));

  const draw = (candidates: SlateCandidate[]): SlateCandidate | null => {
    if (candidates.length === 0) return null;
    const index = input.rng.integer(0, candidates.length);
    const candidate = candidates[index];
    if (candidate === undefined) return null;
    used.add(candidate.row.cfbdTeamId);
    return candidate;
  };

  const sameConference = (candidate: SlateCandidate) =>
    conferenceKey !== null && candidate.row.conferenceKey === conferenceKey;
  const differentConference = (candidate: SlateCandidate) =>
    candidate.row.conferenceKey !== conferenceKey;

  // 8 conference games — filled synthetically if the conference slate is thin.
  for (let index = 0; index < CFB_SLATE_SHAPE.conference; index += 1) {
    const candidate = draw(available(sameConference));
    slate.push(candidate === null ? synthetic('conference') : toOpponent(candidate, 'conference'));
  }

  // 2 rivalry games — prefer same-conference programs still on the board.
  for (let index = 0; index < CFB_SLATE_SHAPE.rivalry; index += 1) {
    const candidate = draw(available(sameConference)) ?? draw(available(() => true));
    slate.push(candidate === null ? synthetic('rivalry') : toOpponent(candidate, 'rivalry'));
  }

  // 1 marquee non-conference game — the toughest of a random draw of 8.
  const marqueeSample: SlateCandidate[] = [];
  for (let index = 0; index < 8; index += 1) {
    const candidate = draw(available(differentConference));
    if (candidate === null) break;
    marqueeSample.push(candidate);
  }
  const marquee = marqueeSample.reduce<SlateCandidate | null>(
    (best, candidate) => (best === null || candidate.strength > best.strength ? candidate : best),
    null,
  );
  // The sampled-but-not-selected programs return to the pool — they were only
  // scouted for the marquee slot and remain eligible below.
  for (const candidate of marqueeSample) {
    if (candidate !== marquee) used.delete(candidate.row.cfbdTeamId);
  }
  slate.push(
    marquee === null
      ? synthetic('nonconference_marquee')
      : toOpponent(marquee, 'nonconference_marquee'),
  );

  // 1 winnable non-conference game — bottom half of the remaining field.
  const nonconferencePool = available(differentConference);
  let nonconference: SlateCandidate | null = null;
  if (nonconferencePool.length > 0) {
    const strengths = nonconferencePool
      .map((candidate) => candidate.strength)
      .sort((a, b) => a - b);
    const median = strengths[Math.floor(strengths.length / 2)] ?? 0;
    const bottomHalf = nonconferencePool.filter((candidate) => candidate.strength <= median);
    nonconference = draw(bottomHalf.length > 0 ? bottomHalf : nonconferencePool);
  }
  slate.push(
    nonconference === null
      ? synthetic('nonconference')
      : toOpponent(nonconference, 'nonconference'),
  );

  return slate;
}
