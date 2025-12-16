import { createClient } from '@supabase/supabase-js';

// --- הוראות חשובות ---
// 1. מחק את הטקסט 'PASTE_YOUR_URL_HERE' (כולל הגרש) והדבק במקומו את ה-URL שהעתקת מ-Supabase.
// 2. מחק את הטקסט 'PASTE_YOUR_ANON_KEY_HERE' (כולל הגרש) והדבק במקומו את ה-Anon Key שהעתקת.
// --------------------

const HARDCODED_URL = 'PASTE_YOUR_URL_HERE'; 
const HARDCODED_KEY = 'PASTE_YOUR_ANON_KEY_HERE';

// Access environment variables safely with fallback
const env = (import.meta as any).env || {};

const localUrl = typeof window !== 'undefined' ? localStorage.getItem('niv_app_supabase_url') : null;
const localKey = typeof window !== 'undefined' ? localStorage.getItem('niv_app_supabase_key') : null;

// Logic to select the best available key
const supabaseUrl = (HARDCODED_URL && HARDCODED_URL !== 'PASTE_YOUR_URL_HERE') ? HARDCODED_URL : (env.VITE_SUPABASE_URL || localUrl);
const supabaseKey = (HARDCODED_KEY && HARDCODED_KEY !== 'PASTE_YOUR_ANON_KEY_HERE') ? HARDCODED_KEY : (env.VITE_SUPABASE_ANON_KEY || localKey);

// Helper to check if a URL is roughly valid to prevent crashes
const isValidUrl = (url: string | null) => url && (url.startsWith('http://') || url.startsWith('https://'));

// Create the client ONLY if we have valid-looking credentials
export const supabase = (supabaseUrl && isValidUrl(supabaseUrl) && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;
