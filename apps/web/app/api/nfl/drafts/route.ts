import { createDraft } from '../../../../lib/server/draft-routes';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  return createDraft('nfl', request);
}
