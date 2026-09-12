import type {
  CompletedRoster,
  OpponentContext,
  PlayerCandidate,
  PositionRating,
  RosterPick,
} from '@perfect-season/sport-engine-core';
import { createRng } from '@perfect-season/sport-engine-core/utils';
import { CFB_SCHEME_PRESETS } from '../src/schemes';
import { CfbSportEngine } from '../src/engine';
import { loadCfbFixtureData } from '../src/data';
import { rateSeason } from '../src/ratings/rate-season';
import type { CfbFixtureData } from '../src/data';
import { loadFixtureRawSeason } from '../etl/fixtures';
import { transformSeason } from '../etl/transform';

const SEED = 'cfb-quick-season-e2e';

// Prefer a real ingested data dir when PERFECT_SEASON_CFB_DATA_DIR is set;
// otherwise derive a demo dataset from the checked-in CFBD fixtures.
function loadDemoData(): CfbFixtureData {
  if (process.env.PERFECT_SEASON_CFB_DATA_DIR !== undefined) {
    return loadCfbFixtureData();
  }
  const output = transformSeason(loadFixtureRawSeason(2023), 2023);
  return {
    conferences: output.conferences,
    teams: output.teams,
    programSeasons: output.programSeasons,
    players: output.players,
    ratings: rateSeason(output.playerSeasonStats, output.teamLineStats),
  };
}

const data = loadDemoData();
const engine = new CfbSportEngine(data);
console.log(
  `dataset: ${data.teams.length} teams, ${data.programSeasons.length} program-seasons, ` +
    `${data.players.length} players, ${data.ratings.length} ratings`,
);

const unit = await engine.resolveSpinUnit(SEED, { modeId: 'core', criteria: {} });
if (unit.sportId !== 'cfb') throw new Error('expected a CFB pool unit');
console.log(`spin unit: ${engine.describeSpinUnit(unit).title}`);

// Fill every '4-3' slot with an eligible fixture player where possible.
const scheme = CFB_SCHEME_PRESETS.find((preset) => preset.id === '4-3');
if (scheme === undefined) throw new Error('missing 4-3 preset');
const usedPlayers = new Set<string>();
const ratingRng = createRng('cfb-e2e-synthetic-ratings');
let syntheticCount = 0;
const picks: RosterPick[] = scheme.slots.map((slot, index) => {
  const player = data.players.find(
    (candidate) =>
      !usedPlayers.has(candidate.cfbdPlayerId) &&
      engine.validateSlotEligibility(
        {
          playerId: candidate.cfbdPlayerId,
          fullName: candidate.fullName,
          primaryPosition: candidate.primaryPosition,
          poolUnit: unit,
          seasons: [],
          traits: {},
        },
        slot,
      ).eligible === true,
  );
  const candidate: PlayerCandidate =
    player === undefined
      ? {
          playerId: `synthetic-${index}`,
          fullName: `Synthetic ${slot.code}`,
          // positionGroup maps to itself, so synthetic candidates always rate.
          primaryPosition: slot.positionGroup,
          poolUnit: unit,
          seasons: [],
          traits: {},
        }
      : {
          playerId: player.cfbdPlayerId,
          fullName: player.fullName,
          primaryPosition: player.primaryPosition,
          poolUnit: unit,
          seasons: [
            {
              poolUnit: unit,
              position: player.primaryPosition,
              confidenceTier: 'full_feature',
              stats: {},
            },
          ],
          traits: {},
        };
  if (player === undefined) syntheticCount += 1;
  else usedPlayers.add(player.cfbdPlayerId);
  const rating: PositionRating =
    player === undefined
      ? {
          // Demo-only: synthesized gap candidates get a realistic mid-tier
          // rating drawn deterministically so the roster lands near ~70.
          positionGroup: slot.positionGroup,
          mode: 'career_season',
          overall: 60 + ratingRng.integer(0, 26),
          sourceSeason: unit.season,
          confidenceTier: 'full_feature',
          isTeamLevelProxy: false,
          modelVersion: 'cfb-e2e',
        }
      : engine.computeRating(candidate, 'career_season');
  return {
    slot,
    candidate,
    rating,
    spinSeed: `${SEED}-${index}`,
  };
});
console.log(`roster: ${picks.length} slots filled (${syntheticCount} synthetic)`);

const roster = {
  draftId: 'cfb-quick-season-e2e',
  sportId: 'cfb',
  schemeId: '4-3',
  ratingMode: 'career_season',
  picks,
} as unknown as CompletedRoster;

const context: OpponentContext = {
  season: unit.season,
  modelVersion: 'cfb-e2e',
  dataVersion: 'fixture',
  opponents: [],
  facts: {},
};

const result = await engine.simulateSeason(
  roster,
  { modeId: 'core', difficulty: 'normal', seed: SEED, options: {} },
  context,
);

console.log(`roster rating: ${String(result.facts.rosterRating)}`);
const regular = result.stages[0];
if (regular === undefined) throw new Error('missing regular season stage');
const schoolById = new Map(data.teams.map((team) => [String(team.cfbdTeamId), team.school]));
for (const game of regular.games) {
  const opponentName = schoolById.get(game.opponentId) ?? game.opponentId;
  console.log(
    `  ${game.site.padEnd(7)} vs ${opponentName.padEnd(24)} ` +
      `[${String(game.facts.flavor ?? 'unflavored')}] ${game.pointsFor}-${game.pointsAgainst} ${game.outcome}`,
  );
}
console.log(
  `record: ${result.record.wins}-${result.record.losses}` +
    (result.record.ties > 0 ? `-${result.record.ties}` : ''),
);
const trophies = engine.evaluateTrophies(result, {
  userId: null,
  roster,
  priorResults: [],
  earnedTrophies: [],
  evaluatedAt: new Date().toISOString(),
  facts: {},
});
console.log(`trophies: ${trophies.map((trophy) => trophy.code).join(', ') || '(none)'}`);

const failures: string[] = [];
if (regular.games.length !== 12) failures.push(`expected 12 games, got ${regular.games.length}`);
if (result.record.wins + result.record.losses !== 12)
  failures.push(`wins+losses ${result.record.wins + result.record.losses} !== 12`);
if (result.record.ties !== 0) failures.push('ties !== 0');
if (result.stages.length !== 1) failures.push(`expected 1 stage, got ${result.stages.length}`);
if (result.postseasonResult !== null)
  failures.push(`postseasonResult ${String(result.postseasonResult)} !== null`);
if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  process.exit(1);
}
console.log('quick-season e2e assertions passed');
