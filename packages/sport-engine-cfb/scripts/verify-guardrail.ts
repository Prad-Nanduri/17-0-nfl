import type { Opponent } from '@perfect-season/sport-engine-core';
import { createRng, createSeed } from '@perfect-season/sport-engine-core/utils';
import { generateSchedule, ratingToElo, simulateGame } from '@perfect-season/simulation';
import { CFB_SIMULATION_CONFIG } from '../src/simulation/config';
import { buildCfbOpponentSlate } from '../src/simulation/schedule';
import { loadFixtureRawSeason } from '../etl/fixtures';
import { transformSeason } from '../etl/transform';
import type { CfbProgramSeason } from '../src/domain';

const config = CFB_SIMULATION_CONFIG;
const GAMES = 12;
const SEASONS = 1000;

function percentile(values: readonly number[], fraction: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor(fraction * sorted.length))] ?? 0;
}

function summarize(values: readonly number[]): string {
  const mean = values.reduce((total, value) => total + value, 0) / values.length;
  const variance = values.reduce((total, value) => total + (value - mean) ** 2, 0) / values.length;
  const share = values.filter((value) => value >= 0.5).length / values.length;
  return [
    `mean=${mean.toFixed(4)}`,
    `sd=${Math.sqrt(variance).toFixed(4)}`,
    `p5=${percentile(values, 0.05).toFixed(4)}`,
    `p50=${percentile(values, 0.5).toFixed(4)}`,
    `p95=${percentile(values, 0.95).toFixed(4)}`,
    `min=${Math.min(...values).toFixed(4)}`,
    `max=${Math.max(...values).toFixed(4)}`,
    `share>=.500=${share.toFixed(4)}`,
  ].join(' ');
}

// Demo pool for the flavored-slate variant: the 2023 fixture transform where
// available, padded with synthetic program rows so a full slate can form.
function demoPool(): {
  programSeasons: CfbProgramSeason[];
  unit: Parameters<typeof buildCfbOpponentSlate>[0]['unit'];
} {
  const output = transformSeason(loadFixtureRawSeason(2023), 2023);
  const conferences = ['acc', 'sec', 'big-ten', 'big-12', 'pac-12'];
  const padded: CfbProgramSeason[] = [...output.programSeasons];
  for (let index = 0; index < 60; index += 1) {
    padded.push({
      cfbdTeamId: 1000 + index,
      season: 2023,
      conferenceKey: conferences[index % conferences.length] ?? 'acc',
      membershipStatus: 'fbs',
      wins: index % 13,
      losses: 12 - (index % 13),
      apPreseasonRank: null,
      apFinalRank: index % 7 === 0 ? (index % 25) + 1 : null,
      peakRankThisSeason: null,
      cfpResult: null,
      bowlResult: null,
      recruitingRank: null,
      recruitingPoints: null,
      eraTier: 'full_feature',
    });
  }
  const drafted = padded.find((row) => row.membershipStatus === 'fbs');
  const unit = {
    sportId: 'cfb' as const,
    programId: String(drafted?.cfbdTeamId ?? 1000),
    season: 2023,
    conferenceId: drafted?.conferenceKey ?? null,
  };
  return { programSeasons: padded, unit };
}

function simulateGroup(
  rosterRating: number,
  opponents: readonly Opponent[],
  tag: string,
): number[] {
  return Array.from({ length: SEASONS }, (_, index) => {
    const seed = createSeed('cfb-guardrail', tag, rosterRating, index);
    const rng = createRng(seed);
    const schedule = generateSchedule({
      games: GAMES,
      difficulty: 'normal',
      opponents,
      config,
      rng,
    });
    let wins = 0;
    for (const game of schedule) {
      if (simulateGame(rosterRating, game.opponent, config, rng).won) wins += 1;
    }
    return wins / GAMES;
  });
}

function winShareAtRating(rosterRating: number, opponentRating: number): number {
  const opponent: Opponent = {
    id: 'fixed',
    name: 'fixed',
    rating: ratingToElo(opponentRating, config.ratingScale),
    site: 'neutral',
    facts: {},
  };
  const results = simulateGroup(rosterRating, [opponent], `swing-${opponentRating}`);
  return results.reduce((total, value) => total + value, 0) / results.length;
}

const { meanRating, sdRating } = config.opponentDistribution;
const { programSeasons, unit } = demoPool();
const teams = programSeasons.map((row) => ({
  cfbdTeamId: row.cfbdTeamId,
  school: `School ${row.cfbdTeamId}`,
  currentName: `School ${row.cfbdTeamId}`,
  abbreviation: `S${row.cfbdTeamId}`,
  mascot: null,
  logoUrl: null,
  isBlueBlood: false,
}));
const slate = buildCfbOpponentSlate({
  unit,
  programSeasons,
  teams,
  rng: createRng('cfb-guardrail-slate'),
});

console.log('CFB guardrail verification (CFB_SIMULATION_CONFIG, 12-game seasons)');
for (const rating of [90, 55]) {
  const synthetic = simulateGroup(rating, [], 'synthetic');
  const flavored = simulateGroup(rating, slate, 'slate');
  console.log(`rating ${rating} synthetic-opponents: ${summarize(synthetic)}`);
  console.log(`rating ${rating} flavored-slate:      ${summarize(flavored)}`);
  const syntheticMean = synthetic.reduce((total, value) => total + value, 0) / synthetic.length;
  const flavoredMean = flavored.reduce((total, value) => total + value, 0) / flavored.length;
  console.log(
    `rating ${rating} gap of means (synthetic - slate) = ${(syntheticMean - flavoredMean).toFixed(4)}`,
  );
}
console.log(
  `opponent swing at fixed roster 72: mean-2sd=${winShareAtRating(72, meanRating - 2 * sdRating).toFixed(4)} ` +
    `mean+2sd=${winShareAtRating(72, meanRating + 2 * sdRating).toFixed(4)}`,
);
