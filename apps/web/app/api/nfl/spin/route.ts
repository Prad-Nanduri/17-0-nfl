import { spin } from '../../../../lib/server/draft-routes';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  return spin('nfl', request);
}
