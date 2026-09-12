import { result } from '../../../../../../lib/server/draft-routes';
import { withJsonErrors } from '../../../../../../lib/server/json-route';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const GET = withJsonErrors((request: Request, context: { params: { id: string } }) =>
  result('nfl', request, context.params.id),
);
