import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL || 'https://iceyvqmewggxhouhzpll.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljZXl2cW1ld2dneGhvdWh6cGxsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc0OTIwNDcsImV4cCI6MjA4MzA2ODA0N30.6GXR52SmMkwY3nuZsoiO-bQQgJ_BcoHfTbXfY3_X2xY';

export const supabase = createClient(supabaseUrl, supabaseKey);

// Types
export interface Episode {
  id: string;
  title: string;
  description: string | null;
  coverImage: string | null;
  createdAt: string;
  category: string | null;
  duration?: number | null;
  audioUrl?: string | null;
  transcript?: string | null;
  host?: string | null;
  episodeNumber?: number | null;
  tags?: string[] | null;
  fullDescription?: string | null;
}

interface EpisodeRow {
  id: string;
  title: string;
  excerpt: string | null;
  cover_url: string | null;
  created_at: string;
  category: string | null;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Fetch functions
export async function fetchEpisodes(): Promise<Episode[]> {
  const { data, error } = await supabase
    .from('episodes')
    .select('*')
    .eq('status', 'completed')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching episodes:', error);
    throw error;
  }

  return (data as any[]).map((episode) => ({
    id: episode.id,
    title: episode.title,
    description: episode.excerpt,
    coverImage: episode.cover_url,
    createdAt: episode.created_at,
    category: episode.category,
    // Include any additional fields that might exist
    duration: episode.duration || episode.length || null,
    audioUrl: episode.audio_url || episode.audio || null,
    transcript: episode.transcript || null,
    host: episode.host || episode.author || null,
    episodeNumber: episode.episode_number || episode.number || null,
    tags: episode.tags || null,
    fullDescription: episode.description || episode.full_description || null,
  }));
}

export async function fetchEpisodeById(id: string): Promise<Episode | null> {
  const { data, error } = await supabase
    .from('episodes')
    .select('*')
    .eq('id', id)
    .eq('status', 'completed')
    .single();

  if (error) {
    console.error('Error fetching episode:', error);
    return null;
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    title: data.title,
    description: data.excerpt,
    coverImage: data.cover_url,
    createdAt: data.created_at,
    category: data.category,
    duration: data.duration || data.length || null,
    audioUrl: data.audio_url || data.audio || null,
    transcript: data.transcript || null,
    host: data.host || data.author || null,
    episodeNumber: data.episode_number || data.number || null,
    tags: data.tags || null,
    fullDescription: data.description || data.full_description || null,
  };
}

export async function fetchCategories(): Promise<string[]> {
  const { data, error } = await supabase
    .from('episodes')
    .select('category')
    .eq('status', 'completed')
    .not('category', 'is', null);

  if (error) {
    console.error('Error fetching categories:', error);
    throw error;
  }

  return [...new Set((data as { category: string | null }[]).map((e) => e.category))]
    .filter((category): category is string => category !== null)
    .sort();
}
