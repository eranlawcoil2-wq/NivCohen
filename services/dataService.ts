
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
    coachBio: `נעים מאוד, אני ניב כהן...`, healthDeclarationTemplate: 'אני מצהיר בזאת כי מצב בריאותי תקין...', healthDeclarationDownloadUrl: ''
};

export const dataService = {
  getUsers: async (): Promise<User[]> => {
    if (supabase) {
      const { data, error } = await supabase.from('users').select('*');
      if (!error && data) return data as User[];
    }
    return safeJsonParse<User[]>('niv_app_users', INITIAL_USERS);
  },

  addUser: async (user: User): Promise<void> => {
    if (supabase) await supabase.from('users').insert([user]);
    else {
      const users = safeJsonParse<User[]>('niv_app_users', INITIAL_USERS);
      localStorage.setItem('niv_app_users', JSON.stringify([...users, user]));
    }
  },

  updateUser: async (user: User): Promise<void> => {
    if (supabase) await supabase.from('users').update(user).eq('id', user.id);
    else {
      const users = safeJsonParse<User[]>('niv_app_users', INITIAL_USERS);
      localStorage.setItem('niv_app_users', JSON.stringify(users.map(u => u.id === user.id ? user : u)));
    }
  },

  deleteUser: async (userId: string): Promise<void> => {
    if (supabase) await supabase.from('users').delete().eq('id', userId);
    else {
      const users = safeJsonParse<User[]>('niv_app_users', INITIAL_USERS);
      localStorage.setItem('niv_app_users', JSON.stringify(users.filter(u => u.id !== userId)));
    }
  },

  getSessions: async (): Promise<TrainingSession[]> => {
    if (supabase) {
      const { data, error } = await supabase.from('sessions').select('*');
      if (!error && data) return data.map((s: any) => ({ 
          ...s, 
          registeredPhoneNumbers: s.registeredPhoneNumbers || [],
          waitingList: s.waitingList || [],
          attendedPhoneNumbers: s.attendedPhoneNumbers || [],
          isPersonalTraining: !!s.isPersonalTraining,
          isZoomSession: !!s.isZoomSession,
          isCancelled: !!s.isCancelled,
          manualHasStarted: !!s.manualHasStarted
      })) as TrainingSession[];
    }
    return safeJsonParse<TrainingSession[]>('niv_app_sessions', INITIAL_SESSIONS).map(s => ({
        ...s,
        isPersonalTraining: !!s.isPersonalTraining,
        isCancelled: !!s.isCancelled,
        manualHasStarted: !!s.manualHasStarted
    }));
  },

  addSession: async (session: TrainingSession): Promise<void> => {
    const data = {
        ...session,
        registeredPhoneNumbers: session.registeredPhoneNumbers || [],
        waitingList: session.waitingList || [],
        isPersonalTraining: !!session.isPersonalTraining,
        isZoomSession: !!session.isZoomSession,
        isCancelled: !!session.isCancelled,
        manualHasStarted: !!session.manualHasStarted
    };
    if (supabase) await supabase.from('sessions').insert([data]);
    else {
      const sessions = safeJsonParse<TrainingSession[]>('niv_app_sessions', INITIAL_SESSIONS);
      localStorage.setItem('niv_app_sessions', JSON.stringify([...sessions, data]));
    }
  },

  updateSession: async (session: TrainingSession): Promise<void> => {
    const { id, ...rest } = session;
    const data = {
        ...rest,
        registeredPhoneNumbers: session.registeredPhoneNumbers || [],
        attendedPhoneNumbers: session.attendedPhoneNumbers || [],
        waitingList: session.waitingList || [],
        isPersonalTraining: !!session.isPersonalTraining,
        isZoomSession: !!session.isZoomSession,
        isCancelled: !!session.isCancelled,
        manualHasStarted: !!session.manualHasStarted
    };
    if (supabase) {
        const { error } = await supabase.from('sessions').update(data).eq('id', id);
        if (error) console.error("Supabase Update Session Error:", error);
    } else {
      const sessions = safeJsonParse<TrainingSession[]>('niv_app_sessions', INITIAL_SESSIONS);
      localStorage.setItem('niv_app_sessions', JSON.stringify(sessions.map(s => s.id === id ? {id, ...data} : s)));
    }
  },

  deleteSession: async (sessionId: string): Promise<void> => {
    if (supabase) await supabase.from('sessions').delete().eq('id', sessionId);
    else {
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
    if (supabase) await supabase.from('config_locations').upsert(locations);
    localStorage.setItem('niv_app_locations', JSON.stringify(locations));
  },

  getWorkoutTypes: async (): Promise<string[]> => {
      if (supabase) {
          const { data, error } = await supabase.from('config_workout_types').select('*');
          if (!error && data && data.length > 0) return data.map((t:any) => t.name);
      }
      return safeJsonParse<string[]>('niv_app_types', DEFAULT_TYPES);
  },

  saveWorkoutTypes: async (types: string[]): Promise<void> => {
      if (supabase) await supabase.from('config_workout_types').upsert(types.map(t => ({ id: t, name: t })));
      localStorage.setItem('niv_app_types', JSON.stringify(types));
  },

  getAppConfig: async (): Promise<AppConfig> => {
      if (supabase) {
          const { data, error } = await supabase.from('config_general').select('*').single();
          if (!error && data) return data as AppConfig;
      }
      return safeJsonParse<AppConfig>('niv_app_config', DEFAULT_CONFIG);
  },

  saveAppConfig: async (config: AppConfig): Promise<void> => {
      if (supabase) await supabase.from('config_general').upsert({ id: 'main', ...config });
      localStorage.setItem('niv_app_config', JSON.stringify(config));
  },

  getQuotes: async (): Promise<Quote[]> => {
    if (supabase) {
      const { data, error } = await supabase.from('quotes').select('*');
      if (!error && data) return data as Quote[];
    }
    return safeJsonParse<Quote[]>('niv_app_quotes', []);
  },

  saveQuotes: async (quotes: Quote[]): Promise<void> => {
    if (supabase) await supabase.from('quotes').upsert(quotes);
    localStorage.setItem('niv_app_quotes', JSON.stringify(quotes));
  }
};
