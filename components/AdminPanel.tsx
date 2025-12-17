
import React, { useState, useMemo, useCallback } from 'react';
import { User, TrainingSession, WeatherLocation, PaymentLink, LocationDef, AppConfig, Quote, WeatherInfo } from '../types';
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
-- סקריפט SQL עבור Supabase (Niv Fitness)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    "fullName" TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    email TEXT,
    "userColor" TEXT DEFAULT '#A3E635',
    "monthlyRecord" INTEGER DEFAULT 0,
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
    "attendedPhoneNumbers" TEXT[],
    "isTrial" BOOLEAN DEFAULT false,
    "isHidden" BOOLEAN DEFAULT false,
    "isCancelled" BOOLEAN DEFAULT false,
    "manualHasStarted" BOOLEAN DEFAULT false
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
    "defaultCity" TEXT,
    "urgentMessage" TEXT
);
`;

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
  const [newType, setNewType] = useState('');

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

  const handleDuplicate = (s: TrainingSession) => {
    const [h, m] = s.time.split(':').map(Number);
    const newH = (h + 1) % 24;
    const newTime = `${newH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    props.onAddSession({ ...s, id: Date.now().toString(), time: newTime, registeredPhoneNumbers: [], attendedPhoneNumbers: null, manualHasStarted: false });
    alert(`שוכפל לשעה ${newTime}! 🚀`);
  };

  const handleWhatsAppPush = (s: TrainingSession) => {
      const text = `היי מתאמנים! 📢\nאימון ${s.type} מתקיים ב-${s.date} בשעה ${s.time}!\nמיקום: ${s.location}\nנתראה שם! 💪🔥`;
      const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
      window.open(url, '_blank');
  };

  const openAttendance = (s: TrainingSession) => {
      setAttendanceSession(s);
      // Logic: Default to all registered if not marked yet
      if (!s.attendedPhoneNumbers) {
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
      {/* Tab Switcher */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar p-4 sticky top-0 bg-brand-black z-30 border-b border-gray-800">
        {[
          { id: 'attendance', label: 'יומן ונוכחות', icon: '📅' },
          { id: 'users', label: 'מתאמנים', icon: '👥' },
          { id: 'settings', label: 'הגדרות', icon: '⚙️' },
          { id: 'connections', label: 'חיבורים', icon: '🔗' }
        ].map(tab => (
          <button 
            key={tab.id} 
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-5 py-2.5 rounded-full text-[10px] font-black whitespace-nowrap flex items-center gap-2 transition-all uppercase tracking-widest ${activeTab === tab.id ? 'bg-brand-primary text-black scale-105 shadow-lg shadow-brand-primary/20' : 'bg-gray-800 text-gray-400'}`}
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
                <span className="text-brand-primary font-black text-[10px] uppercase tracking-widest">{weekOffset === 0 ? 'השבוע' : `שבוע ${weekOffset}`}</span>
                <button onClick={()=>setWeekOffset(p=>p+1)} className="p-2 text-white">→</button>
             </div>

             <Button onClick={() => setEditingSession({ id: Date.now().toString(), type: props.workoutTypes[0], date: new Date().toISOString().split('T')[0], time: '18:00', location: props.locations[0]?.name || '', maxCapacity: 15, registeredPhoneNumbers: [], attendedPhoneNumbers: null })} className="w-full py-4 text-lg rounded-3xl">+ הוספת אימון חדש</Button>

             <div className="space-y-6">
                {weekDates.map(date => (
                  <div key={date} className="bg-gray-900/50 p-4 rounded-3xl border border-gray-800/50">
                    <div className="text-white font-black text-[10px] mb-4 border-b border-gray-800 pb-2 flex justify-between uppercase tracking-widest">
                        <span>{new Date(date).toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'numeric' })}</span>
                        {props.weatherData?.[date] && <span className="text-gray-500">{Math.round(props.weatherData[date].maxTemp)}°C</span>}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {(props.sessions.filter(s => s.date === date) || []).sort((a,b)=>a.time.localeCompare(b.time)).map(s => (
                        <div key={s.id} className="relative group">
                           <SessionCard session={s} allUsers={props.users} isRegistered={false} onRegisterClick={() => openAttendance(s)} onViewDetails={() => openAttendance(s)} isAdmin={true} locations={props.locations} />
                           <div className="absolute top-1 left-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                              <button onClick={(e) => { e.stopPropagation(); setEditingSession(s); }} className="bg-brand-primary text-black p-2 rounded-full text-xs shadow-xl">✏️</button>
                              <button onClick={(e) => { e.stopPropagation(); handleDuplicate(s); }} className="bg-blue-500 text-white p-2 rounded-full text-xs shadow-xl">👯</button>
                              <button onClick={(e) => { e.stopPropagation(); handleWhatsAppPush(s); }} className="bg-green-600 text-white p-2 rounded-full text-xs shadow-xl">📱</button>
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
                <input placeholder="חיפוש לפי שם..." className="flex-1 bg-gray-800 text-white p-4 rounded-2xl border border-gray-700 outline-none focus:border-brand-primary" value={userFilter} onChange={e=>setUserFilter(e.target.value)} />
                <select className="bg-gray-800 text-white p-4 rounded-2xl border border-gray-700 text-xs font-bold" value={userSortKey} onChange={e=>setUserSortKey(e.target.value)}>
                   <option value="fullName">שם א-ת</option>
                   <option value="health">הצהרת בריאות</option>
                   <option value="record">שיא אישי 🏆</option>
                </select>
             </div>
             <div className="grid gap-3">
                {props.users.filter(u => u.fullName.includes(userFilter)).map((u: User) => {
                   const hasHealth = !!u.healthDeclarationDate;
                   return (
                     <div key={u.id} onClick={() => setEditingUser(u)} className="bg-gray-800/60 p-5 rounded-3xl border border-gray-700 flex justify-between items-center cursor-pointer hover:border-brand-primary transition-all group">
                        <div className="flex gap-4 items-center">
                           <div className="w-12 h-12 rounded-full flex items-center justify-center font-black bg-gray-900 border border-gray-700" style={{color: u.userColor || props.primaryColor}}>{u.fullName.charAt(0)}</div>
                           <div>
                              <div className="text-white font-bold">{u.fullName}</div>
                              <div className="flex gap-2 mt-1">
                                 <span className={`text-[8px] px-2 py-0.5 rounded-full font-black uppercase ${hasHealth ? 'bg-blue-500/10 text-blue-500' : 'bg-red-500/10 text-red-500'}`}>{hasHealth ? 'הצהרה ✓' : 'אין הצהרה'}</span>
                              </div>
                           </div>
                        </div>
                        <div className="text-left text-[10px] text-gray-500 font-bold uppercase">
                           שיא: <span className="text-brand-primary text-sm">{u.monthlyRecord || 0}</span>
                        </div>
                     </div>
                   );
                })}
             </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6">
             <div className="bg-gray-800 p-6 rounded-3xl border border-gray-700 space-y-4 shadow-xl">
                <h3 className="text-brand-primary font-black text-[10px] uppercase tracking-widest">פרופיל מאמן והודעות</h3>
                <div className="grid grid-cols-2 gap-4">
                   <div>
                      <label className="text-gray-500 text-[10px] block mb-1 font-bold uppercase">שם (עברית)</label>
                      <input className="w-full bg-gray-900 text-white p-3 rounded-xl border border-gray-700" value={tempConfig.coachNameHeb} onChange={e=>setTempConfig({...tempConfig, coachNameHeb: e.target.value})} />
                   </div>
                   <div>
                      <label className="text-gray-500 text-[10px] block mb-1 font-bold uppercase">שם (אנגלית - ללוגו)</label>
                      <input className="w-full bg-gray-900 text-white p-3 rounded-xl border border-gray-700" value={tempConfig.coachNameEng} onChange={e=>setTempConfig({...tempConfig, coachNameEng: e.target.value})} />
                   </div>
                </div>
                <div>
                   <label className="text-red-400 text-[10px] block mb-1 font-bold uppercase">הודעה דחופה למתאמנים 📢</label>
                   <input className="w-full bg-gray-900 text-white p-3 rounded-xl border border-gray-700 placeholder-gray-700" placeholder="ההודעה תהבהב בראש המסך..." value={tempConfig.urgentMessage || ''} onChange={e=>setTempConfig({...tempConfig, urgentMessage: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div>
                      <label className="text-gray-500 text-[10px] block mb-1 font-bold uppercase">טלפון לוואטסאפ</label>
                      <input className="w-full bg-gray-900 text-white p-3 rounded-xl border border-gray-700" value={tempConfig.coachPhone} onChange={e=>setTempConfig({...tempConfig, coachPhone: e.target.value})} />
                   </div>
                   <div>
                      <label className="text-gray-500 text-[10px] block mb-1 font-bold uppercase">עיר לתחזית</label>
                      <input className="w-full bg-gray-900 text-white p-3 rounded-xl border border-gray-700" value={tempConfig.defaultCity} onChange={e=>setTempConfig({...tempConfig, defaultCity: e.target.value})} />
                   </div>
                </div>
                <Button size="sm" onClick={() => props.onUpdateAppConfig(tempConfig)} className="w-full py-3">עדכן הגדרות מאמן</Button>
             </div>

             <div className="bg-gray-800 p-6 rounded-3xl border border-gray-700 shadow-xl">
                <h3 className="text-brand-primary font-black text-[10px] mb-4 uppercase tracking-widest">ניהול סוגי אימונים</h3>
                <div className="flex flex-wrap gap-2 mb-4">
                   {props.workoutTypes.map(t => (
                      <div key={t} className="bg-gray-900 border border-gray-700 px-3 py-1.5 rounded-full flex items-center gap-2">
                         <span className="text-white text-xs font-bold">{t}</span>
                         <button onClick={() => props.onUpdateWorkoutTypes(props.workoutTypes.filter(x=>x!==t))} className="text-red-500 hover:scale-125 transition-transform">✕</button>
                      </div>
                   ))}
                </div>
                <div className="flex gap-2">
                   <input className="flex-1 bg-gray-900 text-white p-3 rounded-xl border border-gray-700" placeholder="סוג אימון חדש..." value={newType} onChange={e=>setNewType(e.target.value)} />
                   <Button size="sm" onClick={()=>{if(newType){props.onUpdateWorkoutTypes([...props.workoutTypes, newType]); setNewType('');}}}>הוסף</Button>
                </div>
             </div>
          </div>
        )}

        {activeTab === 'connections' && (
           <div className="bg-gray-800 p-6 rounded-3xl border border-gray-700 space-y-4 shadow-xl">
              <h3 className="text-white font-black text-[10px] uppercase tracking-widest">חיבור למסד נתונים (SQL)</h3>
              <p className="text-gray-500 text-[10px] italic font-bold">העתק את הסקריפט והרץ אותו ב-Supabase SQL Editor כדי להקים את המערכת.</p>
              <div className="bg-black p-5 rounded-2xl max-h-64 overflow-auto text-[10px] font-mono text-green-400 border border-gray-900">
                 <pre>{SQL_SCRIPT}</pre>
              </div>
              <Button onClick={() => {navigator.clipboard.writeText(SQL_SCRIPT); alert('הסקריפט הועתק! 📋');}} className="w-full py-4 rounded-2xl">העתק סקריפט SQL</Button>
           </div>
        )}
      </div>

      {/* MODAL: DIRECT ATTENDANCE */}
      {attendanceSession && (
        <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4 backdrop-blur-md">
           <div className="bg-gray-900 p-8 rounded-[40px] w-full max-w-md border border-gray-800 flex flex-col max-h-[90vh] shadow-2xl">
              <div className="flex justify-between items-start mb-6">
                 <div>
                    <h3 className="text-2xl font-black text-white italic leading-none">{attendanceSession.type}</h3>
                    <p className="text-brand-primary font-mono text-xs mt-1 uppercase tracking-tighter">{attendanceSession.time} | {attendanceSession.date}</p>
                 </div>
                 <button onClick={()=>setAttendanceSession(null)} className="text-gray-500 text-3xl">✕</button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 py-2 no-scrollbar">
                 {attendanceSession.registeredPhoneNumbers.length === 0 ? (
                    <div className="text-center text-gray-700 py-12 font-bold italic">אין רשומים לאימון</div>
                 ) : (
                    attendanceSession.registeredPhoneNumbers.map(p => {
                        const u = props.users.find(x => normalizePhone(x.phone) === normalizePhone(p));
                        const isMarked = markedAttendees.has(p);
                        return (
                           <div key={p} onClick={() => {const s = new Set(markedAttendees); if(s.has(p)) s.delete(p); else s.add(p); setMarkedAttendees(s);}} className={`p-5 rounded-3xl border transition-all cursor-pointer flex justify-between items-center ${isMarked ? 'bg-brand-primary/10 border-brand-primary/40' : 'bg-gray-800 border-gray-700 opacity-40'}`}>
                              <span className={`font-black text-sm ${isMarked ? 'text-brand-primary' : 'text-gray-500'}`}>{u?.fullName || p}</span>
                              <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${isMarked ? 'bg-brand-primary border-brand-primary text-black' : 'border-gray-600'}`}>
                                 {isMarked && <span className="font-black">✓</span>}
                              </div>
                           </div>
                        );
                    })
                 )}
              </div>
              <div className="pt-6 border-t border-gray-800 mt-4">
                 <Button onClick={handleSaveAttendance} className="w-full py-5 text-lg rounded-3xl shadow-xl shadow-brand-primary/20">שמור נוכחות ✓</Button>
              </div>
           </div>
        </div>
      )}

      {/* MODAL: EDIT SESSION */}
      {editingSession && (
        <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4 backdrop-blur-md">
           <div className="bg-gray-900 p-8 rounded-[40px] w-full max-w-lg border border-gray-700 max-h-[90vh] overflow-y-auto shadow-2xl no-scrollbar">
              <div className="flex justify-between items-center mb-8">
                 <h3 className="text-white font-black text-2xl italic uppercase tracking-wider">הגדרות אימון</h3>
                 <button onClick={()=>setEditingSession(null)} className="text-gray-500 text-3xl">✕</button>
              </div>
              <div className="space-y-6">
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                       <label className="text-[10px] text-gray-500 block mb-1 uppercase font-black">סוג אימון</label>
                       <select className="w-full bg-gray-800 text-white p-4 rounded-2xl border border-gray-700 outline-none focus:border-brand-primary" value={editingSession.type} onChange={e=>setEditingSession({...editingSession, type: e.target.value})}>
                          {props.workoutTypes.map(t => <option key={t} value={t}>{t}</option>)}
                       </select>
                    </div>
                    <div>
                       <label className="text-[10px] text-gray-500 block mb-1 uppercase font-black">מיקום</label>
                       <select className="w-full bg-gray-800 text-white p-4 rounded-2xl border border-gray-700 outline-none focus:border-brand-primary" value={editingSession.location} onChange={e=>setEditingSession({...editingSession, location: e.target.value})}>
                          {props.locations.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                       </select>
                    </div>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-[10px] text-gray-500 block mb-1 uppercase font-black">תאריך</label><input type="date" className="w-full bg-gray-800 text-white p-4 rounded-2xl border border-gray-700" value={editingSession.date} onChange={e=>setEditingSession({...editingSession, date: e.target.value})} /></div>
                    <div><label className="text-[10px] text-gray-500 block mb-1 uppercase font-black">שעה</label><input type="time" className="w-full bg-gray-800 text-white p-4 rounded-2xl border border-gray-700" value={editingSession.time} onChange={e=>setEditingSession({...editingSession, time: e.target.value})} /></div>
                 </div>
                 <div>
                    <label className="text-[10px] text-gray-500 block mb-1 uppercase font-black">תיאור האימון</label>
                    <textarea className="w-full bg-gray-800 text-white p-4 rounded-2xl border border-gray-700 h-28 outline-none focus:border-brand-primary" value={editingSession.description || ''} onChange={e=>setEditingSession({...editingSession, description: e.target.value})} />
                 </div>
                 <div className="grid grid-cols-2 gap-3 p-5 bg-gray-800/50 rounded-3xl border border-gray-700">
                    <label className="flex items-center gap-3 text-xs font-bold text-white"><input type="checkbox" className="w-5 h-5 rounded-lg accent-brand-primary" checked={editingSession.isTrial} onChange={e=>setEditingSession({...editingSession, isTrial: e.target.checked})} /> אימון ניסיון 🌟</label>
                    <label className="flex items-center gap-3 text-xs font-bold text-red-400"><input type="checkbox" className="w-5 h-5 rounded-lg accent-red-500" checked={editingSession.isCancelled} onChange={e=>setEditingSession({...editingSession, isCancelled: e.target.checked})} /> בטל אימון ✕</label>
                    <label className="flex items-center gap-3 text-xs font-bold text-purple-400"><input type="checkbox" className="w-5 h-5 rounded-lg accent-purple-500" checked={editingSession.isHidden} onChange={e=>setEditingSession({...editingSession, isHidden: e.target.checked})} /> אימון נסתר 👻</label>
                    <label className="flex items-center gap-3 text-xs font-bold text-brand-primary"><input type="checkbox" className="w-5 h-5 rounded-lg accent-brand-primary" checked={editingSession.manualHasStarted} onChange={e=>setEditingSession({...editingSession, manualHasStarted: e.target.checked})} /> מתקיים כעת! ⚡</label>
                 </div>
                 <div className="flex flex-col gap-3 pt-6 border-t border-gray-800">
                    <Button onClick={() => { const isNew = !props.sessions.find(x=>x.id===editingSession.id); if(isNew) props.onAddSession(editingSession); else props.onUpdateSession(editingSession); setEditingSession(null); }} className="w-full py-5 rounded-3xl">שמור שינויים באימון</Button>
                    <Button variant="danger" onClick={() => {if(confirm('למחוק אימון?')) { props.onDeleteSession(editingSession.id); setEditingSession(null); }}}>מחק אימון לצמיתות 🗑️</Button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
