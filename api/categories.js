const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL || 'https://iceyvqmewggxhouhzpll.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljZXl2cW1ld2dneGhvdWh6cGxsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc0OTIwNDcsImV4cCI6MjA4MzA2ODA0N30.6GXR52SmMkwY3nuZsoiO-bQQgJ_BcoHfTbXfY3_X2xY';

const supabase = createClient(supabaseUrl, supabaseKey);

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
    const { data, error } = await supabase
      .from('episodes')
      .select('category')
      .eq('status', 'completed')
      .not('category', 'is', null);

    if (error) {
      console.error('Error fetching categories:', error);
      throw error;
    }

    // Get unique categories and sort them
    const categories = [...new Set(data.map(episode => episode.category))].sort();
    
    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Error in /api/categories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch categories'
    });
  }
};
