import type {
  DraftOrder,
  ModeConstraint,
  ModeRuleset,
  RatingMode,
  SchemeId,
  SportMode,
} from '@perfect-season/sport-engine-core';

const ALL_SCHEMES: readonly SchemeId[] = ['4-3', '3-4', 'nickel'];
const BOTH_DRAFT_ORDERS: readonly DraftOrder[] = ['squad_first', 'position_first'];
const BOTH_RATING_MODES: readonly RatingMode[] = ['career_season', 'prime'];
const DIFFICULTY_RULES = {
  easy: { rerolls: 1, ratingsVisible: true, facts: {} },
  normal: { rerolls: 0, ratingsVisible: true, facts: {} },
  hard: { rerolls: 0, ratingsVisible: false, facts: {} },
} satisfies ModeRuleset['difficultyRules'];

const MODES: readonly SportMode[] = [
  {
    id: 'core',
    name: 'Core Draft',
    description:
      'Squad-First or Position-First draft order; Easy/Normal/Hard difficulty; Career-Season or Prime rating mode; chase 17-0 (or Full Gauntlet).',
  },
  {
    id: 'one_franchise',
    name: 'One-Franchise Mode',
    description:
      "Draft only from one franchise's entire history, one real player per slot, scheme the franchise could genuinely field, rated by season actually played there (Prime disabled).",
  },
  {
    id: 'playoff_draft',
    name: 'Playoff Draft',
    description:
      'Draft a 24-man roster only from the Elite Franchise pool, then play a league phase and knockout bracket.',
  },
  {
    id: 'daily_challenge',
    name: 'Daily Challenge',
    description:
      'One shared challenge/day tied to a real current storyline, with bonus scoring and a shared leaderboard.',
  },
  {
    id: 'conference_trophy',
    name: 'Conference/Dynasty Trophy',
    description:
      "Build a roster restricted to one conference's (AFC/NFC) history and chase a conference champion-style outcome.",
  },
  {
    id: 'mp_live_draft',
    name: 'Multiplayer — Live Draft',
    description: 'Real-time, up to 4 players, synchronous, shared spin queue.',
  },
  {
    id: 'mp_leagues',
    name: 'Multiplayer — Leagues',
    description: 'Fully async, standings table, points-per-win scoring across a shared window.',
  },
  {
    id: 'mp_last_one_standing',
    name: 'Multiplayer — Last One Standing',
    description: 'Timed-round elimination survival — miss a pick window, you are out.',
  },
];

function constraint(
  code: string,
  description: string,
  parameters: ModeConstraint['parameters'],
): ModeConstraint {
  return { code, description, parameters };
}

const RULESETS: readonly ModeRuleset[] = [
  {
    modeId: 'core',
    draftOrders: BOTH_DRAFT_ORDERS,
    ratingModes: BOTH_RATING_MODES,
    schemeIds: ALL_SCHEMES,
    difficultyRules: DIFFICULTY_RULES,
    defaultSimulationOptions: {},
    constraints: [],
  },
  {
    modeId: 'one_franchise',
    draftOrders: ['squad_first'],
    ratingModes: ['career_season'],
    schemeIds: ALL_SCHEMES,
    difficultyRules: DIFFICULTY_RULES,
    defaultSimulationOptions: {},
    constraints: [
      constraint('one_franchise', 'All spins must come from exactly one franchise.', {
        requiresExactlyOneTeamId: true,
      }),
    ],
  },
  {
    modeId: 'playoff_draft',
    draftOrders: BOTH_DRAFT_ORDERS,
    ratingModes: BOTH_RATING_MODES,
    schemeIds: ALL_SCHEMES,
    difficultyRules: DIFFICULTY_RULES,
    defaultSimulationOptions: { playoffBracket: true },
    constraints: [
      constraint('franchise_pool', 'Spins are restricted to the elite franchise pool.', {
        franchisePool: 'elite',
      }),
    ],
  },
  {
    modeId: 'daily_challenge',
    draftOrders: BOTH_DRAFT_ORDERS,
    ratingModes: BOTH_RATING_MODES,
    schemeIds: ALL_SCHEMES,
    difficultyRules: DIFFICULTY_RULES,
    defaultSimulationOptions: {},
    constraints: [],
  },
  {
    modeId: 'conference_trophy',
    draftOrders: BOTH_DRAFT_ORDERS,
    ratingModes: BOTH_RATING_MODES,
    schemeIds: ALL_SCHEMES,
    difficultyRules: DIFFICULTY_RULES,
    defaultSimulationOptions: {},
    constraints: [
      constraint('conference', 'Spins must be restricted to the requested conference.', {
        requiresConference: true,
      }),
    ],
  },
  ...(['mp_live_draft', 'mp_leagues', 'mp_last_one_standing'] as const).map((modeId) => ({
    modeId,
    draftOrders: BOTH_DRAFT_ORDERS,
    ratingModes: BOTH_RATING_MODES,
    schemeIds: ALL_SCHEMES,
    difficultyRules: DIFFICULTY_RULES,
    defaultSimulationOptions: {},
    constraints: [],
  })),
];

export function getAvailableModes(): SportMode[] {
  return MODES.map((mode) => ({ ...mode }));
}

export function getModeRuleset(modeId: string): ModeRuleset {
  const ruleset = RULESETS.find((item) => item.modeId === modeId);
  if (ruleset === undefined) {
    throw new Error(`Unknown NFL mode: ${modeId}`);
  }
  return {
    ...ruleset,
    draftOrders: [...ruleset.draftOrders],
    ratingModes: [...ruleset.ratingModes],
    schemeIds: [...ruleset.schemeIds],
    constraints: [...ruleset.constraints],
  };
}
