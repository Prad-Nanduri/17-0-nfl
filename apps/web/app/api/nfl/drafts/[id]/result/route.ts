import { result } from '../../../../../../lib/server/draft-routes';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request, context: { params: { id: string } }) {
  return result('nfl', request, context.params.id);
}
