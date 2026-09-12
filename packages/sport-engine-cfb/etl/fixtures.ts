import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { CfbdRawSeason, CfbdTeam } from './cfbd-types';

// Assembles a CfbdRawSeason from the checked-in JSON fixtures so tests and the
// quick-season e2e script can run the transform without a live CFBD pull.
export function loadFixtureRawSeason(season = 2023): CfbdRawSeason {
  const directory = resolve(import.meta.dirname, 'fixtures');
  const fixture = <T>(name: string): T =>
    JSON.parse(readFileSync(resolve(directory, name), 'utf8')) as T;

  return {
    season,
    teams: fixture('teams.json'),
    fbsTeamsBySeason: new Map<number, readonly CfbdTeam[]>([
      [2023, fixture<CfbdTeam[]>('fbs-2023.json')],
      [2024, fixture<CfbdTeam[]>('fbs-2024.json')],
      [2025, fixture<CfbdTeam[]>('fbs-2025.json')],
    ]),
    conferences: fixture('conferences.json'),
    roster: fixture('roster.json'),
    playerSeasonStats: fixture('player-stats.json'),
    teamSeasonStats: fixture('team-stats.json'),
    advancedSeasonStats: fixture('advanced.json'),
    rankingsRegular: fixture('rankings-regular.json'),
    rankingsPostseason: fixture('rankings-postseason.json'),
    recruits: fixture('recruits.json'),
    teamRecruiting: fixture('recruiting-teams.json'),
    teamRushing: fixture('rushing-teams.json'),
    gamesRegular: fixture('games-regular.json'),
    gamesPostseason: fixture('games-postseason.json'),
  };
}
