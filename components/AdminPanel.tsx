import React, { useState, useMemo, useEffect } from 'react';
import { User, TrainingSession, PaymentStatus, WeatherLocation, PaymentLink, LocationDef, AppConfig, Quote, WeatherInfo } from '../types';
import { Button } from './Button';
import { generateWorkoutDescription } from '../services/geminiService';
import { getCityCoordinates } from '../services/weatherService';
import { supabase } from '../services/supabaseClient';
import { SessionCard } from './SessionCard';

interface AdminPanelProps {
  users: User[];
  sessions: TrainingSession[];
  primaryColor: string;
  workoutTypes: string[];
  locations: LocationDef[];
  weatherLocation: WeatherLocation;
  weatherData?: Record<string, WeatherInfo>;
  paymentLinks: PaymentLink[];
  streakGoal: number; 
  appConfig: AppConfig;
  quotes?: Quote[];
  onAddUser: (user: User) => void;
  onUpdateUser: (user: User) => void;
  onDeleteUser: (userId: string) => void; 
  onAddSession: (session: TrainingSession) => void;
  onUpdateSession: (session: TrainingSession) => void;
  onDeleteSession: (id: string) => void;
  onColorChange: (color: string) => void;
  onUpdateWorkoutTypes: (types: string[]) => void; 
  onUpdateLocations: (locations: LocationDef[]) => void;
  onUpdateWeatherLocation: (location: WeatherLocation) => void;
  onAddPaymentLink: (link: PaymentLink) => void;
  onDeletePaymentLink: (id: string) => void;
  onUpdateStreakGoal: (goal: number) => void;
  onUpdateAppConfig: (config: AppConfig) => void;
  onAddQuote?: (text: string) => void;
  onDeleteQuote?: (id: string) => void;
  onExitAdmin: () => void;
}

const SESSION_COLORS = [
    '#A3E635', '#3B82F6', '#EF4444', '#F59E0B', 
    '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'
];

const SQL_SCRIPT = `
-- 1. וודא שכל העמודות קיימות בטבלת האימונים
alter table sessions add column if not exists "waitingList" jsonb default '[]';
alter table sessions add column if not exists "attendedPhoneNumbers" jsonb;
alter table sessions add column if not exists "isZoomSession" boolean default false;
alter table sessions add column if not exists "isHybrid" boolean default false;
alter table sessions add column if not exists "zoomLink" text;
alter table sessions add column if not exists "isHidden" boolean default false;
alter table sessions add column if not exists "isCancelled" boolean default false;
alter table sessions add column if not exists "manualHasStarted" boolean default false;
alter table sessions add column if not exists "color" text;

-- 2. וודא שכל העמודות קיימות בטבלת המשתמשים
alter table users add column if not exists "displayName" text;
alter table users add column if not exists "isRestricted" boolean default false;
alter table users add column if not exists "userColor" text;
alter table users add column if not exists "healthDeclarationFile" text;
alter table users add column if not exists "healthDeclarationDate" text;
alter table users add column if not exists "healthDeclarationId" text;
alter table users add column if not exists "isNew" boolean default false;

-- 3. יצירת טבלאות הגדרות אם לא קיימות
create table if not exists config_locations (id text primary key, name text, address text, color text);
create table if not exists config_workout_types (id text primary key, name text);
create table if not exists config_general (id text primary key, "coachNameHeb" text, "coachNameEng" text, "coachPhone" text, "coachAdditionalPhone" text, "coachEmail" text, "defaultCity" text, "urgentMessage" text);
create table if not exists config_quotes (id text primary key, text text);
`;

const getSunday = (d: Date) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day; 
  return new Date(date.setDate(diff));
};

const formatDateForInput = (date: Date) => date.toISOString().split('T')[0];

const normalizePhone = (phone: string): string => {
    if (!phone) return '';
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('972')) cleaned = '0' + cleaned.substring(3);
    return cleaned;
};

const normalizePhoneForWhatsapp = (phone: string): string => {
    let p = normalizePhone(phone);
    if (p.startsWith('0')) p = '972' + p.substring(1);
    return p;
};

export const AdminPanel: React.FC<AdminPanelProps> = ({ 
    users, sessions, primaryColor, workoutTypes, locations, weatherLocation, weatherData,
    paymentLinks, streakGoal, appConfig, quotes = [], onAddUser, onUpdateUser, onDeleteUser, 
    onAddSession, onUpdateSession, onDeleteSession, onColorChange,
    onUpdateWorkoutTypes, onUpdateLocations, onUpdateWeatherLocation,
    onAddPaymentLink, onDeletePaymentLink, onUpdateStreakGoal, onUpdateAppConfig, 
    onAddQuote, onDeleteQuote, onExitAdmin
}) => {
  const [activeTab, setActiveTab] = useState<'attendance' | 'users' | 'settings' | 'new_users' | 'connections'>('attendance');
  
  // User Form State
  const [formUser, setFormUser] = useState<Partial<User>>({
    fullName: '', displayName: '', phone: '', email: '',
    startDate: new Date().toISOString().split('T')[0],
    paymentStatus: PaymentStatus.PAID, userColor: '#A3E635', monthlyRecord: 0,
    isRestricted: false,
    healthDeclarationId: '',
    healthDeclarationDate: ''
  });
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  // Filter & Sort
  const [filterText, setFilterText] = useState('');
  const [sortKey, setSortKey] = useState<'fullName' | 'streak' | 'monthCount' | 'record' | 'payment' | 'health'>('fullName');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  const [copySourceDate, setCopySourceDate] = useState(formatDateForInput(new Date()));
  const [copyTargetDate, setCopyTargetDate] = useState(formatDateForInput(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)));
  const [citySearch, setCitySearch] = useState('');
  const [isSearchingCity, setIsSearchingCity] = useState(false);
  const [newQuoteText, setNewQuoteText] = useState('');

  // Settings
  const [newTypeName, setNewTypeName] = useState('');
  const [editingTypeOriginalName, setEditingTypeOriginalName] = useState<string | null>(null);
  const [newLocationName, setNewLocationName] = useState('');
  const [newLocationAddress, setNewLocationAddress] = useState('');
  const [newLocationColor, setNewLocationColor] = useState('#3B82F6');
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  
  // Feedback
  const [isSavingAttendance, setIsSavingAttendance] = useState(false);
  const [attendanceSavedSuccess, setAttendanceSavedSuccess] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editSavedSuccess, setEditSavedSuccess] = useState(false);

  const [tempConfig, setTempConfig] = useState<AppConfig>(appConfig);
  useEffect(() => { setTempConfig(appConfig); }, [appConfig]);

  const [sbUrl, setSbUrl] = useState(localStorage.getItem('niv_app_supabase_url') || '');
  const [sbKey, setSbKey] = useState(localStorage.getItem('niv_app_supabase_key') || '');

  const [weekOffset, setWeekOffset] = useState(0);
  const [attendanceSession, setAttendanceSession] = useState<TrainingSession | null>(null);
  const [markedAttendees, setMarkedAttendees] = useState<Set<string>>(new Set());
  const [isEditingInModal, setIsEditingInModal] = useState(false);
  const [editSessionForm, setEditSessionForm] = useState<Partial<TrainingSession>>({});

  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [isProcessingCopy, setIsProcessingCopy] = useState(false);
  const [messageText, setMessageText] = useState('');

  const newUsers = users.filter(u => u.isNew);
  const existingUsers = users.filter(u => !u.isNew);

  const getMonthlyWorkoutsCount = (userPhone: string) => {
    if (!userPhone) return 0;
    const normalizedPhone = normalizePhone(userPhone);
    const now = new Date();
    return sessions.filter(session => {
        const sessionDate = new Date(session.date);
        const hasAttendedList = session.attendedPhoneNumbers !== undefined && session.attendedPhoneNumbers !== null;
        let didAttend = hasAttendedList ? session.attendedPhoneNumbers!.includes(normalizedPhone) : session.registeredPhoneNumbers.includes(normalizedPhone);
        return sessionDate.getMonth() === now.getMonth() && sessionDate.getFullYear() === now.getFullYear() && didAttend;
    }).length;
  };

  const calculateStreak = (phone: string) => {
      if (!sessions || sessions.length === 0 || !phone) return 0;
      const normalized = normalizePhone(phone);
      const userSessions = sessions.filter(s => {
         const hasAttendedList = s.attendedPhoneNumbers !== undefined && s.attendedPhoneNumbers !== null;
         return hasAttendedList ? s.attendedPhoneNumbers!.includes(normalized) : s.registeredPhoneNumbers?.includes(normalized);
      }).map(s => new Date(s.date));

      if (userSessions.length === 0) return 0;
      const weeks: Record<string, number> = {};
      userSessions.forEach(d => {
          const day = d.getDay();
          const startOfWeek = new Date(d);
          startOfWeek.setDate(d.getDate() - day);
          startOfWeek.setHours(0,0,0,0);
          const key = startOfWeek.toISOString().split('T')[0];
          weeks[key] = (weeks[key] || 0) + 1;
      });

      let currentStreak = 0;
      let checkDate = new Date();
      checkDate.setDate(checkDate.getDate() - checkDate.getDay());
      checkDate.setHours(0,0,0,0);

      while(true) {
          const count = weeks[checkDate.toISOString().split('T')[0]] || 0;
          if (count >= 3) { currentStreak++; } 
          else if (checkDate.getTime() < Date.now() - 7 * 24 * 60 * 60 * 1000) break;
          checkDate.setDate(checkDate.getDate() - 7);
          if (checkDate.getFullYear() < 2023) break;
      }
      return currentStreak;
  };

  const sortedAndFilteredUsers = useMemo(() => {
      return existingUsers.filter(u => u.fullName.includes(filterText) || u.phone.includes(filterText))
      .sort((a, b) => {
          let valA: any = a.fullName, valB: any = b.fullName;
          if (sortKey === 'streak') { valA = calculateStreak(a.phone); valB = calculateStreak(b.phone); }
          else if (sortKey === 'monthCount') { valA = getMonthlyWorkoutsCount(a.phone); valB = getMonthlyWorkoutsCount(b.phone); }
          if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
          if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
          return 0;
      });
  }, [existingUsers, filterText, sortKey, sortDirection, sessions]);

  const weekDates = useMemo(() => {
    const curr = new Date();
    const diff = curr.getDate() - curr.getDay() + (weekOffset * 7);
    const start = new Date(curr.setDate(diff));
    return Array.from({length: 7}, (_, i) => {
        const d = new Date(start); d.setDate(start.getDate() + i);
        return d.toISOString().split('T')[0];
    });
  }, [weekOffset]);

  const groupedSessions = sessions.reduce((acc, s) => ({...acc, [s.date]: [...(acc[s.date]||[]), s]}), {} as Record<string, TrainingSession[]>);

  const handleQuickAddSession = () => {
      const today = new Date().toISOString().split('T')[0];
      const newSession: TrainingSession = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 5), 
          type: workoutTypes[0] || 'אימון', date: today, time: '18:00', location: locations[0]?.name || '',
          maxCapacity: 15, registeredPhoneNumbers: [], attendedPhoneNumbers: undefined, waitingList: [],
          description: '', color: SESSION_COLORS[0], isHidden: false, isCancelled: false
      };
      setAttendanceSession(newSession); 
      setEditSessionForm(newSession);   
      setIsEditingInModal(true);        
  };

  const openAttendanceModal = (session: TrainingSession) => {
      setAttendanceSession(session);
      setIsEditingInModal(false); 
      setMessageText(`היי! תזכורת לאימון ${session.type} היום ב-${session.time} ב${session.location}. 💪`);
      setMarkedAttendees(new Set(session.attendedPhoneNumbers === undefined || session.attendedPhoneNumbers === null ? session.registeredPhoneNumbers : session.attendedPhoneNumbers));
  };

  const saveAttendance = async () => {
      if (!attendanceSession) return;
      setIsSavingAttendance(true);
      try {
          await onUpdateSession({...attendanceSession, attendedPhoneNumbers: Array.from(markedAttendees)});
          setAttendanceSavedSuccess(true);
          setTimeout(() => { setAttendanceSavedSuccess(false); setAttendanceSession(null); }, 1500);
      } catch (error) { alert('שגיאה בשמירה - וודא שביצעת "עדכון שרת" בטאב חיבורים'); } 
      finally { setIsSavingAttendance(false); }
  };

  const handleSaveEditedSession = async () => {
      if (!editSessionForm.id || !editSessionForm.type || !editSessionForm.date) return;
      setIsSavingEdit(true);
      const sessionToSave = { ...attendanceSession, ...editSessionForm } as TrainingSession;
      try {
          if (sessions.some(s => s.id === sessionToSave.id)) { await onUpdateSession(sessionToSave); } 
          else { await onAddSession(sessionToSave); }
          setEditSavedSuccess(true);
          setTimeout(() => { setEditSavedSuccess(false); setAttendanceSession(null); setIsEditingInModal(false); }, 1500);
      } catch (error: any) { alert('שגיאה בשמירה: וודא שהרצת את קוד ה-SQL בטאב "חיבורים"'); } 
      finally { setIsSavingEdit(false); }
  };

  // Fix: Adding missing handleCopySql function to handle the SQL script copy action in the Connections tab
  const handleCopySql = () => {
      navigator.clipboard.writeText(SQL_SCRIPT);
      alert('סקריפט ה-SQL הועתק ללוח!');
  };

  return (
    <div className="p-4 bg-gray-900 rounded-lg pb-24 text-right">
      <div className="flex justify-between items-center mb-4 sticky top-0 bg-gray-900 z-10 py-2 border-b border-gray-800">
        <h2 className="text-2xl font-bold text-white">פאנל ניהול</h2>
        <button onClick={onExitAdmin} className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-lg text-sm font-bold">חזרה לאתר 🏠</button>
      </div>
      
      <div className="flex gap-4 mb-6 overflow-x-auto no-scrollbar pb-2">
         {['attendance', 'users', 'settings', 'connections'].map(tab => (
             <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-4 py-2 rounded whitespace-nowrap ${activeTab === tab ? 'bg-brand-primary text-brand-black' : 'bg-gray-700 text-gray-300'}`}>
                 {tab === 'attendance' ? 'יומן ונוכחות' : tab === 'users' ? 'מתאמנים' : tab === 'settings' ? 'הגדרות' : 'חיבורים'}
             </button>
         ))}
      </div>

      {activeTab === 'attendance' && (
          <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
              <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold text-white">יומן אימונים</h3>
                  <Button size="sm" onClick={handleQuickAddSession}>+ אימון חדש</Button>
              </div>
              <div className="grid gap-4">
                  {weekDates.map(date => (
                      <div key={date} className="rounded-xl overflow-hidden border border-gray-700 bg-gray-900/30">
                          <div className="flex flex-col md:flex-row">
                              <div className="p-4 md:w-32 text-center border-b md:border-b-0 md:border-l border-gray-700 bg-gray-800 text-gray-400">
                                  <p className="text-lg font-black">{new Date(date).toLocaleDateString('he-IL', {weekday:'long'})}</p>
                                  <p className="text-sm opacity-70">{date.split('-').reverse().slice(0,2).join('/')}</p>
                              </div>
                              <div className="flex-1 p-3 grid grid-cols-2 md:grid-cols-4 gap-2">
                                  {(groupedSessions[date] || []).sort((a,b)=>a.time.localeCompare(b.time)).map(s => (
                                      <div key={s.id} onClick={() => openAttendanceModal(s)}>
                                          <SessionCard session={s} allUsers={users} isRegistered={false} onRegisterClick={() => {}} onViewDetails={() => {}} locations={locations} isAdmin={true} />
                                      </div>
                                  ))}
                              </div>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {attendanceSession && (
         <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setAttendanceSession(null)}>
            <div className="bg-gray-800 p-6 rounded-2xl w-full max-w-lg border border-gray-700 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                 {isEditingInModal ? (
                      <div className="space-y-4">
                          <h3 className="text-xl font-bold text-white mb-2">עריכת אימון</h3>
                          <div className="grid grid-cols-2 gap-2">
                              <select className="bg-gray-900 text-white p-3 rounded border border-gray-700" value={editSessionForm.type} onChange={e=>setEditSessionForm({...editSessionForm, type: e.target.value})}>{workoutTypes.map(t=><option key={t} value={t}>{t}</option>)}</select>
                              <select className="bg-gray-900 text-white p-3 rounded border border-gray-700" value={editSessionForm.location} onChange={e=>setEditSessionForm({...editSessionForm, location: e.target.value})}>{locations.map(l=><option key={l.id} value={l.name}>{l.name}</option>)}</select>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                              <input type="date" className="bg-gray-900 text-white p-3 rounded border border-gray-700" value={editSessionForm.date} onChange={e=>setEditSessionForm({...editSessionForm, date: e.target.value})}/>
                              <input type="time" className="bg-gray-900 text-white p-3 rounded border border-gray-700" value={editSessionForm.time} onChange={e=>setEditSessionForm({...editSessionForm, time: e.target.value})}/>
                          </div>
                          
                          {/* FORMAT SELECTION */}
                          <div className="bg-gray-900 p-3 rounded border border-gray-700 space-y-2">
                              <label className="text-xs text-gray-400 block mb-1">פורמט אימון:</label>
                              <div className="grid grid-cols-3 gap-2">
                                  <button 
                                    onClick={() => setEditSessionForm({...editSessionForm, isZoomSession: false, isHybrid: false})}
                                    className={`p-2 rounded text-xs font-bold border transition-colors ${!editSessionForm.isZoomSession && !editSessionForm.isHybrid ? 'bg-brand-primary text-brand-black border-brand-primary' : 'bg-gray-800 text-gray-400 border-gray-700'}`}
                                  >🏠 שטח בלבד</button>
                                  <button 
                                    onClick={() => setEditSessionForm({...editSessionForm, isZoomSession: true, isHybrid: false})}
                                    className={`p-2 rounded text-xs font-bold border transition-colors ${editSessionForm.isZoomSession && !editSessionForm.isHybrid ? 'bg-blue-600 text-white border-blue-500' : 'bg-gray-800 text-gray-400 border-gray-700'}`}
                                  >🎥 זום בלבד</button>
                                  <button 
                                    onClick={() => setEditSessionForm({...editSessionForm, isZoomSession: true, isHybrid: true})}
                                    className={`p-2 rounded text-xs font-bold border transition-colors ${editSessionForm.isZoomSession && editSessionForm.isHybrid ? 'bg-purple-600 text-white border-purple-500' : 'bg-gray-800 text-gray-400 border-gray-700'}`}
                                  >🏠+🎥 היברידי</button>
                              </div>
                          </div>

                          {(editSessionForm.isZoomSession || editSessionForm.isHybrid) && (
                             <input type="text" placeholder="לינק לזום (zoom.us/...)" className="w-full bg-gray-900 text-white p-3 rounded border border-gray-700 dir-ltr text-left" value={editSessionForm.zoomLink || ''} onChange={e=>setEditSessionForm({...editSessionForm, zoomLink: e.target.value})}/>
                          )}

                          <div className="grid grid-cols-2 gap-2">
                              <input type="number" placeholder="מקסימום משתתפים" className="bg-gray-900 text-white p-3 rounded border border-gray-700" value={editSessionForm.maxCapacity} onChange={e=>setEditSessionForm({...editSessionForm, maxCapacity: parseInt(e.target.value)})}/>
                              <div className="flex items-center bg-red-900/30 p-2 rounded border border-red-800 cursor-pointer" onClick={()=>setEditSessionForm({...editSessionForm, isCancelled: !editSessionForm.isCancelled})}>
                                  <input type="checkbox" checked={editSessionForm.isCancelled || false} className="w-4 h-4 ml-2 accent-red-500"/>
                                  <span className="text-red-300 text-xs font-bold">אימון מבוטל</span>
                              </div>
                          </div>
                          
                          <div className="flex gap-2">
                              <textarea placeholder="תיאור האימון..." className="w-full bg-gray-900 text-white p-3 rounded border border-gray-700 h-20" value={editSessionForm.description || ''} onChange={e=>setEditSessionForm({...editSessionForm, description: e.target.value})}/>
                              <Button variant="secondary" onClick={async () => {setIsGeneratingAi(true); const d = await generateWorkoutDescription(editSessionForm.type as any, editSessionForm.location!); setEditSessionForm({...editSessionForm, description: d}); setIsGeneratingAi(false);}} isLoading={isGeneratingAi} className="h-20 px-2 text-xs">AI ✨</Button>
                          </div>
                          
                          <div className="flex gap-2 pt-2">
                              <Button onClick={handleSaveEditedSession} className={`flex-1 py-3 text-lg transition-all ${editSavedSuccess ? 'bg-green-600' : ''}`} disabled={isSavingEdit}>{editSavedSuccess ? 'נשמר! ✅' : 'שמור שינויים 💾'}</Button>
                              <Button variant="secondary" onClick={()=>setIsEditingInModal(false)}>ביטול</Button>
                          </div>
                      </div>
                  ) : (
                      <>
                          <div className="flex justify-between items-start mb-4 border-b border-gray-700 pb-2">
                             <div className="text-right">
                                <h3 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
                                    {attendanceSession.type}
                                    {attendanceSession.isZoomSession && !attendanceSession.isHybrid && <span className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-full">🎥 זום בלבד</span>}
                                    {attendanceSession.isHybrid && <span className="text-[10px] bg-purple-600 text-white px-2 py-0.5 rounded-full">🏠+🎥 היברידי</span>}
                                    {attendanceSession.isCancelled && <span className="text-[10px] bg-red-600 text-white px-2 py-0.5 rounded-full">🚫 מבוטל</span>}
                                </h3>
                                <p className="text-brand-primary font-mono">{attendanceSession.time} | {attendanceSession.location}</p>
                             </div>
                             <button onClick={() => setAttendanceSession(null)} className="text-gray-400 hover:text-white">✕</button>
                          </div>
                          <div className="flex gap-2 mb-4">
                              <button onClick={() => {setEditSessionForm({...attendanceSession}); setIsEditingInModal(true);}} className="bg-red-600 hover:bg-red-700 text-white text-xs py-2 px-3 rounded flex-1 font-bold">✏️ ערוך אימון</button>
                              <button onClick={() => {onDeleteSession(attendanceSession.id); setAttendanceSession(null);}} className="bg-gray-700 hover:bg-red-600 text-white text-xs py-2 px-3 rounded font-bold">🗑️ מחק</button>
                          </div>
                          <div className="flex-1 overflow-y-auto space-y-2 mb-4 bg-gray-900/50 p-3 rounded max-h-52">
                              {attendanceSession.attendedPhoneNumbers !== undefined && attendanceSession.attendedPhoneNumbers !== null ? (
                                  <div className="bg-green-900/40 border border-green-500/50 p-2 rounded mb-3 text-center"><span className="text-green-400 font-bold text-xs">✅ נוכחות דווחה ושמורה</span></div>
                              ) : (
                                  <div className="bg-yellow-900/40 border border-yellow-500/50 p-2 rounded mb-3 text-center"><span className="text-yellow-400 font-bold text-xs">⚠️ טרם דווחה נוכחות (כולם מסומנים)</span></div>
                              )}
                              {attendanceSession.registeredPhoneNumbers.map(phone => {
                                  const user = users.find(u => normalizePhone(u.phone) === phone);
                                  const isMarked = markedAttendees.has(phone);
                                  return (
                                      <div key={phone} className={`flex items-center justify-between p-2 rounded border ${isMarked ? 'bg-green-900/30 border-green-500' : 'bg-gray-800 border-gray-700'}`}>
                                          <span className="text-white font-bold">{user?.fullName || phone}</span>
                                          <button onClick={() => {const s=new Set(markedAttendees); if(s.has(phone)) s.delete(phone); else s.add(phone); setMarkedAttendees(s);}} className={`w-6 h-6 rounded-full border flex items-center justify-center transition-colors ${isMarked ? 'bg-green-500 border-green-500 text-white' : 'border-gray-500'}`}>{isMarked ? '✓' : ''}</button>
                                      </div>
                                  );
                              })}
                          </div>
                          <Button onClick={saveAttendance} className={`w-full transition-all ${attendanceSavedSuccess ? 'bg-green-600' : ''}`} disabled={isSavingAttendance}>{attendanceSavedSuccess ? 'נשמר! ✅' : (isSavingAttendance ? 'שומר...' : 'אשר נוכחות')}</Button>
                      </>
                  )}
            </div>
         </div>
      )}

      {activeTab === 'connections' && (
          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 text-white space-y-4">
              <h3 className="text-xl font-bold mb-4">חיבור ל-Supabase</h3>
              <div className="space-y-2">
                  <label className="text-xs text-gray-400">Project URL</label>
                  <input type="text" className="w-full bg-gray-900 border border-gray-600 p-2 rounded text-white text-sm" value={sbUrl} onChange={e => setSbUrl(e.target.value)} />
              </div>
              <div className="space-y-2">
                  <label className="text-xs text-gray-400">API Key</label>
                  <input type="password" className="w-full bg-gray-900 border border-gray-600 p-2 rounded text-white text-sm" value={sbKey} onChange={e => setSbKey(e.target.value)} />
              </div>
              <div className="flex gap-2">
                  <Button onClick={() => {localStorage.setItem('niv_app_supabase_url', sbUrl); localStorage.setItem('niv_app_supabase_key', sbKey); window.location.reload();}} className="flex-1">שמור והתחבר</Button>
              </div>
              <div className="mt-6 pt-6 border-t border-gray-700">
                 <h4 className="text-sm font-bold mb-2 text-brand-primary">עדכון שרת (חובה לביצוע שגיאות שמירה):</h4>
                 <p className="text-xs text-gray-400 mb-2">העתק והרץ ב-SQL Editor ב-Supabase כדי להוסיף עמודות חסרות כמו "waitingList" ו-"isHybrid".</p>
                 <Button size="sm" variant="secondary" onClick={handleCopySql} className="w-full text-xs">📋 העתק סקריפט SQL (ALTER TABLE)</Button>
              </div>
          </div>
      )}
    </div>
  );
};