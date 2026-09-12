import { NextResponse } from 'next/server';
import type { SportId } from '@perfect-season/sport-engine-core';
import { resolveSession } from '../../../lib/server/session';
import { withJsonErrors } from '../../../lib/server/json-route';
import {
  COOKIE_MAX_AGE_SECONDS,
  SPORT_COOKIE,
  SPORT_LOCK_MESSAGE,
  isSportId,
  isSportLocked,
} from '../../../lib/sport';
import type { DraftProgress } from '../../../lib/sport';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface ClientSession {
  readonly guest: boolean;
  readonly user: { readonly email: string | null; readonly defaultSport: SportId | null } | null;
  /** Effective sport: explicit cookie choice, else the account default, else NFL. */
  readonly sport: SportId;
  readonly activeDraft: (DraftProgress & { readonly id: string }) | null;
}

async function toClientSession(request: Request): Promise<ClientSession> {
  const resolved = await resolveSession(request);
  const user = resolved.user;
  const activeDraft = resolved.activeDraft;
  return {
    guest: resolved.guestToken !== null && user === null,
    user: user ? { email: user.email, defaultSport: user.defaultSport } : null,
    sport: resolved.sportCookie ?? user?.defaultSport ?? 'nfl',
    activeDraft: activeDraft
      ? {
          id: activeDraft.id,
          sportId: activeDraft.sportId,
          status: activeDraft.status,
          pickCount: Object.keys(activeDraft.picks).length,
          simulated: activeDraft.result !== null,
        }
      : null,
  };
}

export const GET = withJsonErrors(async (request: Request) =>
  NextResponse.json({ session: await toClientSession(request) }),
);

export const PATCH = withJsonErrors(async (request: Request) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 });
  }
  const { sport } = (body ?? {}) as { sport?: unknown };
  if (!isSportId(sport)) return NextResponse.json({ error: 'Invalid sport' }, { status: 400 });
  const current = await toClientSession(request);
  if (isSportLocked(current.activeDraft) && current.activeDraft?.sportId !== sport) {
    return NextResponse.json({ error: SPORT_LOCK_MESSAGE }, { status: 409 });
  }
  const response = NextResponse.json({ session: { ...current, sport } });
  response.cookies.set(SPORT_COOKIE, sport, {
    path: '/',
    maxAge: COOKIE_MAX_AGE_SECONDS,
    sameSite: 'lax',
  });
  return response;
});
