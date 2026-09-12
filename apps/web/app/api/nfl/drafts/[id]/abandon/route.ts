import { abandonDraft } from '../../../../../../lib/server/draft-routes';
import { withJsonErrors } from '../../../../../../lib/server/json-route';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const POST = withJsonErrors((request: Request, context: { params: { id: string } }) =>
  abandonDraft('nfl', request, context.params.id),
);
