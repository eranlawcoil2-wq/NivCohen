
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

const SQL_SCRIPT = `
-- סקריפט SQL סופי ומעודכן עבור Supabase
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    "fullName" TEXT NOT NULL,
    "displayName" TEXT,
    phone TEXT UNIQUE NOT NULL,
    email TEXT,
    "startDate" TEXT,
    "paymentStatus" TEXT DEFAULT 'PAID',
    "isNew" BOOLEAN DEFAULT false,
    "userColor" TEXT DEFAULT '#A3E635',
    "monthlyRecord" INTEGER DEFAULT 0,
    "isRestricted" BOOLEAN DEFAULT false,
    "healthDeclarationFile" TEXT,
    "healthDeclarationDate" TEXT,
    "healthDeclarationId" TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    location TEXT NOT NULL,
    "maxCapacity" INTEGER NOT NULL,
    description TEXT,
    "registeredPhoneNumbers" TEXT[] DEFAULT '{}',
    "waitingList" TEXT[] DEFAULT '{}',
    "attendedPhoneNumbers" TEXT[],
    color TEXT,
    "isTrial" BOOLEAN DEFAULT false,
    "zoomLink" TEXT,
    "isZoomSession" BOOLEAN DEFAULT false,
    "isHidden" BOOLEAN DEFAULT false,
    "isCancelled" BOOLEAN DEFAULT false,
    "manualHasStarted" BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS config_locations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT,
    color TEXT
);

CREATE TABLE IF NOT EXISTS config_workout_types (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS config_general (
    id TEXT PRIMARY KEY DEFAULT 'main',
    "coachNameHeb" TEXT,
    "coachNameEng" TEXT,
    "coachPhone" TEXT,
    "coachAdditionalPhone" TEXT,
    "coachEmail" TEXT,
    "defaultCity" TEXT,
    "urgentMessage" TEXT
);

CREATE TABLE IF NOT EXISTS config_quotes (
    id TEXT PRIMARY KEY,
    text TEXT NOT NULL
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Access" ON users FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Access" ON sessions FOR ALL USING (true) WITH CHECK (true);
`;

export const AdminPanel: React.FC<AdminPanelProps> = (props) => {
  const [activeTab, setActiveTab] = useState<'attendance' | 'users' | 'settings' | 'connections'>('attendance');
  
  // Modals & Selection State
  const [editingSession, setEditingSession] = useState<TrainingSession | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [attendanceSession, setAttendanceSession] = useState<TrainingSession | null>(null);
  const [markedAttendees, setMarkedAttendees] = useState<Set<string>>(new Set());
  
  // Filters & Sorting
  const [userFilter, setUserFilter] = useState('');
  const [userSortKey, setUserSortKey] = useState<string>('fullName');
  const [weekOffset, setWeekOffset] = useState(0);

  // Settings Temp State
  const [tempConfig, setTempConfig] = useState<AppConfig>(props.appConfig);
  const [newLoc, setNewLoc] = useState({ name: '', color: '#A3E635' });
  const [newType, setNewType] = useState('');
  const [newQuote, setNewQuote] = useState('');

  // --- Helpers ---
  const normalizePhone = (p: string) => p.replace(/\D/g, '').replace(/^972/, '0');
  
  const getMonthlyCount = (phone: string) => {
      const p = normalizePhone(phone);
      const now = new Date();
      return props.sessions.filter(s => {
          const d = new Date(s.date);
          const didAttend = s.attendedPhoneNumbers?.includes(p) || (!s.attendedPhoneNumbers && s.registeredPhoneNumbers.includes(p));
          return d.getMonth() === now.getMonth() && didAttend;
      }).length;
  };

  const calculateStreak = (phone: string) => {
      const p = normalizePhone(phone);
      const userDates = props.sessions
        .filter(s => s.attendedPhoneNumbers?.includes(p) || (!s.attendedPhoneNumbers && s.registeredPhoneNumbers.includes(p)))
        .map(s => s.date);
      if (userDates.length === 0) return 0;
      
      const weeks: Record<string, number> = {};
      userDates.forEach(d => {
          const dt = new Date(d);
          const sun = new Date(dt.setDate(dt.getDate() - dt.getDay()));
          const key = sun.toISOString().split('T')[0];
          weeks[key] = (weeks[key] || 0) + 1;
      });
      
      let streak = 0;
      let check = new Date();
      check.setDate(check.getDate() - check.getDay());
      while(true) {
          const key = check.toISOString().split('T')[0];
          if ((weeks[key] || 0) >= 3) streak++;
          else if (check.getTime() < new Date().getTime() - 7 * 24 * 60 * 60 * 1000) break;
          check.setDate(check.getDate() - 7);
          if (check.getFullYear() < 2024) break;
      }
      return streak;
  };

  const weekDates = useMemo(() => {
    const sun = new Date();
    sun.setDate(sun.getDate() - sun.getDay() + (weekOffset * 7));
    return Array.from({length:7}, (_, i) => {
      const d = new Date(sun);
      d.setDate(sun.getDate() + i);
      return d.toISOString().split('T')[0];
    });
  }, [weekOffset]);

  const sortedUsers = useMemo(() => {
    let list = props.users.filter(u => u.fullName.includes(userFilter) || u.phone.includes(userFilter));
    return list.sort((a,b) => {
        if (userSortKey === 'streak') return calculateStreak(b.phone) - calculateStreak(a.phone);
        if (userSortKey === 'count') return getMonthlyCount(b.phone) - getMonthlyCount(a.phone);
        return a.fullName.localeCompare(b.fullName);
    });
  }, [props.users, userFilter, userSortKey, props.sessions]);

  // --- Actions ---
  const handleSaveAttendance = async () => {
    if (!attendanceSession) return;
    await props.onUpdateSession({ ...attendanceSession, attendedPhoneNumbers: Array.from(markedAttendees) });
    setAttendanceSession(null);
  };

  const handleDuplicate = (s: TrainingSession) => {
    const nextWeek = new Date(new Date(s.date).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    props.onAddSession({ ...s, id: Date.now().toString(), date: nextWeek, registeredPhoneNumbers: [], waitingList: [], attendedPhoneNumbers: null });
    alert('האימון שוכפל לשבוע הבא!');
  };

  return (
    <div className="bg-brand-black min-h-screen">
      {/* Tab Navigation */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar p-4 sticky top-0 bg-brand-black z-30 border-b border-gray-800">
        {[
          { id: 'attendance', label: 'יומן', icon: '📅' },
          { id: 'users', label: 'מתאמנים', icon: '👥' },
          { id: 'settings', label: 'הגדרות', icon: '⚙️' },
          { id: 'connections', label: 'חיבורים', icon: '🔗' }
        ].map(tab => (
          <button 
            key={tab.id} 
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-5 py-2.5 rounded-full text-xs font-bold whitespace-nowrap flex items-center gap-2 transition-all ${activeTab === tab.id ? 'bg-brand-primary text-black scale-105 shadow-lg' : 'bg-gray-800 text-gray-400'}`}
          >
            <span>{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      <div className="p-4 max-w-4xl mx-auto space-y-6">
        
        {/* TAB: ATTENDANCE / CALENDAR */}
        {activeTab === 'attendance' && (
          <div className="space-y-4">
             <div className="flex justify-between items-center bg-gray-800 p-3 rounded-2xl border border-gray-700">
                <button onClick={()=>setWeekOffset(p=>p-1)} className="p-2 text-white bg-gray-700 rounded-lg hover:bg-gray-600">←</button>
                <span className="text-brand-primary font-black text-sm uppercase tracking-widest">{weekOffset === 0 ? 'השבוע' : `שבוע ${weekOffset}`}</span>
                <button onClick={()=>setWeekOffset(p=>p+1)} className="p-2 text-white bg-gray-700 rounded-lg hover:bg-gray-600">→</button>
             </div>

             <Button onClick={() => setEditingSession({ id: Date.now().toString(), type: props.workoutTypes[0], date: new Date().toISOString().split('T')[0], time: '18:00', location: props.locations[0]?.name || '', maxCapacity: 15, registeredPhoneNumbers: [] })} className="w-full py-4 text-lg">+ הוספת אימון חדש</Button>

             <div className="space-y-6">
                {weekDates.map(date => (
                  <div key={date} className="bg-gray-900/50 p-4 rounded-2xl border border-gray-800">
                    <div className="flex justify-between items-center mb-4 border-b border-gray-800 pb-2">
                      <span className="text-white font-bold text-sm">{new Date(date).toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'numeric' })}</span>
                      {props.weatherData?.[date] && <span className="text-[10px] text-gray-500">{Math.round(props.weatherData[date].maxTemp)}°C</span>}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {(props.sessions.filter(s => s.date === date) || []).sort((a,b)=>a.time.localeCompare(b.time)).map(s => (
                        <div key={s.id} className="relative group">
                           <SessionCard session={s} allUsers={props.users} isRegistered={false} onRegisterClick={() => {}} onViewDetails={() => {
                              // Choose between attendance and edit
                              if (confirm(`מה תרצה לעשות עם אימון ה${s.type}?\nביטול = עריכת אימון\nאישור = דיווח נוכחות`)) {
                                 setAttendanceSession(s);
                                 setMarkedAttendees(new Set(s.attendedPhoneNumbers || s.registeredPhoneNumbers));
                              } else {
                                 setEditingSession(s);
                              }
                           }} isAdmin={true} locations={props.locations} />
                           <div className="absolute -top-2 -right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                              <button onClick={(e)=>{e.stopPropagation(); setEditingSession(s);}} className="bg-brand-primary text-black p-1.5 rounded-full text-[10px] shadow-lg">✏️</button>
                              <button onClick={(e)=>{e.stopPropagation(); handleDuplicate(s);}} className="bg-blue-500 text-white p-1.5 rounded-full text-[10px] shadow-lg">👯</button>
                           </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
             </div>
          </div>
        )}

        {/* TAB: USERS MANAGEMENT */}
        {activeTab === 'users' && (
          <div className="space-y-4">
             <div className="flex gap-2">
                <input 
                  placeholder="חיפוש לפי שם או טלפון..." 
                  className="flex-1 bg-gray-800 text-white p-3 rounded-xl border border-gray-700 outline-none focus:border-brand-primary"
                  value={userFilter} onChange={e=>setUserFilter(e.target.value)}
                />
                <select className="bg-gray-800 text-white p-3 rounded-xl border border-gray-700 outline-none" value={userSortKey} onChange={e=>setUserSortKey(e.target.value)}>
                   <option value="name">שם א-ת</option>
                   <option value="streak">סטרייק 🏆</option>
                   <option value="count">אימונים החודש</option>
                </select>
             </div>

             <div className="grid gap-3">
                {sortedUsers.map(u => {
                   const streak = calculateStreak(u.phone);
                   const count = getMonthlyCount(u.phone);
                   const record = Math.max(u.monthlyRecord || 0, count);
                   const hasHealth = !!u.healthDeclarationDate || !!u.healthDeclarationFile;
                   
                   return (
                     <div key={u.id} onClick={() => setEditingUser(u)} className="bg-gray-800/80 p-4 rounded-2xl border border-gray-700 hover:border-brand-primary transition-all cursor-pointer flex justify-between items-center group">
                        <div className="flex gap-4 items-center">
                           <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-black bg-gray-900 border border-gray-700" style={{color: u.userColor || props.primaryColor}}>
                              {u.fullName.charAt(0)}
                           </div>
                           <div>
                              <div className="text-white font-bold flex items-center gap-2">
                                 {u.fullName} {streak >= 3 && <span title="סטרייק פעיל!">🔥</span>}
                              </div>
                              <div className="text-gray-500 text-[10px] font-mono">{u.phone}</div>
                              <div className="flex gap-2 mt-1">
                                 <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${u.paymentStatus === PaymentStatus.PAID ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                                    {u.paymentStatus === PaymentStatus.PAID ? 'שולם' : 'חוב'}
                                 </span>
                                 <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${hasHealth ? 'bg-blue-500/10 text-blue-500' : 'bg-orange-500/10 text-orange-500'}`}>
                                    {hasHealth ? 'הצהרה ✓' : 'אין הצהרה'}
                                 </span>
                              </div>
                           </div>
                        </div>
                        <div className="text-left">
                           <div className="text-xs text-gray-400">החודש: <span className="text-white font-bold">{count}</span> / שיא: <span className="text-brand-primary">{record}</span></div>
                           <div className="text-[10px] text-gray-600">סטרייק: <span className="text-orange-400 font-bold">{streak}</span> 🏆</div>
                        </div>
                     </div>
                   );
                })}
             </div>
          </div>
        )}

        {/* TAB: SETTINGS */}
        {activeTab === 'settings' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
             {/* Profile & Messages */}
             <div className="bg-gray-800 p-5 rounded-2xl border border-gray-700 space-y-4">
                <h3 className="text-brand-primary font-black uppercase text-sm tracking-widest">פרופיל מאמן והודעות</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div>
                      <label className="text-gray-500 text-[10px] block mb-1">שם המאמן</label>
                      <input className="w-full bg-gray-900 text-white p-2.5 rounded-lg border border-gray-700" value={tempConfig.coachNameHeb} onChange={e=>setTempConfig({...tempConfig, coachNameHeb: e.target.value})} />
                   </div>
                   <div>
                      <label className="text-gray-500 text-[10px] block mb-1">סיסמת ניהול</label>
                      <input className="w-full bg-gray-900 text-white p-2.5 rounded-lg border border-gray-700" value={tempConfig.coachAdditionalPhone} onChange={e=>setTempConfig({...tempConfig, coachAdditionalPhone: e.target.value})} />
                   </div>
                </div>
                <div>
                   <label className="text-red-400 text-[10px] block mb-1">הודעה דחופה (תופיע בראש האתר)</label>
                   <textarea className="w-full bg-gray-900 text-white p-2.5 rounded-lg border border-gray-700 h-20" value={tempConfig.urgentMessage} onChange={e=>setTempConfig({...tempConfig, urgentMessage: e.target.value})} />
                </div>
                <Button onClick={() => props.onUpdateAppConfig(tempConfig)}>שמור הגדרות מאמן</Button>
             </div>

             {/* Locations Management */}
             <div className="bg-gray-800 p-5 rounded-2xl border border-gray-700">
                <h3 className="text-brand-primary font-black uppercase text-sm tracking-widest mb-4">ניהול מיקומים</h3>
                <div className="flex flex-wrap gap-2 mb-4">
                   {props.locations.map(l => (
                      <div key={l.id} className="bg-gray-900 border border-gray-700 px-3 py-1.5 rounded-xl flex items-center gap-2" style={{borderRightColor: l.color, borderRightWidth: 4}}>
                         <span className="text-white text-xs">{l.name}</span>
                         <button onClick={() => props.onUpdateLocations(props.locations.filter(x=>x.id!==l.id))} className="text-red-500 text-xs">✕</button>
                      </div>
                   ))}
                </div>
                <div className="flex gap-2">
                   <input className="flex-1 bg-gray-900 text-white p-2.5 rounded-lg border border-gray-700 text-sm" placeholder="שם מיקום..." value={newLoc.name} onChange={e=>setNewLoc({...newLoc, name: e.target.value})} />
                   <input type="color" className="w-12 h-10 bg-transparent" value={newLoc.color} onChange={e=>setNewLoc({...newLoc, color: e.target.value})} />
                   <Button size="sm" onClick={()=>{if(newLoc.name){props.onUpdateLocations([...props.locations, {...newLoc, id: Date.now().toString(), address: ''}]); setNewLoc({name:'', color:'#A3E635'});}}}>הוסף</Button>
                </div>
             </div>

             {/* Workout Types */}
             <div className="bg-gray-800 p-5 rounded-2xl border border-gray-700">
                <h3 className="text-brand-primary font-black uppercase text-sm tracking-widest mb-4">סוגי אימונים</h3>
                <div className="flex flex-wrap gap-2 mb-4">
                   {props.workoutTypes.map(t => (
                      <div key={t} className="bg-gray-900 border border-gray-700 px-3 py-1.5 rounded-xl flex items-center gap-2">
                         <span className="text-white text-xs">{t}</span>
                         <button onClick={() => props.onUpdateWorkoutTypes(props.workoutTypes.filter(x=>x!==t))} className="text-red-500 text-xs">✕</button>
                      </div>
                   ))}
                </div>
                <div className="flex gap-2">
                   <input className="flex-1 bg-gray-900 text-white p-2.5 rounded-lg border border-gray-700 text-sm" placeholder="סוג אימון חדש..." value={newType} onChange={e=>setNewType(e.target.value)} />
                   <Button size="sm" onClick={()=>{if(newType){props.onUpdateWorkoutTypes([...props.workoutTypes, newType]); setNewType('');}}}>הוסף</Button>
                </div>
             </div>
          </div>
        )}

        {/* TAB: CONNECTIONS */}
        {activeTab === 'connections' && (
           <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700 space-y-4">
              <h3 className="text-white font-bold">חיבורים ו-SQL</h3>
              <p className="text-gray-400 text-xs">העתק והרץ את הסקריפט הבא ב-Supabase כדי לוודא שכל העמודות החדשות קיימות (רשימת המתנה, נוכחות וכו').</p>
              <div className="bg-black p-4 rounded-xl max-h-48 overflow-auto text-[10px] font-mono text-green-400">
                 <pre>{SQL_SCRIPT}</pre>
              </div>
              <Button onClick={() => {navigator.clipboard.writeText(SQL_SCRIPT); alert('הועתק!');}} className="w-full">העתק סקריפט SQL 📋</Button>
           </div>
        )}
      </div>

      {/* MODAL: EDIT SESSION */}
      {editingSession && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-md">
           <div className="bg-gray-900 p-6 rounded-3xl w-full max-w-md border border-gray-700 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                 <h3 className="text-white font-black text-xl italic uppercase">עריכת אימון</h3>
                 <button onClick={()=>setEditingSession(null)} className="text-gray-500 text-2xl">✕</button>
              </div>
              <div className="space-y-4">
                 <div className="grid grid-cols-2 gap-3">
                    <div>
                       <label className="text-[10px] text-gray-500 block mb-1">סוג אימון</label>
                       <select className="w-full bg-gray-800 text-white p-3 rounded-xl border border-gray-700" value={editingSession.type} onChange={e=>setEditingSession({...editingSession, type: e.target.value})}>
                          {props.workoutTypes.map(t => <option key={t} value={t}>{t}</option>)}
                       </select>
                    </div>
                    <div>
                       <label className="text-[10px] text-gray-500 block mb-1">מיקום</label>
                       <select className="w-full bg-gray-800 text-white p-3 rounded-xl border border-gray-700" value={editingSession.location} onChange={e=>setEditingSession({...editingSession, location: e.target.value})}>
                          {props.locations.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                       </select>
                    </div>
                 </div>
                 <div className="grid grid-cols-2 gap-3">
                    <div>
                       <label className="text-[10px] text-gray-500 block mb-1">תאריך</label>
                       <input type="date" className="w-full bg-gray-800 text-white p-3 rounded-xl border border-gray-700" value={editingSession.date} onChange={e=>setEditingSession({...editingSession, date: e.target.value})} />
                    </div>
                    <div>
                       <label className="text-[10px] text-gray-500 block mb-1">שעה</label>
                       <input type="time" className="w-full bg-gray-800 text-white p-3 rounded-xl border border-gray-700" value={editingSession.time} onChange={e=>setEditingSession({...editingSession, time: e.target.value})} />
                    </div>
                 </div>
                 <div>
                    <label className="text-[10px] text-gray-500 block mb-1">מקסימום משתתפים</label>
                    <input type="number" className="w-full bg-gray-800 text-white p-3 rounded-xl border border-gray-700" value={editingSession.maxCapacity} onChange={e=>setEditingSession({...editingSession, maxCapacity: parseInt(e.target.value)})} />
                 </div>
                 <div className="flex flex-col gap-2 p-3 bg-gray-800 rounded-xl border border-gray-700">
                    <label className="flex items-center gap-3 text-xs text-white">
                       <input type="checkbox" checked={editingSession.isTrial} onChange={e=>setEditingSession({...editingSession, isTrial: e.target.checked})} /> אימון ניסיון (חדשים בלבד)
                    </label>
                    <label className="flex items-center gap-3 text-xs text-red-400">
                       <input type="checkbox" checked={editingSession.isCancelled} onChange={e=>setEditingSession({...editingSession, isCancelled: e.target.checked})} /> אימון מבוטל ✕
                    </label>
                    <label className="flex items-center gap-3 text-xs text-purple-400">
                       <input type="checkbox" checked={editingSession.isHidden} onChange={e=>setEditingSession({...editingSession, isHidden: e.target.checked})} /> אימון נסתר (למאמן בלבד) 👻
                    </label>
                 </div>
                 <div className="flex flex-col gap-3 pt-4 border-t border-gray-800">
                    <Button onClick={() => {
                       const isNew = !props.sessions.find(x=>x.id===editingSession.id);
                       if(isNew) props.onAddSession(editingSession);
                       else props.onUpdateSession(editingSession);
                       setEditingSession(null);
                    }}>שמור שינויים</Button>
                    <Button variant="outline" onClick={() => {handleDuplicate(editingSession); setEditingSession(null);}}>שכפל לשבוע הבא 👯</Button>
                    <Button variant="danger" onClick={() => {if(confirm('למחוק אימון לצמיתות?')) { props.onDeleteSession(editingSession.id); setEditingSession(null); }}}>מחק אימון 🗑️</Button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* MODAL: EDIT USER */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-md">
           <div className="bg-gray-900 p-6 rounded-3xl w-full max-w-md border border-gray-700 shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                 <h3 className="text-white font-black text-xl italic uppercase">ניהול מתאמן</h3>
                 <button onClick={()=>setEditingUser(null)} className="text-gray-500 text-2xl">✕</button>
              </div>
              <div className="space-y-4">
                 <div>
                    <label className="text-[10px] text-gray-500 block mb-1">שם מלא</label>
                    <input className="w-full bg-gray-800 text-white p-3 rounded-xl border border-gray-700" value={editingUser.fullName} onChange={e=>setEditingUser({...editingUser, fullName: e.target.value})} />
                 </div>
                 <div className="grid grid-cols-2 gap-3">
                    <div>
                       <label className="text-[10px] text-gray-500 block mb-1">סטטוס תשלום</label>
                       <select className="w-full bg-gray-800 text-white p-3 rounded-xl border border-gray-700" value={editingUser.paymentStatus} onChange={e=>setEditingUser({...editingUser, paymentStatus: e.target.value as any})}>
                          <option value={PaymentStatus.PAID}>שולם ✓</option>
                          <option value={PaymentStatus.PENDING}>בהמתנה ⏳</option>
                          <option value={PaymentStatus.OVERDUE}>חוב! 🚨</option>
                       </select>
                    </div>
                    <div>
                       <label className="text-[10px] text-gray-500 block mb-1">הצהרת בריאות</label>
                       <div className="flex gap-2">
                          <button onClick={() => setEditingUser({...editingUser, healthDeclarationDate: editingUser.healthDeclarationDate ? '' : new Date().toISOString()})} className={`flex-1 p-3 rounded-xl border border-gray-700 text-[10px] font-bold ${editingUser.healthDeclarationDate ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
                             {editingUser.healthDeclarationDate ? 'חתום ✓' : 'סמן כחתום'}
                          </button>
                       </div>
                    </div>
                 </div>
                 <div className="p-3 bg-red-900/10 rounded-xl border border-red-900/30">
                    <label className="flex items-center gap-3 text-xs text-red-500 font-bold">
                       <input type="checkbox" checked={editingUser.isRestricted} onChange={e=>setEditingUser({...editingUser, isRestricted: e.target.checked})} /> חסום מהרשמה לאימונים 🚫
                    </label>
                 </div>
                 <div className="flex flex-col gap-3 pt-4 border-t border-gray-800">
                    <Button onClick={() => {props.onUpdateUser(editingUser); setEditingUser(null);}}>שמור פרטי מתאמן</Button>
                    <Button variant="danger" onClick={() => {if(confirm('למחוק מתאמן?')){props.onDeleteUser(editingUser.id); setEditingUser(null);}}}>מחק מתאמן מהמערכת 🗑️</Button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* MODAL: ATTENDANCE CHECKLIST */}
      {attendanceSession && (
        <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={()=>setAttendanceSession(null)}>
           <div className="bg-gray-900 p-6 rounded-3xl w-full max-w-md border border-gray-800 flex flex-col max-h-[90vh]" onClick={e=>e.stopPropagation()}>
              <div className="flex justify-between items-start mb-4">
                 <div>
                    <h3 className="text-xl font-black text-white italic uppercase">{attendanceSession.type}</h3>
                    <p className="text-brand-primary font-mono text-xs">{attendanceSession.time} | {attendanceSession.date}</p>
                 </div>
                 <button onClick={()=>setAttendanceSession(null)} className="text-gray-500 text-2xl">✕</button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 py-4">
                 <div className="p-3 bg-gray-800 rounded-xl border border-gray-700 mb-4">
                    <span className="text-xs text-gray-400 block mb-1">הודעה מהירה לנרשמים:</span>
                    <button className="text-[10px] text-green-500 underline" onClick={()=>{
                       const numbers = attendanceSession.registeredPhoneNumbers.map(normalizePhone).join(',');
                       window.open(`https://wa.me/?text=${encodeURIComponent('היי לכולם! מזכיר שמתחילים עוד מעט 🏋️')}`, '_blank');
                    }}>שלח הודעת וואטסאפ קבוצתית 💬</button>
                 </div>

                 <div className="text-[10px] text-gray-500 mb-2">סמן מי שהגיע ({markedAttendees.size}/{attendanceSession.registeredPhoneNumbers.length}):</div>
                 {attendanceSession.registeredPhoneNumbers.map(p => {
                    const u = props.users.find(x => normalizePhone(x.phone) === normalizePhone(p));
                    const isMarked = markedAttendees.has(p);
                    return (
                       <div key={p} onClick={() => {const s = new Set(markedAttendees); if(s.has(p)) s.delete(p); else s.add(p); setMarkedAttendees(s);}} className={`p-4 rounded-2xl border transition-all cursor-pointer flex justify-between items-center ${isMarked ? 'bg-green-900/10 border-green-500/50 shadow-[0_0_10px_rgba(74,222,128,0.1)]' : 'bg-gray-800 border-gray-700 opacity-60'}`}>
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

    </div>
  );
};
