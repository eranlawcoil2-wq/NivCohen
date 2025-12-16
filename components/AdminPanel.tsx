import React, { useState, useEffect } from 'react';
import { User, TrainingSession, PaymentStatus, WeatherLocation, PaymentLink, LocationDef } from '../types';
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
  paymentLinks: PaymentLink[];
  streakGoal: number; 
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
  onExitAdmin: () => void;
}

const SESSION_COLORS = [
    '#A3E635', '#3B82F6', '#EF4444', '#F59E0B', 
    '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'
];

const SQL_SCRIPT = `
-- 1. יצירת טבלאות (אם לא קיימות)
create table if not exists users (
  id text primary key, "fullName" text, "displayName" text, phone text unique,
  email text, "startDate" text, "paymentStatus" text, "isNew" boolean, "userColor" text, "monthlyRecord" int
);

create table if not exists sessions (
  id text primary key, type text, date text, time text, location text,
  "maxCapacity" int, description text, "registeredPhoneNumbers" text[],
  "attendedPhoneNumbers" text[], color text, "isTrial" boolean,
  "zoomLink" text, "isZoomSession" boolean
);

-- 2. עדכון עמודות חסרות (מוסיף רק אם חסר - קריטי לתיקון שגיאות)
alter table sessions add column if not exists "attendedPhoneNumbers" text[] default '{}';
alter table sessions add column if not exists "isZoomSession" boolean default false;
alter table sessions add column if not exists "zoomLink" text;
alter table users add column if not exists "monthlyRecord" int default 0;
alter table users add column if not exists "userColor" text;

-- 3. הגדרות אבטחה (מוחק ויוצר מחדש כדי למנוע שגיאות כפילות)
alter table users enable row level security;
alter table sessions enable row level security;

drop policy if exists "Public Access Users" on users;
create policy "Public Access Users" on users for all using (true);

drop policy if exists "Public Access Sessions" on sessions;
create policy "Public Access Sessions" on sessions for all using (true);
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

export const AdminPanel: React.FC<AdminPanelProps> = ({ 
    users, sessions, primaryColor, workoutTypes, locations, weatherLocation,
    paymentLinks, streakGoal, onAddUser, onUpdateUser, onDeleteUser, 
    onAddSession, onUpdateSession, onDeleteSession, onColorChange,
    onUpdateWorkoutTypes, onUpdateLocations, onUpdateWeatherLocation,
    onAddPaymentLink, onDeletePaymentLink, onUpdateStreakGoal, onExitAdmin
}) => {
  const [activeTab, setActiveTab] = useState<'attendance' | 'users' | 'settings' | 'new_users' | 'connections'>('attendance');
  
  // User Form State
  const [formUser, setFormUser] = useState<Partial<User>>({
    fullName: '', displayName: '', phone: '', email: '',
    startDate: new Date().toISOString().split('T')[0],
    paymentStatus: PaymentStatus.PAID, userColor: '#A3E635', monthlyRecord: 0
  });
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  // User Filter State
  const [filterText, setFilterText] = useState('');
  const [filterStatus, setFilterStatus] = useState<PaymentStatus | 'ALL'>('ALL');
  const [sortByWorkouts, setSortByWorkouts] = useState(false);
  
  // Template & Settings State
  const [templateSourceDate, setTemplateSourceDate] = useState(formatDateForInput(new Date()));
  const [templateTargetDate, setTemplateTargetDate] = useState(formatDateForInput(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)));
  const [citySearch, setCitySearch] = useState('');
  const [isSearchingCity, setIsSearchingCity] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  
  // Location & Payment State
  const [newLocationName, setNewLocationName] = useState('');
  const [newLocationAddress, setNewLocationAddress] = useState('');
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [newPaymentTitle, setNewPaymentTitle] = useState('');
  const [newPaymentUrl, setNewPaymentUrl] = useState('');

  // Cloud Config State
  const [sbUrl, setSbUrl] = useState(localStorage.getItem('niv_app_supabase_url') || '');
  const [sbKey, setSbKey] = useState(localStorage.getItem('niv_app_supabase_key') || '');

  // Attendance & Session Edit State
  const [weekOffset, setWeekOffset] = useState(0);
  const [attendanceSession, setAttendanceSession] = useState<TrainingSession | null>(null);
  const [markedAttendees, setMarkedAttendees] = useState<Set<string>>(new Set());
  const [isEditingInModal, setIsEditingInModal] = useState(false);
  const [editSessionForm, setEditSessionForm] = useState<Partial<TrainingSession>>({});

  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [isReloading, setIsReloading] = useState(false);

  const newUsers = users.filter(u => u.isNew);
  const existingUsers = users.filter(u => !u.isNew);

  const getMonthlyWorkoutsCount = (userPhone: string) => {
    if (!userPhone) return 0;
    const normalizedPhone = normalizePhone(userPhone);
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    return sessions.filter(session => {
        const sessionDate = new Date(session.date);
        const didAttend = session.attendedPhoneNumbers 
            ? session.attendedPhoneNumbers.includes(normalizedPhone)
            : session.registeredPhoneNumbers.includes(normalizedPhone);
        return (
            sessionDate.getMonth() === currentMonth &&
            sessionDate.getFullYear() === currentYear &&
            didAttend
        );
    }).length;
  };

  const calculateStreak = (phone: string) => {
      if (!sessions || sessions.length === 0 || !phone) return 0;
      const normalized = normalizePhone(phone);
      
      const userSessions = sessions.filter(s => 
         s.attendedPhoneNumbers?.includes(normalized) || s.registeredPhoneNumbers?.includes(normalized)
      ).map(s => new Date(s.date));

      if (userSessions.length === 0) return 0;

      const weeks: Record<string, number> = {};
      userSessions.forEach(d => {
          const day = d.getDay();
          const diff = d.getDate() - day; 
          const startOfWeek = new Date(d);
          startOfWeek.setDate(diff);
          startOfWeek.setHours(0,0,0,0);
          const key = startOfWeek.toISOString().split('T')[0];
          weeks[key] = (weeks[key] || 0) + 1;
      });

      let currentStreak = 0;
      const today = new Date();
      const day = today.getDay();
      const diff = today.getDate() - day;
      let checkDate = new Date(today.setDate(diff));
      checkDate.setHours(0,0,0,0);

      while(true) {
          const key = checkDate.toISOString().split('T')[0];
          const count = weeks[key] || 0;
          if (count >= 3) { currentStreak++; } 
          else {
              if (checkDate.getTime() < new Date().setHours(0,0,0,0) - 7 * 24 * 60 * 60 * 1000) { 
                 if (count < 3 && currentStreak > 0) break;
              }
          }
          checkDate.setDate(checkDate.getDate() - 7);
          if (checkDate.getFullYear() < 2023) break;
      }
      return currentStreak;
  };

  const getDayName = (dateStr: string) => new Date(dateStr).toLocaleDateString('he-IL', { weekday: 'long' });
  
  const handleGlobalSave = () => {
      setIsReloading(true);
      setTimeout(() => {
          window.location.reload();
      }, 500);
  };

  // --- Attendance Logic ---
  const getCurrentWeekDates = (offset: number) => {
    const curr = new Date();
    const day = curr.getDay();
    const diff = curr.getDate() - day + (offset * 7);
    const days = [];
    const startOfWeek = new Date(curr.setDate(diff));
    for (let i = 0; i < 7; i++) {
        const next = new Date(startOfWeek.getTime());
        next.setDate(startOfWeek.getDate() + i);
        days.push(next.toISOString().split('T')[0]);
    }
    return days;
  };

  const weekDates = getCurrentWeekDates(weekOffset);
  const safeSessions = Array.isArray(sessions) ? sessions : [];
  const groupedSessions = safeSessions.reduce((acc, session) => {
      const date = session.date;
      if (!acc[date]) acc[date] = [];
      acc[date].push(session);
      return acc;
  }, {} as Record<string, TrainingSession[]>);

  const openAttendanceModal = (session: TrainingSession) => {
      setAttendanceSession(session);
      setIsEditingInModal(false); 
      let initialSet: Set<string>;
      if (session.attendedPhoneNumbers === undefined || session.attendedPhoneNumbers === null) {
          initialSet = new Set(session.registeredPhoneNumbers);
      } else {
          initialSet = new Set(session.attendedPhoneNumbers);
      }
      setMarkedAttendees(initialSet);
  };

  const toggleAttendance = (phone: string) => {
      const newSet = new Set(markedAttendees);
      if (newSet.has(phone)) newSet.delete(phone);
      else newSet.add(phone);
      setMarkedAttendees(newSet);
  };

  const saveAttendance = async () => {
      if (!attendanceSession) return;
      const updatedSession: TrainingSession = {
          ...attendanceSession,
          attendedPhoneNumbers: Array.from(markedAttendees)
      };
      await onUpdateSession(updatedSession);
      alert('נוכחות עודכנה בהצלחה!');
      setAttendanceSession(null);
  };

  const handleEditFromAttendance = () => {
      if(!attendanceSession) return;
      setEditSessionForm({ ...attendanceSession });
      setIsEditingInModal(true);
  };

  const handleSaveEditedSession = async () => {
      if (!editSessionForm.id || !editSessionForm.type || !editSessionForm.date) return;
      
      // Ensure we are not sending undefined arrays
      const sessionToSave = { 
          ...attendanceSession, 
          ...editSessionForm,
          registeredPhoneNumbers: attendanceSession?.registeredPhoneNumbers || [],
          attendedPhoneNumbers: attendanceSession?.attendedPhoneNumbers || [],
      } as TrainingSession;

      // Ensure ID is valid string
      if (!sessionToSave.id) {
           sessionToSave.id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
      }

      const isExistingSession = sessions.some(s => s.id === sessionToSave.id);

      try {
          if (isExistingSession) {
              await onUpdateSession(sessionToSave);
              alert('האימון עודכן בהצלחה! ✅');
          } else {
              await onAddSession(sessionToSave);
              alert('אימון חדש נשמר בשרת בהצלחה! 🎉');
          }
          
          setAttendanceSession(null);
          setIsEditingInModal(false);
      } catch (error: any) {
          console.error(error);
          if (error.message?.includes('attendedPhoneNumbers') || error.message?.includes('column')) {
              alert('⚠️ שגיאה: מסד הנתונים לא מעודכן.\nחסרה העמודה "attendedPhoneNumbers".\n\nפתרון:\n1. גש ללשונית "חיבורים"\n2. העתק את סקריפט ה-SQL\n3. הרץ אותו ב-Supabase SQL Editor');
          } else {
              alert('שגיאה בשמירה: ' + (error.message || 'אנא בדוק את החיבור'));
          }
      }
  };

  const handleDuplicateFromAttendance = async () => {
      if(!attendanceSession) return;
      const [h, m] = attendanceSession.time.split(':').map(Number);
      const dateObj = new Date();
      dateObj.setHours(h, m);
      dateObj.setHours(dateObj.getHours() + 1);
      const newTime = dateObj.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      
      const uniqueId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
      
      const newSession: TrainingSession = { 
          ...attendanceSession, 
          id: uniqueId, 
          date: attendanceSession.date, 
          time: newTime,
          registeredPhoneNumbers: [], 
          attendedPhoneNumbers: [] 
      };
      
      try {
        await onAddSession(newSession);
        alert(`האימון שוכפל לשעה ${newTime}`);
        setAttendanceSession(null);
      } catch (error: any) {
        if (error.message?.includes('attendedPhoneNumbers') || error.message?.includes('column')) {
             alert('⚠️ שגיאה בשכפול: חסרה עמודה בטבלה.\n\nאנא גש ללשונית "חיבורים", העתק את הסקריפט והרץ אותו ב-Supabase.');
        } else {
             alert('שגיאה בשכפול: ' + (error.message || ''));
        }
      }
  };

  const handleDeleteFromAttendance = async () => {
      if(!attendanceSession) return;
      if(confirm('האם אתה בטוח שברצונך למחוק אימון זה?')) {
          await onDeleteSession(attendanceSession.id);
          setAttendanceSession(null);
      }
  };

  const handleGenerateDescription = async () => {
      if (!editSessionForm.type || !editSessionForm.location) {
          alert('נא למלא סוג אימון ומיקום');
          return;
      }
      setIsGeneratingAi(true);
      try {
        const desc = await generateWorkoutDescription(editSessionForm.type as any, editSessionForm.location);
        setEditSessionForm(prev => ({ ...prev, description: desc }));
      } catch (error) {
        console.error(error);
      } finally {
        setIsGeneratingAi(false);
      }
  };

  const handleSaveAsApp = () => {
      alert("כדי ליצור קיצור דרך למסך הבית שפותח ישר את הניהול:\n1. וודא שאתה במסך זה.\n2. לחץ על כפתור השיתוף בדפדפן (Share).\n3. בחר 'הוסף למסך הבית'.");
  };

  const handleSaveCloudConfig = () => {
      if (!sbUrl || !sbKey) {
          alert('נא להזין URL ו-Key');
          return;
      }
      localStorage.setItem('niv_app_supabase_url', sbUrl);
      localStorage.setItem('niv_app_supabase_key', sbKey);
      alert('הגדרות נשמרו. הטעינה תתבצע מחדש.');
      window.location.reload();
  };
  
  const handleClearCloudConfig = () => {
      if(confirm('האם למחוק את חיבור הענן ולחזור למצב מקומי?')) {
          localStorage.removeItem('niv_app_supabase_url');
          localStorage.removeItem('niv_app_supabase_key');
          setSbUrl('');
          setSbKey('');
          window.location.reload();
      }
  };

  const handleUserSubmit = () => {
      if (!formUser.fullName || !formUser.phone) { alert('נא למלא שם וטלפון'); return; }
      const userData = {
          id: editingUserId || Date.now().toString(),
          fullName: formUser.fullName!,
          displayName: formUser.displayName || formUser.fullName!,
          phone: formUser.phone!,
          email: formUser.email || '',
          startDate: formUser.startDate!,
          paymentStatus: formUser.paymentStatus!,
          userColor: formUser.userColor || '#A3E635',
          monthlyRecord: formUser.monthlyRecord || 0,
          isNew: false 
      } as User;

      if (editingUserId) { onUpdateUser(userData); alert('פרטי משתמש עודכנו'); setEditingUserId(null); } 
      else { onAddUser(userData); alert('משתמש נוסף בהצלחה'); }
      
      setFormUser({ fullName: '', displayName: '', phone: '', email: '', startDate: new Date().toISOString().split('T')[0], paymentStatus: PaymentStatus.PAID, userColor: '#A3E635', monthlyRecord: 0 });
  };

  const handleEditUserClick = (user: User) => {
      setFormUser({ ...user }); setEditingUserId(user.id); setActiveTab('users'); window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  const handleDeleteUserClick = (userId: string) => { if(window.confirm('למחוק מתאמן זה?')) onDeleteUser(userId); };
  const handleApproveUser = (user: User) => onUpdateUser({ ...user, isNew: false });
  const handlePaymentStatusChange = (user: User, newStatus: PaymentStatus) => onUpdateUser({ ...user, paymentStatus: newStatus });

  const handleSaveTemplate = () => {
      const startOfWeek = getSunday(new Date(templateSourceDate));
      const endOfWeek = new Date(startOfWeek); endOfWeek.setDate(endOfWeek.getDate() + 6);
      const sessionsToSave = sessions.filter(s => { const d = new Date(s.date); return d >= startOfWeek && d <= endOfWeek; });
      if (sessionsToSave.length === 0) { alert('אין אימונים בשבוע זה'); return; }
      const template = sessionsToSave.map(s => ({ ...s, dayIndex: new Date(s.date).getDay() }));
      localStorage.setItem('niv_app_week_template', JSON.stringify(template));
      alert(`נשמרה תבנית עם ${template.length} אימונים`);
  };

  const handleLoadTemplate = () => {
      const templateStr = localStorage.getItem('niv_app_week_template');
      if (!templateStr) { alert('אין תבנית שמורה'); return; }
      if (!confirm('לייצר אימונים מהתבנית?')) return;
      const template = JSON.parse(templateStr);
      const targetStartOfWeek = getSunday(new Date(templateTargetDate));
      let count = 0;
      template.forEach((t: any) => {
          const newDate = new Date(targetStartOfWeek); newDate.setDate(newDate.getDate() + t.dayIndex);
          const dateStr = newDate.toISOString().split('T')[0];
          const uniqueId = Date.now().toString() + Math.random().toString(36).substr(2, 9) + count;
          
          if (!sessions.some(s => s.date === dateStr && s.time === t.time && s.location === t.location)) {
              onAddSession({ 
                  ...t, 
                  id: uniqueId, 
                  date: dateStr, 
                  registeredPhoneNumbers: [], 
                  attendedPhoneNumbers: [] 
              });
              count++;
          }
      });
      alert(`נוספו ${count} אימונים`);
  };

  const handleSearchCity = async () => {
      if (!citySearch.trim()) return;
      setIsSearchingCity(true);
      const result = await getCityCoordinates(citySearch);
      setIsSearchingCity(false);
      if (result) { onUpdateWeatherLocation(result); setCitySearch(''); alert('מיקום עודכן'); } 
      else alert('עיר לא נמצאה');
  };

  const handleAddType = () => { if (newTypeName.trim() && !workoutTypes.includes(newTypeName.trim())) { onUpdateWorkoutTypes([...workoutTypes, newTypeName.trim()]); setNewTypeName(''); } };
  const handleDeleteType = (e: React.MouseEvent, type: string) => { e.stopPropagation(); if (confirm('למחוק?')) onUpdateWorkoutTypes(workoutTypes.filter(t => t !== type)); };

  const handleAddPaymentLink = () => { if(newPaymentTitle && newPaymentUrl) { onAddPaymentLink({ id: Date.now().toString(), title: newPaymentTitle, url: newPaymentUrl }); setNewPaymentTitle(''); setNewPaymentUrl(''); } };
  const handleCopySql = () => { navigator.clipboard.writeText(SQL_SCRIPT).then(() => alert('הועתק ללוח')); };

  const filteredUsers = existingUsers.filter(u => 
      (u.fullName.includes(filterText) || u.phone.includes(filterText)) && 
      (filterStatus === 'ALL' || u.paymentStatus === filterStatus)
  ).sort((a, b) => sortByWorkouts ? getMonthlyWorkoutsCount(b.phone) - getMonthlyWorkoutsCount(a.phone) : a.fullName.localeCompare(b.fullName));

  const sortedSessions = sessions.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  const handleQuickAddSession = () => {
      const today = new Date().toISOString().split('T')[0];
      const newSession: TrainingSession = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 5), 
          type: workoutTypes[0] || 'אימון',
          date: today,
          time: '18:00',
          location: locations[0]?.name || '',
          maxCapacity: 15,
          registeredPhoneNumbers: [],
          attendedPhoneNumbers: [],
          description: '',
          color: SESSION_COLORS[0]
      };
      setAttendanceSession(newSession); 
      setEditSessionForm(newSession);   
      setIsEditingInModal(true);        
  };

  return (
    <div className="p-4 bg-gray-900 rounded-lg pb-24">
      <div className="flex justify-between items-center mb-4 sticky top-0 bg-gray-900 z-10 py-2 border-b border-gray-800">
        <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-white">פאנל ניהול</h2>
        </div>
        <div className="flex gap-2">
            <button onClick={onExitAdmin} className="text-gray-500 text-xs font-bold border border-gray-700 px-3 py-2 rounded hover:text-white">
                יציאה
            </button>
            <button onClick={handleGlobalSave} disabled={isReloading} className={`bg-green-500 hover:bg-green-600 text-white border border-green-600 px-6 py-2 rounded-lg transition-all text-sm font-bold flex items-center gap-2 shadow-lg ${isReloading ? 'opacity-50' : ''}`}>
               {isReloading ? 'מרענן...' : 'שמירה 💾'}
            </button>
        </div>
      </div>
      
      <div className="flex gap-4 mb-6 overflow-x-auto no-scrollbar pb-2">
         {['attendance', 'users', 'settings', 'connections'].map(tab => (
             <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-4 py-2 rounded whitespace-nowrap ${activeTab === tab ? 'bg-brand-primary text-brand-black' : 'bg-gray-700 text-gray-300'}`}>
                 {tab === 'attendance' ? 'יומן ונוכחות' : tab === 'users' ? 'מתאמנים' : tab === 'settings' ? 'הגדרות' : 'חיבורים'}
             </button>
         ))}
         {newUsers.length > 0 && <button onClick={() => setActiveTab('new_users')} className="px-4 py-2 rounded whitespace-nowrap bg-red-500 text-white relative">חדשים ({newUsers.length})</button>}
      </div>

      {activeTab === 'attendance' && (
          <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 relative">
              <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold text-white">יומן אימונים</h3>
                  <Button size="sm" onClick={handleQuickAddSession} className="text-xs">+ אימון חדש</Button>
              </div>
              <div className="flex gap-2 mb-4 justify-center">
                  <button onClick={() => setWeekOffset(prev => prev - 1)} className="px-3 py-1 bg-gray-700 rounded text-white text-xs">שבוע קודם</button>
                  <span className="text-white text-sm font-bold pt-1">{weekOffset === 0 ? 'השבוע' : weekOffset}</span>
                  <button onClick={() => setWeekOffset(prev => prev + 1)} className="px-3 py-1 bg-gray-700 rounded text-white text-xs">שבוע הבא</button>
              </div>

              <div className="grid gap-4">
                  {weekDates.map((date) => {
                      const daySessions = groupedSessions[date] || [];
                      const isToday = new Date().toISOString().split('T')[0] === date;
                      return (
                          <div key={date} className={`rounded-xl overflow-hidden border ${isToday ? 'border-brand-primary/50 bg-gray-800/50' : 'border-gray-700 bg-gray-900/30'}`}>
                              <div className="flex flex-col md:flex-row h-full">
                                  <div className={`p-4 md:w-32 text-center border-b md:border-b-0 md:border-l border-gray-700 ${isToday ? 'bg-brand-primary/10 text-brand-primary' : 'bg-gray-800 text-gray-400'}`}>
                                      <p className="text-lg font-black">{getDayName(date)}</p>
                                      <p className="text-sm opacity-70">{new Date(date).getDate()}/{new Date(date).getMonth()+1}</p>
                                  </div>
                                  <div className="flex-1 p-3">
                                      {daySessions.length > 0 ? (
                                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                              {daySessions.sort((a,b) => a.time.localeCompare(b.time)).map(session => (
                                                  <div key={session.id} onClick={() => openAttendanceModal(session)}>
                                                      <SessionCard session={session} allUsers={users} isRegistered={false} onRegisterClick={() => openAttendanceModal(session)} onViewDetails={() => openAttendanceModal(session)}/>
                                                  </div>
                                              ))}
                                          </div>
                                      ) : <div className="text-center text-gray-600 text-sm py-4">אין אימונים</div>}
                                  </div>
                              </div>
                          </div>
                      );
                  })}
              </div>
          </div>
      )}

      {attendanceSession && (
          <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setAttendanceSession(null)}>
              <div className="bg-gray-800 p-6 rounded-2xl w-full max-w-lg border border-gray-700 flex flex-col max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                  
                  {isEditingInModal ? (
                      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                          <h3 className="text-xl font-bold text-white mb-2">עריכת אימון</h3>
                          <div className="grid grid-cols-2 gap-2">
                              <select className="bg-gray-900 text-white p-3 rounded border border-gray-700" value={editSessionForm.type} onChange={e=>setEditSessionForm({...editSessionForm, type: e.target.value})}>
                                  {workoutTypes.map(t=><option key={t} value={t}>{t}</option>)}
                              </select>
                              <select className="bg-gray-900 text-white p-3 rounded border border-gray-700" value={editSessionForm.location} onChange={e=>setEditSessionForm({...editSessionForm, location: e.target.value})}>
                                  {locations.map(l=><option key={l.id} value={l.name}>{l.name}</option>)}
                              </select>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                              <input type="date" className="bg-gray-900 text-white p-3 rounded border border-gray-700" value={editSessionForm.date} onChange={e=>setEditSessionForm({...editSessionForm, date: e.target.value})}/>
                              <input type="time" className="bg-gray-900 text-white p-3 rounded border border-gray-700" value={editSessionForm.time} onChange={e=>setEditSessionForm({...editSessionForm, time: e.target.value})}/>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                              <div className="flex items-center bg-gray-900 p-2 rounded border border-gray-700">
                                  <input type="checkbox" checked={editSessionForm.isZoomSession || false} onChange={e=>setEditSessionForm({...editSessionForm, isZoomSession: e.target.checked})} className="w-5 h-5 mr-2"/>
                                  <span className="text-white text-sm">אימון זום</span>
                              </div>
                              <input type="number" placeholder="מקסימום משתתפים" className="bg-gray-900 text-white p-3 rounded border border-gray-700" value={editSessionForm.maxCapacity} onChange={e=>setEditSessionForm({...editSessionForm, maxCapacity: parseInt(e.target.value)})}/>
                          </div>
                          {editSessionForm.isZoomSession && (
                             <input type="text" placeholder="לינק לזום" className="w-full bg-gray-900 text-white p-3 rounded border border-gray-700 dir-ltr" value={editSessionForm.zoomLink || ''} onChange={e=>setEditSessionForm({...editSessionForm, zoomLink: e.target.value})}/>
                          )}
                          <div className="flex gap-2">
                              <textarea placeholder="תיאור האימון..." className="w-full bg-gray-900 text-white p-3 rounded border border-gray-700 h-24" value={editSessionForm.description || ''} onChange={e=>setEditSessionForm({...editSessionForm, description: e.target.value})}/>
                              <Button variant="secondary" onClick={handleGenerateDescription} isLoading={isGeneratingAi} className="h-24 px-2">AI ✨</Button>
                          </div>
                          
                          <div className="flex gap-2 pt-2 border-t border-gray-700 mt-4">
                              <Button onClick={handleSaveEditedSession} className="flex-1 py-3 text-lg">עדכן פרטים ושמור 💾</Button>
                              <Button variant="secondary" onClick={()=>setIsEditingInModal(false)} className="px-4">ביטול</Button>
                          </div>
                      </div>
                  ) : (
                      <>
                          <div className="flex justify-between items-start mb-4 border-b border-gray-700 pb-2">
                             <div>
                                <h3 className="text-2xl font-bold text-white mb-1">{attendanceSession.type}</h3>
                                <p className="text-brand-primary font-mono">{attendanceSession.time} | {attendanceSession.location}</p>
                                <p className="text-xs text-gray-500 mt-1">{attendanceSession.date}</p>
                             </div>
                             <button onClick={() => setAttendanceSession(null)} className="text-gray-400 hover:text-white text-xl">✕</button>
                          </div>
                          
                          <div className="flex gap-2 mb-4 bg-gray-900 p-2 rounded-lg">
                              <Button size="sm" variant="secondary" onClick={handleEditFromAttendance} className="flex-1 text-xs">✏️ ערוך פרטים</Button>
                              <Button size="sm" variant="secondary" onClick={handleDuplicateFromAttendance} className="flex-1 text-xs">📄 שכפל (+1 שעה)</Button>
                              <Button size="sm" variant="danger" onClick={handleDeleteFromAttendance} className="flex-1 text-xs">🗑️ מחק</Button>
                          </div>

                          <div className="flex-1 overflow-y-auto space-y-2 mb-4 bg-gray-900/50 p-2 rounded max-h-60">
                              <div className="text-xs text-gray-400 mb-2 sticky top-0 bg-gray-900 p-1">סימון נוכחות ({markedAttendees.size}/{attendanceSession.registeredPhoneNumbers.length}):</div>
                              {attendanceSession.registeredPhoneNumbers.length === 0 ? <p className="text-center text-gray-500 py-4">אין נרשמים</p> :
                                  attendanceSession.registeredPhoneNumbers.map(phone => {
                                      const user = users.find(u => u.phone.replace(/\D/g,'') === phone.replace(/\D/g,''));
                                      const isMarked = markedAttendees.has(phone);
                                      return (
                                          <div key={phone} onClick={() => toggleAttendance(phone)} className={`flex items-center justify-between p-3 rounded border cursor-pointer transition-colors ${isMarked ? 'bg-green-900/30 border-green-500' : 'bg-gray-800 border-gray-700 hover:bg-gray-700'}`}>
                                              <div className="text-white font-bold">{user?.fullName || phone}</div>
                                              <div className={`w-6 h-6 rounded-full border flex items-center justify-center ${isMarked ? 'bg-green-500 border-green-500 text-white' : 'border-gray-500'}`}>
                                                  {isMarked && '✓'}
                                              </div>
                                          </div>
                                      );
                                  })
                              }
                          </div>
                          <div className="flex gap-2">
                              <Button onClick={saveAttendance} className="flex-1">שמור נוכחות</Button>
                          </div>
                      </>
                  )}
              </div>
          </div>
      )}

      {activeTab === 'users' && (
         <div className="space-y-6">
            <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                <h3 className="text-lg font-bold text-white mb-2">{editingUserId ? 'עריכת מתאמן' : 'הוספת מתאמן'}</h3>
                
                {/* User Stats Display (Only in Edit Mode) */}
                {editingUserId && formUser.phone && (
                   <div className="bg-gray-900/50 p-3 rounded mb-3 flex justify-between text-sm border border-gray-700">
                       <div>💪 אימונים החודש: <span className="text-brand-primary font-bold">{getMonthlyWorkoutsCount(formUser.phone)}</span></div>
                       <div>🏆 רצף נוכחי: <span className="text-yellow-500 font-bold">{calculateStreak(formUser.phone)}</span></div>
                   </div>
                )}

                <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                        <label className="text-xs text-gray-400 mb-1 block">שם מלא</label>
                        <input type="text" placeholder="שם מלא" className="w-full p-2 bg-gray-900 border border-gray-600 text-white rounded" value={formUser.fullName} onChange={e => setFormUser({...formUser, fullName: e.target.value})}/>
                    </div>
                    <div>
                        <label className="text-xs text-gray-400 mb-1 block">כינוי (באפליקציה)</label>
                        <input type="text" placeholder="כינוי" className="w-full p-2 bg-gray-900 border border-gray-600 text-white rounded" value={formUser.displayName || ''} onChange={e => setFormUser({...formUser, displayName: e.target.value})}/>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                        <label className="text-xs text-gray-400 mb-1 block">טלפון</label>
                        <input type="tel" placeholder="050..." className="w-full p-2 bg-gray-900 border border-gray-600 text-white rounded" value={formUser.phone} onChange={e => setFormUser({...formUser, phone: e.target.value})}/>
                    </div>
                    <div>
                        <label className="text-xs text-gray-400 mb-1 block">אימייל</label>
                        <input type="email" placeholder="email@example.com" className="w-full p-2 bg-gray-900 border border-gray-600 text-white rounded" value={formUser.email || ''} onChange={e => setFormUser({...formUser, email: e.target.value})}/>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-2">
                   <div className="flex flex-col">
                       <label className="text-xs text-gray-400 mb-1">שיא חודשי</label>
                       <input type="number" placeholder="שיא" className="p-2 bg-gray-900 border border-gray-600 text-white rounded" value={formUser.monthlyRecord || 0} onChange={e => setFormUser({...formUser, monthlyRecord: parseInt(e.target.value) || 0})}/>
                   </div>
                   <div className="flex flex-col">
                       <label className="text-xs text-gray-400 mb-1">צבע משתמש</label>
                       <div className="flex items-center gap-2">
                           <input type="color" className="w-10 h-10 rounded cursor-pointer bg-transparent border-none p-0" value={formUser.userColor || '#A3E635'} onChange={e => setFormUser({...formUser, userColor: e.target.value})}/>
                           <span className="text-xs text-gray-500">{formUser.userColor}</span>
                       </div>
                   </div>
                </div>

                <div className="flex gap-2 mt-4">
                    <Button onClick={handleUserSubmit} className="flex-1">{editingUserId ? 'עדכן פרטים' : 'הוסף משתמש'}</Button>
                    {editingUserId && <Button variant="secondary" onClick={() => {setEditingUserId(null); setFormUser({ fullName: '', displayName: '', phone: '', email: '', startDate: new Date().toISOString().split('T')[0], paymentStatus: PaymentStatus.PAID, userColor: '#A3E635', monthlyRecord: 0 });}}>ביטול</Button>}
                </div>
            </div>
            
            <div className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700 max-h-96 overflow-y-auto">
                {filteredUsers.map(user => (
                    <div key={user.id} className="p-3 border-b border-gray-700 flex justify-between items-center hover:bg-gray-700/50">
                        <div>
                            <div className="font-bold text-white flex items-center gap-2">
                                <span style={{color: user.userColor}}>{user.fullName}</span>
                                <span className={`text-[10px] px-1.5 rounded ${user.paymentStatus === 'PAID' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>{user.paymentStatus}</span>
                            </div>
                            <div className="text-xs text-gray-400">{user.phone} {user.displayName ? `(${user.displayName})` : ''}</div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => handleEditUserClick(user)} className="bg-gray-600 text-white px-2 py-1 rounded text-xs">ערוך</button>
                            <button onClick={() => handleDeleteUserClick(user.id)} className="bg-red-500/20 text-red-300 px-2 py-1 rounded text-xs">מחק</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      )}
      
      {activeTab === 'new_users' && (
           <div className="space-y-2">
               {newUsers.map(user => (
                   <div key={user.id} className="bg-gray-800 p-3 rounded flex justify-between items-center">
                       <div className="text-white">{user.fullName} ({user.phone})</div>
                       <div className="flex gap-2"><Button size="sm" onClick={() => handleApproveUser(user)}>אשר</Button><Button size="sm" variant="danger" onClick={() => handleDeleteUserClick(user.id)}>דחה</Button></div>
                   </div>
               ))}
           </div>
      )}

      {activeTab === 'connections' && (
          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 text-white space-y-4">
              <h3 className="text-xl font-bold mb-4">חיבור ל-Supabase (ענן)</h3>
              <div className={`p-4 rounded mb-4 ${supabase ? 'bg-green-900/30 border-green-500' : 'bg-red-900/30 border-red-500'} border`}>
                  {supabase ? '✅ מחובר למסד הנתונים' : '❌ עובד מקומית בלבד'}
              </div>
              
              <div className="space-y-2">
                  <label className="text-xs text-gray-400">Project URL</label>
                  <input type="text" className="w-full bg-gray-900 border border-gray-600 p-2 rounded text-white text-sm" value={sbUrl} onChange={e => setSbUrl(e.target.value)} placeholder="https://example.supabase.co" />
              </div>
              <div className="space-y-2">
                  <label className="text-xs text-gray-400">Project API Key (Anon)</label>
                  <input type="password" className="w-full bg-gray-900 border border-gray-600 p-2 rounded text-white text-sm" value={sbKey} onChange={e => setSbKey(e.target.value)} placeholder="eyJhbG..." />
              </div>

              <div className="flex gap-2 pt-2">
                  <Button onClick={handleSaveCloudConfig} className="flex-1">שמור והתחבר</Button>
                  {supabase && <Button variant="danger" onClick={handleClearCloudConfig}>התנתק</Button>}
              </div>

              <div className="mt-6 pt-6 border-t border-gray-700">
                 <h4 className="text-sm font-bold mb-2">הוראות התקנה (חד פעמי):</h4>
                 <p className="text-xs text-gray-400 mb-2">אם נתקלת בשגיאות שמירה (חסרות עמודות), הרץ את הסקריפט הזה:</p>
                 <Button size="sm" variant="secondary" onClick={handleCopySql} className="w-full text-xs">העתק סקריפט SQL ליצירת טבלאות</Button>
              </div>
          </div>
      )}

      {activeTab === 'settings' && (
          <div className="space-y-4">
              <div className="bg-gray-800 p-4 rounded border border-gray-700">
                  <h3 className="text-white mb-2">צבע ראשי</h3>
                  <div className="flex gap-2">{SESSION_COLORS.map(c => <button key={c} onClick={() => onColorChange(c)} className={`w-8 h-8 rounded-full ${primaryColor===c?'border-2 border-white':''}`} style={{backgroundColor:c}}/>)}</div>
              </div>
              
              {/* Template Management */}
              <div className="bg-gray-800 p-4 rounded border border-gray-700 space-y-2">
                  <h3 className="text-white mb-2 font-bold">תבניות שבועיות</h3>
                  <p className="text-xs text-gray-400">שמור את השבוע שבתאריך המקור כתבנית, או טען תבנית לשבוע שבתאריך היעד.</p>
                  <div className="flex flex-col gap-2">
                      <div className="flex gap-2 items-center">
                          <label className="text-xs text-gray-400 w-12">מקור:</label>
                          <input type="date" className="bg-gray-900 text-white p-2 rounded flex-1" value={templateSourceDate} onChange={e=>setTemplateSourceDate(e.target.value)}/>
                          <Button size="sm" onClick={handleSaveTemplate} variant="secondary">שמור כתבנית</Button>
                      </div>
                      <div className="flex gap-2 items-center">
                          <label className="text-xs text-gray-400 w-12">יעד:</label>
                          <input type="date" className="bg-gray-900 text-white p-2 rounded flex-1" value={templateTargetDate} onChange={e=>setTemplateTargetDate(e.target.value)}/>
                          <Button size="sm" onClick={handleLoadTemplate}>טען תבנית</Button>
                      </div>
                  </div>
              </div>

              <div className="bg-gray-800 p-4 rounded border border-gray-700 flex gap-2">
                  <input type="text" placeholder="הוסף סוג אימון" className="bg-gray-900 text-white p-2 rounded flex-1" value={newTypeName} onChange={e=>setNewTypeName(e.target.value)}/>
                  <Button onClick={handleAddType}>הוסף</Button>
              </div>
              <div className="bg-gray-800 p-4 rounded border border-gray-700 flex gap-2">
                  <input type="text" placeholder="חיפוש עיר" className="bg-gray-900 text-white p-2 rounded flex-1" value={citySearch} onChange={e=>setCitySearch(e.target.value)}/>
                  <Button onClick={handleSearchCity}>{isSearchingCity?'...':'עדכן מיקום'}</Button>
              </div>
          </div>
      )}
    </div>
  );
};