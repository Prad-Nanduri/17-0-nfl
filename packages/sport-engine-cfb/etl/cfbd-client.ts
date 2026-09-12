import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export const CFBD_DEFAULT_BASE_URL = 'https://api.collegefootballdata.com';

const MAX_RETRIES = 3;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

export interface CfbdClientOptions {
  readonly apiKey?: string;
  readonly baseUrl?: string;
  readonly fetchImpl?: typeof fetch;
  readonly stagingDir?: string;
  readonly season?: number;
}

export interface CfbdGetOptions {
  readonly refresh?: boolean;
}

export interface CfbdClient {
  get<T>(
    path: string,
    query?: Record<string, string | number>,
    options?: CfbdGetOptions,
  ): Promise<T>;
}

function sanitizeForFile(text: string): string {
  return text.replace(/[^a-zA-Z0-9._-]+/g, '_');
}

export function createCfbdClient(options: CfbdClientOptions = {}): CfbdClient {
  const apiKey = options.apiKey ?? process.env.CFBD_API_KEY;
  const baseUrl = (options.baseUrl ?? CFBD_DEFAULT_BASE_URL).replace(/\/+$/, '');
  const fetchImpl = options.fetchImpl ?? fetch;
  const stagingDir = options.stagingDir;

  const cachePath = (url: string): string | null => {
    if (stagingDir === undefined) return null;
    const parsed = new URL(url);
    const name = sanitizeForFile(`${parsed.pathname}${parsed.search}`);
    const seasonDir = options.season !== undefined ? String(options.season) : 'misc';
    return join(stagingDir, seasonDir, `${name}.json`);
  };

  return {
    async get<T>(
      path: string,
      query: Record<string, string | number> = {},
      getOptions: CfbdGetOptions = {},
    ): Promise<T> {
      if (apiKey === undefined || apiKey === '') {
        throw new Error(
          'CFBD_API_KEY is required (get a free key at https://collegefootballdata.com/key)',
        );
      }
      const url = new URL(`${baseUrl}${path}`);
      for (const [key, value] of Object.entries(query)) {
        url.searchParams.set(key, String(value));
      }
      const target = url.toString();
      const cached = cachePath(target);
      if (cached !== null && !getOptions.refresh) {
        try {
          return JSON.parse(readFileSync(cached, 'utf8')) as T;
        } catch {
          // Cache miss or unreadable file: fall through to the network.
        }
      }
      let lastError: unknown = null;
      for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
        try {
          const response = await fetchImpl(target, {
            headers: { Authorization: `Bearer ${apiKey}` },
          });
          if (!response.ok) {
            if (RETRYABLE_STATUS.has(response.status) && attempt < MAX_RETRIES - 1) {
              await new Promise((resolve) => setTimeout(resolve, 2 ** attempt * 250));
              continue;
            }
            throw new Error(`CFBD GET ${path} failed: HTTP ${response.status}`);
          }
          const body = (await response.json()) as T;
          if (cached !== null) {
            mkdirSync(dirname(cached), { recursive: true });
            writeFileSync(cached, `${JSON.stringify(body)}\n`);
          }
          return body;
        } catch (error) {
          lastError = error;
          if (
            attempt < MAX_RETRIES - 1 &&
            !(error instanceof Error && /HTTP \d+/.test(error.message))
          ) {
            await new Promise((resolve) => setTimeout(resolve, 2 ** attempt * 250));
            continue;
          }
          throw error;
        }
      }
      throw lastError instanceof Error ? lastError : new Error(String(lastError));
    },
  };
}
