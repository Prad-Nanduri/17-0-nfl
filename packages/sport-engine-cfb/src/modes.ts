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

const QUICK_SEASON = { fullCampaign: false } as const;
const FULL_CAMPAIGN = { fullCampaign: true } as const;

const MODES: readonly SportMode[] = [
  {
    id: 'core',
    name: 'Core Draft',
    description:
      'Squad-First or Position-First draft order; Easy/Normal/Hard difficulty; Career-Season or Prime rating mode; Quick Season (default) or Full Campaign — chase "Undefeated & Untied."',
  },
  {
    id: 'one_program',
    name: 'One-Program Mode',
    description:
      "Draft only from one FBS program's history, one real player per slot, rated by the season actually played there (Prime enabled).",
  },
  {
    id: 'blue_blood_bracket',
    name: 'Blue-Blood Bracket',
    description:
      'Draft only from the Blue-Blood pool, then play a league phase and a CFP-shaped knockout bracket.',
  },
  {
    id: 'ranked_only',
    name: 'Ranked Only Draft',
    description:
      'Spin pool restricted to program-seasons that finished AP-ranked (or peaked in the Top 25) — higher floor, higher difficulty.',
  },
  {
    id: 'daily_challenge',
    name: 'Daily Challenge',
    description:
      'One shared challenge/day tied to a real current storyline (Rivalry Week, Ranked Matchup, Bowl Bubble), with bonus scoring and a shared leaderboard.',
  },
  {
    id: 'conference_trophy',
    name: 'Conference Trophy',
    description:
      "Build a roster restricted to one conference's history and chase a conference-championship-style trophy run.",
  },
  {
    id: 'mp_live_draft',
    name: 'Multiplayer — Live Draft',
    description: 'Real-time, up to 4 players, synchronous, shared spin queue.',
  },
  {
    id: 'mp_leagues',
    name: 'Multiplayer — Leagues',
    description:
      'Fully async, standings table, bracket-advancement-weighted scoring across a shared window (Full Campaign only).',
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
    defaultSimulationOptions: QUICK_SEASON,
    constraints: [],
  },
  {
    modeId: 'one_program',
    draftOrders: ['squad_first'],
    ratingModes: BOTH_RATING_MODES,
    schemeIds: ALL_SCHEMES,
    difficultyRules: DIFFICULTY_RULES,
    defaultSimulationOptions: QUICK_SEASON,
    constraints: [
      constraint('one_program', 'All spins must come from exactly one program.', {
        requiresExactlyOneTeamId: true,
      }),
    ],
  },
  {
    modeId: 'blue_blood_bracket',
    draftOrders: BOTH_DRAFT_ORDERS,
    ratingModes: BOTH_RATING_MODES,
    schemeIds: ALL_SCHEMES,
    difficultyRules: DIFFICULTY_RULES,
    defaultSimulationOptions: { fullCampaign: true, bracket: true },
    constraints: [
      constraint('program_pool', 'Spins are restricted to the Blue-Blood pool.', {
        programPool: 'elite',
      }),
    ],
  },
  {
    modeId: 'ranked_only',
    draftOrders: BOTH_DRAFT_ORDERS,
    ratingModes: BOTH_RATING_MODES,
    schemeIds: ALL_SCHEMES,
    difficultyRules: DIFFICULTY_RULES,
    defaultSimulationOptions: QUICK_SEASON,
    constraints: [
      constraint('ranked_only', 'Spins are restricted to AP-ranked program-seasons.', {
        rankedOnly: true,
      }),
    ],
  },
  {
    modeId: 'daily_challenge',
    draftOrders: BOTH_DRAFT_ORDERS,
    ratingModes: BOTH_RATING_MODES,
    schemeIds: ALL_SCHEMES,
    difficultyRules: DIFFICULTY_RULES,
    defaultSimulationOptions: QUICK_SEASON,
    constraints: [],
  },
  {
    modeId: 'conference_trophy',
    draftOrders: BOTH_DRAFT_ORDERS,
    ratingModes: BOTH_RATING_MODES,
    schemeIds: ALL_SCHEMES,
    difficultyRules: DIFFICULTY_RULES,
    defaultSimulationOptions: QUICK_SEASON,
    constraints: [
      constraint('conference', 'Spins must be restricted to the requested conference.', {
        requiresConference: true,
      }),
    ],
  },
  {
    modeId: 'mp_live_draft',
    draftOrders: BOTH_DRAFT_ORDERS,
    ratingModes: BOTH_RATING_MODES,
    schemeIds: ALL_SCHEMES,
    difficultyRules: DIFFICULTY_RULES,
    defaultSimulationOptions: QUICK_SEASON,
    constraints: [],
  },
  {
    modeId: 'mp_leagues',
    draftOrders: BOTH_DRAFT_ORDERS,
    ratingModes: BOTH_RATING_MODES,
    schemeIds: ALL_SCHEMES,
    difficultyRules: DIFFICULTY_RULES,
    defaultSimulationOptions: FULL_CAMPAIGN,
    constraints: [
      constraint('full_campaign_only', 'Only Full Campaign entries are league-eligible.', {
        requiresFullCampaign: true,
        leagueScoringMultipliers: [1, 1, 2, 3, 4, 6],
      }),
    ],
  },
  {
    modeId: 'mp_last_one_standing',
    draftOrders: BOTH_DRAFT_ORDERS,
    ratingModes: BOTH_RATING_MODES,
    schemeIds: ALL_SCHEMES,
    difficultyRules: DIFFICULTY_RULES,
    defaultSimulationOptions: QUICK_SEASON,
    constraints: [],
  },
];

export function getAvailableModes(): SportMode[] {
  return MODES.map((mode) => ({ ...mode }));
}

export function getModeRuleset(modeId: string): ModeRuleset {
  const ruleset = RULESETS.find((item) => item.modeId === modeId);
  if (ruleset === undefined) {
    throw new Error(`Unknown CFB mode: ${modeId}`);
  }
  return {
    ...ruleset,
    draftOrders: [...ruleset.draftOrders],
    ratingModes: [...ruleset.ratingModes],
    schemeIds: [...ruleset.schemeIds],
    defaultSimulationOptions: { ...ruleset.defaultSimulationOptions },
    constraints: [...ruleset.constraints],
  };
}
