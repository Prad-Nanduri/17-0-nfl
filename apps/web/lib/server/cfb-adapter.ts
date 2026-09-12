import type {
  CompletedRoster,
  DraftPoolUnit,
  PlayerCandidate,
} from '@perfect-season/sport-engine-core';
import { createSeed } from '@perfect-season/sport-engine-core/utils';
import type { CfbFixtureData, CfbSportEngine } from '@perfect-season/sport-engine-cfb';
import { CFB_RATING_MODEL_VERSION, describeConference } from '@perfect-season/sport-engine-cfb';
import { getCfbData, getCfbEngine } from './sport-engines';
import type { CfbDraftPoolUnit, DraftState } from './draft-store';
import type { SportDraftAdapter } from './sport-adapter';

export const CFB_SIMULATION_MODEL_VERSION = 'cfb-sim-v1';
export const CFB_SIMULATION_DATA_VERSION = '2023-fixtures';

function assertCfbUnit(unit: DraftPoolUnit): CfbDraftPoolUnit {
  if (unit.sportId !== 'cfb') throw new Error('Expected a CFB draft pool unit');
  return unit;
}

const CFB_FALLBACK_POSITIONS = [
  'QB',
  'RB',
  'WR',
  'TE',
  'OT',
  'OG',
  'C',
  'DE',
  'DT',
  'ILB',
  'OLB',
  'CB',
  'S',
  'K',
  'P',
] as const;

function buildCfbCandidates(unit: CfbDraftPoolUnit, data: CfbFixtureData): PlayerCandidate[] {
  const ratings = data.ratings.filter(
    (rating) => rating.cfbdTeamId === Number(unit.programId) && rating.season === unit.season,
  );
  const players = new Map(data.players.map((player) => [player.cfbdPlayerId, player]));
  const seen = new Set<string>();
  const candidates = ratings.flatMap((rating) => {
    if (seen.has(rating.cfbdPlayerId)) return [];
    seen.add(rating.cfbdPlayerId);
    const player = players.get(rating.cfbdPlayerId);
    if (player === undefined) return [];
    return [
      {
        playerId: player.cfbdPlayerId,
        fullName: player.fullName,
        primaryPosition: player.primaryPosition,
        poolUnit: unit,
        seasons: [
          {
            poolUnit: unit,
            position: player.primaryPosition,
            confidenceTier: rating.confidenceTier,
            stats: {},
          },
        ],
        traits: {
          isTeamLevelProxy: rating.isTeamLevelProxy,
          badges: rating.badges,
          headshotUrl: null,
        },
      },
    ];
  });
  const school =
    data.teams.find((team) => team.cfbdTeamId === Number(unit.programId))?.school ?? 'Program';
  return [
    ...candidates,
    ...CFB_FALLBACK_POSITIONS.map((position, index) => ({
      playerId: `cfb-proxy-${unit.programId}-${unit.season}-${position}-${index}`,
      fullName: `${school} ${position}`,
      primaryPosition: position,
      poolUnit: unit,
      seasons: [{ poolUnit: unit, position, confidenceTier: 'legacy' as const, stats: {} }],
      traits: {
        isTeamLevelProxy:
          position === 'OT' ||
          position === 'OG' ||
          position === 'C' ||
          position === 'DE' ||
          position === 'DT',
        badges:
          position === 'OT' ||
          position === 'OG' ||
          position === 'C' ||
          position === 'DE' ||
          position === 'DT'
            ? ['Team-Level Rating']
            : [],
        headshotUrl: null,
      },
    })),
  ];
}

function completedRoster(
  state: DraftState,
  engine: CfbSportEngine,
  data: CfbFixtureData,
): CompletedRoster {
  const scheme = engine.getSchemePresets().find((item) => item.id === state.schemeId);
  if (scheme === undefined) throw new Error(`Unknown CFB scheme: ${state.schemeId}`);
  const picks = scheme.slots.map((slot) => {
    const stored = state.picks[slot.code];
    if (stored === undefined) throw new Error(`Missing completed pick for ${slot.code}`);
    const candidates = buildCfbCandidates(assertCfbUnit(stored.unit), data);
    const candidate = candidates.find((item) => item.playerId === stored.playerId);
    if (candidate === undefined) throw new Error(`Missing candidate for ${stored.playerId}`);
    return { slot, candidate, rating: stored.rating, spinSeed: stored.spinSeed };
  });
  return {
    draftId: state.id,
    sportId: 'cfb',
    schemeId: state.schemeId,
    ratingMode: state.ratingMode,
    picks: picks as unknown as CompletedRoster['picks'],
  };
}

export function createCfbAdapter(): SportDraftAdapter {
  return {
    sportId: 'cfb',
    engine: () => getCfbEngine(),
    buildCandidates: (unit) => buildCfbCandidates(assertCfbUnit(unit), getCfbData()),
    availableSeasons: () => {
      const seasons = getCfbData()
        .programSeasons.map((row) => row.season)
        .sort((a, b) => a - b);
      return { from: seasons[0] ?? 2005, through: seasons.at(-1) ?? 2023 };
    },
    spinUnitView: async (unit) => {
      const cfb = assertCfbUnit(unit);
      const data = getCfbData();
      const team = data.teams.find((item) => item.cfbdTeamId === Number(cfb.programId));
      if (team === undefined) throw new Error('Program not found');
      const season = data.programSeasons.find(
        (item) => item.cfbdTeamId === Number(cfb.programId) && item.season === cfb.season,
      );
      const current = data.programSeasons.find(
        (item) => item.cfbdTeamId === Number(cfb.programId) && item.membershipStatus === 'fbs',
      );
      const conference = describeConference(
        cfb.conferenceId,
        current?.conferenceKey ?? null,
        data.conferences,
      );
      return {
        key: String(team.cfbdTeamId),
        name: team.school,
        abbreviation: team.abbreviation,
        conference: conference.label,
        logoUrl: team.logoUrl,
        record:
          season?.wins === null || season?.wins === undefined
            ? null
            : { wins: season.wins, losses: season.losses ?? 0, ties: 0 },
        eraTier: season?.eraTier ?? 'legacy',
        color: team.color,
        alternateColor: team.alternateColor,
      };
    },
    opponentContext: (unit) => ({
      season: unit?.sportId === 'cfb' ? unit.season : 2023,
      modelVersion: CFB_SIMULATION_MODEL_VERSION,
      dataVersion: CFB_SIMULATION_DATA_VERSION,
      opponents: [],
      facts: {},
    }),
    simSeed: (draftId) => createSeed('cfb-sim', draftId),
    simulationOptions: (input) => {
      if (input.fullCampaign === true) throw new Error('Full Campaign is not available yet');
      return {};
    },
    buildCompletedRoster: (state) => completedRoster(state, getCfbEngine(), getCfbData()),
    toClientPick: (pick, ratingHidden) => ({ ...pick, rating: ratingHidden ? null : pick.rating }),
    pickMvp: (state, scheme) => {
      const picks = scheme.slots
        .map((slot) => state.picks[slot.code])
        .filter((pick): pick is NonNullable<typeof pick> => pick !== undefined);
      const mvp = picks.reduce(
        (best, pick) => (best === null || pick.rating.overall > best.rating.overall ? pick : best),
        null as (typeof picks)[number] | null,
      );
      if (mvp === null) throw new Error('Cannot choose an MVP without completed picks');
      return {
        slotCode: mvp.slotCode,
        playerId: mvp.playerId,
        fullName: mvp.fullName,
        primaryPosition: mvp.primaryPosition,
        headshotUrl: mvp.headshotUrl,
        rating: mvp.rating.overall,
        unit: mvp.unit,
      };
    },
  };
}

void CFB_RATING_MODEL_VERSION;
