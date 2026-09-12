const BASE = process.env.PS_BASE_URL ?? 'http://localhost:3000';
const guest = `cross-sport-${Date.now()}`;
const headers = { 'content-type': 'application/json', cookie: `ps_guest=${guest}` };

async function request(label: string, path: string, init: RequestInit) {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...headers, ...((init.headers as Record<string, string>) ?? {}) },
  });
  const body = await response.text();
  console.log(`${label}: ${init.method} ${path} -> ${response.status} ${body.slice(0, 300)}`);
  return { response, body };
}

async function main() {
  const created = await request('nfl-create', '/api/nfl/drafts', {
    method: 'POST',
    body: JSON.stringify({
      draftOrder: 'squad_first',
      difficulty: 'normal',
      ratingMode: 'career_season',
      schemeId: '4-3',
    }),
  });
  const nflId = (JSON.parse(created.body) as { draft: { id: string } }).draft.id;
  const spin = await request('nfl-spin', `/api/nfl/spin?draftId=${nflId}`, { method: 'GET' });
  const spinPayload = JSON.parse(spin.body) as {
    spin: {
      spinSeed: string;
      candidates: readonly { playerId: string; eligibleSlots: readonly { slotCode: string }[] }[];
    };
  };
  const candidate = spinPayload.spin.candidates[0];
  await request('nfl-pick', `/api/nfl/drafts/${nflId}/picks`, {
    method: 'POST',
    body: JSON.stringify({
      slotCode: candidate?.eligibleSlots[0]?.slotCode,
      playerId: candidate?.playerId,
      spinSeed: spinPayload.spin.spinSeed,
    }),
  });
  await request('cfb-pick-on-nfl-id', `/api/cfb/drafts/${nflId}/picks`, {
    method: 'POST',
    body: JSON.stringify({ slotCode: 'QB1', playerId: 'x', spinSeed: 'x' }),
  });
  await request('cfb-create-while-locked', '/api/cfb/drafts', {
    method: 'POST',
    body: JSON.stringify({
      draftOrder: 'squad_first',
      difficulty: 'normal',
      ratingMode: 'career_season',
      schemeId: '4-3',
    }),
  });
  await request('session-patch-while-locked', '/api/session', {
    method: 'PATCH',
    body: JSON.stringify({ sport: 'cfb' }),
  });
  await request('nfl-abandon', `/api/nfl/drafts/${nflId}/abandon`, { method: 'POST' });
  await request('cfb-create-after-abandon', '/api/cfb/drafts', {
    method: 'POST',
    body: JSON.stringify({
      draftOrder: 'squad_first',
      difficulty: 'normal',
      ratingMode: 'career_season',
      schemeId: '4-3',
    }),
  });
}

void main();
