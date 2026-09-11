import type { SportEngine } from './index';
import type { SportId } from './types';

export type SportEngineRegistry = Readonly<Record<SportId, SportEngine>> & {
  get(sportId: SportId): SportEngine;
};

export function createSportEngineRegistry(
  engines: Record<SportId, SportEngine>,
): SportEngineRegistry {
  const registered: Record<SportId, SportEngine> = Object.freeze({
    nfl: engines.nfl,
    cfb: engines.cfb,
  });
  for (const [sportId, engine] of Object.entries(registered)) {
    if (!engine || engine.sportId !== sportId || engine.rosterSlotCount !== 24) {
      throw new Error(`Invalid SportEngine registration for ${sportId}`);
    }
  }
  return Object.freeze({
    ...registered,
    get(sportId: SportId): SportEngine {
      if (!Object.hasOwn(registered, sportId)) {
        throw new Error(`Unregistered sport: ${sportId}`);
      }
      return registered[sportId];
    },
  });
}
