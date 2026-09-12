import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, fetchJson } from './api-client';

function stubResponse(status: number, body: string, ok = status >= 200 && status < 300) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(body, { status })),
  );
  void ok;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchJson', () => {
  it('returns the parsed payload for an OK JSON response', async () => {
    stubResponse(200, JSON.stringify({ draft: { id: 'd1' } }));
    const payload = await fetchJson<{ draft: { id: string } }>('/api/nfl/drafts');
    expect(payload.draft.id).toBe('d1');
  });

  it('throws ApiError with the server error message on 400', async () => {
    stubResponse(400, JSON.stringify({ error: 'Invalid ratingMode' }));
    const caught = await fetchJson('/api/nfl/drafts', { method: 'POST' }).catch(
      (error: unknown) => error,
    );
    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).message).toBe('Invalid ratingMode');
    expect((caught as ApiError).status).toBe(400);
  });

  it('throws a friendly ApiError on 500 with an empty body', async () => {
    stubResponse(500, '');
    const caught = await fetchJson('/api/nfl/drafts', { method: 'POST' }).catch(
      (error: unknown) => error,
    );
    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).message).toBe('Server error (500). Please try again.');
    expect((caught as ApiError).status).toBe(500);
  });

  it('throws on a 200 with a non-JSON body', async () => {
    stubResponse(200, '<html>');
    const caught = await fetchJson('/api/session').catch((error: unknown) => error);
    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).message).toBe('Server returned an invalid response');
  });
});
