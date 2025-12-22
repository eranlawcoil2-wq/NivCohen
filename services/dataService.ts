
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
    coachNameHeb: 'ניב כהן', coachNameEng: 'NIV COHEN', coachPhone: '0528726618', coachAdditionalPhone: 'admin', coachEmail: '', defaultCity: 'נס ציונה',
    coachBio: `נעים מאוד, אני ניב כהן...`, healthDeclarationTemplate: 'אני מצהיר בזאת כי מצב בריאותי תקין ומאפשר ביצוע פעילות גופנית...', healthDeclarationDownloadUrl: ''
};

export const dataService = {
  getUsers: async (): Promise<User[]> => {
    if (supabase) {
      const { data, error } = await supabase.from('users').select('*');
      if (!error && data) return data as User[];
      if (error) console.warn("Supabase getUsers Error:", error.message);
    }
    return safeJsonParse<User[]>('niv_app_users', INITIAL_USERS);
  },

  addUser: async (user: User): Promise<void> => {
    const users = safeJsonParse<User[]>('niv_app_users', INITIAL_USERS);
    localStorage.setItem('niv_app_users', JSON.stringify([...users, user]));
    
    if (supabase) {
        const { error } = await supabase.from('users').insert([user]);
        if (error) {
            console.error("Supabase addUser Error:", error.message);
            throw error;
        }
    }
  },

  updateUser: async (user: User): Promise<void> => {
    const users = safeJsonParse<User[]>('niv_app_users', INITIAL_USERS);
    localStorage.setItem('niv_app_users', JSON.stringify(users.map(u => u.id === user.id ? user : u)));
    
    if (supabase) {
        const { error } = await supabase.from('users').update(user).eq('id', user.id);
        if (error) {
            console.error("Supabase updateUser Error:", error.message);
            throw error;
        }
    }
  },

  deleteUser: async (userId: string): Promise<void> => {
    const users = safeJsonParse<User[]>('niv_app_users', INITIAL_USERS);
    localStorage.setItem('niv_app_users', JSON.stringify(users.filter(u => u.id !== userId)));
    if (supabase) await supabase.from('users').delete().eq('id', userId);
  },

  getSessions: async (): Promise<TrainingSession[]> => {
    if (supabase) {
      const { data, error } = await supabase.from('sessions').select('*');
      if (!error && data) return data.map((s: any) => ({ 
          ...s, 
          registeredPhoneNumbers: Array.isArray(s.registeredPhoneNumbers) ? s.registeredPhoneNumbers : [],
          attendedPhoneNumbers: Array.isArray(s.attendedPhoneNumbers) ? s.attendedPhoneNumbers : [],
          isPersonalTraining: !!s.isPersonalTraining,
          isZoomSession: !!s.isZoomSession,
          isCancelled: !!s.isCancelled,
          manualHasStarted: s.manualHasStarted ?? null
      })) as TrainingSession[];
      if (error) console.warn("Supabase getSessions Error:", error.message);
    }
    return safeJsonParse<TrainingSession[]>('niv_app_sessions', INITIAL_SESSIONS).map(s => ({
        ...s,
        isPersonalTraining: !!s.isPersonalTraining,
        isCancelled: !!s.isCancelled,
        manualHasStarted: s.manualHasStarted ?? null,
        isZoomSession: !!s.isZoomSession
    }));
  },

  addSession: async (session: TrainingSession): Promise<void> => {
    const data = {
        id: session.id,
        type: session.type,
        date: session.date,
        time: session.time,
        location: session.location,
        maxCapacity: Number(session.maxCapacity),
        description: session.description || '',
        registeredPhoneNumbers: session.registeredPhoneNumbers || [],
        attendedPhoneNumbers: session.attendedPhoneNumbers || [],
        isPersonalTraining: !!session.isPersonalTraining,
        isZoomSession: !!session.isZoomSession,
        isCancelled: !!session.isCancelled,
        manualHasStarted: session.manualHasStarted
    };
    
    const sessions = safeJsonParse<TrainingSession[]>('niv_app_sessions', INITIAL_SESSIONS);
    localStorage.setItem('niv_app_sessions', JSON.stringify([...sessions, data]));

    if (supabase) {
        const { error } = await supabase.from('sessions').insert([data]);
        if (error) {
            console.error("Supabase addSession Error:", error.message);
            throw error;
        }
    }
  },

  updateSession: async (session: TrainingSession): Promise<void> => {
    const { id, ...rest } = session;
    const data = {
        type: session.type,
        date: session.date,
        time: session.time,
        location: session.location,
        maxCapacity: Number(session.maxCapacity),
        description: session.description || '',
        registeredPhoneNumbers: session.registeredPhoneNumbers || [],
        attendedPhoneNumbers: session.attendedPhoneNumbers || [],
        isPersonalTraining: !!session.isPersonalTraining,
        isZoomSession: !!session.isZoomSession,
        isCancelled: !!session.isCancelled,
        manualHasStarted: session.manualHasStarted
    };
    
    const sessions = safeJsonParse<TrainingSession[]>('niv_app_sessions', INITIAL_SESSIONS);
    localStorage.setItem('niv_app_sessions', JSON.stringify(sessions.map(s => s.id === id ? {id, ...data} : s)));

    if (supabase) {
        const { error } = await supabase.from('sessions').update(data).eq('id', id);
        if (error) {
            console.error("Supabase updateSession Error:", error.message);
            throw error;
        }
    }
  },

  deleteSession: async (sessionId: string): Promise<void> => {
    const sessions = safeJsonParse<TrainingSession[]>('niv_app_sessions', INITIAL_SESSIONS);
    localStorage.setItem('niv_app_sessions', JSON.stringify(sessions.filter(s => s.id !== sessionId)));
    if (supabase) await supabase.from('sessions').delete().eq('id', sessionId);
  },

  getLocations: async (): Promise<LocationDef[]> => {
    if (supabase) {
       const { data, error } = await supabase.from('config_locations').select('*');
       if (!error && data) return data as LocationDef[];
    }
    return safeJsonParse<LocationDef[]>('niv_app_locations', DEFAULT_LOCATIONS);
  },
  
  saveLocations: async (locations: LocationDef[]): Promise<void> => {
    localStorage.setItem('niv_app_locations', JSON.stringify(locations));
    if (supabase) {
        const { error } = await supabase.from('config_locations').upsert(locations);
        if (error) console.error("Supabase saveLocations Error:", error.message);
    }
  },

  getWorkoutTypes: async (): Promise<string[]> => {
      if (supabase) {
          const { data, error } = await supabase.from('config_workout_types').select('*');
          if (!error && data && data.length > 0) return data.map((t:any) => t.name);
      }
      return safeJsonParse<string[]>('niv_app_types', DEFAULT_TYPES);
  },

  saveWorkoutTypes: async (types: string[]): Promise<void> => {
      localStorage.setItem('niv_app_types', JSON.stringify(types));
      if (supabase) {
          const { error } = await supabase.from('config_workout_types').upsert(types.map(t => ({ id: t, name: t })));
          if (error) console.error("Supabase saveWorkoutTypes Error:", error.message);
      }
  },

  getAppConfig: async (): Promise<AppConfig> => {
      if (supabase) {
          const { data, error } = await supabase.from('config_general').select('*').limit(1).maybeSingle();
          if (!error && data) return data as AppConfig;
      }
      return safeJsonParse<AppConfig>('niv_app_config', DEFAULT_CONFIG);
  },

  saveAppConfig: async (config: AppConfig): Promise<void> => {
      // Always update local storage first as a safety measure
      localStorage.setItem('niv_app_config', JSON.stringify(config));
      
      if (supabase) {
          // Using explicit id 'main' and handling conflict for robust updates
          const { error } = await supabase
            .from('config_general')
            .upsert({ id: 'main', ...config }, { onConflict: 'id' });
            
          if (error) {
              console.error("Supabase saveAppConfig Detailed Error:", error);
              // Check if it's a field size limit (Postgres error 22001)
              if (error.code === '22001') {
                  throw new Error("הטקסט ארוך מדי עבור בסיס הנתונים. נסה לקצר מעט.");
              }
              throw error;
          }
      }
  },

  getQuotes: async (): Promise<Quote[]> => {
    if (supabase) {
      const { data, error } = await supabase.from('quotes').select('*');
      if (!error && data) return data as Quote[];
    }
    return safeJsonParse<Quote[]>('niv_app_quotes', []);
  },

  saveQuotes: async (quotes: Quote[]): Promise<void> => {
    localStorage.setItem('niv_app_quotes', JSON.stringify(quotes));
    if (supabase) {
        const { error } = await supabase.from('quotes').upsert(quotes);
        if (error) console.error("Supabase saveQuotes Error:", error.message);
    }
  }
};
