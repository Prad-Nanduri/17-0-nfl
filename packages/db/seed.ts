/*
 * DEV ONLY: this script truncates every platform table before inserting fixtures.
 * Never run it against production or any shared database.
 */

import { Pool, type PoolClient } from 'pg';

type SportId = 'nfl' | 'cfb';

type DraftSpec = {
  sportId: SportId;
  userId: number;
  mode: string;
  draftOrder: string;
  difficulty: string;
  ratingMode: string;
  schemePreset: string;
  campaignMode: string | null;
  status: 'in_progress' | 'complete';
  picks: readonly string[];
};

const platformTables = [
  'daily_challenge_entries',
  'daily_challenges',
  'multiplayer_participants',
  'multiplayer_rooms',
  'user_trophies',
  'leaderboards',
  'season_results',
  'one_team_drafts',
  'playoff_draft_campaigns',
  'draft_picks',
  'drafts',
  'sessions',
  'streaks',
  'trophies',
  'users',
];

async function insertUser(
  client: PoolClient,
  email: string | null,
  displayName: string,
  defaultSport: SportId | null,
  isGuest: boolean,
): Promise<number> {
  const result = await client.query<{ id: number }>(
    `INSERT INTO users (email, display_name, default_sport, is_guest)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [email, displayName, defaultSport, isGuest],
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error('Failed to insert seed user');
  }
  return row.id;
}

async function insertDraft(client: PoolClient, spec: DraftSpec): Promise<number> {
  const result = await client.query<{ id: number }>(
    `INSERT INTO drafts
       (sport_id, user_id, mode, draft_order, difficulty, rating_mode, scheme_preset, campaign_mode, status,
        completed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CASE WHEN $9 = 'complete' THEN now() ELSE NULL END)
     RETURNING id`,
    [
      spec.sportId,
      spec.userId,
      spec.mode,
      spec.draftOrder,
      spec.difficulty,
      spec.ratingMode,
      spec.schemePreset,
      spec.campaignMode,
      spec.status,
    ],
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error('Failed to insert seed draft');
  }

  for (const [index, slotCode] of spec.picks.entries()) {
    await client.query(
      `INSERT INTO draft_picks (draft_id, slot_code, sport_player_ref, spin_seed, used_combine_gate)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        row.id,
        slotCode,
        100000 + index,
        `seed-${spec.sportId}-${row.id}-${index}`,
        spec.sportId === 'nfl',
      ],
    );
  }
  return row.id;
}

async function insertTrophy(
  client: PoolClient,
  sportId: SportId | null,
  code: string,
  name: string,
  description: string,
  category: string,
): Promise<number> {
  const result = await client.query<{ id: number }>(
    `INSERT INTO trophies (sport_id, code, name, description, category)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [sportId, code, name, description, category],
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error('Failed to insert seed trophy');
  }
  return row.id;
}

async function seed(client: PoolClient): Promise<void> {
  await client.query(`TRUNCATE TABLE ${platformTables.join(', ')} RESTART IDENTITY CASCADE`);

  const guestId = await insertUser(client, null, 'Guest Player', null, true);
  const nflUserId = await insertUser(client, 'nfl@example.test', 'NFL Manager', 'nfl', false);
  const cfbUserId = await insertUser(client, 'cfb@example.test', 'CFB Manager', 'cfb', false);

  for (const userId of [guestId, nflUserId, cfbUserId]) {
    await client.query('INSERT INTO sessions (user_id, guest_token) VALUES ($1, $2)', [
      userId,
      `seed-session-${userId}`,
    ]);
  }

  const nflInProgressDraftId = await insertDraft(client, {
    sportId: 'nfl',
    userId: nflUserId,
    mode: 'core',
    draftOrder: 'squad_first',
    difficulty: 'normal',
    ratingMode: 'career_season',
    schemePreset: '4-3',
    campaignMode: null,
    status: 'in_progress',
    picks: ['QB1', 'RB1', 'WR1'],
  });
  const cfbInProgressDraftId = await insertDraft(client, {
    sportId: 'cfb',
    userId: cfbUserId,
    mode: 'core',
    draftOrder: 'position_first',
    difficulty: 'easy',
    ratingMode: 'prime',
    schemePreset: '4-3',
    campaignMode: 'quick_season',
    status: 'in_progress',
    picks: ['QB1', 'RB1'],
  });
  const nflCompleteDraftId = await insertDraft(client, {
    sportId: 'nfl',
    userId: nflUserId,
    mode: 'core',
    draftOrder: 'squad_first',
    difficulty: 'hard',
    ratingMode: 'career_season',
    schemePreset: '4-3',
    campaignMode: null,
    status: 'complete',
    picks: [
      'QB1',
      'RB1',
      'RB2',
      'WR1',
      'WR2',
      'WR3',
      'TE1',
      'OL1',
      'OL2',
      'OL3',
      'OL4',
      'DE1',
      'DE2',
      'DT1',
      'DT2',
      'LB1',
      'LB2',
      'LB3',
      'CB1',
      'CB2',
      'S1',
      'S2',
      'K1',
      'P1',
    ],
  });
  const cfbCompleteDraftId = await insertDraft(client, {
    sportId: 'cfb',
    userId: cfbUserId,
    mode: 'one_team',
    draftOrder: 'position_first',
    difficulty: 'normal',
    ratingMode: 'prime',
    schemePreset: '4-3',
    campaignMode: null,
    status: 'complete',
    picks: ['QB1', 'RB1', 'RB2', 'WR1', 'WR2', 'WR3', 'TE1', 'OL1', 'OL2', 'OL3', 'OL4', 'K1'],
  });

  await client.query(
    `INSERT INTO season_results
       (draft_id, record_wins, record_losses, points_for, points_against, postseason_result, detail_jsonb)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [nflCompleteDraftId, 17, 0, 420, 210, 'super_bowl_champion', { seed: 'nfl-perfect-season' }],
  );
  await client.query(
    `INSERT INTO season_results
       (draft_id, record_wins, record_losses, points_for, points_against, postseason_result, detail_jsonb)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [cfbCompleteDraftId, 12, 1, 360, 180, 'cfp_r1', { seed: 'cfb-quick-season' }],
  );
  await client.query(
    `INSERT INTO one_team_drafts (draft_id, sport_id, team_ref)
     VALUES ($1, $2, $3)`,
    [cfbCompleteDraftId, 'cfb', 200001],
  );
  await client.query(
    `INSERT INTO leaderboards (sport_id, scope, draft_id, user_id, score)
     VALUES ($1, $2, $3, $4, $5)`,
    ['nfl', 'global', nflCompleteDraftId, nflUserId, 1700],
  );

  const nflTrophyId = await insertTrophy(
    client,
    'nfl',
    'nfl_perfect_season',
    'Perfect Season',
    'Finish an undefeated NFL season.',
    'result',
  );
  await insertTrophy(
    client,
    'cfb',
    'cfb_undefeated_untied',
    'Undefeated and Untied',
    'Finish an undefeated CFB season.',
    'result',
  );
  await insertTrophy(
    client,
    null,
    'two_sport_manager',
    'Two-Sport Manager',
    'Manage successful teams in both sports.',
    'meta',
  );
  await client.query(
    `INSERT INTO user_trophies (user_id, trophy_id, draft_id)
     VALUES ($1, $2, $3)`,
    [nflUserId, nflTrophyId, nflCompleteDraftId],
  );
  await client.query(
    `INSERT INTO streaks (user_id, sport_id, streak_type, current_count, best_count, last_incremented_at)
     VALUES ($1, $2, $3, $4, $5, now())`,
    [nflUserId, 'nfl', 'title_run', 1, 1],
  );

  console.log(
    `Seeded drafts: ${nflInProgressDraftId}, ${cfbInProgressDraftId}, ${nflCompleteDraftId}, ${cfbCompleteDraftId}`,
  );
}

async function printSummary(client: PoolClient): Promise<void> {
  console.log('Seed complete. Row counts:');
  for (const table of platformTables.slice().reverse()) {
    const result = await client.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM ${table}`,
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error(`Failed to count ${table}`);
    }
    console.log(`${table}: ${row.count}`);
  }
}

function assertSafeSeedUrl(databaseUrl: string): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed when NODE_ENV=production');
  }
  if (process.env.ALLOW_REMOTE_SEED === '1') {
    return;
  }

  let hostname: string;
  try {
    hostname = new URL(databaseUrl).hostname.toLowerCase();
  } catch {
    throw new Error('DATABASE_URL must be a valid URL');
  }
  if (!['localhost', '127.0.0.1', 'host.docker.internal'].includes(hostname)) {
    throw new Error(`Refusing to seed non-local database host: ${hostname}`);
  }
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to seed');
  }
  assertSafeSeedUrl(databaseUrl);

  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await seed(client);
    await printSummary(client);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

const invokedFile = process.argv[1]?.replaceAll('\\', '/') ?? '';
if (invokedFile.endsWith('/seed.ts')) {
  await main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
