import { NextResponse } from 'next/server';
import { isAuthConfigured, supabaseMagicLink } from '../../../../lib/server/auth';
import { linkGuestToAccount, getSessionStore } from '../../../../lib/server/session-store';
import { readGuestToken, readSportCookie } from '../../../../lib/server/session';
import { COOKIE_MAX_AGE_SECONDS, SPORT_COOKIE } from '../../../../lib/sport';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function accountRedirect(request: Request, status: 'linked' | 'invalid' | 'disabled' | 'noguest') {
  return NextResponse.redirect(new URL(`/account?status=${status}`, request.url));
}

/**
 * Magic-link landing. Verifies the Supabase token, links the guest session to the account, and
 * pre-selects the account's `default_sport` (spec §0.5) via the sport cookie.
 */
export async function GET(request: Request) {
  if (!isAuthConfigured()) return accountRedirect(request, 'disabled');
  const guestToken = readGuestToken(request);
  if (guestToken === null) return accountRedirect(request, 'noguest');
  const tokenHash = new URL(request.url).searchParams.get('token_hash');
  if (!tokenHash) return accountRedirect(request, 'invalid');
  const verified = await supabaseMagicLink().verify(tokenHash);
  if (verified === null) return accountRedirect(request, 'invalid');
  const { user } = await linkGuestToAccount(
    getSessionStore(),
    guestToken,
    verified.email,
    readSportCookie(request) ?? 'nfl',
  );
  const response = accountRedirect(request, 'linked');
  if (user.defaultSport !== null) {
    response.cookies.set(SPORT_COOKIE, user.defaultSport, {
      path: '/',
      maxAge: COOKIE_MAX_AGE_SECONDS,
      sameSite: 'lax',
    });
  }
  return response;
}
