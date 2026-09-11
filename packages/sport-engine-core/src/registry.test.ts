import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  createSportEngineRegistry,
  type DraftPoolUnit,
  type SportEngine,
  type SportId,
  type RosterLineup,
  type RosterPick,
} from './index';
import { createMockSportEngine } from '../test/mock-sport-engine';
import {
  candidate,
  earnedTrophy,
  makeRoster,
  opponents,
  poolUnit,
  rating,
  result,
  ruleset,
  scheme,
  simulationMode,
  trophy,
  trophyContext,
} from '../test/fixtures';

const secondUnit: DraftPoolUnit = {
  sportId: 'cfb',
  programId: '2',
  season: 2000,
  conferenceId: null,
};

describe('SportEngineRegistry', () => {
  it('is a complete Record with immutable bindings and a get accessor', () => {
    const engines = {
      nfl: createMockSportEngine(poolUnit),
      cfb: createMockSportEngine(secondUnit),
    };
    const registry = createSportEngineRegistry(engines);
    expectTypeOf(registry).toMatchTypeOf<Record<SportId, SportEngine>>();
    expectTypeOf<RosterLineup<RosterPick>['length']>().toEqualTypeOf<24>();
    expect(registry.get('nfl')).toBe(registry.nfl);
    expect(registry.get('cfb')).toBe(registry.cfb);
    expect(Object.isFrozen(registry)).toBe(true);
    const original = registry.nfl;
    engines.nfl = createMockSportEngine(poolUnit);
    expect(registry.get('nfl')).toBe(original);
  });

  it.each([poolUnit, secondUnit])('dispatches the entire contract for $sportId', async (unit) => {
    const mocks = { nfl: createMockSportEngine(poolUnit), cfb: createMockSportEngine(secondUnit) };
    const engine: SportEngine = createSportEngineRegistry(mocks).get(unit.sportId);
    const mock = mocks[unit.sportId];
    const filters = { modeId: ruleset.modeId, criteria: {} };
    const roster = makeRoster((pick) => pick, unit);
    const ctx = { ...trophyContext, roster };
    expect(engine.sportId).toBe(unit.sportId);
    expect(engine.displayName).toBe(`Mock ${unit.sportId}`);
    expect(engine.rosterSlotCount).toBe(24);
    expect(await engine.resolveSpinUnit('seed', filters)).toEqual(unit);
    expect(mock.resolveSpinUnit.mock.calls).toEqual([['seed', filters]]);
    expect(engine.getSchemePresets()).toEqual([scheme]);
    expect(mock.getSchemePresets.mock.calls).toEqual([[]]);
    expect(engine.validateSlotEligibility(roster.picks[0].candidate, roster.picks[0].slot)).toEqual(
      { eligible: true, warnings: [] },
    );
    expect(mock.validateSlotEligibility.mock.calls).toEqual([
      [roster.picks[0].candidate, roster.picks[0].slot],
    ]);
    expect(engine.computeRating(roster.picks[0].candidate, 'career_season')).toEqual(rating);
    expect(mock.computeRating.mock.calls).toEqual([[roster.picks[0].candidate, 'career_season']]);
    const season = await engine.simulateSeason(roster, simulationMode, opponents);
    expect(season).toEqual({ ...result, sportId: unit.sportId });
    expect(mock.simulateSeason.mock.calls).toEqual([[roster, simulationMode, opponents]]);
    expect(engine.getAvailableModes()).toEqual([
      { id: ruleset.modeId, name: 'Fixture mode', description: 'Test only' },
    ]);
    expect(mock.getAvailableModes.mock.calls).toEqual([[]]);
    expect(engine.getModeRuleset(ruleset.modeId)).toEqual(ruleset);
    expect(mock.getModeRuleset.mock.calls).toEqual([[ruleset.modeId]]);
    expect(engine.getTrophyDefinitions()).toEqual([trophy]);
    expect(mock.getTrophyDefinitions.mock.calls).toEqual([[]]);
    expect(engine.evaluateTrophies(season, ctx)).toEqual([earnedTrophy]);
    expect(mock.evaluateTrophies.mock.calls).toEqual([[season, ctx]]);
    for (const other of Object.values(mocks)) {
      if (other !== mock) {
        expect(other.resolveSpinUnit).not.toHaveBeenCalled();
        expect(other.simulateSeason).not.toHaveBeenCalled();
      }
    }
  });

  it('rejects swapped, missing, and invalid roster-count registrations', () => {
    const nfl = createMockSportEngine(poolUnit);
    const cfb = createMockSportEngine(secondUnit);
    expect(() => createSportEngineRegistry({ nfl: cfb, cfb: nfl })).toThrow(/registration/);
    // @ts-expect-error Exercise callers bypassing the TypeScript boundary.
    expect(() => createSportEngineRegistry({ nfl })).toThrow(/registration/);
    // @ts-expect-error The slot count is exactly 24.
    expect(() => createSportEngineRegistry({ nfl: { ...nfl, rosterSlotCount: 23 }, cfb })).toThrow(
      /registration/,
    );
  });

  it.each(['unknown', 'toString', '__proto__', 'get'])(
    'rejects invalid runtime sport %s',
    (sport) => {
      const registry = createSportEngineRegistry({
        nfl: createMockSportEngine(poolUnit),
        cfb: createMockSportEngine(secondUnit),
      });
      // @ts-expect-error Exercise unvalidated JSON input.
      expect(() => registry.get(sport)).toThrow(/Unregistered sport/);
    },
  );

  it('supports eligibility failures and propagates asynchronous engine errors', async () => {
    const mock = createMockSportEngine(poolUnit);
    mock.validateSlotEligibility.mockReturnValue({ eligible: false, reason: 'Fixture rejection' });
    expect(mock.validateSlotEligibility(candidate, scheme.slots[0])).toEqual({
      eligible: false,
      reason: 'Fixture rejection',
    });
    const registry = createSportEngineRegistry({
      nfl: mock,
      cfb: createMockSportEngine(secondUnit),
    });
    mock.resolveSpinUnit.mockRejectedValue(new Error('Pool unavailable'));
    await expect(
      registry.get('nfl').resolveSpinUnit('seed', { modeId: 'fixture', criteria: {} }),
    ).rejects.toThrow('Pool unavailable');
  });
});
