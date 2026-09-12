import type {
  PositionGroup,
  RatingConfidenceTier,
  RatingMode,
} from '@perfect-season/sport-engine-core';

export type CfbMembershipStatus = 'fbs' | 'reclassifying' | 'fcs';

export interface CfbConference {
  readonly conferenceKey: string;
  readonly name: string;
  readonly shortName: string | null;
  readonly abbreviation: string | null;
  readonly isActive: boolean;
  readonly foundedYear: number | null;
  readonly dissolvedYear: number | null;
}

export interface CfbTeam {
  readonly cfbdTeamId: number;
  readonly school: string;
  readonly currentName: string;
  readonly abbreviation: string;
  readonly mascot: string | null;
  readonly logoUrl: string | null;
  readonly isBlueBlood: boolean;
}

export type CfbPlayoffResult =
  'missed' | 'r1' | 'quarterfinal' | 'semifinal' | 'runner_up' | 'champion';

export interface CfbProgramSeason {
  readonly cfbdTeamId: number;
  readonly season: number;
  readonly conferenceKey: string | null;
  readonly membershipStatus: CfbMembershipStatus;
  readonly wins: number | null;
  readonly losses: number | null;
  readonly apPreseasonRank: number | null;
  readonly apFinalRank: number | null;
  readonly peakRankThisSeason: number | null;
  readonly cfpResult: CfbPlayoffResult | null;
  readonly bowlResult: 'won' | 'lost' | null;
  readonly recruitingRank: number | null;
  readonly recruitingPoints: number | null;
  readonly eraTier: RatingConfidenceTier;
}

export type CfbGameType =
  'regular' | 'conference_championship' | 'bowl' | 'cfp' | 'national_championship';

export interface CfbGame {
  readonly cfbdGameId: number;
  readonly season: number;
  readonly week: number;
  readonly seasonType: 'regular' | 'postseason';
  readonly homeCfbdTeamId: number | null;
  readonly awayCfbdTeamId: number | null;
  readonly homeScore: number | null;
  readonly awayScore: number | null;
  readonly neutralSite: boolean;
  readonly gameType: CfbGameType;
  readonly notes: string | null;
}

export interface CfbPlayer {
  readonly cfbdPlayerId: string;
  readonly fullName: string;
  readonly primaryPosition: string;
  readonly positionGroup: PositionGroup;
  readonly homeState: string | null;
  readonly homeTown: string | null;
  readonly recruitingClassYear: number | null;
  readonly recruitStars: number | null;
  readonly recruitRating: number | null;
}

export interface CfbPlayerSeasonStats {
  readonly cfbdPlayerId: string;
  readonly cfbdTeamId: number;
  readonly season: number;
  readonly position: string;
  readonly positionGroup: PositionGroup;
  readonly eraTier: RatingConfidenceTier;
  readonly games: number | null;
  readonly gamesStarted: number | null;
  readonly allConference: boolean;
  readonly allAmerican: boolean;
  readonly isTransferThisSeason: boolean;
  readonly stats: Readonly<Record<string, number | null>>;
  readonly isTeamLevelProxy: boolean;
}

export interface CfbTeamLineStats {
  readonly cfbdTeamId: number;
  readonly season: number;
  readonly offenseSacksAllowed: number | null;
  readonly offensePassAttempts: number | null;
  readonly offenseStuffRateAllowed: number | null;
  readonly defenseSacks: number | null;
  readonly defenseOpponentPassAttempts: number | null;
  readonly defenseStuffRate: number | null;
}

// UI badge hook for the §2A.6 team-level OL/DL proxy disclosure.
export type CfbRatingBadge = 'team_level_rating';
export const TEAM_LEVEL_RATING_BADGE: CfbRatingBadge = 'team_level_rating';

export interface CfbRating {
  readonly cfbdPlayerId: string;
  readonly cfbdTeamId: number;
  readonly season: number;
  readonly ratingMode: RatingMode;
  readonly overallRating: number;
  readonly compositeScore: number | null;
  readonly percentile: number | null;
  readonly confidenceTier: RatingConfidenceTier;
  readonly isTeamLevelProxy: boolean;
  readonly badges: readonly CfbRatingBadge[];
  readonly modelVersion: string;
}

// week: 1..n regular-season polls, 99 = final (postseason release per §4.3).
export interface CfbPollRankingWeekly {
  readonly season: number;
  readonly week: number;
  readonly cfbdTeamId: number;
  readonly rank: number | null;
  readonly points: number | null;
  readonly firstPlaceVotes: number;
  readonly isFinal: boolean;
}

export interface CfbRecruit {
  readonly cfbdRecruitId: string;
  readonly athleteId: string | null;
  readonly year: number;
  readonly name: string;
  readonly committedTo: string | null;
  readonly position: string | null;
  readonly stars: number | null;
  readonly rating: number | null;
  readonly ranking: number | null;
  readonly stateProvince: string | null;
}

export interface CfbEtlManifest {
  readonly season: number;
  readonly generatedAt: string;
  readonly cfbdApiVersion: string | null;
  readonly sources: readonly string[];
  readonly rowCounts: Record<string, number>;
}
