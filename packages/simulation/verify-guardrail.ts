import { createRng, createSeed } from '@perfect-season/sport-engine-core/utils';
import { generateSchedule, simulateGame, type SportSimulationConfig } from './src/index';

// This is a sport-agnostic demo config; the values happen to match NFL simulation tuning.
const config: SportSimulationConfig = {
  possessionsPerTeam: 11,
  scoringTable: [
    { outcome: 'touchdown', points: 7, probability: 0.22 },
    { outcome: 'field_goal', points: 3, probability: 0.14 },
    { outcome: 'safety', points: 2, probability: 0.005 },
    { outcome: 'none', points: 0, probability: 0.635 },
  ],
  strengthTilt: 0.35,
  ratingScale: { baseElo: 1500, eloPerRatingPoint: 16 },
  homeAdvantageRating: 3,
  varianceSigmaRating: 6,
  overtime: { maxPeriods: 1, tiesAllowed: true },
  opponentDistribution: { meanRating: 72, sdRating: 9 },
  difficultyOffsets: { easy: -5, normal: 0, hard: 5 },
};

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

function simulateGroup(rosterRating: number): number[] {
  return Array.from({ length: 1000 }, (_, index) => {
    const seed = createSeed('guardrail-demo', rosterRating, index);
    const rng = createRng(seed);
    const schedule = generateSchedule({
      games: 17,
      difficulty: 'normal',
      opponents: [],
      config,
      rng,
    });
    let wins = 0;
    for (const game of schedule) {
      if (simulateGame(rosterRating, game.opponent, config, rng).won) wins += 1;
    }
    return wins / 17;
  });
}

const high = simulateGroup(90);
const low = simulateGroup(55);
console.log('guardrail verification (sport-agnostic config)');
console.log(`rating 90: ${summarize(high)}`);
console.log(`rating 55: ${summarize(low)}`);
const highMean = high.reduce((total, value) => total + value, 0) / high.length;
const lowMean = low.reduce((total, value) => total + value, 0) / low.length;
console.log(`gap of means=${(highMean - lowMean).toFixed(4)}`);
