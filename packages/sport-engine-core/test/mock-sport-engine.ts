import { vi } from 'vitest';
import type { DraftPoolUnit, SportEngine } from '../src';
import { rating, result, ruleset, scheme, trophy, earnedTrophy } from './fixtures';

// Canned responses only: this proves the contract without implementing either sport's rules.
export function createMockSportEngine(unit: DraftPoolUnit) {
  return {
    sportId: unit.sportId,
    displayName: `Mock ${unit.sportId}`,
    rosterSlotCount: 24,
    resolveSpinUnit: vi.fn<SportEngine['resolveSpinUnit']>().mockResolvedValue(unit),
    getSchemePresets: vi.fn<SportEngine['getSchemePresets']>().mockReturnValue([scheme]),
    validateSlotEligibility: vi
      .fn<SportEngine['validateSlotEligibility']>()
      .mockReturnValue({ eligible: true, warnings: [] }),
    computeRating: vi.fn<SportEngine['computeRating']>().mockReturnValue(rating),
    simulateSeason: vi
      .fn<SportEngine['simulateSeason']>()
      .mockResolvedValue({ ...result, sportId: unit.sportId }),
    getAvailableModes: vi
      .fn<SportEngine['getAvailableModes']>()
      .mockReturnValue([{ id: ruleset.modeId, name: 'Fixture mode', description: 'Test only' }]),
    getModeRuleset: vi.fn<SportEngine['getModeRuleset']>().mockReturnValue(ruleset),
    getTrophyDefinitions: vi.fn<SportEngine['getTrophyDefinitions']>().mockReturnValue([trophy]),
    evaluateTrophies: vi.fn<SportEngine['evaluateTrophies']>().mockReturnValue([earnedTrophy]),
  } satisfies SportEngine;
}
