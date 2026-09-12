import { describe, expect, it } from 'vitest';
import { POST as createDraft } from './route';
import { GET as getDraft } from './[id]/route';
import { POST as pick } from './[id]/picks/route';
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
    expect((await spin(new Request(easySpin))).status).toBe(200);
    expect((await spin(new Request(`${easySpin}&reroll=1`))).status).toBe(200);
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
});
