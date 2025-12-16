import { createClient } from '@supabase/supabase-js';

// ==============================================================================
// פרטי התחברות ל-Supabase
// עודכן לפי הבקשה האחרונה שלך
// ==============================================================================

const PROJECT_URL = 'https://xjqlluobnzpgpttprmio.supabase.co';
const ANON_KEY = 'sb_publishable_WyvAmRCYPahTpaQAwqiyjQ_NEGFK5wN';

// ==============================================================================

// מנסה לקחת מהקוד (עדיפות עליונה), ואם אין - מנסה לקחת מהזיכרון המקומי
const FINAL_URL = PROJECT_URL || localStorage.getItem('niv_app_supabase_url') || '';
const FINAL_KEY = ANON_KEY || localStorage.getItem('niv_app_supabase_key') || '';

// בדיקה בסיסית שהערכים קיימים וארוכים מספיק
const isConfigured = FINAL_URL.length > 10 && FINAL_KEY.length > 20;

if (!isConfigured) {
    console.error('❌ שגיאה: לא הוזנו פרטי התחברות ל-Supabase בקובץ services/supabaseClient.ts');
} else {
    console.log('✅ Supabase מחובר בהצלחה עם הכתובת:', FINAL_URL);
}

export const supabase = isConfigured ? createClient(FINAL_URL, FINAL_KEY) : null;