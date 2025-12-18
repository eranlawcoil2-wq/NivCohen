
import { supabase } from './supabaseClient';
import { User, TrainingSession, LocationDef, WorkoutType, AppConfig, Quote } from '../types';
import { INITIAL_USERS, INITIAL_SESSIONS } from '../constants';

function safeJsonParse<T>(key: string, fallback: T): T {
    try {
        const item = localStorage.getItem(key);
        if (!item) return fallback;
        const parsed = JSON.parse(item);
        return parsed === null ? fallback : parsed;
    } catch (error) {
        console.error(`Error parsing localStorage key "${key}":`, error);
        return fallback;
    }
}

const DEFAULT_TYPES = Object.values(WorkoutType);

const DEFAULT_LOCATIONS: LocationDef[] = [
    { id: '1', name: 'כיכר הפרפר, נס ציונה', address: 'כיכר הפרפר, נס ציונה', color: '#A3E635' },
    { id: '2', name: 'סטודיו נס ציונה', address: 'נס ציונה', color: '#3B82F6' }
];

const DEFAULT_CONFIG: AppConfig = {
    coachNameHeb: 'ניב כהן',
    coachNameEng: 'NIV COHEN',
    coachPhone: '0528726618',
    coachAdditionalPhone: 'admin',
    coachEmail: '',
    defaultCity: 'נס ציונה',
    coachBio: `נעים מאוד, אני ניב. אני מאמין שכושר הוא לא רק מטרה, אלא דרך חיים של התמדה וחוסן.\n\nבנס ציונה, תחת כיפת השמיים ובאוויר הפתוח, אני מעביר אימונים אישיים וקבוצתיים שנועדו להוציא מכם את המקסימום. האווירה הדינמית של האימון הקבוצתי נותנת כוח, אבל אני יודע שלכל אחד יש את המכשולים האישיים שלו.\n\n"השיטה שלי משלבת את הכוח של הקבוצה עם דיוק של אימון אישי."\n\nאני מעודד את המתאמנים שלי לשלב מדי פעם אימון אישי נקודתי לחיזוק החולשות הספציפיות - זה מה שיוצר את ההתקדמות המהותית והופך אתכם לגרסה הטובה ביותר של עצמכם.`,
    healthDeclarationTemplate: 'אני מצהיר בזאת כי מצב בריאותי תקין ומאפשר לי לבצע פעילות גופנית מאומצת. אני מתחייב להודיע למאמן על כל שינוי במצבי הבריאותי. האימון מתבצע באחריותי המלאה.',
    healthDeclarationDownloadUrl: ''
};

export const dataService = {
  getUsers: async (): Promise<User[]> => {
    if (supabase) {
      const { data, error } = await supabase.from('users').select('*');
      if (error) throw error;
      if (data) return data as User[];
    }
    return safeJsonParse<User[]>('niv_app_users', INITIAL_USERS);
  },

  addUser: async (user: User): Promise<void> => {
    if (supabase) {
      const { error } = await supabase.from('users').insert([user]);
      if (error) throw error;
    } else {
      const users = safeJsonParse<User[]>('niv_app_users', INITIAL_USERS);
      localStorage.setItem('niv_app_users', JSON.stringify([...users, user]));
    }
  },

  updateUser: async (user: User): Promise<void> => {
    if (supabase) {
      const { error } = await supabase.from('users').update(user).eq('id', user.id);
      if (error) throw error;
    } else {
      const users = safeJsonParse<User[]>('niv_app_users', INITIAL_USERS);
      const updated = users.map(u => u.id === user.id ? user : u);
      localStorage.setItem('niv_app_users', JSON.stringify(updated));
    }
  },

  deleteUser: async (userId: string): Promise<void> => {
    if (supabase) {
      const { error } = await supabase.from('users').delete().eq('id', userId);
      if (error) throw error;
    } else {
      const users = safeJsonParse<User[]>('niv_app_users', INITIAL_USERS);
      localStorage.setItem('niv_app_users', JSON.stringify(users.filter(u => u.id !== userId)));
    }
  },

  getSessions: async (): Promise<TrainingSession[]> => {
    if (supabase) {
      const { data, error } = await supabase.from('sessions').select('*');
      if (error) throw error;
      if (data) return data.map((s: any) => ({ ...s, waitingList: s.waitingList || [] })) as TrainingSession[];
    }
    return safeJsonParse<TrainingSession[]>('niv_app_sessions', INITIAL_SESSIONS);
  },

  addSession: async (session: TrainingSession): Promise<void> => {
    if (supabase) {
      const { error } = await supabase.from('sessions').insert([{ ...session, registeredPhoneNumbers: session.registeredPhoneNumbers || [], waitingList: session.waitingList || [] }]);
      if (error) throw error;
    } else {
      const sessions = safeJsonParse<TrainingSession[]>('niv_app_sessions', INITIAL_SESSIONS);
      localStorage.setItem('niv_app_sessions', JSON.stringify([...sessions, session]));
    }
  },

  updateSession: async (session: TrainingSession): Promise<void> => {
    if (supabase) {
      const { error } = await supabase.from('sessions').update({ ...session, registeredPhoneNumbers: session.registeredPhoneNumbers || [], waitingList: session.waitingList || [] }).eq('id', session.id);
      if (error) throw error;
    } else {
      const sessions = safeJsonParse<TrainingSession[]>('niv_app_sessions', INITIAL_SESSIONS);
      const updated = sessions.map(s => s.id === session.id ? session : s);
      localStorage.setItem('niv_app_sessions', JSON.stringify(updated));
    }
  },

  deleteSession: async (sessionId: string): Promise<void> => {
    if (supabase) {
      const { error } = await supabase.from('sessions').delete().eq('id', sessionId);
      if (error) throw error;
    } else {
      const sessions = safeJsonParse<TrainingSession[]>('niv_app_sessions', INITIAL_SESSIONS);
      localStorage.setItem('niv_app_sessions', JSON.stringify(sessions.filter(s => s.id !== sessionId)));
    }
  },

  getLocations: async (): Promise<LocationDef[]> => {
    if (supabase) {
       const { data, error } = await supabase.from('config_locations').select('*');
       if (!error && data) return data as LocationDef[];
    }
    return safeJsonParse<LocationDef[]>('niv_app_locations', DEFAULT_LOCATIONS);
  },
  
  saveLocations: async (locations: LocationDef[]): Promise<void> => {
    if (supabase) {
        await supabase.from('config_locations').upsert(locations);
    }
    localStorage.setItem('niv_app_locations', JSON.stringify(locations));
  },

  deleteLocation: async (id: string): Promise<void> => {
      if (supabase) {
          await supabase.from('config_locations').delete().eq('id', id);
      }
      const current = safeJsonParse<LocationDef[]>('niv_app_locations', DEFAULT_LOCATIONS);
      localStorage.setItem('niv_app_locations', JSON.stringify(current.filter(l => l.id !== id)));
  },

  getWorkoutTypes: async (): Promise<string[]> => {
      if (supabase) {
          const { data, error } = await supabase.from('config_workout_types').select('*');
          if (!error && data && data.length > 0) return data.map((t:any) => t.name);
      }
      return safeJsonParse<string[]>('niv_app_types', DEFAULT_TYPES);
  },

  saveWorkoutTypes: async (types: string[]): Promise<void> => {
      if (supabase) {
           const records = types.map(t => ({ id: t, name: t }));
           await supabase.from('config_workout_types').upsert(records);
      }
      localStorage.setItem('niv_app_types', JSON.stringify(types));
  },
  
  deleteWorkoutType: async (type: string): Promise<void> => {
      if (supabase) {
          await supabase.from('config_workout_types').delete().eq('id', type);
      }
      const current = safeJsonParse<string[]>('niv_app_types', DEFAULT_TYPES);
      localStorage.setItem('niv_app_types', JSON.stringify(current.filter(t => t !== type)));
  },

  getAppConfig: async (): Promise<AppConfig> => {
      if (supabase) {
          const { data, error } = await supabase.from('config_general').select('*').single();
          if (!error && data) return data as AppConfig;
      }
      return safeJsonParse<AppConfig>('niv_app_config', DEFAULT_CONFIG);
  },

  saveAppConfig: async (config: AppConfig): Promise<void> => {
      if (supabase) {
          await supabase.from('config_general').upsert({ id: 'main', ...config });
      }
      localStorage.setItem('niv_app_config', JSON.stringify(config));
  },

  getQuotes: async (): Promise<Quote[]> => {
      if (supabase) {
          const { data, error } = await supabase.from('config_quotes').select('*');
          if (!error && data) return data as Quote[];
      }
      return safeJsonParse<Quote[]>('niv_app_quotes', []);
  },

  addQuote: async (quote: Quote): Promise<void> => {
      if (supabase) {
          await supabase.from('config_quotes').insert([quote]);
      } else {
          const quotes = safeJsonParse<Quote[]>('niv_app_quotes', []);
          localStorage.setItem('niv_app_quotes', JSON.stringify([...quotes, quote]));
      }
  },

  deleteQuote: async (id: string): Promise<void> => {
      if (supabase) {
          await supabase.from('config_quotes').delete().eq('id', id);
      } else {
          const quotes = safeJsonParse<Quote[]>('niv_app_quotes', []);
          localStorage.setItem('niv_app_quotes', JSON.stringify(quotes.filter(q => q.id !== id)));
      }
  }
};
