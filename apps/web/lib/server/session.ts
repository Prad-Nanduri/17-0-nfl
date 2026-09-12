import type { SportId } from '@perfect-season/sport-engine-core';
import { GUEST_COOKIE, SPORT_COOKIE, isSportId } from '../sport';
import type { DraftState } from './draft-store';
import { getDraftStore } from './draft-store';
import type { SessionRecord, UserRecord } from './session-store';
import { getSessionStore } from './session-store';

export function parseCookies(header: string | null): Readonly<Record<string, string>> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    const name = part.slice(0, index).trim();
    if (!name) continue;
    try {
      out[name] = decodeURIComponent(part.slice(index + 1).trim());
    } catch {
      out[name] = part.slice(index + 1).trim();
    }
  }
  return out;
}

export function readGuestToken(request: Request): string | null {
  return parseCookies(request.headers.get('cookie'))[GUEST_COOKIE] ?? null;
}

export function readSportCookie(request: Request): SportId | null {
  const value = parseCookies(request.headers.get('cookie'))[SPORT_COOKIE];
  return isSportId(value) ? value : null;
}

/** The guest's live draft, if any: the newest one that is neither abandoned nor simulated. */
export function findActiveDraft(guestToken: string): DraftState | null {
  const drafts = getDraftStore()
    .listByGuest(guestToken)
    .filter((draft) => draft.status !== 'abandoned' && draft.result === null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return drafts[0] ?? null;
}

export interface ResolvedSession {
  readonly guestToken: string | null;
  readonly session: SessionRecord | null;
  readonly user: UserRecord | null;
  readonly activeDraft: DraftState | null;
  readonly sportCookie: SportId | null;
}

export function resolveSession(request: Request): ResolvedSession {
  const guestToken = readGuestToken(request);
  const sportCookie = readSportCookie(request);
  if (guestToken === null) {
    return { guestToken, session: null, user: null, activeDraft: null, sportCookie };
  }
  const store = getSessionStore();
  const session = store.touch(guestToken);
  const user = session.userId === null ? null : (store.getUser(session.userId) ?? null);
  return { guestToken, session, user, activeDraft: findActiveDraft(guestToken), sportCookie };
}

/** Drafts are visible only to the guest token that created them (legacy drafts without one stay open). */
export function draftBelongsTo(draft: DraftState, request: Request): boolean {
  return draft.guestToken === null || draft.guestToken === readGuestToken(request);
}
