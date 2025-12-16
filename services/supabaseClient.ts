import { createClient } from '@supabase/supabase-js';

// --- קבועים לחיבור קבוע (עבור כל המשתמשים) ---
// כדי שהאתר יעבוד לכולם, המתכנת צריך להחליף את הערכים כאן.
// אם אתה לא יודע לערוך קוד, השאר את זה ככה והשתמש בחיבור הידני דרך פאנל הניהול.
const HARDCODED_URL = 'PASTE_YOUR_URL_HERE'; 
const HARDCODED_KEY = 'PASTE_YOUR_ANON_KEY_HERE';

// Access environment variables safely with fallback
const env = (import.meta as any).env || {};

// --- לוגיקה לבחירת מפתח ---
// סדר עדיפויות:
// 1. קוד קשיח (אם הוגדר ע"י מתכנת) - זה משפיע על כל המשתמשים.
// 2. משתני סביבה (אם יש).
// 3. אחסון מקומי (LocalStorage) - זה משפיע רק על המכשיר הנוכחי (מצוין לאדמין שרוצה להתחבר ממחשב זר).

const getSupabaseConfig = () => {
    // 1. Check Hardcoded
    if (HARDCODED_URL && HARDCODED_URL !== 'PASTE_YOUR_URL_HERE' && HARDCODED_KEY && HARDCODED_KEY !== 'PASTE_YOUR_ANON_KEY_HERE') {
        return { url: HARDCODED_URL, key: HARDCODED_KEY };
    }

    // 2. Check Environment Variables
    if (env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY) {
        return { url: env.VITE_SUPABASE_URL, key: env.VITE_SUPABASE_ANON_KEY };
    }

    // 3. Check LocalStorage (Client-side manual override)
    if (typeof window !== 'undefined') {
        const localUrl = localStorage.getItem('niv_app_supabase_url');
        const localKey = localStorage.getItem('niv_app_supabase_key');
        if (localUrl && localKey) {
            return { url: localUrl, key: localKey };
        }
    }

    return null;
};

const config = getSupabaseConfig();

// Create the client
export const supabase = config ? createClient(config.url, config.key) : null;