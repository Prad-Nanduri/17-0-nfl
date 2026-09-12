import { getDraft } from '../../../../../lib/server/draft-routes';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request, context: { params: { id: string } }) {
  return getDraft('nfl', request, context.params.id);
}
