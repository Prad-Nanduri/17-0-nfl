import type { PositionGroup } from '@perfect-season/sport-engine-core';
import {
  buildConferenceDimension,
  conferenceKey,
  cfbConfidenceTier,
  resolveMembershipStatus,
} from '../src/index';
import type {
  CfbConference,
  CfbGame,
  CfbGameType,
  CfbPlayoffResult,
  CfbPlayer,
  CfbPlayerSeasonStats,
  CfbPollRankingWeekly,
  CfbProgramSeason,
  CfbRecruit,
  CfbTeam,
  CfbTeamLineStats,
} from '../src/domain';
import type { CfbdGame, CfbdPollRank, CfbdPollWeek, CfbdRawSeason } from './cfbd-types';

const CFP_FIRST_SEASON = 2014;
const FINAL_POLL_WEEK = 99;

const POSITION_TO_GROUP = new Map<string, PositionGroup>(
  Object.entries({
    QB: 'QB',
    RB: 'RB',
    FB: 'RB',
    WR: 'WR',
    TE: 'TE',
    OL: 'OL',
    OT: 'OL',
    OG: 'OL',
    C: 'OL',
    DL: 'DL',
    DE: 'DL',
    DT: 'DL',
    NT: 'DL',
    LB: 'LB',
    ILB: 'LB',
    OLB: 'LB',
    EDGE: 'LB',
    CB: 'CB',
    S: 'S',
    FS: 'S',
    SS: 'S',
    DB: 'S',
    K: 'K',
    PK: 'K',
    P: 'P',
  }),
);

export function cfbPositionGroup(position: string | null | undefined): PositionGroup | null {
  if (position === null || position === undefined) return null;
  return POSITION_TO_GROUP.get(position.trim().toUpperCase()) ?? null;
}

export interface CfbSeasonOutput {
  readonly conferences: CfbConference[];
  readonly teams: CfbTeam[];
  readonly programSeasons: CfbProgramSeason[];
  readonly games: CfbGame[];
  readonly players: CfbPlayer[];
  readonly playerSeasonStats: CfbPlayerSeasonStats[];
  readonly teamLineStats: CfbTeamLineStats[];
  readonly apRankings: CfbPollRankingWeekly[];
  readonly cfpRankings: CfbPollRankingWeekly[];
  readonly recruits: CfbRecruit[];
  readonly rowCounts: Record<string, number>;
}

function parseStatValue(raw: string | number): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function classifyGameType(game: CfbdGame): CfbGameType {
  if (game.playoff != null) {
    return game.playoff.round === 'championship' ? 'national_championship' : 'cfp';
  }
  if (game.seasonType === 'postseason') return 'bowl';
  if (
    game.seasonType === 'regular' &&
    game.conferenceGame &&
    /championship/i.test(game.notes ?? '')
  ) {
    return 'conference_championship';
  }
  return 'regular';
}

const PLAYOFF_ROUND_ORDER: Record<string, number> = {
  first_round: 1,
  quarterfinal: 2,
  semifinal: 3,
  championship: 4,
};

function pollRows(
  weeks: readonly { week: CfbdPollWeek; isFinal: boolean }[],
  pollName: string,
  teamIds: ReadonlyMap<string, number>,
): CfbPollRankingWeekly[] {
  const rows: CfbPollRankingWeekly[] = [];
  for (const { week, isFinal } of weeks) {
    for (const poll of week.polls) {
      if (poll.poll !== pollName) continue;
      for (const rank of poll.ranks) {
        const cfbdTeamId = rank.teamId ?? teamIds.get(rank.school);
        if (cfbdTeamId === undefined) continue;
        rows.push({
          season: week.season,
          week: isFinal ? FINAL_POLL_WEEK : week.week,
          cfbdTeamId,
          rank: rank.rank,
          points: rank.points ?? null,
          firstPlaceVotes: rank.firstPlaceVotes ?? 0,
          isFinal: isFinal || poll.isFinal === true,
        });
      }
    }
  }
  return rows;
}

function rankValue(rank: CfbdPollRank): number | null {
  return rank.rank;
}

export function transformSeason(raw: CfbdRawSeason, season: number): CfbSeasonOutput {
  const fbsBySeason = new Map<number, ReadonlySet<string>>(
    [...raw.fbsTeamsBySeason.entries()].map(([year, teams]) => [
      year,
      new Set(
        teams.map((team) => team.school).filter((name): name is string => typeof name === 'string'),
      ),
    ]),
  );

  const schoolToId = new Map<string, number>();
  for (const team of raw.teams) {
    if (typeof team.school === 'string') schoolToId.set(team.school, team.id);
  }

  const teams: CfbTeam[] = [];
  const programSeasons: CfbProgramSeason[] = [];
  const seenConferenceNames = new Set<string>();

  const games = [...raw.gamesRegular, ...raw.gamesPostseason];
  const gameRows: CfbGame[] = games.map((game) => ({
    cfbdGameId: game.id,
    season: game.season,
    week: game.week,
    seasonType: game.seasonType === 'postseason' ? 'postseason' : 'regular',
    homeCfbdTeamId: game.homeId ?? schoolToId.get(game.homeTeam) ?? null,
    awayCfbdTeamId: game.awayId ?? schoolToId.get(game.awayTeam) ?? null,
    homeScore: game.homePoints,
    awayScore: game.awayPoints,
    neutralSite: game.neutralSite,
    gameType: classifyGameType(game),
    notes: game.notes ?? game.playoff?.bowlName ?? null,
  }));

  const recordBySchool = new Map<string, { wins: number; losses: number }>();
  const cfpDeepestRound = new Map<
    string,
    { round: number; wonTitle: boolean; lostTitle: boolean }
  >();
  const bowlResultBySchool = new Map<string, 'won' | 'lost'>();
  for (const game of games) {
    if (!game.completed || game.homePoints === null || game.awayPoints === null) continue;
    const homeWon = game.homePoints > game.awayPoints;
    const awayWon = game.awayPoints > game.homePoints;
    for (const [school, won] of [
      [game.homeTeam, homeWon],
      [game.awayTeam, awayWon],
    ] as const) {
      const record = recordBySchool.get(school) ?? { wins: 0, losses: 0 };
      if (won) record.wins += 1;
      else if (game.homePoints !== game.awayPoints) record.losses += 1;
      recordBySchool.set(school, record);
    }
    const type = classifyGameType(game);
    if (type === 'bowl') {
      if (homeWon || awayWon) {
        bowlResultBySchool.set(game.homeTeam, homeWon ? 'won' : 'lost');
        bowlResultBySchool.set(game.awayTeam, awayWon ? 'won' : 'lost');
      }
    }
    if (game.playoff != null) {
      const round = PLAYOFF_ROUND_ORDER[game.playoff.round ?? ''] ?? 0;
      for (const [school, won] of [
        [game.homeTeam, homeWon],
        [game.awayTeam, awayWon],
      ] as const) {
        const current = cfpDeepestRound.get(school) ?? {
          round: 0,
          wonTitle: false,
          lostTitle: false,
        };
        cfpDeepestRound.set(school, {
          round: Math.max(current.round, round),
          wonTitle: current.wonTitle || (game.playoff.round === 'championship' && won),
          lostTitle: current.lostTitle || (game.playoff.round === 'championship' && !won),
        });
      }
    }
  }

  const recruitingByTeam = new Map(
    raw.teamRecruiting.map((row) => [row.team, { rank: row.rank, points: row.points }]),
  );

  const regularPollWeeks = raw.rankingsRegular.map((week) => ({ week, isFinal: false }));
  const postseasonPollWeeks = raw.rankingsPostseason.map((week) => ({ week, isFinal: true }));
  const allPollWeeks = [...regularPollWeeks, ...postseasonPollWeeks];

  // §4.3: AP + CFP polls; postseason releases become week 99 / isFinal.
  const apRankings = pollRows(allPollWeeks, 'AP Top 25', schoolToId);
  const cfpRankings = pollRows(allPollWeeks, 'Playoff Committee Rankings', schoolToId);
  for (const rows of [apRankings, cfpRankings]) {
    if (rows.some((row) => row.week === FINAL_POLL_WEEK)) continue;
    const maxWeek = Math.max(0, ...rows.map((row) => row.week));
    const last = rows.filter((row) => row.week === maxWeek);
    for (const row of last) {
      rows[rows.indexOf(row)] = { ...row, isFinal: true };
    }
  }

  const apBySchoolAllWeeks = new Map<string, number[]>();
  const apPreseasonBySchool = new Map<string, number>();
  const apFinalBySchool = new Map<string, number>();
  for (const { week, isFinal } of allPollWeeks) {
    for (const poll of week.polls) {
      if (poll.poll !== 'AP Top 25') continue;
      for (const rank of poll.ranks) {
        const value = rankValue(rank);
        if (value === null) continue;
        const list = apBySchoolAllWeeks.get(rank.school) ?? [];
        list.push(value);
        apBySchoolAllWeeks.set(rank.school, list);
        if (!isFinal && week.week === 1 && !apPreseasonBySchool.has(rank.school)) {
          apPreseasonBySchool.set(rank.school, value);
        }
        if (isFinal || poll.isFinal === true) {
          apFinalBySchool.set(rank.school, value);
        }
      }
    }
  }
  if (apFinalBySchool.size === 0) {
    // No postseason AP release: the last regular poll week is final.
    let maxWeek = 0;
    for (const { week } of regularPollWeeks) maxWeek = Math.max(maxWeek, week.week);
    for (const { week } of regularPollWeeks) {
      if (week.week !== maxWeek) continue;
      for (const poll of week.polls) {
        if (poll.poll !== 'AP Top 25') continue;
        for (const rank of poll.ranks) {
          if (rank.rank !== null) apFinalBySchool.set(rank.school, rank.rank);
        }
      }
    }
  }

  for (const team of raw.teams) {
    if (typeof team.school !== 'string') continue;
    const inFbsNow = fbsBySeason.get(season)?.has(team.school) === true;
    const inFbsFuture = [1, 2].some((offset) => fbsBySeason.get(season + offset)?.has(team.school));
    if (team.classification !== 'fbs' && !inFbsNow && !inFbsFuture) continue;
    teams.push({
      cfbdTeamId: team.id,
      school: team.school,
      currentName: team.school,
      abbreviation: team.abbreviation ?? team.school,
      mascot: team.mascot,
      logoUrl: team.logos?.[0] ?? null,
      isBlueBlood: false,
    });
    const membershipStatus = resolveMembershipStatus(team.school, season, fbsBySeason);
    if (team.conference !== null) seenConferenceNames.add(team.conference);
    const record = recordBySchool.get(team.school);
    const cfp = cfpDeepestRound.get(team.school);
    let cfpResult: CfbPlayoffResult | null = null;
    if (season >= CFP_FIRST_SEASON && membershipStatus === 'fbs') {
      if (cfp === undefined) cfpResult = 'missed';
      else if (cfp.wonTitle) cfpResult = 'champion';
      else if (cfp.lostTitle) cfpResult = 'runner_up';
      else if (cfp.round >= 3) cfpResult = 'semifinal';
      else if (cfp.round === 2) cfpResult = 'quarterfinal';
      else cfpResult = 'r1';
    }
    programSeasons.push({
      cfbdTeamId: team.id,
      season,
      conferenceKey: team.conference === null ? null : conferenceKey(team.conference),
      membershipStatus,
      wins: record?.wins ?? null,
      losses: record?.losses ?? null,
      apPreseasonRank: apPreseasonBySchool.get(team.school) ?? null,
      apFinalRank: apFinalBySchool.get(team.school) ?? null,
      peakRankThisSeason: apBySchoolAllWeeks.has(team.school)
        ? Math.min(...(apBySchoolAllWeeks.get(team.school) ?? []))
        : null,
      cfpResult,
      bowlResult: bowlResultBySchool.get(team.school) ?? null,
      recruitingRank: recruitingByTeam.get(team.school)?.rank ?? null,
      recruitingPoints: recruitingByTeam.get(team.school)?.points ?? null,
      eraTier: cfbConfidenceTier(season),
    });
  }

  const conferences: CfbConference[] = buildConferenceDimension(
    raw.conferences,
    seenConferenceNames,
  );

  const recruits: CfbRecruit[] = raw.recruits.map((recruit) => ({
    cfbdRecruitId: recruit.id,
    athleteId: recruit.athleteId,
    year: recruit.year,
    name: recruit.name,
    committedTo: recruit.committedTo,
    position: recruit.position,
    stars: recruit.stars,
    rating: recruit.rating,
    ranking: recruit.ranking,
    stateProvince: recruit.stateProvince,
  }));
  const recruitById = new Map(raw.recruits.map((recruit) => [recruit.id, recruit]));

  let skippedUnknownPosition = 0;
  const players: CfbPlayer[] = [];
  const rosterIndex = new Map<string, (typeof raw.roster)[number]>();
  for (const rosterPlayer of raw.roster) {
    const positionGroup = cfbPositionGroup(rosterPlayer.position);
    if (positionGroup === null) {
      skippedUnknownPosition += 1;
      continue;
    }
    const recruit = (rosterPlayer.recruitIds ?? [])
      .map((id) => recruitById.get(id))
      .find((entry) => entry !== undefined);
    players.push({
      cfbdPlayerId: rosterPlayer.id,
      fullName: `${rosterPlayer.firstName} ${rosterPlayer.lastName}`.trim(),
      primaryPosition: rosterPlayer.position ?? '',
      positionGroup,
      homeState: rosterPlayer.homeState,
      homeTown: rosterPlayer.homeCity,
      recruitingClassYear: recruit?.year ?? null,
      recruitStars: recruit?.stars ?? null,
      recruitRating: recruit?.rating ?? null,
    });
    rosterIndex.set(rosterPlayer.id, rosterPlayer);
  }

  const eraTier = cfbConfidenceTier(season);
  const statsByPlayerTeam = new Map<
    string,
    {
      playerId: string;
      teamId: number | null;
      position: string | null;
      stats: Record<string, number | null>;
    }
  >();
  for (const stat of raw.playerSeasonStats) {
    const key = `${stat.playerId}:${stat.team}`;
    const entry = statsByPlayerTeam.get(key) ?? {
      playerId: stat.playerId,
      teamId: schoolToId.get(stat.team) ?? null,
      position: stat.position,
      stats: {},
    };
    entry.position ??= stat.position;
    entry.stats[`${stat.category}.${stat.statType}`] = parseStatValue(stat.stat);
    statsByPlayerTeam.set(key, entry);
  }

  let skippedUnknownTeam = 0;
  const playerSeasonStats: CfbPlayerSeasonStats[] = [];
  const seenPlayerIds = new Set<string>();
  for (const entry of statsByPlayerTeam.values()) {
    if (entry.teamId === null) {
      skippedUnknownTeam += 1;
      continue;
    }
    const position = entry.position ?? rosterIndex.get(entry.playerId)?.position ?? '';
    const positionGroup = cfbPositionGroup(position);
    if (positionGroup === null) {
      skippedUnknownPosition += 1;
      continue;
    }
    seenPlayerIds.add(entry.playerId);
    playerSeasonStats.push({
      cfbdPlayerId: entry.playerId,
      cfbdTeamId: entry.teamId,
      season,
      position,
      positionGroup,
      eraTier,
      games: entry.stats['games.games'] ?? entry.stats['games.G'] ?? null,
      gamesStarted: null,
      allConference: false,
      allAmerican: false,
      isTransferThisSeason: false,
      stats: entry.stats,
      isTeamLevelProxy: positionGroup === 'OL' || positionGroup === 'DL',
    });
  }
  for (const player of players) {
    if (seenPlayerIds.has(player.cfbdPlayerId)) continue;
    const rosterPlayer = rosterIndex.get(player.cfbdPlayerId);
    const teamId = rosterPlayer !== undefined ? (schoolToId.get(rosterPlayer.team) ?? null) : null;
    if (teamId === null) continue;
    playerSeasonStats.push({
      cfbdPlayerId: player.cfbdPlayerId,
      cfbdTeamId: teamId,
      season,
      position: player.primaryPosition,
      positionGroup: player.positionGroup,
      eraTier,
      games: null,
      gamesStarted: null,
      allConference: false,
      allAmerican: false,
      isTransferThisSeason: false,
      stats: {},
      isTeamLevelProxy: player.positionGroup === 'OL' || player.positionGroup === 'DL',
    });
  }

  const teamStatValues = new Map<string, Map<string, number | null>>();
  for (const stat of raw.teamSeasonStats) {
    const perTeam = teamStatValues.get(stat.team) ?? new Map<string, number | null>();
    perTeam.set(stat.statName.toLowerCase(), parseStatValue(stat.statValue));
    teamStatValues.set(stat.team, perTeam);
  }
  const advancedByTeam = new Map(raw.advancedSeasonStats.map((row) => [row.team, row]));
  const rushingByTeam = new Map(raw.teamRushing.map((row) => [row.team, row]));

  const statByName = (team: string, names: readonly string[]): number | null => {
    const perTeam = teamStatValues.get(team);
    if (perTeam === undefined) return null;
    for (const name of names) {
      const value = perTeam.get(name);
      if (value !== null && value !== undefined) return value;
    }
    return null;
  };

  const teamLineStats: CfbTeamLineStats[] = raw.teams
    .filter(
      (team) =>
        typeof team.school === 'string' &&
        (team.classification === 'fbs' || fbsBySeason.get(season)?.has(team.school) === true),
    )
    .map((team) => ({
      cfbdTeamId: team.id,
      season,
      // /rushing/teams/season 'sacks' counts sacks taken by the offense.
      offenseSacksAllowed: rushingByTeam.get(team.school)?.sacks ?? null,
      offensePassAttempts: statByName(team.school, ['passattempts', 'passesattempted']),
      offenseStuffRateAllowed: advancedByTeam.get(team.school)?.offense?.stuffRate ?? null,
      defenseSacks: statByName(team.school, ['sacks']),
      defenseOpponentPassAttempts: null,
      defenseStuffRate: advancedByTeam.get(team.school)?.defense?.stuffRate ?? null,
    }));

  const rowCounts: Record<string, number> = {
    conferences: conferences.length,
    teams: teams.length,
    programSeasons: programSeasons.length,
    games: gameRows.length,
    players: players.length,
    playerSeasonStats: playerSeasonStats.length,
    teamLineStats: teamLineStats.length,
    apRankings: apRankings.length,
    cfpRankings: cfpRankings.length,
    recruits: recruits.length,
    'players.skippedUnknownPosition': skippedUnknownPosition,
    'playerSeasonStats.skippedUnknownTeam': skippedUnknownTeam,
  };

  return {
    conferences,
    teams,
    programSeasons,
    games: gameRows,
    players,
    playerSeasonStats,
    teamLineStats,
    apRankings,
    cfpRankings,
    recruits,
    rowCounts,
  };
}
