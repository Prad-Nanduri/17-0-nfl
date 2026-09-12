import type { SportSimulationConfig } from '@perfect-season/simulation';

export const CFB_SIMULATION_CONFIG: SportSimulationConfig = {
  possessionsPerTeam: 12,
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
  // CFB has no ties; overtime repeats until a winner.
  overtime: { maxPeriods: null, tiesAllowed: false },
  opponentDistribution: { meanRating: 68, sdRating: 10 },
  difficultyOffsets: { easy: -5, normal: 0, hard: 5 },
};

// Provisional (spec §2A.4, §2B): the conference-title/CFP/bowl branch qualifies
// and seeds by win total against synthetic opponents, not real AP/CFP rankings.
// Unreachable until the CFB ranking-lifecycle system exists; Quick Season is
// the only wired-up path.
export const ENABLE_FULL_CAMPAIGN = false as const;

export const CFB_REGULAR_SEASON_GAMES = 12;
export const CFB_CONFERENCE_TITLE_WIN_THRESHOLD = 10;
