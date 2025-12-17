import React, { useState, useMemo } from 'react';
import { User, TrainingSession, PaymentStatus, WeatherLocation, PaymentLink, LocationDef, AppConfig, Quote, WeatherInfo } from '../types';
import { Button } from './Button';
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

export const AdminPanel: React.FC<AdminPanelProps> = (props) => {
  const [activeTab, setActiveTab] = useState<'attendance' | 'users' | 'settings' | 'connections'>('attendance');
  const [editingSession, setEditingSession] = useState<TrainingSession | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [attendanceSession, setAttendanceSession] = useState<TrainingSession | null>(null);
  const [markedAttendees, setMarkedAttendees] = useState<Set<string>>(new Set());
  
  const [userFilter, setUserFilter] = useState('');
  const [userSortKey, setUserSortKey] = useState<string>('fullName');
  const [weekOffset, setWeekOffset] = useState(0);
  const [tempConfig, setTempConfig] = useState<AppConfig>(props.appConfig);

  const normalizePhone = (p: string) => p.replace(/\D/g, '').replace(/^972/, '0');
  
  const weekDates = useMemo(() => {
    const sun = new Date();
    sun.setDate(sun.getDate() - sun.getDay() + (weekOffset * 7));
    return Array.from({length:7}, (_, i) => {
      const d = new Date(sun);
      d.setDate(sun.getDate() + i);
      return d.toISOString().split('T')[0];
    });
  }, [weekOffset]);

  // Helpers for sorting/counts
  const getUserWeeklyCount = (phone: string) => {
    const p = normalizePhone(phone);
    return props.sessions.filter(s => 
      weekDates.includes(s.date) && 
      (s.attendedPhoneNumbers?.includes(p) || (!s.attendedPhoneNumbers && s.registeredPhoneNumbers.includes(p)))
    ).length;
  };

  const calculateStreak = (phone: string) => {
      const p = normalizePhone(phone);
      const attendedDates = props.sessions
        .filter(s => s.attendedPhoneNumbers?.includes(p))
        .map(s => s.date);
      if (attendedDates.length === 0) return 0;
      let streak = 0;
      let check = new Date();
      check.setDate(check.getDate() - check.getDay());
      while(true) {
          const key = check.toISOString().split('T')[0];
          const weekSessions = props.sessions.filter(s => s.date.startsWith(key.substring(0,7)) && (s.attendedPhoneNumbers?.includes(p))).length;
          if (weekSessions >= 3) streak++; // Simple streak logic
          else if (check.getTime() < new Date().getTime() - 14 * 24 * 60 * 60 * 1000) break;
          check.setDate(check.getDate() - 7);
          if (check.getFullYear() < 2024) break;
      }
      return streak;
  };

  const sortedUsers = useMemo(() => {
    let list = props.users.filter(u => u.fullName.includes(userFilter) || u.phone.includes(userFilter));
    return list.sort((a: User, b: User) => {
        if (userSortKey === 'health') return (b.healthDeclarationDate ? 1 : 0) - (a.healthDeclarationDate ? 1 : 0);
        if (userSortKey === 'weekly') return getUserWeeklyCount(b.phone) - getUserWeeklyCount(a.phone);
        if (userSortKey === 'record') return (b.monthlyRecord || 0) - (a.monthlyRecord || 0);
        if (userSortKey === 'streak') return calculateStreak(b.phone) - calculateStreak(a.phone);
        return a.fullName.localeCompare(b.fullName);
    });
  }, [props.users, userFilter, userSortKey, props.sessions, weekDates]);

  // Actions
  const handleDuplicate = (s: TrainingSession) => {
    const [h, m] = s.time.split(':').map(Number);
    const dateObj = new Date(`${s.date}T${s.time}`);
    const nextHour = new Date(dateObj.getTime() + 60 * 60 * 1000);
    
    const newTime = nextHour.toTimeString().substring(0, 5);
    const newDate = nextHour.toISOString().split('T')[0];

    props.onAddSession({ 
      ...s, 
      id: Date.now().toString(), 
      date: newDate, 
      time: newTime,
      registeredPhoneNumbers: [], 
      waitingList: [], 
      attendedPhoneNumbers: null 
    });
    alert(`האימון שוכפל לשעה ${newTime}! 🚀`);
  };

  const openAttendance = (s: TrainingSession) => {
      setAttendanceSession(s);
      if (s.attendedPhoneNumbers === undefined || s.attendedPhoneNumbers === null) {
          setMarkedAttendees(new Set(s.registeredPhoneNumbers));
      } else {
          setMarkedAttendees(new Set(s.attendedPhoneNumbers));
      }
  };

  const handleSaveAttendance = async () => {
    if (!attendanceSession) return;
    const finalAttendance = Array.from(markedAttendees);
    await props.onUpdateSession({ ...attendanceSession, attendedPhoneNumbers: finalAttendance });
    setAttendanceSession(null);
  };

  return (
    <div className="bg-brand-black min-h-screen">
      <div className="flex gap-2 overflow-x-auto no-scrollbar p-4 sticky top-0 bg-brand-black z-30 border-b border-gray-800">
        {[
          { id: 'attendance', label: 'יומן ונוכחות', icon: '📅' },
          { id: 'users', label: 'מתאמנים', icon: '👥' },
          { id: 'settings', label: 'הגדרות', icon: '⚙️' }
        ].map(tab => (
          <button 
            key={tab.id} 
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-5 py-2.5 rounded-full text-xs font-bold whitespace-nowrap flex items-center gap-2 transition-all ${activeTab === tab.id ? 'bg-brand-primary text-black scale-105' : 'bg-gray-800 text-gray-400'}`}
          >
            <span>{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      <div className="p-4 max-w-4xl mx-auto space-y-6">
        
        {activeTab === 'attendance' && (
          <div className="space-y-4">
             <div className="flex justify-between items-center bg-gray-800 p-3 rounded-2xl border border-gray-700">
                <button onClick={()=>setWeekOffset(p=>p-1)} className="p-2 text-white">←</button>
                <span className="text-brand-primary font-black text-xs">{weekOffset === 0 ? 'השבוע' : `שבוע ${weekOffset}`}</span>
                <button onClick={()=>setWeekOffset(p=>p+1)} className="p-2 text-white">→</button>
             </div>

             <Button onClick={() => setEditingSession({ id: Date.now().toString(), type: props.workoutTypes[0], date: new Date().toISOString().split('T')[0], time: '18:00', location: props.locations[0]?.name || '', maxCapacity: 15, registeredPhoneNumbers: [] })} className="w-full py-4">+ הוספת אימון</Button>

             <div className="space-y-6">
                {weekDates.map(date => (
                  <div key={date} className="bg-gray-900/50 p-4 rounded-2xl border border-gray-800">
                    <div className="text-white font-bold text-sm mb-4 border-b border-gray-800 pb-2">
                        {new Date(date).toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'numeric' })}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {(props.sessions.filter(s => s.date === date) || []).sort((a,b)=>a.time.localeCompare(b.time)).map(s => (
                        <div key={s.id} className="relative group">
                           <SessionCard session={s} allUsers={props.users} isRegistered={false} onRegisterClick={() => openAttendance(s)} onViewDetails={() => openAttendance(s)} isAdmin={true} locations={props.locations} />
                           <div className="absolute top-1 left-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                              <button onClick={(e) => { e.stopPropagation(); setEditingSession(s); }} className="bg-brand-primary text-black p-1.5 rounded-full text-[10px]">✏️</button>
                              <button onClick={(e) => { e.stopPropagation(); handleDuplicate(s); }} className="bg-blue-500 text-white p-1.5 rounded-full text-[10px]">👯</button>
                           </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
             </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-4">
             <div className="flex gap-2">
                <input placeholder="חיפוש..." className="flex-1 bg-gray-800 text-white p-3 rounded-xl border border-gray-700" value={userFilter} onChange={e=>setUserFilter(e.target.value)} />
                <select className="bg-gray-800 text-white p-3 rounded-xl border border-gray-700 text-xs" value={userSortKey} onChange={e=>setUserSortKey(e.target.value)}>
                   <option value="fullName">שם</option>
                   <option value="health">הצהרה</option>
                   <option value="weekly">השבוע</option>
                   <option value="record">שיא</option>
                   <option value="streak">סטרייק</option>
                </select>
             </div>

             <div className="grid gap-3">
                {sortedUsers.map((u: User) => {
                   const hasHealth = !!u.healthDeclarationDate;
                   const weekly = getUserWeeklyCount(u.phone);
                   return (
                     <div key={u.id} onClick={() => setEditingUser(u)} className="bg-gray-800/80 p-4 rounded-2xl border border-gray-700 flex justify-between items-center cursor-pointer hover:border-brand-primary">
                        <div className="flex gap-3 items-center">
                           <div className="w-10 h-10 rounded-full flex items-center justify-center font-black bg-gray-900" style={{color: u.userColor || props.primaryColor}}>{u.fullName.charAt(0)}</div>
                           <div>
                              <div className="text-white font-bold text-sm">{u.fullName}</div>
                              <div className="flex gap-2 mt-1">
                                 <span className={`text-[8px] px-1.5 py-0.5 rounded-full ${hasHealth ? 'bg-blue-500/10 text-blue-500' : 'bg-red-500/10 text-red-500'}`}>{hasHealth ? 'הצהרה ✓' : 'אין הצהרה'}</span>
                                 <span className="text-[8px] bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded-full">השבוע: {weekly}</span>
                              </div>
                           </div>
                        </div>
                        <div className="text-left text-[10px] text-gray-400">
                           <div>שיא: <span className="text-brand-primary">{u.monthlyRecord || 0}</span></div>
                           <div>סטרייק: <span className="text-orange-400">{calculateStreak(u.phone)}</span> 🏆</div>
                        </div>
                     </div>
                   );
                })}
             </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6">
             <div className="bg-gray-800 p-5 rounded-2xl border border-gray-700 space-y-4">
                <h3 className="text-brand-primary font-black text-xs uppercase tracking-widest">פרופיל מאמן ומיקום</h3>
                <div className="grid grid-cols-2 gap-3">
                   <div>
                      <label className="text-gray-500 text-[10px] block mb-1">שם (עברית)</label>
                      <input className="w-full bg-gray-900 text-white p-2.5 rounded-lg border border-gray-700 text-sm" value={tempConfig.coachNameHeb} onChange={e=>setTempConfig({...tempConfig, coachNameHeb: e.target.value})} />
                   </div>
                   <div>
                      <label className="text-gray-500 text-[10px] block mb-1">שם (אנגלית - ללוגו)</label>
                      <input className="w-full bg-gray-900 text-white p-2.5 rounded-lg border border-gray-700 text-sm" value={tempConfig.coachNameEng} onChange={e=>setTempConfig({...tempConfig, coachNameEng: e.target.value})} />
                   </div>
                </div>
                <div>
                   <label className="text-gray-500 text-[10px] block mb-1">עיר לאימונים (למזג אוויר)</label>
                   <input className="w-full bg-gray-900 text-white p-2.5 rounded-lg border border-gray-700 text-sm" value={tempConfig.defaultCity} onChange={e=>setTempConfig({...tempConfig, defaultCity: e.target.value})} />
                </div>
                <Button size="sm" onClick={() => props.onUpdateAppConfig(tempConfig)}>עדכן הגדרות</Button>
             </div>
             
             {/* Locations & Types management remains similar but with cleaner UI */}
             <div className="bg-gray-800 p-5 rounded-2xl border border-gray-700">
                <h3 className="text-brand-primary font-black text-xs mb-4 uppercase">ניהול מיקומים</h3>
                <div className="grid grid-cols-2 gap-2 mb-4">
                   {props.locations.map(l => (
                      <div key={l.id} className="bg-gray-900 border border-gray-700 px-3 py-2 rounded-xl flex justify-between items-center" style={{borderRightColor: l.color, borderRightWidth: 4}}>
                         <span className="text-white text-xs font-bold">{l.name}</span>
                         <button onClick={() => props.onUpdateLocations(props.locations.filter(x=>x.id!==l.id))} className="text-red-500">✕</button>
                      </div>
                   ))}
                </div>
             </div>
          </div>
        )}
      </div>

      {/* MODAL: ATTENDANCE (DIRECT) */}
      {attendanceSession && (
        <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4">
           <div className="bg-gray-900 p-6 rounded-3xl w-full max-w-md border border-gray-700 flex flex-col max-h-[90vh]">
              <div className="flex justify-between items-start mb-4">
                 <div>
                    <h3 className="text-xl font-black text-white italic leading-none">{attendanceSession.type}</h3>
                    <p className="text-brand-primary font-mono text-xs mt-1">{attendanceSession.time} | {attendanceSession.date}</p>
                 </div>
                 <button onClick={()=>setAttendanceSession(null)} className="text-gray-500 text-2xl">✕</button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 py-2">
                 {attendanceSession.registeredPhoneNumbers.map(p => {
                    const u = props.users.find(x => normalizePhone(x.phone) === normalizePhone(p));
                    const isMarked = markedAttendees.has(p);
                    return (
                       <div key={p} onClick={() => {const s = new Set(markedAttendees); if(s.has(p)) s.delete(p); else s.add(p); setMarkedAttendees(s);}} className={`p-4 rounded-2xl border transition-all cursor-pointer flex justify-between items-center ${isMarked ? 'bg-green-900/10 border-green-500/50' : 'bg-gray-800 border-gray-700 opacity-60'}`}>
                          <span className={`font-bold text-sm ${isMarked ? 'text-green-400' : 'text-gray-400'}`}>{u?.fullName || p}</span>
                          <div className={`w-6 h-6 rounded-full border flex items-center justify-center ${isMarked ? 'bg-green-500 border-green-500 text-black' : 'border-gray-600'}`}>
                             {isMarked && '✓'}
                          </div>
                       </div>
                    );
                 })}
              </div>
              <div className="pt-4 border-t border-gray-800">
                 <Button onClick={handleSaveAttendance} className="w-full py-4 text-lg">שמור נוכחות ✓</Button>
              </div>
           </div>
        </div>
      )}

      {/* MODAL: EDIT USER (HEALTH DECLARATION) */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
           <div className="bg-gray-900 p-6 rounded-3xl w-full max-w-md border border-gray-700 shadow-2xl">
              <h3 className="text-white font-black text-xl mb-6">עריכת מתאמן</h3>
              <div className="space-y-4">
                 <div>
                    <label className="text-[10px] text-gray-500 block">שם מלא</label>
                    <input className="w-full bg-gray-800 text-white p-3 rounded-xl border border-gray-700" value={editingUser.fullName} onChange={e=>setEditingUser({...editingUser, fullName: e.target.value})} />
                 </div>
                 <div className="p-4 bg-blue-900/10 rounded-2xl border border-blue-500/20">
                    <p className="text-blue-400 text-xs font-bold mb-2">הצהרת בריאות 📜</p>
                    <div className="grid grid-cols-2 gap-3">
                       <div>
                          <label className="text-[10px] text-gray-500 block">תאריך חתימה</label>
                          <input type="date" className="w-full bg-gray-800 text-white p-2 rounded-lg border border-gray-700 text-xs" value={editingUser.healthDeclarationDate?.split('T')[0] || ''} onChange={e=>setEditingUser({...editingUser, healthDeclarationDate: e.target.value ? new Date(e.target.value).toISOString() : ''})} />
                       </div>
                       <div>
                          <label className="text-[10px] text-gray-500 block">ת"ז</label>
                          <input className="w-full bg-gray-800 text-white p-2 rounded-lg border border-gray-700 text-xs" value={editingUser.healthDeclarationId || ''} onChange={e=>setEditingUser({...editingUser, healthDeclarationId: e.target.value})} />
                       </div>
                    </div>
                 </div>
                 <div className="flex flex-col gap-3 pt-4 border-t border-gray-800">
                    <Button onClick={() => {props.onUpdateUser(editingUser); setEditingUser(null);}}>שמור מתאמן</Button>
                    <Button variant="danger" onClick={() => {if(confirm('למחוק מתאמן?')){props.onDeleteUser(editingUser.id); setEditingUser(null);}}}>מחק מתאמן 🗑️</Button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* MODAL: EDIT SESSION SETTINGS */}
      {editingSession && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
           <div className="bg-gray-900 p-6 rounded-3xl w-full max-w-md border border-gray-700 max-h-[90vh] overflow-y-auto">
              <h3 className="text-white font-black text-xl mb-6 italic uppercase">הגדרות אימון</h3>
              <div className="space-y-4">
                 <div className="grid grid-cols-2 gap-3">
                    <div>
                       <label className="text-[10px] text-gray-500 block">סוג</label>
                       <select className="w-full bg-gray-800 text-white p-3 rounded-xl border border-gray-700" value={editingSession.type} onChange={e=>setEditingSession({...editingSession, type: e.target.value})}>
                          {props.workoutTypes.map(t => <option key={t} value={t}>{t}</option>)}
                       </select>
                    </div>
                    <div>
                       <label className="text-[10px] text-gray-500 block">מיקום</label>
                       <select className="w-full bg-gray-800 text-white p-3 rounded-xl border border-gray-700" value={editingSession.location} onChange={e=>setEditingSession({...editingSession, location: e.target.value})}>
                          {props.locations.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                       </select>
                    </div>
                 </div>
                 <div className="grid grid-cols-2 gap-3">
                    <div>
                       <label className="text-[10px] text-gray-500 block">תאריך</label>
                       <input type="date" className="w-full bg-gray-800 text-white p-3 rounded-xl border border-gray-700" value={editingSession.date} onChange={e=>setEditingSession({...editingSession, date: e.target.value})} />
                    </div>
                    <div>
                       <label className="text-[10px] text-gray-500 block">שעה</label>
                       <input type="time" className="w-full bg-gray-800 text-white p-3 rounded-xl border border-gray-700" value={editingSession.time} onChange={e=>setEditingSession({...editingSession, time: e.target.value})} />
                    </div>
                 </div>
                 <div className="flex flex-col gap-3 pt-4 border-t border-gray-800">
                    <Button onClick={() => {
                       const isNew = !props.sessions.find(x=>x.id===editingSession.id);
                       if(isNew) props.onAddSession(editingSession);
                       else props.onUpdateSession(editingSession);
                       setEditingSession(null);
                    }}>שמור הגדרות</Button>
                    <Button variant="danger" onClick={() => {if(confirm('למחוק אימון?')) { props.onDeleteSession(editingSession.id); setEditingSession(null); }}}>מחק לצמיתות 🗑️</Button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};