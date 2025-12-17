
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
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, "fullName" TEXT NOT NULL, phone TEXT UNIQUE NOT NULL, email TEXT, "userColor" TEXT DEFAULT '#A3E635', "monthlyRecord" INTEGER DEFAULT 0, "healthDeclarationDate" TEXT, "healthDeclarationId" TEXT);
CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, type TEXT NOT NULL, date TEXT NOT NULL, time TEXT NOT NULL, location TEXT NOT NULL, "maxCapacity" INTEGER NOT NULL, description TEXT, "registeredPhoneNumbers" TEXT[] DEFAULT '{}', "attendedPhoneNumbers" TEXT[], "isTrial" BOOLEAN DEFAULT false, "isHidden" BOOLEAN DEFAULT false, "isCancelled" BOOLEAN DEFAULT false, "manualHasStarted" BOOLEAN DEFAULT false);
CREATE TABLE IF NOT EXISTS config_workout_types (id TEXT PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS config_general (id TEXT PRIMARY KEY DEFAULT 'main', "coachNameHeb" TEXT, "coachNameEng" TEXT, "coachPhone" TEXT, "coachAdditionalPhone" TEXT, "defaultCity" TEXT, "urgentMessage" TEXT);
`;

export const AdminPanel: React.FC<AdminPanelProps> = (props) => {
  const [activeTab, setActiveTab] = useState<'attendance' | 'users' | 'settings' | 'connections'>('attendance');
  const [editingSession, setEditingSession] = useState<TrainingSession | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [attendanceSession, setAttendanceSession] = useState<TrainingSession | null>(null);
  const [markedAttendees, setMarkedAttendees] = useState<Set<string>>(new Set());
  const [newType, setNewType] = useState('');
  const [weekOffset, setWeekOffset] = useState(0);
  const [tempConfig, setTempConfig] = useState(props.appConfig);

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

  const handleWhatsAppPush = (s: TrainingSession) => {
      const text = `היי מתאמנים! 📢\nאימון ${s.type} ב-${s.date} בשעה ${s.time}!\nמיקום: ${s.location}\nנתראה שם! 💪🔥`;
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const openAttendance = (s: TrainingSession) => {
      setAttendanceSession(s);
      // DEFAULT TO ALL REGISTERED (V)
      setMarkedAttendees(new Set(s.attendedPhoneNumbers || s.registeredPhoneNumbers));
  };

  return (
    <div className="bg-brand-black min-h-screen">
      <div className="flex gap-2 overflow-x-auto no-scrollbar p-4 sticky top-0 bg-brand-black z-30 border-b border-gray-800">
        {[
          { id: 'attendance', label: 'יומן ונוכחות', icon: '📅' },
          { id: 'users', label: 'מתאמנים', icon: '👥' },
          { id: 'settings', label: 'הגדרות', icon: '⚙️' },
          { id: 'connections', label: 'חיבורים', icon: '🔗' }
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`px-5 py-3 rounded-full text-[10px] font-black whitespace-nowrap flex items-center gap-2 transition-all uppercase tracking-widest ${activeTab === tab.id ? 'bg-red-600 text-white scale-105 shadow-xl shadow-red-600/20' : 'bg-gray-800 text-gray-400'}`}>
            <span>{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-6">
        {activeTab === 'attendance' && (
          <div className="space-y-4">
             <div className="flex justify-between items-center bg-gray-800 p-4 rounded-3xl border border-gray-700">
                <button onClick={()=>setWeekOffset(p=>p-1)} className="text-white">←</button>
                <span className="text-red-500 font-black text-xs uppercase tracking-widest">{weekOffset === 0 ? 'השבוע' : `שבוע ${weekOffset}`}</span>
                <button onClick={()=>setWeekOffset(p=>p+1)} className="text-white">→</button>
             </div>
             <Button onClick={() => setEditingSession({ id: Date.now().toString(), type: props.workoutTypes[0], date: new Date().toISOString().split('T')[0], time: '18:00', location: props.locations[0]?.name || '', maxCapacity: 15, registeredPhoneNumbers: [], attendedPhoneNumbers: null })} className="w-full py-5 text-lg rounded-[40px] bg-red-600 hover:bg-red-500">+ הוספת אימון חדש</Button>
             <div className="space-y-6">
                {weekDates.map(date => (
                  <div key={date} className="bg-gray-900/50 p-6 rounded-[40px] border border-gray-800">
                    <div className="text-white font-black text-[10px] mb-4 border-b border-gray-800 pb-2 flex justify-between uppercase tracking-widest">
                        <span>{new Date(date).toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'numeric' })}</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {props.sessions.filter(s => s.date === date).map(s => (
                        <div key={s.id} className="relative group">
                           <SessionCard session={s} allUsers={props.users} isRegistered={false} onRegisterClick={() => openAttendance(s)} onViewDetails={() => openAttendance(s)} isAdmin={true} locations={props.locations} />
                           <div className="absolute top-1 left-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                              <button onClick={(e) => { e.stopPropagation(); setEditingSession(s); }} className="bg-red-500 text-white p-2 rounded-full text-xs shadow-xl">✏️</button>
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
             <div className="grid gap-3">
                {props.users.map((u: User) => (
                   <div key={u.id} onClick={() => setEditingUser(u)} className="bg-gray-800/60 p-5 rounded-3xl border border-gray-700 flex justify-between items-center cursor-pointer hover:border-red-500 transition-all">
                      <div className="flex gap-4 items-center">
                         <div className="w-12 h-12 rounded-full flex items-center justify-center font-black bg-gray-900 border border-gray-700" style={{color: u.userColor || props.primaryColor}}>{u.fullName.charAt(0)}</div>
                         <div><div className="text-white font-black">{u.fullName}</div><div className="text-[10px] text-gray-500">{u.phone}</div></div>
                      </div>
                      <div className="text-[10px] font-black uppercase text-red-500">שיא: {u.monthlyRecord || 0}</div>
                   </div>
                ))}
             </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6">
             <div className="bg-gray-800 p-8 rounded-[40px] border border-gray-700 space-y-4 shadow-xl">
                <h3 className="text-red-500 font-black text-[10px] uppercase tracking-widest">פרופיל מאמן והודעות</h3>
                <div className="grid grid-cols-2 gap-4">
                   <input className="bg-gray-900 text-white p-4 rounded-2xl border border-gray-700" value={tempConfig.coachNameHeb} onChange={e=>setTempConfig({...tempConfig, coachNameHeb: e.target.value})} />
                   <input className="bg-gray-900 text-white p-4 rounded-2xl border border-gray-700" value={tempConfig.coachNameEng} onChange={e=>setTempConfig({...tempConfig, coachNameEng: e.target.value})} />
                </div>
                <input className="w-full bg-gray-900 text-red-500 font-bold p-4 rounded-2xl border border-gray-700 placeholder-gray-800" placeholder="הודעה דחופה למתאמנים..." value={tempConfig.urgentMessage || ''} onChange={e=>setTempConfig({...tempConfig, urgentMessage: e.target.value})} />
                <Button size="sm" onClick={() => props.onUpdateAppConfig(tempConfig)} className="w-full bg-red-600">עדכן הגדרות</Button>
             </div>
             <div className="bg-gray-800 p-8 rounded-[40px] border border-gray-700 shadow-xl">
                <h3 className="text-red-500 font-black text-[10px] mb-4 uppercase tracking-widest">ניהול סוגי אימונים</h3>
                <div className="flex flex-wrap gap-2 mb-4">
                   {props.workoutTypes.map(t => (
                      <div key={t} className="bg-gray-900 border border-gray-700 px-3 py-2 rounded-full flex items-center gap-2">
                         <span className="text-white text-xs font-bold">{t}</span>
                         <button onClick={() => props.onUpdateWorkoutTypes(props.workoutTypes.filter(x=>x!==t))} className="text-red-500">✕</button>
                      </div>
                   ))}
                </div>
                <div className="flex gap-2">
                   <input className="flex-1 bg-gray-900 text-white p-4 rounded-2xl border border-gray-700" placeholder="סוג חדש..." value={newType} onChange={e=>setNewType(e.target.value)} />
                   <Button size="sm" onClick={()=>{if(newType){props.onUpdateWorkoutTypes([...props.workoutTypes, newType]); setNewType('');}}} className="bg-red-600">הוסף</Button>
                </div>
             </div>
          </div>
        )}

        {activeTab === 'connections' && (
           <div className="bg-gray-800 p-8 rounded-[40px] border border-gray-700 space-y-4 shadow-xl">
              <h3 className="text-white font-black text-[10px] uppercase tracking-widest">חיבור למסד נתונים (SQL)</h3>
              <div className="bg-black p-5 rounded-2xl max-h-64 overflow-auto text-[10px] font-mono text-green-400 border border-gray-900">
                 <pre>{SQL_SCRIPT}</pre>
              </div>
              <Button onClick={() => {navigator.clipboard.writeText(SQL_SCRIPT); alert('סקריפט הועתק!');}} className="w-full py-5 rounded-3xl bg-red-600">העתק סקריפט SQL</Button>
           </div>
        )}
      </div>

      {attendanceSession && (
        <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4 backdrop-blur-md">
           <div className="bg-gray-900 p-10 rounded-[40px] w-full max-w-md border border-gray-800 flex flex-col max-h-[90vh]">
              <div className="flex justify-between items-start mb-6">
                 <div><h3 className="text-2xl font-black text-white italic uppercase">{attendanceSession.type}</h3><p className="text-red-500 font-mono text-xs">{attendanceSession.time} | {attendanceSession.date}</p></div>
                 <button onClick={()=>setAttendanceSession(null)} className="text-gray-500 text-3xl">✕</button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 py-2 no-scrollbar">
                 {attendanceSession.registeredPhoneNumbers.map(p => {
                    const u = props.users.find(x => normalizePhone(x.phone) === normalizePhone(p));
                    const isMarked = markedAttendees.has(p);
                    return (
                       <div key={p} onClick={() => {const s = new Set(markedAttendees); if(s.has(p)) s.delete(p); else s.add(p); setMarkedAttendees(s);}} className={`p-5 rounded-3xl border transition-all cursor-pointer flex justify-between items-center ${isMarked ? 'bg-red-600/10 border-red-500/40' : 'bg-gray-800 border-gray-700 opacity-40'}`}>
                          <span className={`font-black text-sm ${isMarked ? 'text-red-500' : 'text-gray-500'}`}>{u?.fullName || p}</span>
                          <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${isMarked ? 'bg-red-500 border-red-500 text-white' : 'border-gray-600'}`}>{isMarked && '✓'}</div>
                       </div>
                    );
                 })}
              </div>
              <Button onClick={async () => {
                  await props.onUpdateSession({ ...attendanceSession, attendedPhoneNumbers: Array.from(markedAttendees) });
                  setAttendanceSession(null);
              }} className="w-full py-5 mt-4 rounded-3xl bg-red-600">שמור נוכחות ✓</Button>
           </div>
        </div>
      )}
    </div>
  );
};
