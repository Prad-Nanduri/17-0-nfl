import type { SportId } from '@perfect-season/sport-engine-core';
import { cfbTeams } from './cfb';
import { nflTeams } from './nfl';
import type { League, Team } from './types';

export type { League, Team } from './types';
export { nflTeams, cfbTeams };

/**
 * League marks are bundled locally; team marks are hotlinked from ESPN's public CDN.
 * All marks are trademarks of their respective owners — presentation use only.
 */
export const leagues: Record<SportId, League> = {
  nfl: {
    sport: 'nfl',
    name: 'National Football League',
    shortName: 'NFL',
    teamCountLabel: '32 franchises',
    logo: '/logos/nfl.png',
    logoDark: '/logos/nfl-dark.png',
  },
  cfb: {
    sport: 'cfb',
    name: 'NCAA Football Bowl Subdivision',
    shortName: 'NCAA FBS',
    teamCountLabel: '136 programs',
    logo: '/logos/ncaa.svg',
    logoDark: '/logos/ncaa.svg',
  },
};

export const teamsBySport: Record<SportId, readonly Team[]> = { nfl: nflTeams, cfb: cfbTeams };

/** Preserves first-seen order of `group` so callers control sequencing via the data file. */
export function groupTeams(teams: readonly Team[]): Array<{ group: string; teams: Team[] }> {
  const groups = new Map<string, Team[]>();
  for (const team of teams) {
    const bucket = groups.get(team.group);
    if (bucket) bucket.push(team);
    else groups.set(team.group, [team]);
  }
  return Array.from(groups, ([group, members]) => ({ group, teams: members }));
}

export function findTeam(sport: SportId, slug: string): Team | undefined {
  return teamsBySport[sport].find((team) => team.slug === slug);
}

/** For static references that must exist in the bundled data (fails at build/render, not silently). */
export function requireTeam(sport: SportId, slug: string): Team {
  const team = findTeam(sport, slug);
  if (!team) throw new Error(`Unknown ${sport} team "${slug}"`);
  return team;
}
