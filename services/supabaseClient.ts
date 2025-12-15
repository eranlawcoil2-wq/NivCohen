import { createClient } from '@supabase/supabase-js';

// Access environment variables safely with fallback
const env = (import.meta as any).env || {};

// Priority: 1. LocalStorage (User input via Admin Panel) 2. Environment Variables
const localUrl = localStorage.getItem('niv_app_supabase_url');
const localKey = localStorage.getItem('niv_app_supabase_key');

const supabaseUrl = localUrl || env.VITE_SUPABASE_URL;
const supabaseKey = localKey || env.VITE_SUPABASE_ANON_KEY;

export const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;