import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLogoResolver, type LogoCacheEntry } from './espn-logos';

describe('createLogoResolver', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('fetches a logo and serves a positive cache hit', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ team: { logos: [{ href: 'https://cdn/logo.svg' }] } }), {
        status: 200,
      }),
    );
    const resolver = createLogoResolver({ fetchImpl });
    await expect(resolver.getTeamLogo('KC')).resolves.toEqual({
      url: 'https://cdn/logo.svg',
      source: 'espn',
    });
    await expect(resolver.getTeamLogo('kc')).resolves.toEqual({
      url: 'https://cdn/logo.svg',
      source: 'cache',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('deduplicates concurrent requests', async () => {
    let resolveFetch: ((response: Response) => void) | undefined;
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    const resolver = createLogoResolver({ fetchImpl });
    const first = resolver.getTeamLogo('NE');
    const second = resolver.getTeamLogo('NE');
    resolveFetch?.(new Response(JSON.stringify({ team: { logos: [{ href: 'url' }] } })));
    await expect(Promise.all([first, second])).resolves.toEqual([
      { url: 'url', source: 'espn' },
      { url: 'url', source: 'espn' },
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('never throws and suppresses failures with a negative cache', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('nope', { status: 429 }));
    const resolver = createLogoResolver({ fetchImpl, failureTtlMs: 60_000 });
    await expect(resolver.getTeamLogo('DAL')).resolves.toEqual({
      url: '/logos/nfl-placeholder.svg',
      source: 'placeholder',
    });
    await expect(resolver.getTeamLogo('DAL')).resolves.toEqual({
      url: '/logos/nfl-placeholder.svg',
      source: 'placeholder',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('handles rejected fetches and malformed JSON', async () => {
    const rejected = createLogoResolver({
      fetchImpl: vi.fn<typeof fetch>().mockRejectedValue(new Error('offline')),
    });
    await expect(rejected.getTeamLogo('GB')).resolves.toEqual({
      url: '/logos/nfl-placeholder.svg',
      source: 'placeholder',
    });
    const malformed = createLogoResolver({
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status: 200 })),
    });
    await expect(malformed.getTeamLogo('GB')).resolves.toEqual({
      url: '/logos/nfl-placeholder.svg',
      source: 'placeholder',
    });
  });

  it('returns a placeholder when a request times out', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementation(() => new Promise<Response>(() => undefined));
    const resolver = createLogoResolver({ fetchImpl, timeoutMs: 100 });
    const request = resolver.getTeamLogo('SF');
    await vi.advanceTimersByTimeAsync(101);
    await expect(request).resolves.toEqual({
      url: '/logos/nfl-placeholder.svg',
      source: 'placeholder',
    });
  });

  it('accepts a caller-provided cache', async () => {
    const cache = new Map<string, LogoCacheEntry>([
      ['GB', { url: 'cached', expiresAt: Date.now() + 10_000, failed: false }],
    ]);
    const fetchImpl = vi.fn<typeof fetch>();
    const resolver = createLogoResolver({ cache, fetchImpl });
    await expect(resolver.getTeamLogo('GB')).resolves.toEqual({ url: 'cached', source: 'cache' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
