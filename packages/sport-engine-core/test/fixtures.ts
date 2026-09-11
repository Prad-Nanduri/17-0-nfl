import type {
  CompletedRoster,
  DraftPoolUnit,
  EarnedTrophy,
  ModeRuleset,
  OpponentContext,
  PlayerCandidate,
  PositionGroup,
  PositionRating,
  RosterLineup,
  RosterPick,
  SchemePreset,
  SeasonResult,
  SimulationMode,
  TrophyDefinition,
  TrophyEvalContext,
} from '../src';

export const poolUnit: DraftPoolUnit = {
  sportId: 'nfl',
  franchiseId: '9007199254740993',
  season: 2000,
};

export function lineup<T>(item: (index: number) => T): RosterLineup<T> {
  return [
    item(0),
    item(1),
    item(2),
    item(3),
    item(4),
    item(5),
    item(6),
    item(7),
    item(8),
    item(9),
    item(10),
    item(11),
    item(12),
    item(13),
    item(14),
    item(15),
    item(16),
    item(17),
    item(18),
    item(19),
    item(20),
    item(21),
    item(22),
    item(23),
  ];
}

const positions: RosterLineup<PositionGroup> = [
  'QB',
  'RB',
  'RB',
  'WR',
  'WR',
  'WR',
  'TE',
  'OL',
  'OL',
  'OL',
  'OL',
  'DL',
  'DL',
  'DL',
  'DL',
  'LB',
  'LB',
  'LB',
  'CB',
  'CB',
  'S',
  'S',
  'K',
  'P',
];

export const rating: PositionRating = {
  positionGroup: 'QB',
  mode: 'career_season',
  overall: 80,
  sourceSeason: 2000,
  confidenceTier: 'full_feature',
  isTeamLevelProxy: false,
  modelVersion: 'mock-v1',
};

export const candidate: PlayerCandidate = {
  playerId: '1',
  fullName: 'Fixture Player',
  primaryPosition: 'QB',
  poolUnit,
  seasons: [{ poolUnit, position: 'QB', confidenceTier: 'full_feature', stats: { sample: 1 } }],
  traits: {},
};

export function makeRoster(
  transform: (pick: RosterPick, index: number) => RosterPick = (pick) => pick,
  unit: DraftPoolUnit = poolUnit,
): CompletedRoster {
  return {
    draftId: '1',
    sportId: unit.sportId,
    schemeId: '4-3',
    ratingMode: 'career_season',
    picks: lineup((index) => {
      const positionGroup = positions[index];
      if (!positionGroup) throw new Error('Missing fixture position');
      const code = `${positionGroup}${index + 1}`;
      return transform(
        {
          slot: { code, positionGroup, eligiblePositions: [positionGroup] },
          candidate: {
            ...candidate,
            playerId: String(index + 1),
            primaryPosition: positionGroup,
            poolUnit: unit,
            seasons: [
              {
                poolUnit: unit,
                position: positionGroup,
                confidenceTier: 'full_feature',
                stats: {},
              },
            ],
          },
          rating: { ...rating, positionGroup },
          spinSeed: `fixture:${index}`,
        },
        index,
      );
    }),
  };
}

export const roster = makeRoster();
export const scheme: SchemePreset = {
  id: roster.schemeId,
  name: 'Fixture scheme',
  description: 'Test-only slot layout',
  slots: lineup((index) => {
    const pick = roster.picks[index];
    if (!pick) throw new Error('Missing fixture pick');
    return pick.slot;
  }),
};
export const simulationMode: SimulationMode = {
  modeId: 'fixture_mode',
  difficulty: 'normal',
  seed: 'fixture-simulation',
  options: { extended: true },
};
export const opponents: OpponentContext = {
  season: 2000,
  modelVersion: 'mock-v1',
  dataVersion: 'fixture-snapshot',
  opponents: [
    { id: 'synthetic-1', name: 'Fixture opponent', rating: 1500, site: 'neutral', facts: {} },
  ],
  facts: {},
};
export const result: SeasonResult = {
  draftId: roster.draftId,
  sportId: roster.sportId,
  modeId: simulationMode.modeId,
  seed: simulationMode.seed,
  modelVersion: opponents.modelVersion,
  dataVersion: opponents.dataVersion,
  record: { wins: 1, losses: 0, ties: 0 },
  pointsFor: 1,
  pointsAgainst: 0,
  postseasonResult: null,
  stages: [
    {
      id: 'regular',
      name: 'Fixture stage',
      games: [
        {
          opponentId: 'synthetic-1',
          site: 'neutral',
          pointsFor: 1,
          pointsAgainst: 0,
          outcome: 'win',
          facts: {},
        },
      ],
      record: { wins: 1, losses: 0, ties: 0 },
      outcome: 'complete',
    },
  ],
  facts: {},
};
export const ruleset: ModeRuleset = {
  modeId: simulationMode.modeId,
  draftOrders: ['squad_first', 'position_first'],
  ratingModes: ['career_season', 'prime'],
  schemeIds: ['4-3'],
  difficultyRules: {
    easy: { rerolls: 1, ratingsVisible: true, facts: {} },
    normal: { rerolls: 0, ratingsVisible: true, facts: {} },
    hard: { rerolls: 0, ratingsVisible: false, facts: {} },
  },
  defaultSimulationOptions: { extended: false },
  constraints: [],
};
export const trophy: TrophyDefinition = {
  code: 'fixture_trophy',
  sportId: null,
  name: 'Fixture trophy',
  description: 'Only used by the mock',
  category: 'meta',
  isSecret: false,
  modeExclusiveTo: null,
  tiers: [],
};
export const earnedTrophy: EarnedTrophy = {
  code: trophy.code,
  sportId: trophy.sportId,
  draftId: roster.draftId,
  tier: null,
  earnedAt: '2000-01-01T00:00:00.000Z',
};
export const trophyContext: TrophyEvalContext = {
  userId: null,
  roster,
  priorResults: [],
  earnedTrophies: [],
  evaluatedAt: earnedTrophy.earnedAt,
  facts: {},
};
