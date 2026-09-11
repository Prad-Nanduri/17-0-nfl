import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import type {
  NflFranchise,
  NflFranchiseSeason,
  NflPlayer,
  NflPlayerSeasonStats,
  NflRating,
} from '../src/domain';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');
const seasonArgIndex = process.argv.indexOf('--season');
const season = Number(process.argv[seasonArgIndex + 1] ?? 2023);
const root = resolve(import.meta.dirname, '..');
const load = async <T>(name: string): Promise<T> =>
  JSON.parse(await readFile(resolve(root, 'data', String(season), name), 'utf8')) as T;
const loadOptional = async <T>(path: string): Promise<T | null> => {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T;
  } catch {
    return null;
  }
};
const pool = new Pool({ connectionString: databaseUrl });

try {
  await pool.query('BEGIN');
  const franchises = await load<NflFranchise[]>('franchises.json');
  const seasons = await load<NflFranchiseSeason[]>('franchise_seasons.json');
  const players = await load<NflPlayer[]>('players.json');
  const stats = await load<NflPlayerSeasonStats[]>('player_season_stats.json');
  const ratings = await load<NflRating[]>('ratings.json');
  const legacyCareers = await loadOptional<
    Array<{
      readonly pfrId: string;
      readonly gsisId?: string | null;
      readonly fullName: string;
      readonly positionGroup: string;
      readonly draftYear: number;
      readonly draftRound: number;
      readonly draftPick: number;
      readonly franchiseKey: string;
      readonly hof: boolean;
      readonly careerFromSeason: number;
      readonly careerThroughSeason: number | null;
      readonly stats: Readonly<Record<string, number | null>>;
    }>
  >(resolve(root, 'data', 'legacy', 'legacy_player_careers.json'));
  const legacyRatings = await loadOptional<NflRating[]>(
    resolve(root, 'data', 'legacy', 'legacy_ratings.json'),
  );
  const franchiseIds = new Map<string, number>();
  for (const franchise of franchises) {
    const result = await pool.query<{ id: number }>(
      `INSERT INTO nfl_franchises
        (franchise_key, name, current_name, abbreviation, nflverse_team_id, logo_url)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (franchise_key) DO UPDATE SET name = EXCLUDED.name,
         current_name = EXCLUDED.current_name, abbreviation = EXCLUDED.abbreviation,
         nflverse_team_id = EXCLUDED.nflverse_team_id, logo_url = EXCLUDED.logo_url
       RETURNING id`,
      [
        franchise.franchiseKey,
        franchise.name,
        franchise.currentName,
        franchise.abbreviation,
        franchise.nflverseTeamId,
        franchise.logoUrl,
      ],
    );
    franchiseIds.set(franchise.franchiseKey, result.rows[0]?.id ?? 0);
  }
  const seasonIds = new Map<string, number>();
  for (const item of seasons) {
    const result = await pool.query<{ id: number }>(
      `INSERT INTO nfl_franchise_seasons
        (franchise_id, season, wins, losses, ties, era_tier)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (franchise_id, season) DO UPDATE SET wins = EXCLUDED.wins,
         losses = EXCLUDED.losses, ties = EXCLUDED.ties, era_tier = EXCLUDED.era_tier
       RETURNING id`,
      [
        franchiseIds.get(item.franchiseKey),
        item.season,
        item.wins,
        item.losses,
        item.ties,
        item.eraTier,
      ],
    );
    seasonIds.set(`${item.franchiseKey}:${item.season}`, result.rows[0]?.id ?? 0);
  }
  const playerIds = new Map<string, number>();
  for (const player of players) {
    const result = await pool.query<{ id: number }>(
      `INSERT INTO nfl_players
        (gsis_id, pfr_id, espn_id, full_name, primary_position, position_group,
         birth_date, college, draft_year, draft_round, draft_number, rookie_year, headshot_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (gsis_id) DO UPDATE SET full_name = EXCLUDED.full_name,
         pfr_id = EXCLUDED.pfr_id, espn_id = EXCLUDED.espn_id,
         position_group = EXCLUDED.position_group
       RETURNING id`,
      [
        player.gsisId,
        player.pfrId,
        player.espnId,
        player.fullName,
        player.primaryPosition,
        player.positionGroup,
        player.birthDate,
        player.college,
        player.draftYear,
        player.draftRound,
        player.draftNumber,
        player.rookieYear,
        player.headshotUrl,
      ],
    );
    playerIds.set(player.gsisId, result.rows[0]?.id ?? 0);
  }
  for (const row of stats) {
    await pool.query(
      `INSERT INTO nfl_player_season_stats
        (player_id, franchise_season_id, position, position_group, games, era_tier,
         stats_jsonb, is_team_level_proxy)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (player_id, franchise_season_id) DO UPDATE SET stats_jsonb = EXCLUDED.stats_jsonb,
         games = EXCLUDED.games, position = EXCLUDED.position,
         position_group = EXCLUDED.position_group`,
      [
        playerIds.get(row.gsisId),
        seasonIds.get(`${row.franchiseKey}:${row.season}`),
        row.position,
        row.positionGroup,
        row.games,
        row.eraTier,
        row.stats,
        row.isTeamLevelProxy,
      ],
    );
  }
  for (const row of ratings) {
    await pool.query(
      `INSERT INTO nfl_ratings
        (player_id, franchise_season_id, rating_mode, overall_rating, percentile,
         composite_score, qualified, confidence_tier, is_team_level_proxy, model_version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (player_id, franchise_season_id, rating_mode) DO UPDATE SET
         overall_rating = EXCLUDED.overall_rating, percentile = EXCLUDED.percentile,
         composite_score = EXCLUDED.composite_score, qualified = EXCLUDED.qualified,
         model_version = EXCLUDED.model_version`,
      [
        playerIds.get(row.gsisId ?? ''),
        seasonIds.get(`${row.franchiseKey}:${row.season}`),
        row.ratingMode,
        row.overall,
        row.percentile,
        row.compositeScore,
        row.qualified,
        row.confidenceTier,
        row.isTeamLevelProxy,
        row.modelVersion,
      ],
    );
  }
  if (legacyCareers !== null) {
    const legacyIds = new Map<string, number>();
    for (const row of legacyCareers) {
      const result = await pool.query<{ id: number }>(
        `INSERT INTO nfl_legacy_player_careers
          (player_id, pfr_id, full_name, position_group, draft_year, draft_round,
           draft_pick, franchise_id, hof, career_from_season, career_through_season, stats_jsonb)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (pfr_id) DO UPDATE SET full_name = EXCLUDED.full_name,
           stats_jsonb = EXCLUDED.stats_jsonb, career_through_season = EXCLUDED.career_through_season
         RETURNING id`,
        [
          row.gsisId === undefined || row.gsisId === null
            ? null
            : (playerIds.get(row.gsisId) ?? null),
          row.pfrId,
          row.fullName,
          row.positionGroup,
          row.draftYear,
          row.draftRound,
          row.draftPick,
          franchiseIds.get(row.franchiseKey) ?? null,
          row.hof,
          row.careerFromSeason,
          row.careerThroughSeason,
          row.stats,
        ],
      );
      legacyIds.set(row.pfrId, result.rows[0]?.id ?? 0);
    }
    if (legacyRatings !== null) {
      for (const row of legacyRatings) {
        const career = legacyCareers.find((item) => item.gsisId === row.gsisId);
        if (career === undefined) continue;
        await pool.query(
          `INSERT INTO nfl_legacy_ratings
            (legacy_career_id, rating_mode, overall_rating, percentile, composite_score,
             qualified, confidence_tier, model_version)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (legacy_career_id, rating_mode) DO UPDATE SET overall_rating = EXCLUDED.overall_rating,
             percentile = EXCLUDED.percentile, composite_score = EXCLUDED.composite_score,
             qualified = EXCLUDED.qualified, model_version = EXCLUDED.model_version`,
          [
            legacyIds.get(career.pfrId),
            row.ratingMode,
            row.overall,
            row.percentile,
            row.compositeScore,
            row.qualified,
            row.confidenceTier,
            row.modelVersion,
          ],
        );
      }
    }
  }
  await pool.query('COMMIT');
} catch (error) {
  await pool.query('ROLLBACK');
  throw error;
} finally {
  await pool.end();
}
