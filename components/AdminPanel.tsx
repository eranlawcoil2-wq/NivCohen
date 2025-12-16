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

const USER_COLORS = [
    '#ffffff', '#EF4444', '#F59E0B', '#10B981', 
    '#3B82F6', '#8B5CF6', '#EC4899', '#A3E635'
];

const SQL_SCRIPT = `
-- טבלת משתמשים
create table if not exists users (
  id text primary key, "fullName" text, "displayName" text, phone text unique,
  email text, "startDate" text, "paymentStatus" text, "isNew" boolean, "userColor" text
);
-- טבלת אימונים
create table if not exists sessions (
  id text primary key, type text, date text, time text, location text,
  "maxCapacity" int, description text, "registeredPhoneNumbers" text[],
  "attendedPhoneNumbers" text[], color text, "isTrial" boolean,
  "zoomLink" text, "isZoomSession" boolean
);
alter table users enable row level security;
alter table sessions enable row level security;
create policy "Public Access Users" on users for all using (true);
create policy "Public Access Sessions" on sessions for all using (true);
`;

const getSunday = (d: Date) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day; 
  return new Date(date.setDate(diff));
};

const formatDateForInput = (date: Date) => date.toISOString().split('T')[0];

export const AdminPanel: React.FC<AdminPanelProps> = ({ 
    users, sessions, primaryColor, workoutTypes, locations, weatherLocation,
    paymentLinks, streakGoal, onAddUser, onUpdateUser, onDeleteUser, 
    onAddSession, onUpdateSession, onDeleteSession, onColorChange,
    onUpdateWorkoutTypes, onUpdateLocations, onUpdateWeatherLocation,
    onAddPaymentLink, onDeletePaymentLink, onUpdateStreakGoal, onExitAdmin
}) => {
  const [activeTab, setActiveTab] = useState<'attendance' | 'users' | 'sessions' | 'settings' | 'new_users' | 'connections'>('attendance');
  
  // User Form State
  const [formUser, setFormUser] = useState<Partial<User>>({
    fullName: '', displayName: '', phone: '', email: '',
    startDate: new Date().toISOString().split('T')[0],
    paymentStatus: PaymentStatus.PAID, userColor: ''
  });
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  // User Filter State
  const [filterText, setFilterText] = useState('');
  const [filterStatus, setFilterStatus] = useState<PaymentStatus | 'ALL'>('ALL');
  const [sortByWorkouts, setSortByWorkouts] = useState(false);

  // Session Form State
  const [newSession, setNewSession] = useState<Partial<TrainingSession>>({
    type: workoutTypes[0] || '',
    date: new Date().toISOString().split('T')[0],
    time: '18:00',
    location: locations.length > 0 ? locations[0].name : '',
    maxCapacity: 15, description: '', color: SESSION_COLORS[0],
    isTrial: false, zoomLink: '', isZoomSession: false
  });
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  
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

  // Attendance State
  const [weekOffset, setWeekOffset] = useState(0);
  const [attendanceSession, setAttendanceSession] = useState<TrainingSession | null>(null);
  const [markedAttendees, setMarkedAttendees] = useState<Set<string>>(new Set());

  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const newUsers = users.filter(u => u.isNew);
  const existingUsers = users.filter(u => !u.isNew);

  const getMonthlyWorkoutsCount = (userPhone: string) => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    return sessions.filter(session => {
        const sessionDate = new Date(session.date);
        const didAttend = session.attendedPhoneNumbers 
            ? session.attendedPhoneNumbers.includes(userPhone)
            : session.registeredPhoneNumbers.includes(userPhone);
        return (
            sessionDate.getMonth() === currentMonth &&
            sessionDate.getFullYear() === currentYear &&
            didAttend
        );
    }).length;
  };

  const getDayName = (dateStr: string) => new Date(dateStr).toLocaleDateString('he-IL', { weekday: 'long' });
  
  const handleExitClick = () => {
      setIsExiting(true);
      setTimeout(() => { onExitAdmin(); setIsExiting(false); }, 800);
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
      const initialSet = new Set(session.attendedPhoneNumbers || []);
      setMarkedAttendees(initialSet);
  };

  const toggleAttendance = (phone: string) => {
      const newSet = new Set(markedAttendees);
      if (newSet.has(phone)) newSet.delete(phone);
      else newSet.add(phone);
      setMarkedAttendees(newSet);
  };

  const saveAttendance = () => {
      if (!attendanceSession) return;
      const updatedSession: TrainingSession = {
          ...attendanceSession,
          attendedPhoneNumbers: Array.from(markedAttendees)
      };
      onUpdateSession(updatedSession);
      setAttendanceSession(null);
      alert('נוכחות עודכנה בהצלחה!');
  };

  const handleInstallApp = () => alert("כדי להתקין את ממשק הניהול בדסקטופ, לחץ על סמל ההתקנה בשורת הכתובת של הדפדפן (Chrome/Edge).");

  const handleGenerateDescription = async () => {
      if (!newSession.type || !newSession.location) {
          alert('נא למלא סוג אימון ומיקום לפני שימוש ב-AI');
          return;
      }
      setIsGeneratingAi(true);
      try {
        const desc = await generateWorkoutDescription(newSession.type as any, newSession.location);
        setNewSession(prev => ({ ...prev, description: desc }));
      } catch (error) {
        console.error(error);
        alert('שגיאה ביצירת תיאור');
      } finally {
        setIsGeneratingAi(false);
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
          userColor: formUser.userColor,
          isNew: false 
      } as User;

      if (editingUserId) { onUpdateUser(userData); alert('פרטי משתמש עודכנו'); setEditingUserId(null); } 
      else { onAddUser(userData); alert('משתמש נוסף בהצלחה'); }
      
      setFormUser({ fullName: '', displayName: '', phone: '', email: '', startDate: new Date().toISOString().split('T')[0], paymentStatus: PaymentStatus.PAID, userColor: '' });
  };

  const handleEditUserClick = (user: User) => {
      setFormUser({ ...user }); setEditingUserId(user.id); setActiveTab('users'); window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  const handleDeleteUserClick = (userId: string) => { if(window.confirm('למחוק מתאמן זה?')) onDeleteUser(userId); };
  const handleApproveUser = (user: User) => onUpdateUser({ ...user, isNew: false });
  const handlePaymentStatusChange = (user: User, newStatus: PaymentStatus) => onUpdateUser({ ...user, paymentStatus: newStatus });

  const handleSessionSubmit = () => {
      if (!newSession.type || !newSession.date || !newSession.location) { alert('נא למלא שדות חובה'); return; }
      const sessionData = {
          id: editingSessionId || Date.now().toString(),
          type: newSession.type!, date: newSession.date!, time: newSession.time!,
          location: newSession.location!, maxCapacity: newSession.maxCapacity || 15,
          description: newSession.description || '',
          registeredPhoneNumbers: editingSessionId ? (sessions.find(s => s.id === editingSessionId)?.registeredPhoneNumbers || []) : [],
          attendedPhoneNumbers: editingSessionId ? (sessions.find(s => s.id === editingSessionId)?.attendedPhoneNumbers || []) : [],
          color: newSession.color || SESSION_COLORS[0], isTrial: newSession.isTrial || false,
          zoomLink: newSession.isZoomSession ? newSession.zoomLink : undefined, isZoomSession: newSession.isZoomSession || false
      } as TrainingSession;

      if (editingSessionId) { onUpdateSession(sessionData); alert('אימון עודכן'); setEditingSessionId(null); }
      else { onAddSession(sessionData); alert('אימון נוסף'); }
      
      setNewSession({ type: workoutTypes[0] || '', date: newSession.date, time: '18:00', location: locations[0]?.name || '', maxCapacity: 15, description: '', color: SESSION_COLORS[0], isTrial: false, zoomLink: '', isZoomSession: false });
  };

  const handleEditSessionClick = (session: TrainingSession) => { setNewSession({ ...session }); setEditingSessionId(session.id); setActiveTab('sessions'); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const handleCancelEditSession = () => { setEditingSessionId(null); setNewSession({ type: workoutTypes[0] || '', date: new Date().toISOString().split('T')[0], time: '18:00', location: locations[0]?.name || '', maxCapacity: 15, description: '', color: SESSION_COLORS[0], isTrial: false, zoomLink: '', isZoomSession: false }); };

  const handleDuplicateSession = (session: TrainingSession) => {
      const nextWeekDate = new Date(new Date(session.date)); nextWeekDate.setDate(nextWeekDate.getDate() + 7);
      onAddSession({ ...session, id: Date.now().toString(), date: nextWeekDate.toISOString().split('T')[0], registeredPhoneNumbers: [], attendedPhoneNumbers: [] });
      alert('האימון שוכפל');
  };

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
          if (!sessions.some(s => s.date === dateStr && s.time === t.time && s.location === t.location)) {
              onAddSession({ ...t, id: Date.now().toString() + Math.random().toString().slice(2,5), date: dateStr, registeredPhoneNumbers: [], attendedPhoneNumbers: [] });
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

  const handleLocationSubmit = () => {
      if (!newLocationName.trim()) return;
      if (editingLocationId) {
          onUpdateLocations(locations.map(l => l.id === editingLocationId ? { ...l, name: newLocationName, address: newLocationAddress } : l));
          setEditingLocationId(null);
      } else onUpdateLocations([...locations, { id: Date.now().toString(), name: newLocationName, address: newLocationAddress }]);
      setNewLocationName(''); setNewLocationAddress('');
  };
  const handleEditLocation = (loc: LocationDef) => { setNewLocationName(loc.name); setNewLocationAddress(loc.address); setEditingLocationId(loc.id); };
  const handleCancelLocationEdit = () => { setNewLocationName(''); setNewLocationAddress(''); setEditingLocationId(null); };
  const handleDeleteLocation = (e: React.MouseEvent, id: string) => { e.stopPropagation(); if (confirm('למחוק?')) onUpdateLocations(locations.filter(l => l.id !== id)); };

  const handleAddPaymentLink = () => { if(newPaymentTitle && newPaymentUrl) { onAddPaymentLink({ id: Date.now().toString(), title: newPaymentTitle, url: newPaymentUrl }); setNewPaymentTitle(''); setNewPaymentUrl(''); } };
  const handleCopySql = () => { navigator.clipboard.writeText(SQL_SCRIPT).then(() => alert('הועתק ללוח')); };

  const filteredUsers = existingUsers.filter(u => 
      (u.fullName.includes(filterText) || u.phone.includes(filterText)) && 
      (filterStatus === 'ALL' || u.paymentStatus === filterStatus)
  ).sort((a, b) => sortByWorkouts ? getMonthlyWorkoutsCount(b.phone) - getMonthlyWorkoutsCount(a.phone) : a.fullName.localeCompare(b.fullName));

  const sortedSessions = sessions.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const todayStr = new Date().toISOString().split('T')[0];
  const futureSessions = sortedSessions.filter(s => s.date >= todayStr);
  const pastSessions = sortedSessions.filter(s => s.date < todayStr && new Date(s.date) > new Date(Date.now() - 30*24*60*60*1000));

  return (
    <div className="p-4 bg-gray-900 rounded-lg">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-white">פאנל ניהול</h2>
            <Button size="sm" variant="outline" onClick={handleInstallApp} className="hidden md:flex">📥 התקן</Button>
        </div>
        <button onClick={handleExitClick} disabled={isExiting} className={`bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500 px-4 py-2 rounded-lg transition-all text-sm font-bold flex items-center gap-2 ${isExiting ? 'opacity-50' : ''}`}>
          {isExiting ? 'יוצא...' : 'יציאה ושמירה'}
        </button>
      </div>
      
      <div className="flex gap-4 mb-6 overflow-x-auto no-scrollbar pb-2">
         {['attendance', 'users', 'sessions', 'settings', 'connections'].map(tab => (
             <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-4 py-2 rounded whitespace-nowrap ${activeTab === tab ? 'bg-brand-primary text-brand-black' : 'bg-gray-700 text-gray-300'}`}>
                 {tab === 'attendance' ? 'יומן ונוכחות' : tab === 'users' ? 'מתאמנים' : tab === 'sessions' ? 'ניהול אימונים' : tab === 'settings' ? 'הגדרות' : 'חיבורים'}
             </button>
         ))}
         {newUsers.length > 0 && <button onClick={() => setActiveTab('new_users')} className="px-4 py-2 rounded whitespace-nowrap bg-red-500 text-white relative">חדשים ({newUsers.length})</button>}
      </div>

      {activeTab === 'attendance' && (
          <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
              <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold text-white">יומן אימונים</h3>
                  <div className="flex gap-2">
                      <button onClick={() => setWeekOffset(prev => prev - 1)} className="px-3 py-1 bg-gray-700 rounded text-white">שבוע קודם</button>
                      <button onClick={() => setWeekOffset(prev => prev + 1)} className="px-3 py-1 bg-gray-700 rounded text-white">שבוע הבא</button>
                  </div>
              </div>
              <div className="grid gap-4">
                  {weekDates.slice(0, 6).map((date) => {
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
              <div className="bg-gray-800 p-6 rounded-2xl w-full max-w-lg border border-gray-700 flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                  <h3 className="text-2xl font-bold text-white mb-2">נוכחות: {attendanceSession.time} - {attendanceSession.type}</h3>
                  <div className="flex-1 overflow-y-auto space-y-2 mb-4">
                      {attendanceSession.registeredPhoneNumbers.length === 0 ? <p className="text-center text-gray-500">אין נרשמים</p> :
                          attendanceSession.registeredPhoneNumbers.map(phone => {
                              const user = users.find(u => u.phone.replace(/\D/g,'') === phone.replace(/\D/g,''));
                              const isMarked = markedAttendees.has(phone);
                              return (
                                  <div key={phone} onClick={() => toggleAttendance(phone)} className={`flex items-center justify-between p-3 rounded border cursor-pointer ${isMarked ? 'bg-green-900/30 border-green-500' : 'bg-gray-900 border-gray-700'}`}>
                                      <div className="text-white font-bold">{user?.fullName || phone}</div>
                                      <div className={`w-6 h-6 rounded-full border ${isMarked ? 'bg-green-500' : 'border-gray-500'}`}/>
                                  </div>
                              );
                          })
                      }
                  </div>
                  <div className="flex gap-2">
                      <Button onClick={saveAttendance} className="flex-1">שמור ({markedAttendees.size})</Button>
                      <Button variant="secondary" onClick={() => setAttendanceSession(null)}>ביטול</Button>
                  </div>
              </div>
          </div>
      )}

      {activeTab === 'users' && (
         <div className="space-y-6">
            <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                <h3 className="text-lg font-bold text-white mb-2">{editingUserId ? 'עריכה' : 'הוספה'}</h3>
                <div className="grid grid-cols-2 gap-2 mb-2">
                    <input type="text" placeholder="שם מלא" className="p-2 bg-gray-900 border border-gray-600 text-white rounded" value={formUser.fullName} onChange={e => setFormUser({...formUser, fullName: e.target.value})}/>
                    <input type="tel" placeholder="טלפון" className="p-2 bg-gray-900 border border-gray-600 text-white rounded" value={formUser.phone} onChange={e => setFormUser({...formUser, phone: e.target.value})}/>
                </div>
                <Button onClick={handleUserSubmit} className="w-full">{editingUserId ? 'עדכן' : 'הוסף'}</Button>
            </div>
            <div className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700 max-h-96 overflow-y-auto">
                {filteredUsers.map(user => (
                    <div key={user.id} className="p-3 border-b border-gray-700 flex justify-between items-center hover:bg-gray-700/50">
                        <div>
                            <div className="font-bold text-white">{user.fullName} <span className={`text-xs px-2 rounded ${user.paymentStatus === 'PAID' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>{user.paymentStatus}</span></div>
                            <div className="text-xs text-gray-400">{user.phone} | אימונים החודש: {getMonthlyWorkoutsCount(user.phone)}</div>
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
          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 text-white">
              <h3 className="text-xl font-bold mb-4">חיבור ל-Supabase</h3>
              <div className={`p-4 rounded mb-4 ${supabase ? 'bg-green-900/30 border-green-500' : 'bg-red-900/30 border-red-500'} border`}>
                  {supabase ? '✅ מחובר למסד הנתונים' : '❌ לא מחובר'}
              </div>
              <Button size="sm" variant="secondary" onClick={handleCopySql}>העתק SQL להתקנה</Button>
          </div>
      )}

      {activeTab === 'settings' && (
          <div className="space-y-4">
              <div className="bg-gray-800 p-4 rounded border border-gray-700">
                  <h3 className="text-white mb-2">צבע ראשי</h3>
                  <div className="flex gap-2">{SESSION_COLORS.map(c => <button key={c} onClick={() => onColorChange(c)} className={`w-8 h-8 rounded-full ${primaryColor===c?'border-2 border-white':''}`} style={{backgroundColor:c}}/>)}</div>
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

      {activeTab === 'sessions' && (
        <div className="space-y-4">
            <div className="bg-gray-800 p-4 rounded border border-gray-700">
                <h3 className="text-brand-primary mb-2">{editingSessionId ? 'עריכה' : 'אימון חדש'}</h3>
                <div className="grid gap-2">
                    <div className="grid grid-cols-2 gap-2">
                        <select className="bg-gray-900 text-white p-2 rounded" value={newSession.type} onChange={e=>setNewSession({...newSession, type: e.target.value})}>
                            {workoutTypes.map(t=><option key={t} value={t}>{t}</option>)}
                        </select>
                        <select className="bg-gray-900 text-white p-2 rounded" value={newSession.location} onChange={e=>setNewSession({...newSession, location: e.target.value})}>
                            {locations.map(l=><option key={l.id} value={l.name}>{l.name}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <input type="date" className="bg-gray-900 text-white p-2 rounded" value={newSession.date} onChange={e=>setNewSession({...newSession, date: e.target.value})}/>
                        <input type="time" className="bg-gray-900 text-white p-2 rounded" value={newSession.time} onChange={e=>setNewSession({...newSession, time: e.target.value})}/>
                    </div>
                    <div className="flex gap-2">
                        <input type="text" placeholder="תיאור" className="bg-gray-900 text-white p-2 rounded flex-1" value={newSession.description} onChange={e=>setNewSession({...newSession, description: e.target.value})}/>
                        <Button variant="secondary" onClick={handleGenerateDescription} isLoading={isGeneratingAi}>AI ✨</Button>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={handleSessionSubmit} className="flex-1">{editingSessionId?'עדכן':'צור'}</Button>
                        {editingSessionId && <Button onClick={handleCancelEditSession} variant="secondary">ביטול</Button>}
                    </div>
                </div>
            </div>
            
            <div className="bg-gray-800 rounded p-2 max-h-96 overflow-y-auto">
                <h4 className="text-white font-bold mb-2">עתידיים</h4>
                {futureSessions.map(s => (
                    <div key={s.id} className="flex justify-between items-center bg-gray-900 p-2 rounded mb-2 border border-gray-700">
                        <div className="text-white text-sm">{s.date} | {s.time} | {s.type}</div>
                        <div className="flex gap-2">
                            <button onClick={() => handleEditSessionClick(s)} className="text-blue-400 text-xs">ערוך</button>
                            <button onClick={() => handleDuplicateSession(s)} className="text-green-400 text-xs">שכפל</button>
                            <button onClick={() => onDeleteSession(s.id)} className="text-red-400 text-xs">מחק</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      )}
    </div>
  );
};