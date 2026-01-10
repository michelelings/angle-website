const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL || 'https://iceyvqmewggxhouhzpll.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljZXl2cW1ld2dneGhvdWh6cGxsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc0OTIwNDcsImV4cCI6MjA4MzA2ODA0N30.6GXR52SmMkwY3nuZsoiO-bQQgJ_BcoHfTbXfY3_X2xY';

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Fetch completed episodes from Supabase
 */
async function fetchEpisodesFromDB() {
  try {
    const { data, error } = await supabase
      .from('episodes')
      .select('id, title, excerpt, cover_url, created_at, category')
      .eq('status', 'completed')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching episodes:', error);
      throw error;
    }

    // Transform data to match frontend needs
    return data.map(episode => ({
      id: episode.id,
      title: episode.title,
      description: episode.excerpt,
      coverImage: episode.cover_url,
      createdAt: episode.created_at,
      category: episode.category
    }));
  } catch (error) {
    console.error('Failed to fetch episodes:', error);
    throw error;
  }
}

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const episodes = await fetchEpisodesFromDB();
    res.json({
      success: true,
      data: episodes
    });
  } catch (error) {
    console.error('Error in /api/episodes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch episodes'
    });
  }
};
