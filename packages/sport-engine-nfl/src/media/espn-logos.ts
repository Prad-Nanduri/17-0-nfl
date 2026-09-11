export type LogoSource = 'espn' | 'cache' | 'placeholder';

export interface LogoResult {
  readonly url: string;
  readonly source: LogoSource;
}

export interface LogoCacheEntry {
  readonly url: string;
  readonly expiresAt: number;
  readonly failed: boolean;
}

export interface LogoResolverOptions {
  readonly fetchImpl?: typeof fetch;
  readonly cache?: Map<string, LogoCacheEntry>;
  readonly ttlMs?: number;
  readonly failureTtlMs?: number;
  readonly timeoutMs?: number;
  readonly placeholderUrl?: string;
}

export interface LogoResolver {
  getTeamLogo(abbreviation: string): Promise<LogoResult>;
}

interface EspnLogoPayload {
  readonly team?: {
    readonly logos?: readonly { readonly href?: unknown }[];
  };
}

function logoUrl(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const team = (payload as EspnLogoPayload).team;
  const href = team?.logos?.[0]?.href;
  return typeof href === 'string' && href.length > 0 ? href : null;
}

export function createLogoResolver({
  fetchImpl = globalThis.fetch,
  cache = new Map<string, LogoCacheEntry>(),
  ttlMs = 24 * 60 * 60 * 1000,
  failureTtlMs = 5 * 60 * 1000,
  timeoutMs = 3000,
  placeholderUrl = '/logos/nfl-placeholder.svg',
}: LogoResolverOptions = {}): LogoResolver {
  const inFlight = new Map<string, Promise<LogoResult>>();

  const getTeamLogo = (abbreviation: string): Promise<LogoResult> => {
    const key = abbreviation.trim().toUpperCase();
    const now = Date.now();
    const cached = cache.get(key);
    if (cached !== undefined && cached.expiresAt > now) {
      return Promise.resolve({
        url: cached.url,
        source: cached.failed ? 'placeholder' : 'cache',
      });
    }
    if (cached !== undefined) cache.delete(key);

    const pending = inFlight.get(key);
    if (pending !== undefined) return pending;

    const request = (async (): Promise<LogoResult> => {
      try {
        const controller = new AbortController();
        let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
        try {
          const response = await Promise.race([
            fetchImpl(
              `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${key.toLowerCase()}`,
              { signal: controller.signal },
            ),
            new Promise<never>((_, reject) => {
              timeoutHandle = setTimeout(() => {
                controller.abort();
                reject(new Error('ESPN logo request timed out'));
              }, timeoutMs);
            }),
          ]);
          if (response.status < 200 || response.status >= 300) {
            throw new Error(`ESPN logo request failed: ${response.status}`);
          }
          const url = logoUrl(await response.json());
          if (url === null) throw new Error('ESPN logo response did not contain a logo URL');
          cache.set(key, { url, expiresAt: Date.now() + ttlMs, failed: false });
          return { url, source: 'espn' };
        } finally {
          if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
        }
      } catch {
        cache.set(key, {
          url: placeholderUrl,
          expiresAt: Date.now() + failureTtlMs,
          failed: true,
        });
        return { url: placeholderUrl, source: 'placeholder' };
      } finally {
        inFlight.delete(key);
      }
    })();
    inFlight.set(key, request);
    return request;
  };

  return { getTeamLogo };
}
