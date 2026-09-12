'use client';

import { useCallback, useEffect, useState } from 'react';
import type { LeaderboardEntry } from '../../lib/server/leaderboard';
import type { SportId } from '../../lib/sport';

const REFRESH_MS = 45_000;
const DIFFICULTIES = [
  { id: 'all', label: 'All difficulties' },
  { id: 'easy', label: 'Easy' },
  { id: 'normal', label: 'Normal' },
  { id: 'hard', label: 'Hard' },
] as const;

type DifficultyFilter = (typeof DIFFICULTIES)[number]['id'];
const TABS: readonly { id: SportId; label: string }[] = [
  { id: 'nfl', label: 'NFL' },
  { id: 'cfb', label: 'NCAA FBS' },
];

function formatRecord(record: LeaderboardEntry['record']): string {
  return record.ties > 0
    ? `${record.wins}-${record.losses}-${record.ties}`
    : `${record.wins}-${record.losses}`;
}

export function LeaderboardBoard() {
  const [sport, setSport] = useState<SportId>('nfl');
  const [difficulty, setDifficulty] = useState<DifficultyFilter>('all');
  const [entries, setEntries] = useState<readonly LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (nextSport: SportId, nextDifficulty: DifficultyFilter) => {
    try {
      const response = await fetch(
        `/api/leaderboard?sport=${nextSport}&difficulty=${nextDifficulty}`,
      );
      if (!response.ok) return;
      const payload = (await response.json()) as { entries?: LeaderboardEntry[] };
      setEntries(payload.entries ?? []);
    } catch {
      // transient fetch failure — keep showing the last good data
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh(sport, difficulty);
    const timer = setInterval(() => void refresh(sport, difficulty), REFRESH_MS);
    return () => clearInterval(timer);
  }, [sport, difficulty, refresh]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Sport">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={sport === tab.id}
            onClick={() => {
              setSport(tab.id);
              setLoading(true);
            }}
            className={`min-h-11 rounded-control px-4 text-small font-semibold transition-colors ${
              sport === tab.id
                ? 'bg-action text-on-action'
                : 'border border-line text-muted hover:text-action'
            }`}
          >
            {tab.label}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-small text-muted">
          Difficulty
          <select
            value={difficulty}
            onChange={(event) => {
              setDifficulty(event.target.value as DifficultyFilter);
              setLoading(true);
            }}
            className="min-h-11 rounded-control border border-line bg-surface px-3 text-small text-ink"
          >
            {DIFFICULTIES.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {entries.length === 0 ? (
        <p className="mt-10 rounded-panel border border-line bg-surface p-8 text-center text-body text-muted">
          {loading
            ? 'Loading results…'
            : 'No completed drafts here yet. Finish a season and it lands here.'}
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-panel border border-line bg-surface">
          <table className="w-full min-w-[36rem] text-left text-small">
            <thead>
              <tr className="border-b border-line text-muted">
                <th className="px-4 py-3 font-semibold">#</th>
                <th className="px-4 py-3 font-semibold">Drafter</th>
                <th className="px-4 py-3 font-semibold">Record</th>
                <th className="px-4 py-3 font-semibold">+/−</th>
                <th className="px-4 py-3 font-semibold">Difficulty</th>
                <th className="px-4 py-3 font-semibold">Mode</th>
                <th className="px-4 py-3 font-semibold">Finish</th>
                <th className="px-4 py-3 font-semibold">Trophies</th>
                <th className="px-4 py-3 font-semibold">Completed</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr
                  key={`${entry.sport}-${entry.rank}-${entry.alias}-${entry.completedAt}`}
                  className="border-b border-line last:border-b-0"
                >
                  <td className="px-4 py-3 font-display font-bold text-action">{entry.rank}</td>
                  <td className="px-4 py-3 font-semibold">{entry.alias}</td>
                  <td className="px-4 py-3 tabular-nums">{formatRecord(entry.record)}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {entry.pointDifferential > 0
                      ? `+${entry.pointDifferential}`
                      : entry.pointDifferential}
                  </td>
                  <td className="px-4 py-3 capitalize">{entry.difficulty}</td>
                  <td className="px-4 py-3">
                    {entry.ratingMode === 'prime' ? 'Prime' : 'Career season'}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {entry.postseasonResult?.replaceAll('_', ' ') ?? '—'}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{entry.trophyCount}</td>
                  <td className="px-4 py-3 text-muted">
                    {new Date(entry.completedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
