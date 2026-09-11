import type { SportSimulationConfig } from '@perfect-season/simulation';

export const NFL_SIMULATION_CONFIG: SportSimulationConfig = {
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

export const NFL_PLAYOFF_CONFIG: SportSimulationConfig = {
  ...NFL_SIMULATION_CONFIG,
  overtime: { maxPeriods: null, tiesAllowed: false },
};

export const NFL_REGULAR_SEASON_GAMES = 17;
