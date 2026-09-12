import { createSportEngineRegistry } from '@perfect-season/sport-engine-core';
import { NflSportEngine } from '@perfect-season/sport-engine-nfl';
import { describe, expect, it } from 'vitest';
import { CfbSportEngine } from './engine';

describe('SportEngineRegistry (spec §0.1, §6)', () => {
  it('registers CFB and NFL engines side by side', () => {
    const registry = createSportEngineRegistry({
      nfl: new NflSportEngine({ franchises: [], franchiseSeasons: [], ratings: [] }),
      cfb: new CfbSportEngine({
        conferences: [],
        teams: [],
        programSeasons: [],
        ratings: [],
      }),
    });
    expect(registry.get('cfb').displayName).toBe('College Football (FBS)');
    expect(registry.get('nfl').sportId).toBe('nfl');
  });
});
