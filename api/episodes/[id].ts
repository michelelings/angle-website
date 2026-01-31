import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchEpisodeById, type ApiResponse, type Episode } from '../../lib/supabase.js';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  try {
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Episode ID is required',
      } satisfies ApiResponse<never>);
      return;
    }

    const episode = await fetchEpisodeById(id);

    if (!episode) {
      res.status(404).json({
        success: false,
        error: 'Episode not found',
      } satisfies ApiResponse<never>);
      return;
    }

    res.status(200).json({
      success: true,
      data: episode,
    } satisfies ApiResponse<Episode>);
  } catch (error) {
    console.error('Error in /api/episodes/[id]:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch episode',
    } satisfies ApiResponse<never>);
  }
}
