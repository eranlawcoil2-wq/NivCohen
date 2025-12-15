import { supabase } from './supabaseClient';
import { User, TrainingSession } from '../types';
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

export const dataService = {
  // --- USERS ---
  getUsers: async (): Promise<User[]> => {
    if (supabase) {
      const { data, error } = await supabase.from('users').select('*');
      if (!error && data) return data as User[];
    }
    return safeJsonParse<User[]>('niv_app_users', INITIAL_USERS);
  },

  addUser: async (user: User): Promise<void> => {
    if (supabase) {
      await supabase.from('users').insert([user]);
    } else {
      const users = safeJsonParse<User[]>('niv_app_users', INITIAL_USERS);
      localStorage.setItem('niv_app_users', JSON.stringify([...users, user]));
    }
  },

  updateUser: async (user: User): Promise<void> => {
    if (supabase) {
      await supabase.from('users').update(user).eq('id', user.id);
    } else {
      const users = safeJsonParse<User[]>('niv_app_users', INITIAL_USERS);
      const updated = users.map(u => u.id === user.id ? user : u);
      localStorage.setItem('niv_app_users', JSON.stringify(updated));
    }
  },

  deleteUser: async (userId: string): Promise<void> => {
    if (supabase) {
      await supabase.from('users').delete().eq('id', userId);
    } else {
      const users = safeJsonParse<User[]>('niv_app_users', INITIAL_USERS);
      localStorage.setItem('niv_app_users', JSON.stringify(users.filter(u => u.id !== userId)));
    }
  },

  // --- SESSIONS ---
  getSessions: async (): Promise<TrainingSession[]> => {
    if (supabase) {
      const { data, error } = await supabase.from('sessions').select('*');
      if (!error && data) return data as TrainingSession[];
    }
    return safeJsonParse<TrainingSession[]>('niv_app_sessions', INITIAL_SESSIONS);
  },

  addSession: async (session: TrainingSession): Promise<void> => {
    if (supabase) {
      await supabase.from('sessions').insert([session]);
    } else {
      const sessions = safeJsonParse<TrainingSession[]>('niv_app_sessions', INITIAL_SESSIONS);
      localStorage.setItem('niv_app_sessions', JSON.stringify([...sessions, session]));
    }
  },

  updateSession: async (session: TrainingSession): Promise<void> => {
    if (supabase) {
      await supabase.from('sessions').update(session).eq('id', session.id);
    } else {
      const sessions = safeJsonParse<TrainingSession[]>('niv_app_sessions', INITIAL_SESSIONS);
      const updated = sessions.map(s => s.id === session.id ? session : s);
      localStorage.setItem('niv_app_sessions', JSON.stringify(updated));
    }
  },

  deleteSession: async (sessionId: string): Promise<void> => {
    if (supabase) {
      await supabase.from('sessions').delete().eq('id', sessionId);
    } else {
      const sessions = safeJsonParse<TrainingSession[]>('niv_app_sessions', INITIAL_SESSIONS);
      localStorage.setItem('niv_app_sessions', JSON.stringify(sessions.filter(s => s.id !== sessionId)));
    }
  }
};
