import { pick } from '../../../../../../lib/server/draft-routes';
import { withJsonErrors } from '../../../../../../lib/server/json-route';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const POST = withJsonErrors((request: Request, context: { params: { id: string } }) =>
  pick('cfb', request, context.params.id),
);
