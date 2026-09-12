import { describe, expect, it, vi } from 'vitest';
import { extractSeason } from './extract';
import type { CfbdClient } from './cfbd-client';

function fakeClient(
  responses: Record<string, unknown>,
  options: { failPaths?: readonly string[] } = {},
): {
  client: CfbdClient;
  calls: { path: string; query: Record<string, string | number> | undefined }[];
} {
  const calls: { path: string; query: Record<string, string | number> | undefined }[] = [];
  const get = <T>(path: string, query?: Record<string, string | number>): Promise<T> => {
    calls.push({ path, query });
    if (options.failPaths?.includes(path)) {
      return Promise.reject(new Error(`CFBD GET ${path} failed: HTTP 500`));
    }
    return Promise.resolve((responses[path] ?? []) as T);
  };
  return { client: { get }, calls };
}

describe('extractSeason', () => {
  it('fetches player season stats once without a category filter', async () => {
    const { client, calls } = fakeClient({
      '/teams': [{ id: 1, school: 'State U' }],
      '/teams/fbs': [{ id: 1, school: 'State U' }],
      '/roster': [{ id: 'p1' }],
      '/stats/player/season': [
        { playerId: 'p1', category: 'passing', statType: 'YDS', stat: '3000' },
      ],
    });
    const raw = await extractSeason(client, 2023);
    const statCalls = calls.filter((call) => call.path === '/stats/player/season');
    expect(statCalls).toHaveLength(1);
    expect(statCalls[0]?.query).toEqual({ year: 2023 });
    expect(calls.some((call) => call.path === '/stats/categories')).toBe(false);
    expect(raw.playerSeasonStats).toHaveLength(1);
  });

  it('fetches sequentially rather than firing parallel bursts', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const get = <T>(path: string): Promise<T> => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      return new Promise<T>((resolve) => {
        setTimeout(() => {
          inFlight -= 1;
          resolve((path === '/roster' ? [{ id: 'p1' }] : []) as T);
        }, 0);
      });
    };
    await extractSeason({ get }, 2023);
    expect(maxInFlight).toBe(1);
  });

  it('warns and defaults to empty on optional-endpoint failure', async () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { client } = fakeClient(
      {
        '/teams': [{ id: 1 }],
        '/roster': [{ id: 'p1' }],
        '/stats/player/season': [{ playerId: 'p1' }],
      },
      { failPaths: ['/recruiting/players', '/recruiting/teams'] },
    );
    const raw = await extractSeason(client, 2023);
    expect(raw.recruits).toEqual([]);
    expect(raw.teamRecruiting).toEqual([]);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('/recruiting/players'));
    spy.mockRestore();
  });

  it('propagates failure on required endpoints', async () => {
    const { client } = fakeClient(
      { '/teams': [{ id: 1 }] },
      { failPaths: ['/stats/player/season', '/conferences'] },
    );
    await expect(extractSeason(client, 2023)).rejects.toThrow(/conferences|player\/season/);
  });
});
