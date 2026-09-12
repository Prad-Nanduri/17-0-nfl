// Raw CFBD REST payload shapes (api.collegefootballdata.com v2).
// Stat values arrive as strings; transform parses them to numbers.

export interface CfbdTeam {
  readonly id: number;
  readonly school: string;
  readonly mascot: string | null;
  readonly abbreviation: string | null;
  readonly conference: string | null;
  readonly division: string | null;
  readonly classification: string | null;
  readonly logos?: readonly string[] | null;
  readonly color?: string | null;
  readonly alternateColor?: string | null;
}

export interface CfbdConference {
  readonly id: number;
  readonly name: string;
  readonly shortName: string | null;
  readonly abbreviation: string | null;
  readonly classification?: string | null;
}

export interface CfbdRosterPlayer {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly team: string;
  readonly position: string | null;
  readonly homeState: string | null;
  readonly homeCity: string | null;
  readonly recruitIds?: readonly string[] | null;
}

export interface CfbdPlayerStat {
  readonly season: number;
  readonly playerId: string;
  readonly player: string;
  readonly position: string | null;
  readonly team: string;
  readonly conference: string | null;
  readonly category: string;
  readonly statType: string;
  readonly stat: string;
}

export interface CfbdTeamStat {
  readonly season: number;
  readonly team: string;
  readonly conference: string | null;
  readonly statName: string;
  readonly statValue: string | number;
}

export interface CfbdAdvancedSide {
  readonly stuffRate?: number | null;
  readonly lineYards?: number | null;
  readonly havoc?: { readonly total?: number | null } | null;
}

export interface CfbdAdvancedSeasonStat {
  readonly season: number;
  readonly team: string;
  readonly conference: string | null;
  readonly offense?: CfbdAdvancedSide | null;
  readonly defense?: CfbdAdvancedSide | null;
}

export interface CfbdPollRank {
  readonly rank: number | null;
  readonly teamId?: number | null;
  readonly school: string;
  readonly conference?: string | null;
  readonly firstPlaceVotes?: number | null;
  readonly points?: number | null;
}

export interface CfbdPoll {
  readonly poll: string;
  readonly isFinal?: boolean | null;
  readonly ranks: readonly CfbdPollRank[];
}

export interface CfbdPollWeek {
  readonly season: number;
  readonly seasonType: string;
  readonly week: number;
  readonly polls: readonly CfbdPoll[];
}

export interface CfbdGamePlayoff {
  readonly competition?: string | null;
  readonly round?: string | null;
  readonly roundName?: string | null;
  readonly bowlName?: string | null;
}

export interface CfbdGame {
  readonly id: number;
  readonly season: number;
  readonly week: number;
  readonly seasonType: string;
  readonly completed: boolean;
  readonly neutralSite: boolean;
  readonly conferenceGame: boolean;
  readonly homeId?: number | null;
  readonly homeTeam: string;
  readonly homePoints: number | null;
  readonly awayId?: number | null;
  readonly awayTeam: string;
  readonly awayPoints: number | null;
  readonly notes: string | null;
  readonly playoff?: CfbdGamePlayoff | null;
}

export interface CfbdRecruit {
  readonly id: string;
  readonly athleteId: string | null;
  readonly year: number;
  readonly name: string;
  readonly school: string | null;
  readonly committedTo: string | null;
  readonly position: string | null;
  readonly stars: number | null;
  readonly rating: number | null;
  readonly ranking: number | null;
  readonly stateProvince: string | null;
}

export interface CfbdTeamRecruitingRanking {
  readonly year: number;
  readonly rank: number;
  readonly team: string;
  readonly points: number;
}

export interface CfbdTeamRushingSeason {
  readonly season: number;
  readonly team: string;
  readonly sacks?: number | null;
}

export interface CfbdRawSeason {
  readonly season: number;
  readonly teams: readonly CfbdTeam[];
  readonly fbsTeamsBySeason: ReadonlyMap<number, readonly CfbdTeam[]>;
  readonly conferences: readonly CfbdConference[];
  readonly roster: readonly CfbdRosterPlayer[];
  readonly playerSeasonStats: readonly CfbdPlayerStat[];
  readonly teamSeasonStats: readonly CfbdTeamStat[];
  readonly advancedSeasonStats: readonly CfbdAdvancedSeasonStat[];
  readonly rankingsRegular: readonly CfbdPollWeek[];
  readonly rankingsPostseason: readonly CfbdPollWeek[];
  readonly recruits: readonly CfbdRecruit[];
  readonly teamRecruiting: readonly CfbdTeamRecruitingRanking[];
  readonly teamRushing: readonly CfbdTeamRushingSeason[];
  readonly gamesRegular: readonly CfbdGame[];
  readonly gamesPostseason: readonly CfbdGame[];
}
