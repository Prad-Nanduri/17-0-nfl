/*
 * Install the browser once with: npx playwright install chromium
 * Run with: npx tsx apps/web/scripts/perfect-season-e2e.ts
 */
import { writeFile } from 'node:fs/promises';
import { chromium, type Page } from 'playwright';
import {
  SCHEME_PRESETS,
  simulateNFLSeason,
  type NflDraftPoolUnit,
} from '@perfect-season/sport-engine-nfl';
import type {
  CompletedRoster,
  PlayerCandidate,
  PositionRating,
  SimulationMode,
} from '@perfect-season/sport-engine-core';
import { nflOpponentContext } from '../lib/server/simulate';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3001';
const SCHEME_ID = '4-3' as const;
const RESULT_DESKTOP_PATH = 'C:\\Users\\Administrator\\perfect-season-results-1440.png';
const RESULT_MOBILE_PATH = 'C:\\Users\\Administrator\\perfect-season-results-375.png';
const OG_PATH = 'C:\\Users\\Administrator\\perfect-season-og.png';

interface DraftPayload {
  readonly draft: {
    readonly id: string;
    readonly status: 'in_progress' | 'complete';
    readonly aggregateRating: number | null;
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

async function json<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? `Request failed with ${response.status}`);
  return payload;
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function stubRoster(aggregateRating: number, draftId: string): CompletedRoster {
  const scheme = SCHEME_PRESETS.find((item) => item.id === SCHEME_ID);
  if (scheme === undefined) throw new Error(`Missing scheme ${SCHEME_ID}`);
  return {
    draftId,
    sportId: 'nfl',
    schemeId: SCHEME_ID,
    ratingMode: 'prime',
    picks: scheme.slots.map((slot, index) => {
      const unit: NflDraftPoolUnit = {
        sportId: 'nfl',
        franchiseId: 'BUF',
        season: 2023,
      };
      const candidate: PlayerCandidate = {
        playerId: `perfect-season-stub-${index}`,
        fullName: `Perfect Season Stub ${index}`,
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
        mode: 'prime',
        overall: aggregateRating,
        sourceSeason: 2023,
        confidenceTier: 'full_feature',
        isTeamLevelProxy: false,
        modelVersion: 'nfl-rating-v1',
      };
      return { slot, candidate, rating, spinSeed: `stub-${index}` };
    }) as unknown as CompletedRoster['picks'],
  };
}

async function createDraft(): Promise<DraftPayload['draft']> {
  const response = await fetch(`${BASE_URL}/api/nfl/drafts`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      draftOrder: 'squad_first',
      difficulty: 'normal',
      ratingMode: 'prime',
      schemeId: SCHEME_ID,
    }),
  });
  return (await json<DraftPayload>(response)).draft;
}

async function completeDraft(): Promise<DraftPayload['draft']> {
  let draft = await createDraft();
  while (draft.status !== 'complete') {
    const spinResponse = await fetch(
      `${BASE_URL}/api/nfl/spin?draftId=${encodeURIComponent(draft.id)}`,
    );
    const spin = await json<SpinPayload>(spinResponse);
    const candidate = spin.spin.candidates
      .filter((item) => item.rating !== null && item.eligibleSlots.length > 0)
      .sort((left, right) => (right.rating ?? 0) - (left.rating ?? 0))[0];
    assert(candidate !== undefined, 'No eligible rated candidate was returned');
    const slot = candidate.eligibleSlots[0];
    assert(slot !== undefined, 'Candidate has no eligible slot');
    const pickResponse = await fetch(`${BASE_URL}/api/nfl/drafts/${draft.id}/picks`, {
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

async function findPerfectSeed(aggregateRating: number, draftId: string): Promise<string> {
  const roster = stubRoster(aggregateRating, draftId);
  const context = nflOpponentContext({
    franchises: [],
    franchiseSeasons: [],
    players: [],
    playerSeasonStats: [],
    ratings: [],
  });
  for (let index = 0; index <= 20_000; index += 1) {
    const seed = `perfect-season-e2e-${index}`;
    const mode: SimulationMode = {
      modeId: 'core',
      difficulty: 'normal',
      seed,
      options: { fullGauntlet: false },
    };
    const result = simulateNFLSeason(roster, mode, context);
    if (result.record.wins === 17 && result.record.losses === 0 && result.record.ties === 0) {
      console.log(`perfect seed: ${seed} (iteration ${index})`);
      return seed;
    }
  }
  throw new Error('No perfect-season seed found in 20,001 attempts');
}

async function assertResultsPage(page: Page, id: string) {
  await page.goto(`${BASE_URL}/play/nfl/results/${id}`);
  await page.getByTestId('trophy-perfect_season').waitFor({ state: 'visible' });
  await page.getByText('17-0', { exact: false }).first().waitFor({ state: 'visible' });
  await page.screenshot({ path: RESULT_DESKTOP_PATH, fullPage: true });
}

async function main() {
  const draft = await completeDraft();
  const aggregateRating = draft.aggregateRating;
  assert(aggregateRating !== null, 'Aggregate rating is required for seed search');
  const seed = await findPerfectSeed(aggregateRating, draft.id);
  const simulationResponse = await fetch(`${BASE_URL}/api/nfl/drafts/${draft.id}/simulate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ fullGauntlet: false, seed }),
  });
  assert(simulationResponse.status === 201, `Simulation returned ${simulationResponse.status}`);
  const simulation = await json<ResultPayload>(simulationResponse);
  assert(
    simulation.result.season.facts.rosterRating === aggregateRating,
    'Simulation roster rating did not match draft aggregate rating',
  );
  assert(
    simulation.result.season.record.wins === 17 &&
      simulation.result.season.record.losses === 0 &&
      simulation.result.season.record.ties === 0,
    'Simulation did not produce a 17-0 record',
  );
  assert(
    simulation.result.trophies.some((trophy) => trophy.code === 'perfect_season'),
    'Perfect Season trophy was not awarded',
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
    await mobile.goto(`${BASE_URL}/play/nfl/results/${draft.id}`);
    const scrollWidth = await mobile.evaluate(() => document.documentElement.scrollWidth);
    assert(scrollWidth <= 375, `Mobile page overflows: ${scrollWidth}px`);
    await mobile.screenshot({ path: RESULT_MOBILE_PATH, fullPage: true });
    const ogResponse = await mobile.request.get(`${BASE_URL}/api/nfl/drafts/${draft.id}/og`);
    assert(
      ogResponse.headers()['content-type']?.startsWith('image/png') === true,
      `Unexpected OG content type: ${ogResponse.headers()['content-type'] ?? 'missing'}`,
    );
    await writeFile(OG_PATH, await ogResponse.body());
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
