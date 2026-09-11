import { Plus, Trophy } from '@phosphor-icons/react/dist/ssr';
import { requireTeam } from '../../lib/teams';
import { Badge } from '../ui/badge';
import { Card } from '../ui/card';
import { TeamLogo } from '../ui/team-logo';

// Illustrative picks; team slugs resolve against the static NFL reference data.
const sampleRoster = [
  { slot: 'QB', name: 'Patrick Mahomes', team: 'kansas-city-chiefs', era: '2018' },
  { slot: 'RB', name: 'Barry Sanders', team: 'detroit-lions', era: '1997' },
  { slot: 'WR', name: 'Randy Moss', team: 'minnesota-vikings', era: '1998' },
  { slot: 'WR', name: 'Jerry Rice', team: 'san-francisco-49ers', era: '1987' },
  { slot: 'TE', name: 'Rob Gronkowski', team: 'new-england-patriots', era: '2011' },
  { slot: 'OT', name: 'Anthony Muñoz', team: 'cincinnati-bengals', era: '1988' },
].map((pick) => ({ ...pick, team: requireTeam('nfl', pick.team) }));

export function SampleRoster() {
  return (
    <aside aria-labelledby="roster-heading" className="min-w-0">
      <div className="flex items-center justify-between gap-3">
        <h2 id="roster-heading" className="text-small font-bold">
          Your roster
        </h2>
        <span className="font-mono text-small tabular-nums">
          06<span className="text-muted"> / 24</span>
        </span>
      </div>
      <p className="mb-5 mt-2 text-caption text-muted">Illustrative selections</p>
      <ol className="divide-y divide-line">
        {sampleRoster.map((player) => (
          <li key={player.name} className="flex items-center gap-4 py-3.5 first:pt-0">
            <span className="w-9 shrink-0 font-display text-title font-semibold text-muted">
              {player.slot}
            </span>
            <span className="logo-well h-10 w-10 shrink-0 p-1">
              <TeamLogo team={player.team} size="fill" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-small font-bold">{player.name}</h3>
              <p className="mt-0.5 truncate text-caption text-muted">{player.team.location}</p>
            </div>
            <span className="font-mono text-caption text-muted">{player.era}</span>
          </li>
        ))}
      </ol>
      <div className="mt-3 flex items-center gap-4 rounded-control border border-dashed border-line px-4 py-5 text-muted">
        <Plus size={22} aria-hidden="true" />
        <div>
          <p className="text-small font-semibold">A place for the next great.</p>
          <p className="mt-1 text-caption">18 roster slots still open.</p>
        </div>
      </div>
      <Card className="mt-7 p-5">
        <Badge tone="sport">
          <Trophy size={14} aria-hidden="true" />
          The ambition
        </Badge>
        <p className="display-heading mt-3 text-title">An undefeated season.</p>
        <p className="mt-2 text-caption text-muted">
          Your roster will write the story. Season simulation arrives in a later build.
        </p>
      </Card>
    </aside>
  );
}
