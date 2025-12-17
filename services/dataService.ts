import { supabase } from './supabaseClient';
import { User, TrainingSession, LocationDef, WorkoutType } from '../types';
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
const DEFAULT_LOCATIONS: LocationDef[] = [
    { id: '1', name: 'כיכר הפרפר, נס ציונה', address: 'כיכר הפרפר, נס ציונה', color: '#A3E635' },
    { id: '2', name: 'סטודיו נס ציונה', address: 'נס ציונה', color: '#3B82F6' }
];

export const dataService = {
  // --- USERS ---
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

  // --- SESSIONS ---
  getSessions: async (): Promise<TrainingSession[]> => {
    if (supabase) {
      const { data, error } = await supabase.from('sessions').select('*');
      if (error) throw error;
      if (data) return data as TrainingSession[];
    }
    return safeJsonParse<TrainingSession[]>('niv_app_sessions', INITIAL_SESSIONS);
  },

  addSession: async (session: TrainingSession): Promise<void> => {
    if (supabase) {
      const safeSession = {
          ...session,
          registeredPhoneNumbers: session.registeredPhoneNumbers || [],
          attendedPhoneNumbers: session.attendedPhoneNumbers || []
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
       const safeSession = {
          ...session,
          registeredPhoneNumbers: session.registeredPhoneNumbers || [],
          attendedPhoneNumbers: session.attendedPhoneNumbers || []
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
       if (!error && data && data.length > 0) return data as LocationDef[];
    }
    return safeJsonParse<LocationDef[]>('niv_app_locations', DEFAULT_LOCATIONS);
  },
  
  saveLocations: async (locations: LocationDef[]): Promise<void> => {
    if (supabase) {
        // Simple replace strategy for simplicity: Delete all and insert all
        // In production, better to upsert, but since this is small config, this ensures full sync.
        // HOWEVER, Supabase delete all requires a where clause.
        // Safer approach: Upsert each.
        const { error } = await supabase.from('config_locations').upsert(locations);
        if (error) {
             console.error("Error saving locations:", error);
             // Fallback to local if table doesn't exist yet
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
      // Also update local cache
      const current = safeJsonParse<LocationDef[]>('niv_app_locations', DEFAULT_LOCATIONS);
      localStorage.setItem('niv_app_locations', JSON.stringify(current.filter(l => l.id !== id)));
  },

  // --- WORKOUT TYPES ---
  getWorkoutTypes: async (): Promise<string[]> => {
      if (supabase) {
          const { data, error } = await supabase.from('config_workout_types').select('*');
          if (!error && data && data.length > 0) return data.map((t:any) => t.name);
      }
      return safeJsonParse<string[]>('niv_app_types', DEFAULT_TYPES);
  },

  saveWorkoutTypes: async (types: string[]): Promise<void> => {
      if (supabase) {
           // We store them as { id: name, name: name } for simplicity
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
  }
};