import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE_MAX_AGE_SECONDS, GUEST_COOKIE } from './lib/sport';

/**
 * No-signup play (spec §0.5): every first-time visitor gets an opaque guest token cookie that
 * maps to `sessions.guest_token`. Nothing else is required to start a draft.
 */
export function middleware(request: NextRequest) {
  if (request.cookies.has(GUEST_COOKIE)) return NextResponse.next();
  const token = crypto.randomUUID();
  const headers = new Headers(request.headers);
  headers.set('cookie', `${GUEST_COOKIE}=${token}; ${request.headers.get('cookie') ?? ''}`);
  const response = NextResponse.next({ request: { headers } });
  response.cookies.set(GUEST_COOKIE, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
  return response;
}

export const config = {
  matcher: ['/((?!_next/|_vercel/|logos/|images/|icon.svg|favicon.ico).*)'],
};
