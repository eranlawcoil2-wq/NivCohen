import { createClient } from '@supabase/supabase-js';

// ==============================================================================
// 🔴 הוראות למאמן (ניב):
// 1. מחק את מה שכתוב בין הגרשיים בשורה PROJECT_URL והדבק את ה-URL שלך מ-Supabase.
// 2. מחק את מה שכתוב בין הגרשיים בשורה ANON_KEY והדבק את ה-Key שלך.
// 3. שמור את הקובץ. זהו! זה יעבוד לכולם.
// ==============================================================================

const PROJECT_URL: string = ''; // <-- הדבק כאן את ה-URL (למשל: https://xyz.supabase.co)
const ANON_KEY: string = '';    // <-- הדבק כאן את ה-Anon Key

// ==============================================================================

const isConfigured = PROJECT_URL.length > 5 && ANON_KEY.length > 10;

if (!isConfigured) {
    console.warn('⚠️ Supabase credentials are missing or too short in services/supabaseClient.ts');
} else {
    console.log('✅ Supabase Client Initialized with URL:', PROJECT_URL);
}

export const supabase = isConfigured ? createClient(PROJECT_URL, ANON_KEY) : null;