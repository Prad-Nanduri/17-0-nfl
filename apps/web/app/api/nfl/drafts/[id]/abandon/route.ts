import { abandonDraft } from '../../../../../../lib/server/draft-routes';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request, context: { params: { id: string } }) {
  return abandonDraft('nfl', request, context.params.id);
}
