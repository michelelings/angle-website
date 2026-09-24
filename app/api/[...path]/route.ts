import { apiResponse } from '@/lib/server/api';
import { catalogEnv } from '@/lib/server/catalog';
export const dynamic = 'force-dynamic';
export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const response = await apiResponse((await params).path, await catalogEnv());
  if (!response.headers.has('Cache-Control')) response.headers.set('Cache-Control', 'no-store');
  return response;
}
export function OPTIONS() { return new Response(null, { status: 204, headers: { Allow: 'GET, HEAD, OPTIONS' } }); }
