import { describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';
import { withJsonErrors } from './json-route';

describe('withJsonErrors', () => {
  it('returns a JSON 500 when the handler throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const handler = withJsonErrors(async () => {
      throw new Error('boom');
    });
    const response = await handler();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Internal server error' });
  });

  it('passes through the handler response untouched', async () => {
    const ok = NextResponse.json({ sent: true }, { status: 201 });
    const handler = withJsonErrors(() => ok);
    const response = await handler();
    expect(response).toBe(ok);
    expect(response.status).toBe(201);
  });
});
