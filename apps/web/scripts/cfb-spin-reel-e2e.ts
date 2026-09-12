// Requires `playwright` (npx playwright install chromium); excluded from apps/web tsconfig — run with `npx tsx`.
// Verifies the CFB slot-reel spin visual: the landed logo must always equal the
// API-resolved franchise, the reel must stay a short filmstrip (not all ~130
// logos), and mid-spin / landed screenshots are captured at 1440px and 375px.
/*
 * Install the browser once with: npx playwright install chromium
 * Run with: npx tsx apps/web/scripts/cfb-spin-reel-e2e.ts
 */
import { chromium, type Page } from 'playwright';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const SCHEME_ID = '4-3' as const;
const SPIN_ITERATIONS = 8;
const MAX_REEL_ITEMS = 40;
const SHOT_DIR = 'C:\\Users\\Administrator\\repos\\17-0-nfl\\docs\\qa\\screenshots\\cfb';
const SHOTS = {
  midSpinDesktop: `${SHOT_DIR}\\reel-mid-spin-1440.png`,
  landedDesktop: `${SHOT_DIR}\\reel-landed-1440.png`,
  midSpinMobile: `${SHOT_DIR}\\reel-mid-spin-375.png`,
  landedMobile: `${SHOT_DIR}\\reel-landed-375.png`,
};

interface SpinResponse {
  readonly spin: {
    readonly spinSeed: string;
    readonly franchise: { readonly abbreviation: string; readonly name: string };
    readonly candidates: readonly {
      readonly playerId: string;
      readonly rating: number | null;
      readonly eligibleSlots: readonly { readonly slotCode: string }[];
    }[];
  };
  readonly draft: {
    readonly id: string;
    readonly status: string;
    readonly rerollsRemaining: number;
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
  const text = await response.text();
  let payload: (T & { error?: string }) | null = null;
  if (text.length > 0) {
    try {
      payload = JSON.parse(text) as T & { error?: string };
    } catch {
      payload = null;
    }
  }
  if (!response.ok) {
    throw new Error(payload?.error ?? `Request failed with ${response.status}`);
  }
  if (payload === null) throw new Error('Server returned an invalid response');
  return payload;
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function createDraft(difficulty: 'easy' | 'normal'): Promise<string> {
  const response = await apiFetch(`${BASE_URL}/api/cfb/drafts`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      draftOrder: 'squad_first',
      difficulty,
      ratingMode: 'career_season',
      schemeId: SCHEME_ID,
    }),
  });
  return (await json<{ draft: { id: string } }>(response)).draft.id;
}

/** Place the top eligible candidate via the API so the next UI spin is unlocked. */
async function placePick(draftId: string, spin: SpinResponse['spin']): Promise<void> {
  const candidate = spin.candidates
    .filter((item) => item.eligibleSlots.length > 0)
    .sort((left, right) => (right.rating ?? 0) - (left.rating ?? 0))[0];
  assert(candidate !== undefined, 'No eligible candidate to place');
  const slot = candidate.eligibleSlots[0];
  assert(slot !== undefined, 'Candidate has no eligible slot');
  const response = await apiFetch(`${BASE_URL}/api/cfb/drafts/${draftId}/picks`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      slotCode: slot.slotCode,
      playerId: candidate.playerId,
      spinSeed: spin.spinSeed,
    }),
  });
  await json(response);
}

async function assertReelIntegrity(page: Page): Promise<void> {
  const reelItems = await page.locator('[data-reel-item]').count();
  assert(
    reelItems > 0 && reelItems <= MAX_REEL_ITEMS,
    `Reel rendered ${reelItems} items (expected <= ${MAX_REEL_ITEMS})`,
  );
}

/**
 * Click Spin (or Reroll), capture the API-resolved franchise, and assert the
 * reel's landed logo matches it exactly once the animation rests.
 */
async function spinAndVerify(page: Page, reroll: boolean): Promise<SpinResponse['spin']> {
  const button = page.getByRole('button', { name: reroll ? /reroll/i : /^spin$/i });
  const responsePromise = page.waitForResponse(
    (response) => response.url().includes('/api/cfb/spin') && response.status() === 200,
  );
  await button.click();
  const resolved = (await (await responsePromise).json()) as SpinResponse;
  const expected = resolved.spin.franchise.abbreviation;
  await page.waitForFunction(
    (wanted) =>
      document
        .querySelector('[data-testid="cfb-spin-reel"]')
        ?.getAttribute('data-landed-abbreviation') === wanted,
    expected,
    { timeout: 15_000 },
  );
  const landed = await page.getByTestId('cfb-reel-landed-item').getAttribute('data-abbreviation');
  assert(
    landed === expected,
    `Landed logo ${landed ?? 'none'} did not match resolved franchise ${expected}`,
  );
  // The card-flip reveal must hand off the full detail after landing.
  await page.getByText(resolved.spin.franchise.name, { exact: false }).first().waitFor();
  await assertReelIntegrity(page);
  return resolved.spin;
}

async function runPass(
  page: Page,
  draftId: string,
  spins: number,
  shots: { mid: string; landed: string },
): Promise<void> {
  await page.goto(`${BASE_URL}/play/cfb`);
  await page.getByRole('button', { name: /^spin$/i }).waitFor();
  for (let index = 0; index < spins; index += 1) {
    // Mid-spin capture: screenshot while the filmstrip is still cycling.
    const responsePromise = page.waitForResponse(
      (response) => response.url().includes('/api/cfb/spin') && response.status() === 200,
    );
    await page.getByRole('button', { name: /^spin$/i }).click();
    const resolved = (await (await responsePromise).json()) as SpinResponse;
    if (index === 0) {
      await page.waitForTimeout(700);
      await page.screenshot({ path: shots.mid });
      assert(
        (await page.locator('[data-reel-item]').count()) <= MAX_REEL_ITEMS,
        'Reel exceeded the filmstrip budget mid-spin',
      );
    }
    const expected = resolved.spin.franchise.abbreviation;
    await page.waitForFunction(
      (wanted) =>
        document
          .querySelector('[data-testid="cfb-spin-reel"]')
          ?.getAttribute('data-landed-abbreviation') === wanted,
      expected,
      { timeout: 15_000 },
    );
    const landed = await page.getByTestId('cfb-reel-landed-item').getAttribute('data-abbreviation');
    assert(landed === expected, `Spin ${index}: landed ${landed} != resolved ${expected}`);
    console.log(`spin ${index}: landed ${landed} == resolved ${expected}`);
    if (index === 0) {
      // Let the card-flip reveal finish so the landed screenshot shows detail.
      await page
        .getByText(resolved.spin.franchise.name, { exact: false })
        .first()
        .waitFor({ state: 'visible' });
      await page.waitForTimeout(900);
      await page.screenshot({ path: shots.landed });
    }
    await placePick(draftId, resolved.spin);
    await page.reload();
    await page.getByRole('button', { name: /^spin$/i }).waitFor();
  }
}

async function checkSignup(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/account`);
  const emailInput = page.locator('input[type="email"], input[name="email"]');
  const hasEmailSignup = (await emailInput.count()) > 0;
  console.log(`account page email signup form present: ${hasEmailSignup}`);
  const probe = await apiFetch(`${BASE_URL}/api/auth/magic-link`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'e2e-probe@example.com' }),
  });
  console.log(`magic-link endpoint status: ${probe.status}`);
}

async function main() {
  const draftId = await createDraft('easy');
  const guestCookie = cookieJar
    .split(';')
    .map((pair) => pair.trim().split('='))
    .find(([name]) => name === 'ps_guest');
  assert(guestCookie !== undefined, 'Draft creation did not set the ps_guest cookie');

  const browser = await chromium.launch({ headless: true });
  try {
    const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await desktop.addCookies([{ name: 'ps_guest', value: guestCookie[1], url: BASE_URL }]);
    const desktopPage = await desktop.newPage();
    await runPass(desktopPage, draftId, SPIN_ITERATIONS, {
      mid: SHOTS.midSpinDesktop,
      landed: SHOTS.landedDesktop,
    });

    // Reroll landing check on the mobile pass (easy difficulty = 1 reroll).
    const mobile = await browser.newContext({
      viewport: { width: 375, height: 812 },
      isMobile: true,
      hasTouch: true,
    });
    await mobile.addCookies([{ name: 'ps_guest', value: guestCookie[1], url: BASE_URL }]);
    const mobilePage = await mobile.newPage();
    await mobilePage.goto(`${BASE_URL}/play/cfb`);
    await mobilePage.getByRole('button', { name: /^spin$/i }).waitFor();
    await spinAndVerify(mobilePage, false);
    await mobilePage.waitForTimeout(300);
    const reroll = mobilePage.getByRole('button', { name: /reroll/i });
    if ((await reroll.count()) > 0 && (await reroll.isEnabled())) {
      const rerollResponse = mobilePage.waitForResponse(
        (response) => response.url().includes('/api/cfb/spin') && response.status() === 200,
      );
      await reroll.click();
      const resolved = (await (await rerollResponse).json()) as SpinResponse;
      await mobilePage.waitForTimeout(700);
      await mobilePage.screenshot({ path: SHOTS.midSpinMobile });
      await mobilePage.waitForFunction(
        (wanted) =>
          document
            .querySelector('[data-testid="cfb-spin-reel"]')
            ?.getAttribute('data-landed-abbreviation') === wanted,
        resolved.spin.franchise.abbreviation,
        { timeout: 15_000 },
      );
      const landed = await mobilePage
        .getByTestId('cfb-reel-landed-item')
        .getAttribute('data-abbreviation');
      assert(
        landed === resolved.spin.franchise.abbreviation,
        `Reroll landed ${landed} != resolved ${resolved.spin.franchise.abbreviation}`,
      );
      console.log(`reroll: landed ${landed} == resolved ${resolved.spin.franchise.abbreviation}`);
      await mobilePage.screenshot({ path: SHOTS.landedMobile });
    } else {
      await mobilePage.screenshot({ path: SHOTS.landedMobile });
      console.log('reroll unavailable; landed-only mobile screenshot taken');
    }
    const scrollWidth = await mobilePage.evaluate(() => document.documentElement.scrollWidth);
    assert(scrollWidth <= 375, `Mobile page overflows: ${scrollWidth}px`);
    await checkSignup(mobilePage);
  } finally {
    await browser.close();
  }
  console.log(`draft: ${draftId}`);
  console.log(`artifacts: ${Object.values(SHOTS).join(', ')}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
