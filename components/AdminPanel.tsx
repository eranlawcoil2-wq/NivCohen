
import React, { useState, useMemo } from 'react';
import { User, TrainingSession, WeatherLocation, PaymentLink, LocationDef, AppConfig, Quote, WeatherInfo, PaymentStatus } from '../types';
import { Button } from './Button';
import { SessionCard } from './SessionCard';
import { dataService } from '../services/dataService';

interface AdminPanelProps {
  users: User[]; sessions: TrainingSession[]; primaryColor: string; workoutTypes: string[]; locations: LocationDef[];
  weatherLocation: WeatherLocation; weatherData?: Record<string, WeatherInfo>; paymentLinks: PaymentLink[];
  streakGoal: number; appConfig: AppConfig; quotes: Quote[]; deferredPrompt?: any; onInstall?: () => void;
  onAddUser: (user: User) => void; onUpdateUser: (user: User) => void; onDeleteUser: (userId: string) => void; 
  onAddSession: (session: TrainingSession) => void; onUpdateSession: (session: TrainingSession) => void; onDeleteSession: (id: string) => void;
  onDuplicateSession?: (session: TrainingSession) => void;
  onAddToCalendar?: (session: TrainingSession) => void;
  onColorChange: (color: string) => void; onUpdateWorkoutTypes: (types: string[]) => void; 
  onUpdateLocations: (locations: LocationDef[]) => void; onUpdateWeatherLocation: (location: WeatherLocation) => void;
  onAddPaymentLink: (link: PaymentLink) => void; onDeletePaymentLink: (id: string) => void; onUpdateStreakGoal: (goal: number) => void;
  onUpdateAppConfig: (config: AppConfig) => void; onExitAdmin: () => void;
}

const SUPABASE_SQL = `-- Supabase SQL Setup Script
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  fullName TEXT NOT NULL,
  displayName TEXT,
  phone TEXT UNIQUE NOT NULL,
  email TEXT,
  startDate TEXT,
  paymentStatus TEXT,
  userColor TEXT,
  monthlyRecord INTEGER,
  healthDeclarationDate TEXT,
  healthDeclarationId TEXT,
  healthDeclarationFile TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  location TEXT NOT NULL,
  maxCapacity INTEGER NOT NULL,
  description TEXT,
  registeredPhoneNumbers JSONB DEFAULT '[]',
  attendedPhoneNumbers JSONB DEFAULT '[]',
  waitingList JSONB DEFAULT '[]',
  isCancelled BOOLEAN DEFAULT FALSE,
  isHidden BOOLEAN DEFAULT FALSE,
  isZoomSession BOOLEAN DEFAULT FALSE,
  zoomLink TEXT,
  manualHasStarted BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS config_locations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  color TEXT
);

CREATE TABLE IF NOT EXISTS config_workout_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS config_general (
  id TEXT PRIMARY KEY DEFAULT 'main',
  coachNameHeb TEXT,
  coachNameEng TEXT,
  coachPhone TEXT,
  coachAdditionalPhone TEXT,
  coachEmail TEXT,
  defaultCity TEXT,
  urgentMessage TEXT,
  coachBio TEXT,
  healthDeclarationTemplate TEXT,
  healthDeclarationDownloadUrl TEXT
);

CREATE TABLE IF NOT EXISTS config_quotes (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL
);`;

export const AdminPanel: React.FC<AdminPanelProps> = (props) => {
  const [activeTab, setActiveTab] = useState<'attendance' | 'users' | 'settings'>('attendance');
  const [settingsSection, setSettingsSection] = useState<'general' | 'locations' | 'types' | 'quotes' | 'connections'>('general');
  const [attendanceSession, setAttendanceSession] = useState<TrainingSession | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');

  // Added handleAddLocation to resolve missing name error
  const handleAddLocation = () => {
    const name = prompt('שם המיקום:');
    const address = prompt('כתובת המיקום:');
    if (name && address) {
      const newLoc: LocationDef = { 
        id: Date.now().toString(), 
        name, 
        address,
        color: '#A3E635'
      };
      props.onUpdateLocations([...props.locations, newLoc]);
    }
  };

  // Added handleAddWorkoutType to resolve missing name error
  const handleAddWorkoutType = () => {
    const name = prompt('שם סוג האימון החדש:');
    if (name) {
      if (props.workoutTypes.includes(name)) {
        alert('סוג אימון זה כבר קיים');
        return;
      }
      props.onUpdateWorkoutTypes([...props.workoutTypes, name]);
    }
  };

  const normalizePhone = (p: string) => p.replace(/\D/g, '').replace(/^972/, '0');
  
  const weekDates = useMemo(() => {
    const sun = new Date(); sun.setHours(12, 0, 0, 0); 
    sun.setDate(sun.getDate() - sun.getDay() + (weekOffset * 7));
    return Array.from({length:7}, (_, i) => { 
        const d = new Date(sun); d.setDate(sun.getDate() + i); 
        return d.toISOString().split('T')[0]; 
    });
  }, [weekOffset]);

  const filteredUsers = useMemo(() => {
      return props.users.filter(u => u.fullName.includes(searchTerm) || u.phone.includes(searchTerm)).sort((a,b) => a.fullName.localeCompare(b.fullName));
  }, [props.users, searchTerm]);

  return (
    <div className="bg-brand-black min-h-screen">
      <div className="sticky top-[140px] z-50 bg-brand-black/90 pt-4 border-b border-white/5 pb-2">
        <div className="flex gap-2 p-2 max-w-4xl mx-auto">
          {['attendance', 'users', 'settings'].map(t => (
            <button key={t} onClick={() => setActiveTab(t as any)} className={`flex-1 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === t ? 'bg-red-600 text-white shadow-xl shadow-red-600/20' : 'bg-gray-800/50 text-gray-500'}`}>
              {t === 'attendance' ? 'נוכחות' : t === 'users' ? 'מתאמנים' : 'הגדרות'}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 max-w-4xl mx-auto space-y-6 pb-24">
        {activeTab === 'attendance' && (
          <div className="space-y-6">
             <div className="flex justify-between items-center bg-gray-800/40 p-5 rounded-3xl border border-white/5 shadow-xl">
                <button onClick={()=>setWeekOffset(p=>p-1)} className="text-white text-2xl p-2 hover:text-red-500 transition-colors">←</button>
                <span className="text-red-500 font-black uppercase tracking-[0.3em] bg-red-500/10 px-4 py-1 rounded-full">{weekOffset === 0 ? 'השבוע' : `שבוע ${weekOffset}`}</span>
                <button onClick={()=>setWeekOffset(p=>p+1)} className="text-white text-2xl p-2 hover:text-red-500 transition-colors">→</button>
             </div>
             <Button onClick={() => setAttendanceSession({ id: Date.now().toString(), type: props.workoutTypes[0] || 'פונקציונלי', date: new Date().toISOString().split('T')[0], time: '18:00', location: props.locations[0]?.name || '', maxCapacity: 15, registeredPhoneNumbers: [], attendedPhoneNumbers: [], description: '' })} className="w-full py-7 rounded-[45px] bg-red-600 text-xl font-black italic shadow-2xl">+ יצירת אימון חדש</Button>
             <div className="space-y-12">
              {weekDates.map(date => {
                  const daySessions = props.sessions.filter(s => s.date === date).sort((a,b)=>a.time.localeCompare(b.time));
                  return (
                      <div key={date}>
                          <h4 className="text-gray-500 font-black text-[11px] mb-4 uppercase tracking-widest border-b border-white/5 pb-2">{new Date(date).toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'numeric' })}</h4>
                          <div className="grid grid-cols-2 gap-4">
                            {daySessions.map(s => <SessionCard key={s.id} session={s} allUsers={props.users} isRegistered={false} onRegisterClick={()=>{}} onViewDetails={(sid) => setAttendanceSession(props.sessions.find(x => x.id === sid) || null)} onDuplicate={props.onDuplicateSession} onAddToCalendar={props.onAddToCalendar} isAdmin={true} locations={props.locations} weather={props.weatherData?.[s.date]} />)}
                          </div>
                      </div>
                  );
              })}
             </div>
          </div>
        )}

        {activeTab === 'users' && (
            <div className="space-y-6">
                <input type="text" placeholder="חיפוש מתאמן..." className="w-full bg-gray-800 border border-white/10 p-6 rounded-[30px] text-white outline-none focus:border-red-500" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
                <div className="grid gap-4">
                    {filteredUsers.map(u => (
                       <div key={u.id} className="bg-gray-800/40 p-6 rounded-[40px] border border-white/5 flex justify-between items-center hover:border-red-500/30 transition-colors cursor-pointer" onClick={()=>setEditingUser(u)}>
                          <div className="flex items-center gap-4">
                             <div className="w-12 h-12 rounded-full bg-gray-900 flex items-center justify-center font-black text-red-500" style={{ color: u.userColor }}>{u.fullName.charAt(0)}</div>
                             <div>
                                <p className="text-white font-black italic">{u.fullName}</p>
                                <p className="text-[10px] text-gray-500 font-mono">{u.phone}</p>
                             </div>
                          </div>
                          <span className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${u.paymentStatus === PaymentStatus.PAID ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>{u.paymentStatus === PaymentStatus.PAID ? 'שולם' : 'חוב'}</span>
                       </div>
                    ))}
                </div>
            </div>
        )}

        {activeTab === 'settings' && (
            <div className="space-y-10">
                <div className="flex gap-2 p-1 bg-gray-900 rounded-2xl overflow-x-auto no-scrollbar">
                    {(['general', 'locations', 'types', 'quotes', 'connections'] as const).map(s => (
                        <button key={s} onClick={() => setSettingsSection(s)} className={`flex-1 py-2 px-4 text-[9px] font-black uppercase rounded-xl transition-all whitespace-nowrap ${settingsSection === s ? 'bg-gray-800 text-white' : 'text-gray-600'}`}>
                            {s === 'general' ? 'כללי' : s === 'locations' ? 'מיקומים' : s === 'types' ? 'אימונים' : s === 'quotes' ? 'מוטיבציה' : 'חיבורים'}
                        </button>
                    ))}
                </div>

                {settingsSection === 'general' && (
                    <div className="bg-gray-800/40 p-8 rounded-[50px] border border-white/5 space-y-8 shadow-2xl">
                        <h3 className="text-white font-black uppercase italic tracking-widest border-b border-white/10 pb-4">הגדרות אתר ⚙️</h3>
                        <div className="space-y-3">
                            <label className="text-[10px] text-red-500 font-black uppercase block">הודעה דחופה באתר</label>
                            <input className="w-full bg-red-900/10 border border-red-500/30 p-6 rounded-[30px] text-white font-black italic shadow-inner outline-none focus:border-red-500" value={props.appConfig.urgentMessage || ''} onChange={e=>props.onUpdateAppConfig({...props.appConfig, urgentMessage: e.target.value})} placeholder="כתוב כאן הודעה שתופיע למעלה באדום..." />
                        </div>
                        <div className="space-y-3">
                            <label className="text-[10px] text-brand-primary font-black uppercase block">טקסט אודות (דף נחיתה)</label>
                            <textarea className="w-full bg-gray-800 border border-white/10 p-6 rounded-[30px] text-white font-bold h-48 italic" value={props.appConfig.coachBio || ''} onChange={e=>props.onUpdateAppConfig({...props.appConfig, coachBio: e.target.value})} placeholder="ספר על עצמך כאן..." />
                        </div>
                        <div className="space-y-3">
                            <label className="text-[10px] text-blue-400 font-black uppercase block">נוסח הצהרת בריאות</label>
                            <textarea className="w-full bg-gray-800 border border-white/10 p-6 rounded-[30px] text-white font-bold h-48 italic" value={props.appConfig.healthDeclarationTemplate || ''} onChange={e=>props.onUpdateAppConfig({...props.appConfig, healthDeclarationTemplate: e.target.value})} placeholder="נוסח הצהרה..." />
                        </div>
                        <div className="space-y-3">
                            <label className="text-[10px] text-gray-500 font-black uppercase block">לינק לטופס להורדה (PDF/Doc)</label>
                            <input className="w-full bg-gray-800 border border-white/10 p-4 rounded-2xl text-white font-bold" value={props.appConfig.healthDeclarationDownloadUrl || ''} onChange={e=>props.onUpdateAppConfig({...props.appConfig, healthDeclarationDownloadUrl: e.target.value})} placeholder="https://..." />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="text-[10px] text-gray-500 font-black mb-1 block uppercase">שם מאמן</label><input className="w-full bg-gray-800 border border-white/10 p-4 rounded-2xl text-white font-bold" value={props.appConfig.coachNameHeb} onChange={e=>props.onUpdateAppConfig({...props.appConfig, coachNameHeb: e.target.value})} /></div>
                            <div><label className="text-[10px] text-gray-500 font-black mb-1 block uppercase">טלפון</label><input className="w-full bg-gray-800 border border-white/10 p-4 rounded-2xl text-white font-bold" value={props.appConfig.coachPhone} onChange={e=>props.onUpdateAppConfig({...props.appConfig, coachPhone: e.target.value})} /></div>
                        </div>
                    </div>
                )}

                {settingsSection === 'locations' && (
                    <div className="space-y-4">
                        <Button onClick={handleAddLocation} className="w-full py-4 rounded-2xl bg-gray-800 text-white">+ הוסף מיקום חדש</Button>
                        <div className="grid gap-2">
                            {props.locations.map(loc => (
                                <div key={loc.id} className="bg-gray-800/40 p-5 rounded-3xl flex justify-between items-center border border-white/5">
                                    <div><p className="text-white font-bold">{loc.name}</p><p className="text-[10px] text-gray-500">{loc.address}</p></div>
                                    <button onClick={async () => { if(confirm('למחוק?')) { await dataService.deleteLocation(loc.id); props.onUpdateLocations(props.locations.filter(l => l.id !== loc.id)); }}} className="text-red-500 text-sm">🗑️</button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {settingsSection === 'types' && (
                    <div className="space-y-4">
                        <Button onClick={handleAddWorkoutType} className="w-full py-4 rounded-2xl bg-gray-800 text-white">+ הוסף סוג אימון חדש</Button>
                        <div className="grid grid-cols-2 gap-2">
                            {props.workoutTypes.map(t => (
                                <div key={t} className="bg-gray-800/40 p-4 rounded-2xl flex justify-between items-center border border-white/5">
                                    <span className="text-white text-sm font-bold">{t}</span>
                                    <button onClick={async () => { if(confirm('למחוק?')) { await dataService.deleteWorkoutType(t); props.onUpdateWorkoutTypes(props.workoutTypes.filter(x => x !== t)); }}} className="text-red-500 text-sm">🗑️</button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {settingsSection === 'connections' && (
                    <div className="bg-gray-800/40 p-8 rounded-[40px] border border-white/5 space-y-6 overflow-hidden shadow-2xl">
                        <h3 className="text-white font-black uppercase italic tracking-widest border-b border-white/10 pb-4">חיבורים וסנכרון 🔌</h3>
                        <div className="space-y-4">
                            <label className="text-[10px] text-blue-400 font-black uppercase block">Supabase SQL Setup</label>
                            <p className="text-[10px] text-gray-500">העתק והדבק ב-SQL Editor של Supabase כדי להכין את מסד הנתונים:</p>
                            <pre className="bg-gray-900 p-6 rounded-[30px] text-[10px] text-gray-400 font-mono overflow-auto max-h-96 border border-white/5 no-scrollbar whitespace-pre-wrap">{SUPABASE_SQL}</pre>
                            <Button onClick={() => { navigator.clipboard.writeText(SUPABASE_SQL); alert('SQL העותק ללוח!'); }} size="sm">העתק SQL 📋</Button>
                        </div>
                    </div>
                )}

                <Button onClick={props.onExitAdmin} variant="outline" className="w-full py-6 rounded-[40px] font-black italic uppercase">חזרה ללו"ז מתאמנים</Button>
            </div>
        )}
      </div>

      {attendanceSession && (
          <div className="fixed inset-0 bg-black/95 z-[200] flex items-center justify-center p-6 backdrop-blur-xl overflow-y-auto no-scrollbar">
              <div className="bg-gray-900 p-8 sm:p-12 rounded-[60px] w-full max-w-3xl border border-white/10 text-right shadow-3xl my-auto" dir="rtl">
                  <div className="flex justify-between mb-8 border-b border-white/5 pb-5">
                      <h3 className="text-3xl font-black text-white italic uppercase">ניהול אימון ⚙️</h3>
                      <button onClick={()=>setAttendanceSession(null)} className="text-gray-500 text-4xl">✕</button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                      <div className="space-y-5">
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="text-[10px] text-gray-500 font-black mb-1 block">סוג</label>
                                <select className="w-full bg-gray-800 border border-white/10 p-5 rounded-3xl text-white font-bold" value={attendanceSession.type} onChange={e=>setAttendanceSession({...attendanceSession, type: e.target.value})}>
                                    {props.workoutTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div><label className="text-[10px] text-gray-500 font-black mb-1 block">מיקום</label>
                                <select className="w-full bg-gray-800 border border-white/10 p-5 rounded-3xl text-white font-bold" value={attendanceSession.location} onChange={e=>setAttendanceSession({...attendanceSession, location: e.target.value})}>
                                    {props.locations.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="text-[10px] text-gray-500 font-black mb-1 block">תאריך</label><input type="date" className="w-full bg-gray-800 p-5 rounded-3xl text-white font-bold" value={attendanceSession.date} onChange={e=>setAttendanceSession({...attendanceSession, date: e.target.value})} /></div>
                            <div><label className="text-[10px] text-gray-500 font-black mb-1 block">שעה</label><input type="time" className="w-full bg-gray-800 p-5 rounded-3xl text-white font-bold" value={attendanceSession.time} onChange={e=>setAttendanceSession({...attendanceSession, time: e.target.value})} /></div>
                        </div>
                        <textarea className="w-full bg-gray-800 p-5 rounded-3xl text-white font-bold h-24" value={attendanceSession.description || ''} onChange={e=>setAttendanceSession({...attendanceSession, description: e.target.value})} placeholder="דגשים למתאמנים..."></textarea>
                        <div className="flex items-center gap-3 bg-brand-primary/10 p-4 rounded-2xl border border-brand-primary/20">
                            <input type="checkbox" id="isHappening" className="w-6 h-6 accent-brand-primary" checked={attendanceSession.manualHasStarted} onChange={e=>setAttendanceSession({...attendanceSession, manualHasStarted: e.target.checked})} />
                            <label htmlFor="isHappening" className="text-brand-primary text-sm font-black uppercase">אימון מתקיים ✓</label>
                        </div>
                      </div>
                      <div className="bg-gray-800/40 p-6 rounded-[35px] max-h-[500px] overflow-y-auto no-scrollbar border border-white/5 space-y-3">
                        <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest border-b border-white/5 pb-2">נוכחות ({attendanceSession.registeredPhoneNumbers.length})</p>
                        <div className="space-y-2">
                            {attendanceSession.registeredPhoneNumbers.map(phone => {
                                const u = props.users.find(user => normalizePhone(user.phone) === normalizePhone(phone));
                                const isAttended = (attendanceSession.attendedPhoneNumbers || []).includes(phone);
                                return (
                                    <div key={phone} className="flex justify-between items-center p-3 bg-gray-900/50 rounded-2xl border border-white/5">
                                        <span className="text-white text-sm font-bold">{u ? (u.displayName || u.fullName) : phone}</span>
                                        <button onClick={() => { const curr = attendanceSession.attendedPhoneNumbers || []; const up = isAttended ? curr.filter(p => p !== phone) : [...curr, phone]; setAttendanceSession({...attendanceSession, attendedPhoneNumbers: up}); }} className={`px-4 py-2 rounded-xl text-[10px] font-black ${isAttended ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-500'}`}>{isAttended ? 'נכח ✓' : 'לא נכח'}</button>
                                    </div>
                                );
                            })}
                        </div>
                      </div>
                  </div>
                  <div className="mt-8 flex gap-4">
                      <Button onClick={()=>{ if (attendanceSession.id.length > 15) props.onAddSession(attendanceSession); else props.onUpdateSession(attendanceSession); setAttendanceSession(null); }} className="flex-1 bg-red-600 py-7 rounded-[45px] text-xl font-black italic shadow-2xl">שמור שינויים ✓</Button>
                      <Button onClick={()=>{if(confirm('למחוק אימון?')){props.onDeleteSession(attendanceSession.id); setAttendanceSession(null);}}} variant="danger" className="px-10 rounded-[45px]">🗑️</Button>
                  </div>
              </div>
          </div>
      )}

      {editingUser && (
        <div className="fixed inset-0 bg-black/95 z-[210] flex items-center justify-center p-6 backdrop-blur-xl">
           <div className="bg-gray-900 p-12 rounded-[60px] w-full max-w-2xl border border-white/10 text-right shadow-3xl overflow-y-auto no-scrollbar max-h-[90vh]" dir="rtl">
              <div className="flex justify-between mb-8 border-b border-white/5 pb-5"><h3 className="text-3xl font-black text-white italic uppercase">ניהול מתאמן 👤</h3><button onClick={()=>setEditingUser(null)} className="text-gray-500 text-4xl">✕</button></div>
              <div className="space-y-8">
                  <div className="grid grid-cols-2 gap-6">
                      <div><label className="text-[10px] text-gray-500 font-black mb-1 block uppercase">שם מלא</label><input className="w-full bg-gray-800 p-5 rounded-3xl text-white font-bold" value={editingUser.fullName} onChange={e=>setEditingUser({...editingUser, fullName: e.target.value})} /></div>
                      <div><label className="text-[10px] text-gray-500 font-black mb-1 block uppercase">כינוי</label><input className="w-full bg-gray-800 p-5 rounded-3xl text-white font-bold" value={editingUser.displayName || ''} onChange={e=>setEditingUser({...editingUser, displayName: e.target.value})} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                      <div><label className="text-[10px] text-gray-500 font-black mb-1 block uppercase">צבע אישי</label><input type="color" className="w-full h-16 bg-gray-800 rounded-3xl p-2 cursor-pointer" value={editingUser.userColor || '#ffffff'} onChange={e=>setEditingUser({...editingUser, userColor: e.target.value})} /></div>
                      <div><label className="text-[10px] text-gray-500 font-black mb-1 block uppercase">סטטוס תשלום</label>
                        <select className="w-full bg-gray-800 p-5 rounded-3xl text-white font-black" value={editingUser.paymentStatus} onChange={e=>setEditingUser({...editingUser, paymentStatus: e.target.value as any})}>
                            <option value={PaymentStatus.PAID}>שולם ✓</option><option value={PaymentStatus.PENDING}>ממתין ⏳</option><option value={PaymentStatus.OVERDUE}>חוב ⚠</option>
                        </select>
                      </div>
                  </div>
                  {editingUser.healthDeclarationDate && <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl"><p className="text-blue-400 text-sm font-bold">הצהרה חתומה ב: {editingUser.healthDeclarationDate}</p><p className="text-gray-500 text-xs">ת.ז.: {editingUser.healthDeclarationId}</p></div>}
              </div>
              <div className="mt-12 flex gap-4"><Button onClick={()=>{props.onUpdateUser(editingUser); setEditingUser(null);}} className="flex-1 bg-red-600 py-7 rounded-[45px] text-xl font-black italic shadow-2xl">שמור מתאמן ✓</Button></div>
           </div>
        </div>
      )}
    </div>
  );
};
