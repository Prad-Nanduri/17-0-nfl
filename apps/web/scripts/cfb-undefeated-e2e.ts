// Requires `playwright` (npx playwright install chromium); excluded from apps/web tsconfig — run with `npx tsx`.
// The dev server must be started with PERFECT_SEASON_ALLOW_SEED_OVERRIDE=1 for the seed override to be accepted.
/*
 * Install the browser once with: npx playwright install chromium
 * Run with: npx tsx apps/web/scripts/cfb-undefeated-e2e.ts
 */
import { writeFile } from 'node:fs/promises';
import { chromium, type Page } from 'playwright';
import { CFB_RATING_MODEL_VERSION } from '@perfect-season/sport-engine-cfb';
import { CFB_SCHEME_PRESETS } from '@perfect-season/sport-engine-cfb/schemes';
import type {
  CompletedRoster,
  PlayerCandidate,
  PositionRating,
  SimulationMode,
} from '@perfect-season/sport-engine-core';
import {
  CFB_SIMULATION_DATA_VERSION,
  CFB_SIMULATION_MODEL_VERSION,
} from '../lib/server/cfb-adapter';
import { getCfbEngine } from '../lib/server/sport-engines';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const SCHEME_ID = '4-3' as const;
const SEASON = 2023;
const MAX_SEED_ATTEMPTS = 20_000;
const RESULT_DESKTOP_PATH = 'C:\\Users\\Administrator\\cfb-undefeated-results-1440.png';
const RESULT_MOBILE_PATH = 'C:\\Users\\Administrator\\cfb-undefeated-results-375.png';
const OG_PATH = 'C:\\Users\\Administrator\\cfb-undefeated-og.png';

interface DraftPayload {
  readonly draft: {
    readonly id: string;
    readonly status: 'in_progress' | 'complete';
    readonly aggregateRating: number | null;
    readonly picks: Readonly<
      Record<
        string,
        {
          readonly unit: {
            readonly sportId: string;
            readonly programId?: string;
            readonly season?: number;
            readonly conferenceId?: string | null;
          };
        }
      >
    >;
  };
}

interface SpinPayload {
  readonly spin: {
    readonly spinSeed: string;
    readonly candidates: readonly {
      readonly playerId: string;
      readonly rating: number | null;
      readonly eligibleSlots: readonly { readonly slotCode: string }[];
    }[];
  };
  readonly draft: DraftPayload['draft'];
}

interface ResultPayload {
  readonly result: {
    readonly season: {
      readonly facts: { readonly rosterRating?: number };
      readonly record: { readonly wins: number; readonly losses: number; readonly ties: number };
    };
    readonly trophies: readonly { readonly code: string }[];
  };
}

let cookieJar = '';

function captureCookies(response: Response): void {
  const setCookies = response.headers.getSetCookie?.() ?? [];
  const jar = new Map(
    cookieJar
      .split(';')
      .map((pair) => pair.trim().split('='))
      .filter((pair): pair is [string, string] => pair.length === 2 && pair[0] !== ''),
  );
  for (const entry of setCookies) {
    const [pair] = entry.split(';');
    const [name, ...rest] = pair.split('=');
    jar.set(name.trim(), rest.join('='));
  }
  cookieJar = [...jar.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
}

async function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (cookieJar !== '') headers.set('cookie', cookieJar);
  const response = await fetch(url, { ...init, headers });
  captureCookies(response);
  return response;
}

async function json<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? `Request failed with ${response.status}`);
  return payload;
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function stubRoster(
  aggregateRating: number,
  draftId: string,
  unit: CompletedRoster['picks'][number]['candidate']['poolUnit'],
): CompletedRoster {
  const scheme = CFB_SCHEME_PRESETS.find((item) => item.id === SCHEME_ID);
  if (scheme === undefined) throw new Error(`Missing scheme ${SCHEME_ID}`);
  return {
    draftId,
    sportId: 'cfb',
    schemeId: SCHEME_ID,
    ratingMode: 'career_season',
    picks: scheme.slots.map((slot, index) => {
      const candidate: PlayerCandidate = {
        playerId: `cfb-undefeated-stub-${index}`,
        fullName: `Undefeated Stub ${index}`,
        primaryPosition: slot.eligiblePositions[0] ?? slot.positionGroup,
        poolUnit: unit,
        seasons: [
          {
            poolUnit: unit,
            position: slot.eligiblePositions[0] ?? slot.positionGroup,
            confidenceTier: 'full_feature',
            stats: {},
          },
        ],
        traits: {},
      };
      const rating: PositionRating = {
        positionGroup: slot.positionGroup,
        mode: 'career_season',
        overall: aggregateRating,
        sourceSeason: SEASON,
        confidenceTier: 'full_feature',
        isTeamLevelProxy: false,
        modelVersion: CFB_RATING_MODEL_VERSION,
      };
      return { slot, candidate, rating, spinSeed: `stub-${index}` };
    }) as unknown as CompletedRoster['picks'],
  };
}

async function createDraft(): Promise<DraftPayload['draft']> {
  const response = await apiFetch(`${BASE_URL}/api/cfb/drafts`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      draftOrder: 'squad_first',
      difficulty: 'normal',
      ratingMode: 'career_season',
      schemeId: SCHEME_ID,
    }),
  });
  return (await json<DraftPayload>(response)).draft;
}

async function completeDraft(): Promise<DraftPayload['draft']> {
  let draft = await createDraft();
  while (draft.status !== 'complete') {
    const spinResponse = await apiFetch(
      `${BASE_URL}/api/cfb/spin?draftId=${encodeURIComponent(draft.id)}`,
    );
    const spin = await json<SpinPayload>(spinResponse);
    const candidate = spin.spin.candidates
      .filter((item) => item.rating !== null && item.eligibleSlots.length > 0)
      .sort((left, right) => (right.rating ?? 0) - (left.rating ?? 0))[0];
    assert(candidate !== undefined, 'No eligible rated candidate was returned');
    const slot = candidate.eligibleSlots[0];
    assert(slot !== undefined, 'Candidate has no eligible slot');
    const pickResponse = await apiFetch(`${BASE_URL}/api/cfb/drafts/${draft.id}/picks`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        slotCode: slot.slotCode,
        playerId: candidate.playerId,
        spinSeed: spin.spin.spinSeed,
      }),
    });
    draft = (await json<DraftPayload>(pickResponse)).draft;
  }
  assert(draft.aggregateRating !== null, 'Completed draft did not expose aggregate rating');
  return draft;
}

async function findUndefeatedSeed(
  aggregateRating: number,
  draftId: string,
  unit: CompletedRoster['picks'][number]['candidate']['poolUnit'],
): Promise<string> {
  const roster = stubRoster(aggregateRating, draftId, unit);
  const engine = getCfbEngine();
  const context = {
    season: SEASON,
    modelVersion: CFB_SIMULATION_MODEL_VERSION,
    dataVersion: CFB_SIMULATION_DATA_VERSION,
    opponents: [],
    facts: {},
  };
  for (let index = 0; index <= MAX_SEED_ATTEMPTS; index += 1) {
    const seed = `cfb-undefeated-e2e-${index}`;
    const mode: SimulationMode = {
      modeId: 'core',
      difficulty: 'normal',
      seed,
      options: { fullCampaign: false },
    };
    const result = await engine.simulateSeason(roster, mode, context);
    if (result.record.wins === 12 && result.record.losses === 0 && result.record.ties === 0) {
      console.log(`undefeated seed: ${seed} (iteration ${index})`);
      return seed;
    }
  }
  throw new Error(`No undefeated-and-untied seed found in ${MAX_SEED_ATTEMPTS + 1} attempts`);
}

async function assertResultsPage(page: Page, id: string) {
  await page.goto(`${BASE_URL}/play/cfb/results/${id}`);
  await page.getByTestId('trophy-undefeated_untied').waitFor({ state: 'visible' });
  await page
    .getByText('Undefeated & Untied', { exact: false })
    .first()
    .waitFor({ state: 'visible' });
  await page.screenshot({ path: RESULT_DESKTOP_PATH, fullPage: true });
}

async function main() {
  const draft = await completeDraft();
  const aggregateRating = draft.aggregateRating;
  assert(aggregateRating !== null, 'Aggregate rating is required for seed search');
  // The slate is generated from the roster's majority program-season
  // (draftedUnitFor), so the probe roster must reuse it to stay deterministic.
  const unitCounts = new Map<
    string,
    { unit: DraftPayload['draft']['picks'][string]['unit']; count: number }
  >();
  for (const pick of Object.values(draft.picks)) {
    const key = JSON.stringify(pick.unit);
    const entry = unitCounts.get(key) ?? { unit: pick.unit, count: 0 };
    entry.count += 1;
    unitCounts.set(key, entry);
  }
  const draftedUnit = [...unitCounts.values()].sort((a, b) => b.count - a.count)[0]?.unit;
  assert(
    draftedUnit !== undefined && draftedUnit.sportId === 'cfb',
    'Completed draft did not expose a CFB pool unit',
  );
  const seed = await findUndefeatedSeed(
    aggregateRating,
    draft.id,
    draftedUnit as CompletedRoster['picks'][number]['candidate']['poolUnit'],
  );
  const simulationResponse = await apiFetch(`${BASE_URL}/api/cfb/drafts/${draft.id}/simulate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ seed }),
  });
  assert(simulationResponse.status === 201, `Simulation returned ${simulationResponse.status}`);
  const simulation = await json<ResultPayload>(simulationResponse);
  assert(
    simulation.result.season.facts.rosterRating === aggregateRating,
    'Simulation roster rating did not match draft aggregate rating',
  );
  assert(
    simulation.result.season.record.wins === 12 &&
      simulation.result.season.record.losses === 0 &&
      simulation.result.season.record.ties === 0,
    'Simulation did not produce a 12-0-0 record',
  );
  assert(
    simulation.result.trophies.some((trophy) => trophy.code === 'undefeated_untied'),
    'Undefeated & Untied trophy was not awarded',
  );

  const browser = await chromium.launch({ headless: true });
  try {
    const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await assertResultsPage(desktop, draft.id);
    const mobile = await browser.newPage({
      viewport: { width: 375, height: 812 },
      isMobile: true,
      hasTouch: true,
    });
    await mobile.goto(`${BASE_URL}/play/cfb/results/${draft.id}`);
    await mobile.getByTestId('trophy-undefeated_untied').waitFor({ state: 'visible' });
    const scrollWidth = await mobile.evaluate(() => document.documentElement.scrollWidth);
    assert(scrollWidth <= 375, `Mobile page overflows: ${scrollWidth}px`);
    await mobile.screenshot({ path: RESULT_MOBILE_PATH, fullPage: true });
    const ogResponse = await mobile.request.get(`${BASE_URL}/api/cfb/drafts/${draft.id}/og`);
    assert(
      ogResponse.headers()['content-type']?.startsWith('image/png') === true,
      `Unexpected OG content type: ${ogResponse.headers()['content-type'] ?? 'missing'}`,
    );
    const ogBytes = await ogResponse.body();
    assert(
      Array.from(ogBytes.subarray(0, 8)).join(',') === '137,80,78,71,13,10,26,10',
      'OG response did not have a PNG signature',
    );
    const ogView = new DataView(ogBytes.buffer, ogBytes.byteOffset, ogBytes.byteLength);
    assert(ogView.getUint32(16) === 1200, 'OG PNG width was not 1200');
    assert(ogView.getUint32(20) === 630, 'OG PNG height was not 630');
    await writeFile(OG_PATH, ogBytes);
  } finally {
    await browser.close();
  }
  console.log(`draft: ${draft.id}`);
  console.log(`aggregate rating: ${aggregateRating}`);
  console.log(`artifacts: ${RESULT_DESKTOP_PATH}, ${RESULT_MOBILE_PATH}, ${OG_PATH}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
