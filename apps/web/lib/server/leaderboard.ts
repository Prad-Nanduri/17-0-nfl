import { createSupabaseServiceClient } from '@perfect-season/db';
import type { SportId } from '@perfect-season/sport-engine-core';
import type { Difficulty, RatingMode } from '@perfect-season/sport-engine-core';
import type { DraftState, StoredResult } from './draft-store';
import { getSessionStore } from './session-store';

export function isLeaderboardConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

const ADJECTIVES = [
  'Audacious',
  'Blitzing',
  'Bone-Crushing',
  'Clutch',
  'Crafty',
  'Dazzling',
  'Electric',
  'Fearless',
  'Fiery',
  'Gritty',
  'Heraldic',
  'Ironclad',
  'Jumbo',
  'Lightning',
  'Mighty',
  'Nimble',
  'Overtime',
  'Prime-Time',
  'Rocket',
  'Ruthless',
  'Sideline',
  'Sneaky',
  'Stadium',
  'Thundering',
  'Two-Minute',
  'Untamed',
  'Victory',
  'Wildcat',
  'Wing-T',
  'Zero-Blitz',
] as const;

const ANIMALS = [
  'Badgers',
  'Bears',
  'Bengals',
  'Bison',
  'Broncos',
  'Bulldogs',
  'Cardinals',
  'Cavaliers',
  'Cobras',
  'Cougars',
  'Cyclones',
  'Eagles',
  'Falcons',
  'Foxes',
  'Gators',
  'Hawkeyes',
  'Hornets',
  'Huskies',
  'Jaguars',
  'Longhorns',
  'Mustangs',
  'Owls',
  'Panthers',
  'Raptors',
  'Rebels',
  'Seminoles',
  'Spartans',
  'Tigers',
  'Trojans',
  'Wolverines',
] as const;

function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Deterministic fun alias for a draft whose owner is anonymous. Never leaks
 *  the guest token or any internal id — the public output is just a name. */
export function guestAlias(draftId: number | string): string {
  const hash = fnv1a(`perfect-season:${String(draftId)}`);
  const adjective = ADJECTIVES[hash % ADJECTIVES.length];
  const animal = ANIMALS[Math.floor(hash / ADJECTIVES.length) % ANIMALS.length];
  const number = (Math.floor(hash / (ADJECTIVES.length * ANIMALS.length)) % 90) + 10;
  return `${adjective} ${animal} ${number}`;
}

/** Persist a completed draft + its simulated result into the platform-core
 *  Postgres tables so the leaderboard can read it. Best-effort: failures warn
 *  and never break the simulate response. */
export async function persistCompletedResult(
  state: DraftState,
  result: StoredResult,
): Promise<void> {
  if (!isLeaderboardConfigured()) return;
  try {
    const supabase = createSupabaseServiceClient();
    let userId: number | null = null;
    if (state.guestToken !== null) {
      const sessionStore = getSessionStore();
      const session = await sessionStore.getSession(state.guestToken);
      const user = session?.userId != null ? await sessionStore.getUser(session.userId) : undefined;
      if (user?.email) {
        const { data: existing } = await supabase
          .from('users')
          .select('id')
          .eq('email', user.email)
          .maybeSingle();
        if (existing !== null) {
          userId = existing.id as number;
        } else {
          const { data: inserted } = await supabase
            .from('users')
            .insert({ email: user.email, display_name: user.displayName, is_guest: false })
            .select('id')
            .single();
          userId = (inserted?.id as number | undefined) ?? null;
        }
      }
    }
    const { data: draftRow, error: draftError } = await supabase
      .from('drafts')
      .insert({
        sport_id: state.sportId,
        user_id: userId,
        mode: state.modeId,
        draft_order: state.draftOrder,
        difficulty: state.difficulty,
        rating_mode: state.ratingMode,
        scheme_preset: state.schemeId,
        campaign_mode: state.sportId === 'cfb' ? 'quick_season' : null,
        status: 'complete',
        created_at: state.createdAt,
        completed_at: result.simulatedAt,
      })
      .select('id')
      .single();
    if (draftError || draftRow === null) {
      console.warn('[leaderboard] draft insert failed', draftError?.message);
      return;
    }
    const { error: resultError } = await supabase.from('season_results').insert({
      draft_id: draftRow.id,
      record_wins: result.season.record.wins,
      record_losses: result.season.record.losses,
      points_for: result.season.pointsFor,
      points_against: result.season.pointsAgainst,
      postseason_result: result.season.postseasonResult,
      simulated_at: result.simulatedAt,
      detail_jsonb: {
        ties: result.season.record.ties,
        fullGauntlet: result.fullGauntlet,
        trophies: result.trophies.map((trophy) => trophy.code),
        mvp: result.mvp.fullName,
        localDraftId: state.id,
      },
    });
    if (resultError) console.warn('[leaderboard] result insert failed', resultError.message);
  } catch (error) {
    console.warn('[leaderboard] persistence failed', error);
  }
}

export interface LeaderboardEntry {
  readonly rank: number;
  readonly alias: string;
  readonly sport: SportId;
  readonly difficulty: Difficulty;
  readonly ratingMode: RatingMode;
  readonly record: { readonly wins: number; readonly losses: number; readonly ties: number };
  readonly pointDifferential: number;
  readonly postseasonResult: string | null;
  readonly trophyCount: number;
  readonly completedAt: string;
}

interface LeaderboardRow {
  id: number;
  record_wins: number;
  record_losses: number;
  points_for: number;
  points_against: number;
  postseason_result: string | null;
  simulated_at: string;
  detail_jsonb: { ties?: number; trophies?: unknown[] } | null;
  drafts: {
    id: number;
    sport_id: SportId;
    difficulty: Difficulty;
    rating_mode: RatingMode;
    completed_at: string | null;
    users: { display_name: string } | null;
  } | null;
}

export async function listLeaderboard(input: {
  sport: SportId;
  difficulty: Difficulty | 'all';
  limit?: number;
}): Promise<readonly LeaderboardEntry[]> {
  if (!isLeaderboardConfigured()) return [];
  const supabase = createSupabaseServiceClient();
  let query = supabase
    .from('season_results')
    .select(
      'id,record_wins,record_losses,points_for,points_against,postseason_result,simulated_at,detail_jsonb,drafts!inner(id,sport_id,difficulty,rating_mode,completed_at,users(display_name))',
    )
    .eq('drafts.sport_id', input.sport)
    .eq('drafts.status', 'complete')
    .order('record_wins', { ascending: false })
    .order('points_for', { ascending: false })
    .limit(200);
  if (input.difficulty !== 'all') query = query.eq('drafts.difficulty', input.difficulty);
  const { data, error } = await query;
  if (error || data === null) {
    if (error) console.warn('[leaderboard] query failed', error.message);
    return [];
  }
  const rows = (data as unknown as LeaderboardRow[]).filter((row) => row.drafts !== null);
  rows.sort((a, b) => {
    if (b.record_wins !== a.record_wins) return b.record_wins - a.record_wins;
    if (a.record_losses !== b.record_losses) return a.record_losses - b.record_losses;
    const aDiff = a.points_for - a.points_against;
    const bDiff = b.points_for - b.points_against;
    if (bDiff !== aDiff) return bDiff - aDiff;
    return a.simulated_at.localeCompare(b.simulated_at);
  });
  const limit = Math.min(input.limit ?? 50, 100);
  return rows.slice(0, limit).map((row, index) => {
    const draft = row.drafts!;
    const ties = row.detail_jsonb?.ties ?? 0;
    return {
      rank: index + 1,
      alias: draft.users?.display_name ?? guestAlias(draft.id),
      sport: draft.sport_id,
      difficulty: draft.difficulty,
      ratingMode: draft.rating_mode,
      record: { wins: row.record_wins, losses: row.record_losses, ties },
      pointDifferential: row.points_for - row.points_against,
      postseasonResult: row.postseason_result,
      trophyCount: row.detail_jsonb?.trophies?.length ?? 0,
      completedAt: draft.completed_at ?? row.simulated_at,
    };
  });
}
