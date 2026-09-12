import type { SportId } from '@perfect-season/sport-engine-core';

export type { SportId };

export const GUEST_COOKIE = 'ps_guest';
export const SPORT_COOKIE = 'ps_sport';
export const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export const SPORT_IDS: readonly SportId[] = ['nfl', 'cfb'];

export interface SportOption {
  readonly id: SportId;
  readonly label: string;
  readonly longLabel: string;
  /** The in-product chase phrase that lives under the "Perfect Season" umbrella (spec §8). */
  readonly chase: string;
  readonly available: boolean;
}

export const SPORTS: Readonly<Record<SportId, SportOption>> = {
  nfl: { id: 'nfl', label: 'NFL', longLabel: 'NFL', chase: 'Chase 17-0', available: true },
  cfb: {
    id: 'cfb',
    label: 'CFB',
    longLabel: 'College Football',
    chase: 'Chase Undefeated & Untied',
    available: true,
  },
};

export function isSportId(value: unknown): value is SportId {
  return typeof value === 'string' && (SPORT_IDS as readonly string[]).includes(value);
}

/** Minimal view of a draft that the sport-selector rule needs. */
export interface DraftProgress {
  readonly sportId: SportId;
  readonly status: 'in_progress' | 'complete' | 'abandoned';
  readonly pickCount: number;
  readonly simulated: boolean;
}

/**
 * Spec §0.5 hard rule: a draft's sport_id is immutable once picks exist. The toggle is locked
 * while such a draft is still live (not abandoned, season not yet simulated).
 */
export function isSportLocked(draft: DraftProgress | null): boolean {
  if (draft === null) return false;
  if (draft.status === 'abandoned' || draft.simulated) return false;
  return draft.pickCount > 0;
}

export const SPORT_LOCK_MESSAGE = 'Finish or abandon this draft to switch sports.';

/** The sport a route belongs to, e.g. /play/cfb/results/x → 'cfb'; null off /play/*. */
export function routeSportFromPathname(pathname: string): SportId | null {
  const match = /^\/play\/(nfl|cfb)(\/|$)/.exec(pathname);
  return match === null ? null : (match[1] as SportId);
}
