import type { SportId } from '@perfect-season/sport-engine-core';

// One polymorphic simulation service driving SportEngine.simulateSeason() for
// both sports (docs/spec.md §5.4) — implementation lands in a later PR.
export type SimulateRequest = { sportId: SportId };
