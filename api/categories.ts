import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchCategories, type ApiResponse } from '../lib/supabase.js';

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
    const categories = await fetchCategories();
    res.status(200).json({
      success: true,
      data: categories,
    } satisfies ApiResponse<string[]>);
  } catch (error) {
    console.error('Error in /api/categories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch categories',
    } satisfies ApiResponse<never>);
  }
}
