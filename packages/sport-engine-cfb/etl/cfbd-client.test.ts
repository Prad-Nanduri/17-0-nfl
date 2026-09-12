import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createCfbdClient } from './cfbd-client';

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('createCfbdClient', () => {
  it('sends the bearer token and builds the query string', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse([{ id: 1 }]));
    const client = createCfbdClient({ apiKey: 'test-key', fetchImpl });
    await client.get('/teams', { year: 2023, conference: 'SEC' });
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(String(url)).toContain('/teams?');
    expect(String(url)).toContain('year=2023');
    expect(String(url)).toContain('conference=SEC');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer test-key');
  });

  it('throws a clear error when no API key is configured', async () => {
    const client = createCfbdClient({ apiKey: '', fetchImpl: vi.fn() });
    await expect(client.get('/teams')).rejects.toThrow(/CFBD_API_KEY is required/);
  });

  it('retries on 429 before succeeding', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({}, 429))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    const client = createCfbdClient({ apiKey: 'k', fetchImpl });
    await expect(client.get('/teams')).resolves.toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('does not retry a hard 4xx failure', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({}, 404));
    const client = createCfbdClient({ apiKey: 'k', fetchImpl });
    await expect(client.get('/teams')).rejects.toThrow(/HTTP 404/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('serves a cached staging response without fetching', async () => {
    const stagingDir = mkdtempSync(join(tmpdir(), 'cfbd-client-'));
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse([{ id: 7 }]));
    const client = createCfbdClient({ apiKey: 'k', fetchImpl, stagingDir, season: 2023 });
    await client.get('/conferences');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await client.get('/conferences');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('bypasses the cache when refresh is set', async () => {
    const stagingDir = mkdtempSync(join(tmpdir(), 'cfbd-client-'));
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementation(() => Promise.resolve(jsonResponse([{ id: 7 }])));
    const client = createCfbdClient({ apiKey: 'k', fetchImpl, stagingDir, season: 2023 });
    await client.get('/conferences');
    await client.get('/conferences', {}, { refresh: true });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
