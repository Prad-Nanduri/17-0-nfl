import type { SportId } from '@perfect-season/sport-engine-core';

export const SPORT_ID = 'nfl' as const satisfies SportId;

// NflSportEngine implementing SportEngine (docs/spec.md §0.1) lands in a later PR.
