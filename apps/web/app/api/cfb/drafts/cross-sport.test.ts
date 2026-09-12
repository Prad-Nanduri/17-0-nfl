import { describe, expect, it } from 'vitest';
import { POST as createCfbDraft } from './route';
import { POST as createNflDraft } from '../../nfl/drafts/route';
import { POST as pickCfb } from './[id]/picks/route';
import { POST as abandonCfb } from './[id]/abandon/route';
import { GET as spinCfb } from '../spin/route';
import { PATCH as patchSession } from '../../session/route';
import { SPORT_LOCK_MESSAGE } from '../../../../lib/sport';

const guest = 'cross-sport-guest-1';
const headers = { 'content-type': 'application/json', cookie: `ps_guest=${guest}` };

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

describe('Cross-sport draft locking (spec §0.5)', () => {
  it('locks another sport while a draft has picks, then unlocks after abandon', async () => {
    const nflCreate = await createNflDraft(
      new Request('http://localhost/api/nfl/drafts', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          draftOrder: 'squad_first',
          difficulty: 'normal',
          ratingMode: 'career_season',
          schemeId: '4-3',
        }),
      }),
    );
    expect(nflCreate.status).toBe(201);
    const nflId = (await json<{ draft: { id: string } }>(nflCreate)).draft.id;

    const spin = await (
      await import('../../nfl/spin/route')
    ).GET(
      new Request(`http://localhost/api/nfl/spin?draftId=${nflId}`, {
        headers: { cookie: `ps_guest=${guest}` },
      }),
    );
    const spinPayload = await json<{
      spin: {
        spinSeed: string;
        candidates: readonly { playerId: string; eligibleSlots: readonly { slotCode: string }[] }[];
      };
    }>(spin);
    const candidate = spinPayload.spin.candidates[0];
    const pickResponse = await (
      await import('../../nfl/drafts/[id]/picks/route')
    ).POST(
      new Request(`http://localhost/api/nfl/drafts/${nflId}/picks`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          slotCode: candidate?.eligibleSlots[0]?.slotCode,
          playerId: candidate?.playerId,
          spinSeed: spinPayload.spin.spinSeed,
        }),
      }),
      { params: { id: nflId } },
    );
    expect(pickResponse.status).toBe(200);

    const wrongSport = await pickCfb(
      new Request(`http://localhost/api/cfb/drafts/${nflId}/picks`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ slotCode: 'QB1', playerId: 'x', spinSeed: 'x' }),
      }),
      { params: { id: nflId } },
    );
    expect(wrongSport.status).toBe(409);
    expect(await json<{ error: string }>(wrongSport)).toEqual({
      error: 'Draft belongs to a different sport',
    });

    const locked = await createCfbDraft(
      new Request('http://localhost/api/cfb/drafts', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          draftOrder: 'squad_first',
          difficulty: 'normal',
          ratingMode: 'career_season',
          schemeId: '4-3',
        }),
      }),
    );
    expect(locked.status).toBe(409);
    expect(await json<{ error: string }>(locked)).toEqual({ error: SPORT_LOCK_MESSAGE });

    const patch = await patchSession(
      new Request('http://localhost/api/session', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ sport: 'cfb' }),
      }),
    );
    expect(patch.status).toBe(409);

    const abandoned = await abandonCfb(
      new Request(`http://localhost/api/nfl/drafts/${nflId}/abandon`, { method: 'POST', headers }),
      { params: { id: nflId } },
    );
    // abandon must go through the NFL route; the CFB route correctly rejects it as wrong sport
    expect(abandoned.status).toBe(409);

    const abandonNfl = await (
      await import('../../nfl/drafts/[id]/abandon/route')
    ).POST(
      new Request(`http://localhost/api/nfl/drafts/${nflId}/abandon`, { method: 'POST', headers }),
      { params: { id: nflId } },
    );
    expect(abandonNfl.status).toBe(200);

    const unlocked = await createCfbDraft(
      new Request('http://localhost/api/cfb/drafts', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          draftOrder: 'squad_first',
          difficulty: 'normal',
          ratingMode: 'career_season',
          schemeId: '4-3',
        }),
      }),
    );
    expect(unlocked.status).toBe(201);
    void spinCfb;
  });
});
