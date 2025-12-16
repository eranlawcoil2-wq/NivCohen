import { createClient } from '@supabase/supabase-js';

// פרטי התחברות לשרת (Supabase)
const HARDCODED_URL = 'https://xjqlluobnzpgpttprmio.supabase.co'; 
const HARDCODED_KEY = 'sb_publishable_WyvAmRCYPahTpaQAwqiyjQ_NEGFK5wN';

// Access environment variables safely with fallback
const env = (import.meta as any).env || {};

const localUrl = typeof window !== 'undefined' ? localStorage.getItem('niv_app_supabase_url') : null;
const localKey = typeof window !== 'undefined' ? localStorage.getItem('niv_app_supabase_key') : null;

// Logic to select the best available key (Prioritize Hardcoded values for User Ease)
const supabaseUrl = HARDCODED_URL || env.VITE_SUPABASE_URL || localUrl;
const supabaseKey = HARDCODED_KEY || env.VITE_SUPABASE_ANON_KEY || localKey;

// Helper to check if a URL is roughly valid to prevent crashes
const isValidUrl = (url: string | null) => url && (url.startsWith('http://') || url.startsWith('https://'));

// Create the client ONLY if we have valid-looking credentials
export const supabase = (supabaseUrl && isValidUrl(supabaseUrl) && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;