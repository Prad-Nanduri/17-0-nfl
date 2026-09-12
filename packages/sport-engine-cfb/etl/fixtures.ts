import type { CfbdRawSeason, CfbdTeam } from './cfbd-types';
import teamsJson from './fixtures/teams.json';
import fbs2023Json from './fixtures/fbs-2023.json';
import fbs2024Json from './fixtures/fbs-2024.json';
import fbs2025Json from './fixtures/fbs-2025.json';
import conferencesJson from './fixtures/conferences.json';
import rosterJson from './fixtures/roster.json';
import playerStatsJson from './fixtures/player-stats.json';
import teamStatsJson from './fixtures/team-stats.json';
import advancedJson from './fixtures/advanced.json';
import rankingsRegularJson from './fixtures/rankings-regular.json';
import rankingsPostseasonJson from './fixtures/rankings-postseason.json';
import recruitsJson from './fixtures/recruits.json';
import recruitingTeamsJson from './fixtures/recruiting-teams.json';
import rushingTeamsJson from './fixtures/rushing-teams.json';
import gamesRegularJson from './fixtures/games-regular.json';
import gamesPostseasonJson from './fixtures/games-postseason.json';

// Assembles a CfbdRawSeason from the checked-in JSON fixtures so tests, the
// quick-season e2e script, and the dev server can run the transform without a
// live CFBD pull. Static imports (rather than fs reads) keep this loadable
// inside the Next.js/webpack server bundle.
export function loadFixtureRawSeason(season = 2023): CfbdRawSeason {
  return {
    season,
    teams: teamsJson as CfbdRawSeason['teams'],
    fbsTeamsBySeason: new Map<number, readonly CfbdTeam[]>([
      [2023, fbs2023Json as CfbdTeam[]],
      [2024, fbs2024Json as CfbdTeam[]],
      [2025, fbs2025Json as CfbdTeam[]],
    ]),
    conferences: conferencesJson as CfbdRawSeason['conferences'],
    roster: rosterJson as CfbdRawSeason['roster'],
    playerSeasonStats: playerStatsJson as CfbdRawSeason['playerSeasonStats'],
    teamSeasonStats: teamStatsJson as CfbdRawSeason['teamSeasonStats'],
    advancedSeasonStats: advancedJson as CfbdRawSeason['advancedSeasonStats'],
    rankingsRegular: rankingsRegularJson as CfbdRawSeason['rankingsRegular'],
    rankingsPostseason: rankingsPostseasonJson as CfbdRawSeason['rankingsPostseason'],
    recruits: recruitsJson as CfbdRawSeason['recruits'],
    teamRecruiting: recruitingTeamsJson as CfbdRawSeason['teamRecruiting'],
    teamRushing: rushingTeamsJson as CfbdRawSeason['teamRushing'],
    gamesRegular: gamesRegularJson as CfbdRawSeason['gamesRegular'],
    gamesPostseason: gamesPostseasonJson as CfbdRawSeason['gamesPostseason'],
  };
}
