import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { runMigrations } from './scripts/migrate';

const databaseUrl = process.env.DATABASE_URL;
const pool = new Pool(databaseUrl ? { connectionString: databaseUrl } : undefined);
const draftIds: number[] = [];

describe.skipIf(!process.env.DATABASE_URL)('platform-core schema', () => {
  beforeAll(async () => {
    await runMigrations(pool);
  });

  afterAll(async () => {
    if (draftIds.length > 0) {
      await pool.query('DELETE FROM draft_picks WHERE draft_id = ANY($1::bigint[])', [draftIds]);
      await pool.query('DELETE FROM drafts WHERE id = ANY($1::bigint[])', [draftIds]);
    }
  });

  it('creates all platform tables and the exact sport enum labels', async () => {
    const result = await pool.query<{ table_name: string }>(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name = ANY($1::text[])
       ORDER BY table_name`,
      [
        [
          'users',
          'sessions',
          'drafts',
          'draft_picks',
          'season_results',
          'one_team_drafts',
          'playoff_draft_campaigns',
          'daily_challenges',
          'daily_challenge_entries',
          'multiplayer_rooms',
          'multiplayer_participants',
          'leaderboards',
          'trophies',
          'user_trophies',
          'streaks',
        ],
      ],
    );
    expect(result.rows.map((row) => row.table_name)).toHaveLength(15);

    const enumResult = await pool.query<{ enumlabel: string }>(
      `SELECT enumlabel
       FROM pg_type
       JOIN pg_enum ON pg_enum.enumtypid = pg_type.oid
       WHERE pg_type.typname = 'sport_id_enum'
       ORDER BY enumsortorder`,
    );
    expect(enumResult.rows.map((row) => row.enumlabel)).toEqual(['nfl', 'cfb']);
  });

  it('allows changing sport_id before picks exist', async () => {
    const result = await pool.query<{ id: number }>(
      `INSERT INTO drafts
         (sport_id, mode, draft_order, difficulty, rating_mode, scheme_preset)
       VALUES ('nfl', 'core', 'squad_first', 'normal', 'prime', '4-3')
       RETURNING id`,
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error('Failed to create test draft');
    }
    draftIds.push(row.id);

    await pool.query(`UPDATE drafts SET sport_id = 'cfb' WHERE id = $1`, [row.id]);
    const updated = await pool.query<{ sport_id: string }>(
      'SELECT sport_id FROM drafts WHERE id = $1',
      [row.id],
    );
    expect(updated.rows[0]?.sport_id).toBe('cfb');
  });

  it('rejects changing sport_id after a pick exists', async () => {
    const result = await pool.query<{ id: number }>(
      `INSERT INTO drafts
         (sport_id, mode, draft_order, difficulty, rating_mode, scheme_preset)
       VALUES ('nfl', 'core', 'squad_first', 'normal', 'prime', '4-3')
       RETURNING id`,
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error('Failed to create test draft');
    }
    draftIds.push(row.id);
    await pool.query(
      `INSERT INTO draft_picks (draft_id, slot_code, sport_player_ref, spin_seed)
       VALUES ($1, 'QB1', 900001, 'schema-test-seed')`,
      [row.id],
    );

    await expect(
      pool.query(`UPDATE drafts SET sport_id = 'cfb' WHERE id = $1`, [row.id]),
    ).rejects.toThrow(/immutable/);
  });

  it('still allows unrelated draft updates after a pick exists', async () => {
    const result = await pool.query<{ id: number }>(
      `INSERT INTO drafts
         (sport_id, mode, draft_order, difficulty, rating_mode, scheme_preset)
       VALUES ('nfl', 'core', 'squad_first', 'normal', 'prime', '4-3')
       RETURNING id`,
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error('Failed to create test draft');
    }
    draftIds.push(row.id);
    await pool.query(
      `INSERT INTO draft_picks (draft_id, slot_code, sport_player_ref, spin_seed)
       VALUES ($1, 'QB1', 900002, 'schema-test-status-seed')`,
      [row.id],
    );

    await pool.query(`UPDATE drafts SET status = 'complete' WHERE id = $1`, [row.id]);
    const updated = await pool.query<{ status: string }>(
      'SELECT status FROM drafts WHERE id = $1',
      [row.id],
    );
    expect(updated.rows[0]?.status).toBe('complete');
  });
});

describe.skipIf(!process.env.DATABASE_URL)('NFL domain schema', () => {
  beforeAll(async () => {
    await runMigrations(pool);
  });

  it('creates the NFL domain tables and rejects invalid era tiers', async () => {
    const result = await pool.query<{ table_name: string }>(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name = ANY($1::text[])
       ORDER BY table_name`,
      [
        [
          'nfl_franchises',
          'nfl_franchise_seasons',
          'nfl_players',
          'nfl_player_season_stats',
          'nfl_ratings',
          'nfl_legacy_player_careers',
          'nfl_legacy_ratings',
        ],
      ],
    );
    expect(result.rows.map((row) => row.table_name)).toEqual([
      'nfl_franchise_seasons',
      'nfl_franchises',
      'nfl_legacy_player_careers',
      'nfl_legacy_ratings',
      'nfl_player_season_stats',
      'nfl_players',
      'nfl_ratings',
    ]);

    await expect(
      pool.query(
        `INSERT INTO nfl_franchise_seasons
          (franchise_id, season, wins, losses, ties, era_tier)
         VALUES (999999, 2023, 0, 0, 0, 'foo')`,
      ),
    ).rejects.toThrow();
  });
});

afterAll(async () => {
  await pool.end();
});
