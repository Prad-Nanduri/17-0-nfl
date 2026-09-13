import { NextResponse } from 'next/server';
import { isSportId } from '../../../lib/sport';
import { listLeaderboard } from '../../../lib/server/leaderboard';

const DIFFICULTIES = new Set(['easy', 'normal', 'hard']);

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const sportParam = params.get('sport') ?? 'nfl';
    const sport = isSportId(sportParam) ? sportParam : 'nfl';
    const difficultyParam = params.get('difficulty') ?? 'all';
    const difficulty = DIFFICULTIES.has(difficultyParam)
      ? (difficultyParam as 'easy' | 'normal' | 'hard')
      : 'all';
    const limitParam = params.get('limit');
    const parsedLimit = limitParam === null ? Number.NaN : Number(limitParam);
    const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 50;
    const entries = await listLeaderboard({ sport, difficulty, limit });
    return NextResponse.json({ sport, difficulty, entries });
  } catch (error) {
    console.error('[api] leaderboard error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
