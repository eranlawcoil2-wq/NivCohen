import { createClient } from '@supabase/supabase-js';

// --- הוראות חשובות ---
// כדי שהאתר יעבוד לכולם (בנייד ובמחשב) ללא צורך בהגדרות:
// 1. מחק את הטקסט 'PASTE_YOUR_URL_HERE' והדבק במקומו את ה-URL של הפרויקט שלך מ-Supabase.
// 2. מחק את הטקסט 'PASTE_YOUR_ANON_KEY_HERE' והדבק במקומו את ה-Anon Key שלך.
// --------------------

const HARDCODED_URL = 'PASTE_YOUR_URL_HERE'; 
const HARDCODED_KEY = 'PASTE_YOUR_ANON_KEY_HERE';

// Access environment variables safely with fallback
const env = (import.meta as any).env || {};

// Priority: 
// 1. Hardcoded in file (Best for public website)
// 2. Environment Variables (Best for developers)
// 3. LocalStorage (Fallback for testing)

const localUrl = typeof window !== 'undefined' ? localStorage.getItem('niv_app_supabase_url') : null;
const localKey = typeof window !== 'undefined' ? localStorage.getItem('niv_app_supabase_key') : null;

// Logic to select the best available key
const supabaseUrl = (HARDCODED_URL && HARDCODED_URL !== 'PASTE_YOUR_URL_HERE') ? HARDCODED_URL : (env.VITE_SUPABASE_URL || localUrl);
const supabaseKey = (HARDCODED_KEY && HARDCODED_KEY !== 'PASTE_YOUR_ANON_KEY_HERE') ? HARDCODED_KEY : (env.VITE_SUPABASE_ANON_KEY || localKey);

// Create the client
export const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;
