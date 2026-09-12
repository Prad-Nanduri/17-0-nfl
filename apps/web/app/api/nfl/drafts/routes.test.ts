import { describe, expect, it, vi } from 'vitest';
import { POST as createDraft } from './route';
import { GET as getDraft } from './[id]/route';
import { POST as pick } from './[id]/picks/route';
import { GET as getOg } from './[id]/og/route';
import { GET as getResult } from './[id]/result/route';
import { POST as simulate } from './[id]/simulate/route';
import { GET as spin } from '../spin/route';

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

async function create(
  difficulty: 'easy' | 'normal' | 'hard' = 'normal',
  draftOrder: 'squad_first' | 'position_first' = 'squad_first',
) {
  const response = await createDraft(
    new Request('http://localhost/api/nfl/drafts', {
      method: 'POST',
      body: JSON.stringify({
        draftOrder,
        difficulty,
        ratingMode: 'career_season',
        schemeId: '4-3',
      }),
      headers: { 'content-type': 'application/json' },
    }),
  );
  expect(response.status).toBe(201);
  return json<{ draft: { id: string } }>(response);
}

async function completeDraft() {
  const created = await create();
  const draftId = created.draft.id;
  for (let index = 0; index < 24; index += 1) {
    const spinResponse = await spin(
      new Request(`http://localhost/api/nfl/spin?draftId=${draftId}`),
    );
    const spinPayload = await json<{
      spin: {
        spinSeed: string;
        candidates: readonly {
          playerId: string;
          eligibleSlots: readonly { slotCode: string }[];
        }[];
      };
    }>(spinResponse);
    const candidate = spinPayload.spin.candidates[0];
    const slot = candidate?.eligibleSlots[0];
    expect(candidate).toBeDefined();
    expect(slot).toBeDefined();
    const pickResponse = await pick(
      new Request(`http://localhost/api/nfl/drafts/${draftId}/picks`, {
        method: 'POST',
        body: JSON.stringify({
          slotCode: slot?.slotCode,
          playerId: candidate?.playerId,
          spinSeed: spinPayload.spin.spinSeed,
        }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: { id: draftId } },
    );
    expect(pickResponse.status).toBe(200);
  }
  const completed = await json<{
    draft: {
      status: string;
      picks: Readonly<Record<string, { rating: { overall: number } | null }>>;
    };
  }>(
    await getDraft(new Request(`http://localhost/api/nfl/drafts/${draftId}`), {
      params: { id: draftId },
    }),
  );
  expect(completed.draft.status).toBe('complete');
  return { id: draftId, draft: completed.draft };
}

describe('NFL draft routes', () => {
  it('runs a complete 24-pick flow through the real engine', async () => {
    const created = await create();
    let draftId = created.draft.id;
    for (let index = 0; index < 24; index += 1) {
      const spinResponse = await spin(
        new Request(`http://localhost/api/nfl/spin?draftId=${draftId}`),
      );
      expect(spinResponse.status).toBe(200);
      const spinPayload = await json<{
        spin: {
          spinSeed: string;
          candidates: readonly {
            playerId: string;
            eligibleSlots: readonly { slotCode: string }[];
          }[];
        };
        draft: { id: string };
      }>(spinResponse);
      const candidate = spinPayload.spin.candidates[0];
      const slot = candidate?.eligibleSlots[0];
      expect(candidate).toBeDefined();
      expect(slot).toBeDefined();
      const pickResponse = await pick(
        new Request(`http://localhost/api/nfl/drafts/${draftId}/picks`, {
          method: 'POST',
          body: JSON.stringify({
            slotCode: slot?.slotCode,
            playerId: candidate?.playerId,
            spinSeed: spinPayload.spin.spinSeed,
          }),
          headers: { 'content-type': 'application/json' },
        }),
        { params: { id: draftId } },
      );
      expect(pickResponse.status).toBe(200);
      draftId = spinPayload.draft.id;
    }
    const completed = await json<{
      draft: {
        status: string;
        usedUnits: readonly unknown[];
        picks: Readonly<Record<string, { rating: { overall: number } | null }>>;
      };
    }>(
      await getDraft(new Request(`http://localhost/api/nfl/drafts/${draftId}`), {
        params: { id: draftId },
      }),
    );
    expect(completed.draft.status).toBe('complete');
    expect(new Set(completed.draft.usedUnits.map((unit) => JSON.stringify(unit))).size).toBe(24);
    expect(
      Object.values(completed.draft.picks).every((pick) => (pick.rating?.overall ?? 0) >= 40),
    ).toBe(true);
  });

  it('rejects pending spins, wrong seeds, and unknown drafts', async () => {
    const created = await create();
    const id = created.draft.id;
    expect((await spin(new Request(`http://localhost/api/nfl/spin?draftId=${id}`))).status).toBe(
      200,
    );
    expect((await spin(new Request(`http://localhost/api/nfl/spin?draftId=${id}`))).status).toBe(
      409,
    );
    expect(
      (
        await pick(
          new Request(`http://localhost/api/nfl/drafts/${id}/picks`, {
            method: 'POST',
            body: JSON.stringify({ slotCode: 'QB1', playerId: 'unknown', spinSeed: 'wrong' }),
            headers: { 'content-type': 'application/json' },
          }),
          { params: { id } },
        )
      ).status,
    ).toBe(409);
    expect((await spin(new Request('http://localhost/api/nfl/spin?draftId=missing'))).status).toBe(
      404,
    );
  });

  it('allows one easy reroll and constrains position-first picks', async () => {
    const easy = await create('easy');
    const easySpin = `http://localhost/api/nfl/spin?draftId=${easy.draft.id}`;
    const first = await json<{ spin: { spinSeed: string } }>(await spin(new Request(easySpin)));
    const rerolled = await spin(new Request(`${easySpin}&reroll=1`));
    expect(rerolled.status).toBe(200);
    const second = await json<{ spin: { spinSeed: string } }>(rerolled);
    expect(second.spin.spinSeed).not.toBe(first.spin.spinSeed);
    expect((await spin(new Request(`${easySpin}&reroll=1`))).status).toBe(409);

    const position = await create('normal', 'position_first');
    const response = await spin(
      new Request(`http://localhost/api/nfl/spin?draftId=${position.draft.id}`),
    );
    const payload = await json<{
      spin: {
        targetSlotCode: string;
        candidates: readonly { eligibleSlots: readonly { slotCode: string }[] }[];
      };
    }>(response);
    expect(
      payload.spin.candidates.every((candidate) =>
        candidate.eligibleSlots.every((slot) => slot.slotCode === payload.spin.targetSlotCode),
      ),
    ).toBe(true);
  });

  it('rejects simulation before a draft is complete', async () => {
    const created = await create();
    const response = await simulate(
      new Request(`http://localhost/api/nfl/drafts/${created.draft.id}/simulate`, {
        method: 'POST',
      }),
      { params: { id: created.draft.id } },
    );
    expect(response.status).toBe(409);
  });

  it('stores a real season result and prevents duplicate simulation', async () => {
    const completed = await completeDraft();
    const response = await simulate(
      new Request(`http://localhost/api/nfl/drafts/${completed.id}/simulate`, {
        method: 'POST',
        body: JSON.stringify({ fullGauntlet: false }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: { id: completed.id } },
    );
    expect(response.status).toBe(201);
    const payload = await json<{
      result: {
        season: { seed: string; stages: readonly { games: readonly unknown[] }[] };
        trophies: readonly unknown[];
        mvp: { rating: number };
      };
    }>(response);
    expect(payload.result.season.stages[0]?.games).toHaveLength(17);
    expect(Array.isArray(payload.result.trophies)).toBe(true);
    const maxRating = Math.max(
      ...Object.values(completed.draft.picks).map((pick) => pick.rating?.overall ?? 0),
    );
    expect(payload.result.mvp.rating).toBe(maxRating);

    const duplicate = await simulate(
      new Request(`http://localhost/api/nfl/drafts/${completed.id}/simulate`, { method: 'POST' }),
      { params: { id: completed.id } },
    );
    expect(duplicate.status).toBe(409);
    const resultResponse = await getResult(
      new Request(`http://localhost/api/nfl/drafts/${completed.id}/result`),
      { params: { id: completed.id } },
    );
    expect(resultResponse.status).toBe(200);
    const resultPayload = await json<{ result: { season: { seed: string } } }>(resultResponse);
    expect(resultPayload.result.season.seed).toBe(payload.result.season.seed);
  });

  it('enforces seed overrides and renders the result OG image', async () => {
    vi.stubEnv('PERFECT_SEASON_ALLOW_SEED_OVERRIDE', '');
    const completed = await completeDraft();
    const disabled = await simulate(
      new Request(`http://localhost/api/nfl/drafts/${completed.id}/simulate`, {
        method: 'POST',
        body: JSON.stringify({ seed: 'route-test-seed' }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: { id: completed.id } },
    );
    expect(disabled.status).toBe(400);

    vi.stubEnv('PERFECT_SEASON_ALLOW_SEED_OVERRIDE', '1');
    const enabled = await simulate(
      new Request(`http://localhost/api/nfl/drafts/${completed.id}/simulate`, {
        method: 'POST',
        body: JSON.stringify({ fullGauntlet: false, seed: 'route-test-seed' }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: { id: completed.id } },
    );
    expect(enabled.status).toBe(201);
    const og = await getOg(new Request(`http://localhost/api/nfl/drafts/${completed.id}/og`), {
      params: { id: completed.id },
    });
    expect(og.status).toBe(200);
    expect(og.headers.get('content-type')?.startsWith('image/png')).toBe(true);
    vi.unstubAllEnvs();
  });
});
