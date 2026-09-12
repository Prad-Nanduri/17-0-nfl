import { NextResponse } from 'next/server';

export function withJsonErrors<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response> | Response,
): (...args: Args) => Promise<Response> {
  return async (...args) => {
    try {
      return await handler(...args);
    } catch (error) {
      console.error('[api] unhandled error', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  };
}
