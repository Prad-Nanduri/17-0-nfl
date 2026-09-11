import type { SportId } from '@perfect-season/sport-engine-core';
import { groupTeams, leagues, teamsBySport } from '../../lib/teams';
import { LeagueMark, TeamLogo } from '../ui/team-logo';

/**
 * Roster-sheet style index of every team in a league, grouped by division or conference.
 * Static presentation of reference data; `data-sport` scopes the local accent only.
 */
export function LeagueWall({ sport }: { sport: SportId }) {
  const league = leagues[sport];
  const groups = groupTeams(teamsBySport[sport]);
  const headingId = `wall-${sport}`;

  return (
    <section aria-labelledby={headingId} data-sport={sport} className="min-w-0">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-b-2 border-ink pb-4">
        <div className="flex items-center gap-4">
          <LeagueMark league={league} size="md" />
          <div>
            <h3 id={headingId} className="display-heading text-title">
              {league.shortName}
            </h3>
            <p className="text-caption text-muted">{league.name}</p>
          </div>
        </div>
        <p className="eyebrow text-sport">{league.teamCountLabel}</p>
      </header>
      <div className="mt-6 grid grid-cols-1 gap-x-10 gap-y-8 sm:grid-cols-2 xl:grid-cols-4">
        {groups.map(({ group, teams }) => (
          <div key={group} className="min-w-0">
            <h4 className="flex items-baseline justify-between gap-3 text-caption font-bold uppercase tracking-wider text-muted">
              {group}
              <span className="font-mono text-micro tabular-nums">{teams.length}</span>
            </h4>
            <ul className="mt-3 grid grid-cols-6 gap-1.5 sm:grid-cols-4 xl:grid-cols-6">
              {teams.map((team) => (
                <li
                  key={team.id}
                  className="logo-well aspect-square p-1.5"
                  title={team.displayName}
                >
                  <TeamLogo team={team} size="fill" />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
