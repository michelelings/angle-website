const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(cors());

// Serve static files
app.use(express.static('.'));

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL || 'https://iceyvqmewggxhouhzpll.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljZXl2cW1ld2dneGhvdWh6cGxsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc0OTIwNDcsImV4cCI6MjA4MzA2ODA0N30.6GXR52SmMkwY3nuZsoiO-bQQgJ_BcoHfTbXfY3_X2xY';

const supabase = createClient(supabaseUrl, supabaseKey);

// Cache configuration
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds
let episodesCache = null;
let cacheTimestamp = null;

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

/**
 * Get episodes with caching
 */
async function getEpisodes() {
  const now = Date.now();
  
  // Check if cache is valid
  if (episodesCache && cacheTimestamp && (now - cacheTimestamp) < CACHE_TTL) {
    console.log('Returning cached episodes');
    return episodesCache;
  }

  // Fetch fresh data
  console.log('Fetching fresh episodes from database');
  episodesCache = await fetchEpisodesFromDB();
  cacheTimestamp = now;
  
  return episodesCache;
}

/**
 * API endpoint to get completed episodes
 */
app.get('/api/episodes', async (req, res) => {
  try {
    const episodes = await getEpisodes();
    res.json({
      success: true,
      data: episodes,
      cached: cacheTimestamp && (Date.now() - cacheTimestamp) < CACHE_TTL
    });
  } catch (error) {
    console.error('Error in /api/episodes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch episodes'
    });
  }
});

/**
 * API endpoint to get unique categories
 */
app.get('/api/categories', async (req, res) => {
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
});

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start server with error handling
const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`API endpoint: http://localhost:${PORT}/api/episodes`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use.`);
    console.error(`Please either:`);
    console.error(`  1. Stop the process using port ${PORT}`);
    console.error(`  2. Set PORT environment variable to use a different port (e.g., PORT=3001 npm start)`);
    process.exit(1);
  } else {
    console.error('Server error:', error);
    process.exit(1);
  }
});
