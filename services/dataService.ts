import { supabase } from './supabaseClient';
import { User, TrainingSession, LocationDef, WorkoutType, AppConfig, Quote } from '../types';
import { INITIAL_USERS, INITIAL_SESSIONS } from '../constants';

// Safe LocalStorage Parser
function safeJsonParse<T>(key: string, fallback: T): T {
    try {
        const item = localStorage.getItem(key);
        if (!item) return fallback;
        const parsed = JSON.parse(item);
        if (parsed === null || parsed === undefined) return fallback;
        return parsed;
    } catch (error) {
        console.error(`Error parsing localStorage key "${key}":`, error);
        return fallback;
    }
}

const DEFAULT_TYPES = Object.values(WorkoutType);

// UPDATED DEFAULTS to match user preference (Ness Ziona)
const DEFAULT_LOCATIONS: LocationDef[] = [
    { id: '1', name: 'כיכר הפרפר, נס ציונה', address: 'כיכר הפרפר, נס ציונה', color: '#A3E635' },
    { id: '2', name: 'סטודיו נס ציונה', address: 'נס ציונה', color: '#3B82F6' }
];

const DEFAULT_CONFIG: AppConfig = {
    coachNameHeb: 'ניב כהן',
    coachNameEng: 'NIV COHEN',
    coachPhone: '0500000000',
    coachAdditionalPhone: 'admin', // Default password set to 'admin'
    coachEmail: '',
    defaultCity: 'נס ציונה'
};

export const dataService = {
  // --- USERS ---
  getUsers: async (): Promise<User[]> => {
    if (supabase) {
      const { data, error } = await supabase.from('users').select('*');
      if (error) throw error;
      // If connected to cloud, return cloud data (even if empty). Do NOT fallback to demo users.
      if (data) return data as User[];
    }
    // Local mode fallback
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

  // --- SESSIONS ---
  getSessions: async (): Promise<TrainingSession[]> => {
    if (supabase) {
      const { data, error } = await supabase.from('sessions').select('*');
      if (error) throw error;
      // If connected to cloud, return cloud data (even if empty). Do NOT fallback to demo sessions.
      if (data) return data.map((s: any) => ({
          ...s,
          waitingList: s.waitingList || [] // Ensure waitingList exists
      })) as TrainingSession[];
    }
    return safeJsonParse<TrainingSession[]>('niv_app_sessions', INITIAL_SESSIONS);
  },

  addSession: async (session: TrainingSession): Promise<void> => {
    if (supabase) {
      // NOTE: We do NOT force attendedPhoneNumbers to [] here. 
      // We want it to be undefined/null so AdminPanel knows it hasn't been marked yet.
      const safeSession = {
          ...session,
          registeredPhoneNumbers: session.registeredPhoneNumbers || [],
          // attendedPhoneNumbers: session.attendedPhoneNumbers, // Leave as is (should be null/undefined initially)
          waitingList: session.waitingList || []
      };
      const { error } = await supabase.from('sessions').insert([safeSession]);
      if (error) throw error;
    } else {
      const sessions = safeJsonParse<TrainingSession[]>('niv_app_sessions', INITIAL_SESSIONS);
      localStorage.setItem('niv_app_sessions', JSON.stringify([...sessions, session]));
    }
  },

  updateSession: async (session: TrainingSession): Promise<void> => {
    if (supabase) {
       // Ensure arrays are never undefined to avoid SQL errors on array columns
       const safeSession = {
          ...session,
          registeredPhoneNumbers: session.registeredPhoneNumbers || [],
          waitingList: session.waitingList || []
          // attendedPhoneNumbers is purposely left to spread from session. 
          // If undefined in session, it won't update the column (good). 
          // If null, it sets to NULL (good for reset).
          // If array, it updates (good).
      };
      
      const { error } = await supabase.from('sessions').update(safeSession).eq('id', session.id);
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

  // --- LOCATIONS ---
  getLocations: async (): Promise<LocationDef[]> => {
    if (supabase) {
       const { data, error } = await supabase.from('config_locations').select('*');
       if (!error && data) return data as LocationDef[];
    }
    
    // Local storage fallback
    return safeJsonParse<LocationDef[]>('niv_app_locations', DEFAULT_LOCATIONS);
  },
  
  saveLocations: async (locations: LocationDef[]): Promise<void> => {
    if (supabase) {
        const { error } = await supabase.from('config_locations').upsert(locations);
        if (error) {
             console.error("Error saving locations:", error);
             localStorage.setItem('niv_app_locations', JSON.stringify(locations));
        }
    } else {
        localStorage.setItem('niv_app_locations', JSON.stringify(locations));
    }
  },

  deleteLocation: async (id: string): Promise<void> => {
      if (supabase) {
          const { error } = await supabase.from('config_locations').delete().eq('id', id);
          if (error) throw error;
      }
      const current = safeJsonParse<LocationDef[]>('niv_app_locations', DEFAULT_LOCATIONS);
      localStorage.setItem('niv_app_locations', JSON.stringify(current.filter(l => l.id !== id)));
  },

  // --- WORKOUT TYPES ---
  getWorkoutTypes: async (): Promise<string[]> => {
      if (supabase) {
          const { data, error } = await supabase.from('config_workout_types').select('*');
          if (!error && data && data.length > 0) return data.map((t:any) => t.name);
          if (!error && data && data.length === 0) return [];
      }
      return safeJsonParse<string[]>('niv_app_types', DEFAULT_TYPES);
  },

  saveWorkoutTypes: async (types: string[]): Promise<void> => {
      if (supabase) {
           const records = types.map(t => ({ id: t, name: t }));
           const { error } = await supabase.from('config_workout_types').upsert(records);
           if (error) console.error(error);
      }
      localStorage.setItem('niv_app_types', JSON.stringify(types));
  },
  
  deleteWorkoutType: async (type: string): Promise<void> => {
      if (supabase) {
          const { error } = await supabase.from('config_workout_types').delete().eq('id', type);
          if (error) console.error(error);
      }
      const current = safeJsonParse<string[]>('niv_app_types', DEFAULT_TYPES);
      localStorage.setItem('niv_app_types', JSON.stringify(current.filter(t => t !== type)));
  },

  // --- APP CONFIG ---
  getAppConfig: async (): Promise<AppConfig> => {
      if (supabase) {
          const { data, error } = await supabase.from('config_general').select('*').single();
          if (!error && data) return data as AppConfig;
      }
      return safeJsonParse<AppConfig>('niv_app_config', DEFAULT_CONFIG);
  },

  saveAppConfig: async (config: AppConfig): Promise<void> => {
      if (supabase) {
          const { error } = await supabase.from('config_general').upsert({ id: 'main', ...config });
          if (error) console.error(error);
      }
      localStorage.setItem('niv_app_config', JSON.stringify(config));
  },

  // --- QUOTES ---
  getQuotes: async (): Promise<Quote[]> => {
      if (supabase) {
          const { data, error } = await supabase.from('config_quotes').select('*');
          if (!error && data) return data as Quote[];
      }
      return safeJsonParse<Quote[]>('niv_app_quotes', []);
  },

  addQuote: async (quote: Quote): Promise<void> => {
      if (supabase) {
          const { error } = await supabase.from('config_quotes').insert([quote]);
          if (error) throw error;
      } else {
          const quotes = safeJsonParse<Quote[]>('niv_app_quotes', []);
          localStorage.setItem('niv_app_quotes', JSON.stringify([...quotes, quote]));
      }
  },

  deleteQuote: async (id: string): Promise<void> => {
      if (supabase) {
          const { error } = await supabase.from('config_quotes').delete().eq('id', id);
          if (error) throw error;
      } else {
          const quotes = safeJsonParse<Quote[]>('niv_app_quotes', []);
          localStorage.setItem('niv_app_quotes', JSON.stringify(quotes.filter(q => q.id !== id)));
      }
  }
};