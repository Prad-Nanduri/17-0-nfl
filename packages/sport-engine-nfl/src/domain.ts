import type { PositionGroup, RatingConfidenceTier } from '@perfect-season/sport-engine-core';

export interface NflFranchise {
  readonly franchiseKey: string;
  readonly name: string;
  readonly currentName: string;
  readonly abbreviation: string;
  readonly nflverseTeamId: number;
  readonly logoUrl: string | null;
}

export interface NflFranchiseSeason {
  readonly franchiseKey: string;
  readonly season: number;
  readonly wins: number;
  readonly losses: number;
  readonly ties: number;
  readonly eraTier: RatingConfidenceTier;
}

export interface NflPlayer {
  readonly gsisId: string;
  readonly pfrId: string | null;
  readonly espnId: string | null;
  readonly fullName: string;
  readonly primaryPosition: string;
  readonly positionGroup: PositionGroup;
  readonly birthDate: string | null;
  readonly college: string | null;
  readonly draftYear: number | null;
  readonly draftRound: number | null;
  readonly draftNumber: number | null;
  readonly rookieYear: number | null;
  readonly headshotUrl: string | null;
}

export interface NflPlayerSeasonStats {
  readonly gsisId: string;
  readonly franchiseKey: string;
  readonly season: number;
  readonly position: string;
  readonly positionGroup: PositionGroup;
  readonly eraTier: RatingConfidenceTier;
  readonly games: number;
  readonly stats: Readonly<Record<string, number | null>>;
  readonly isTeamLevelProxy: boolean;
}

export interface NflLegacyPlayerCareer {
  readonly pfrId: string;
  readonly gsisId: string | null;
  readonly fullName: string;
  readonly positionGroup: PositionGroup;
  readonly draftYear: number;
  readonly draftRound: number;
  readonly draftPick: number;
  readonly franchiseKey: string;
  readonly hof: boolean;
  readonly careerFromSeason: number;
  readonly careerThroughSeason: number | null;
  readonly eraTier: RatingConfidenceTier;
  readonly stats: Readonly<Record<string, number | null>>;
}

export interface NflEtlManifest {
  readonly season: number;
  readonly generatedAt: string;
  readonly nflDataPyVersion: string;
  readonly sources: readonly string[];
  readonly pbpIncluded: boolean;
  readonly rowCounts: Readonly<Record<string, number>>;
}

export interface NflRating {
  readonly gsisId: string | null;
  readonly franchiseKey: string | null;
  readonly season: number;
  readonly positionGroup: PositionGroup;
  readonly ratingMode: 'career_season';
  readonly overall: number;
  readonly percentile: number | null;
  readonly compositeScore: number | null;
  readonly qualified: boolean;
  readonly confidenceTier: RatingConfidenceTier;
  readonly isTeamLevelProxy: boolean;
  readonly modelVersion: string;
}
