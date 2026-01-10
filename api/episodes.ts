import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchEpisodes, type ApiResponse, type Episode } from '../lib/supabase.js';

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
    const episodes = await fetchEpisodes();
    res.status(200).json({
      success: true,
      data: episodes,
    } satisfies ApiResponse<Episode[]>);
  } catch (error) {
    console.error('Error in /api/episodes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch episodes',
    } satisfies ApiResponse<never>);
  }
}
