import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import type {
  CfbConference,
  CfbGame,
  CfbPlayer,
  CfbPlayerSeasonStats,
  CfbPollRankingWeekly,
  CfbProgramSeason,
  CfbRating,
  CfbRecruit,
  CfbTeam,
  CfbTeamLineStats,
} from '../src/domain';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');
const seasonArgIndex = process.argv.indexOf('--season');
const season = Number(process.argv[seasonArgIndex + 1] ?? new Date().getFullYear() - 1);
const root = resolve(import.meta.dirname, '..');
const load = async <T>(name: string): Promise<T> =>
  JSON.parse(await readFile(resolve(root, 'data', String(season), name), 'utf8')) as T;

const pool = new Pool({ connectionString: databaseUrl });

try {
  await pool.query('BEGIN');
  const conferences = await load<CfbConference[]>('conferences.json');
  const teams = await load<CfbTeam[]>('teams.json');
  const programSeasons = await load<CfbProgramSeason[]>('program_seasons.json');
  const games = await load<CfbGame[]>('games.json');
  const players = await load<CfbPlayer[]>('players.json');
  const stats = await load<CfbPlayerSeasonStats[]>('player_season_stats.json');
  const ratings = await load<CfbRating[]>('ratings.json');
  const apRankings = await load<CfbPollRankingWeekly[]>('ap_rankings.json');
  const cfpRankings = await load<CfbPollRankingWeekly[]>('cfp_rankings.json');
  const recruits = await load<CfbRecruit[]>('recruits.json');
  const teamLineStats = await load<CfbTeamLineStats[]>('team_line_stats.json');

  const conferenceIds = new Map<string, number>();
  for (const conference of conferences) {
    const result = await pool.query<{ id: number }>(
      `INSERT INTO cfb_conferences
        (conference_key, name, short_name, abbreviation, is_active, founded_year, dissolved_year)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (conference_key) DO UPDATE SET name = EXCLUDED.name,
         short_name = EXCLUDED.short_name, abbreviation = EXCLUDED.abbreviation,
         is_active = EXCLUDED.is_active, founded_year = EXCLUDED.founded_year,
         dissolved_year = EXCLUDED.dissolved_year
       RETURNING id`,
      [
        conference.conferenceKey,
        conference.name,
        conference.shortName,
        conference.abbreviation,
        conference.isActive,
        conference.foundedYear,
        conference.dissolvedYear,
      ],
    );
    conferenceIds.set(conference.conferenceKey, result.rows[0]?.id ?? 0);
  }

  const teamIds = new Map<number, number>();
  for (const team of teams) {
    const result = await pool.query<{ id: number }>(
      `INSERT INTO cfb_teams
        (cfbd_team_id, school, current_name, abbreviation, mascot, logo_url, is_blue_blood)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (cfbd_team_id) DO UPDATE SET school = EXCLUDED.school,
         current_name = EXCLUDED.current_name, abbreviation = EXCLUDED.abbreviation,
         mascot = EXCLUDED.mascot, logo_url = EXCLUDED.logo_url,
         is_blue_blood = EXCLUDED.is_blue_blood
       RETURNING id`,
      [
        team.cfbdTeamId,
        team.school,
        team.currentName,
        team.abbreviation,
        team.mascot,
        team.logoUrl,
        team.isBlueBlood,
      ],
    );
    teamIds.set(team.cfbdTeamId, result.rows[0]?.id ?? 0);
  }

  const programSeasonIds = new Map<string, number>();
  for (const row of programSeasons) {
    const result = await pool.query<{ id: number }>(
      `INSERT INTO cfb_program_seasons
        (team_id, season, conference_id, membership_status, wins, losses,
         ap_preseason_rank, ap_final_rank, peak_rank_this_season, cfp_result,
         bowl_result, recruiting_rank, recruiting_points, era_tier)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       ON CONFLICT (team_id, season) DO UPDATE SET conference_id = EXCLUDED.conference_id,
         membership_status = EXCLUDED.membership_status, wins = EXCLUDED.wins,
         losses = EXCLUDED.losses, ap_preseason_rank = EXCLUDED.ap_preseason_rank,
         ap_final_rank = EXCLUDED.ap_final_rank,
         peak_rank_this_season = EXCLUDED.peak_rank_this_season,
         cfp_result = EXCLUDED.cfp_result, bowl_result = EXCLUDED.bowl_result,
         recruiting_rank = EXCLUDED.recruiting_rank,
         recruiting_points = EXCLUDED.recruiting_points, era_tier = EXCLUDED.era_tier
       RETURNING id`,
      [
        teamIds.get(row.cfbdTeamId),
        row.season,
        row.conferenceKey === null ? null : (conferenceIds.get(row.conferenceKey) ?? null),
        row.membershipStatus,
        row.wins,
        row.losses,
        row.apPreseasonRank,
        row.apFinalRank,
        row.peakRankThisSeason,
        row.cfpResult,
        row.bowlResult,
        row.recruitingRank,
        row.recruitingPoints,
        row.eraTier,
      ],
    );
    programSeasonIds.set(`${row.cfbdTeamId}:${row.season}`, result.rows[0]?.id ?? 0);
  }

  for (const game of games) {
    await pool.query(
      `INSERT INTO cfb_games
        (cfbd_game_id, season, week, season_type, home_team_id, away_team_id,
         home_score, away_score, neutral_site, game_type, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (cfbd_game_id) DO UPDATE SET home_score = EXCLUDED.home_score,
         away_score = EXCLUDED.away_score, game_type = EXCLUDED.game_type,
         notes = EXCLUDED.notes`,
      [
        game.cfbdGameId,
        game.season,
        game.week,
        game.seasonType,
        game.homeCfbdTeamId === null ? null : (teamIds.get(game.homeCfbdTeamId) ?? null),
        game.awayCfbdTeamId === null ? null : (teamIds.get(game.awayCfbdTeamId) ?? null),
        game.homeScore,
        game.awayScore,
        game.neutralSite,
        game.gameType,
        game.notes,
      ],
    );
  }

  const playerIds = new Map<string, number>();
  for (const player of players) {
    const result = await pool.query<{ id: number }>(
      `INSERT INTO cfb_players
        (cfbd_player_id, full_name, primary_position, position_group, home_state,
         home_town, recruiting_class_year, recruit_stars, recruit_rating)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (cfbd_player_id) DO UPDATE SET full_name = EXCLUDED.full_name,
         primary_position = EXCLUDED.primary_position,
         position_group = EXCLUDED.position_group, home_state = EXCLUDED.home_state,
         home_town = EXCLUDED.home_town,
         recruiting_class_year = EXCLUDED.recruiting_class_year,
         recruit_stars = EXCLUDED.recruit_stars, recruit_rating = EXCLUDED.recruit_rating
       RETURNING id`,
      [
        player.cfbdPlayerId,
        player.fullName,
        player.primaryPosition,
        player.positionGroup,
        player.homeState,
        player.homeTown,
        player.recruitingClassYear,
        player.recruitStars,
        player.recruitRating,
      ],
    );
    playerIds.set(player.cfbdPlayerId, result.rows[0]?.id ?? 0);
  }

  const playerSeasonStatIds = new Map<string, number>();
  for (const row of stats) {
    const result = await pool.query<{ id: number }>(
      `INSERT INTO cfb_player_season_stats
        (player_id, program_season_id, position, position_group, games, games_started,
         era_tier, stats_jsonb, is_transfer_this_season, all_conference, all_american,
         is_team_level_proxy)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (player_id, program_season_id) DO UPDATE SET position = EXCLUDED.position,
         position_group = EXCLUDED.position_group, games = EXCLUDED.games,
         games_started = EXCLUDED.games_started, era_tier = EXCLUDED.era_tier,
         stats_jsonb = EXCLUDED.stats_jsonb,
         is_transfer_this_season = EXCLUDED.is_transfer_this_season,
         all_conference = EXCLUDED.all_conference, all_american = EXCLUDED.all_american,
         is_team_level_proxy = EXCLUDED.is_team_level_proxy
       RETURNING id`,
      [
        playerIds.get(row.cfbdPlayerId),
        programSeasonIds.get(`${row.cfbdTeamId}:${row.season}`),
        row.position,
        row.positionGroup,
        row.games,
        row.gamesStarted,
        row.eraTier,
        JSON.stringify(row.stats),
        row.isTransferThisSeason,
        row.allConference,
        row.allAmerican,
        row.isTeamLevelProxy,
      ],
    );
    playerSeasonStatIds.set(
      `${row.cfbdPlayerId}:${row.cfbdTeamId}:${row.season}`,
      result.rows[0]?.id ?? 0,
    );
  }

  for (const row of ratings) {
    await pool.query(
      `INSERT INTO cfb_ratings
        (player_id, program_season_id, rating_mode, overall_rating, percentile,
         composite_score, confidence_tier, is_team_level_proxy, model_version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (player_id, program_season_id, rating_mode) DO UPDATE SET
         overall_rating = EXCLUDED.overall_rating, percentile = EXCLUDED.percentile,
         composite_score = EXCLUDED.composite_score,
         confidence_tier = EXCLUDED.confidence_tier,
         is_team_level_proxy = EXCLUDED.is_team_level_proxy,
         model_version = EXCLUDED.model_version`,
      [
        playerIds.get(row.cfbdPlayerId),
        programSeasonIds.get(`${row.cfbdTeamId}:${row.season}`),
        row.ratingMode,
        row.overallRating,
        row.percentile,
        row.compositeScore,
        row.confidenceTier,
        row.isTeamLevelProxy,
        row.modelVersion,
      ],
    );
  }

  for (const row of apRankings) {
    await pool.query(
      `INSERT INTO cfb_ap_rankings_weekly
        (season, week, team_id, ap_rank, points, first_place_votes, is_final)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (season, week, team_id) DO UPDATE SET ap_rank = EXCLUDED.ap_rank,
         points = EXCLUDED.points, first_place_votes = EXCLUDED.first_place_votes,
         is_final = EXCLUDED.is_final`,
      [
        row.season,
        row.week,
        teamIds.get(row.cfbdTeamId),
        row.rank,
        row.points,
        row.firstPlaceVotes,
        row.isFinal,
      ],
    );
  }

  for (const row of cfpRankings) {
    await pool.query(
      `INSERT INTO cfb_cfp_rankings_weekly
        (season, week, team_id, cfp_rank, points, first_place_votes, is_final)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (season, week, team_id) DO UPDATE SET cfp_rank = EXCLUDED.cfp_rank,
         points = EXCLUDED.points, first_place_votes = EXCLUDED.first_place_votes,
         is_final = EXCLUDED.is_final`,
      [
        row.season,
        row.week,
        teamIds.get(row.cfbdTeamId),
        row.rank,
        row.points,
        row.firstPlaceVotes,
        row.isFinal,
      ],
    );
  }

  for (const recruit of recruits) {
    await pool.query(
      `INSERT INTO cfb_recruits
        (cfbd_recruit_id, athlete_id, year, name, committed_to, position, stars,
         rating, ranking, state_province)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (cfbd_recruit_id) DO UPDATE SET name = EXCLUDED.name,
         committed_to = EXCLUDED.committed_to, position = EXCLUDED.position,
         stars = EXCLUDED.stars, rating = EXCLUDED.rating, ranking = EXCLUDED.ranking`,
      [
        recruit.cfbdRecruitId,
        recruit.athleteId,
        recruit.year,
        recruit.name,
        recruit.committedTo,
        recruit.position,
        recruit.stars,
        recruit.rating,
        recruit.ranking,
        recruit.stateProvince,
      ],
    );
  }

  for (const line of teamLineStats) {
    await pool.query(
      `UPDATE cfb_program_seasons SET team_line_stats_jsonb = $3
       WHERE id = $1`,
      [
        programSeasonIds.get(`${line.cfbdTeamId}:${line.season}`) ?? -1,
        line.season,
        JSON.stringify(line),
      ],
    );
  }

  await pool.query('COMMIT');
} catch (error) {
  await pool.query('ROLLBACK');
  throw error;
} finally {
  await pool.end();
}
