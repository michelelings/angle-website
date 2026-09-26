import { mediaArtworkResponse } from '@/worker/artwork';
import { catalogEnv } from '@/lib/server/catalog';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return mediaArtworkResponse(request, (await params).id, await catalogEnv());
}
