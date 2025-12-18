
import React, { useState, useMemo } from 'react';
import { User, TrainingSession, WeatherLocation, PaymentLink, LocationDef, AppConfig, Quote, WeatherInfo, PaymentStatus } from '../types';
import { Button } from './Button';
import { SessionCard } from './SessionCard';
import { dataService } from '../services/dataService';

const SUPABASE_SQL = `
-- Initial database setup script for Niv Cohen Fitness
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  "fullName" TEXT NOT NULL,
  "displayName" TEXT,
  phone TEXT NOT NULL,
  email TEXT,
  "startDate" TEXT,
  "paymentStatus" TEXT,
  "isNew" BOOLEAN DEFAULT false,
  "userColor" TEXT,
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
  "maxCapacity" INTEGER DEFAULT 15,
  description TEXT,
  "registeredPhoneNumbers" JSONB DEFAULT '[]'::jsonb,
  "waitingList" JSONB DEFAULT '[]'::jsonb,
  "attendedPhoneNumbers" JSONB DEFAULT '[]'::jsonb,
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
  "urgentMessage" TEXT,
  "coachBio" TEXT,
  "healthDeclarationTemplate" TEXT,
  "healthDeclarationDownloadUrl" TEXT
);

CREATE TABLE IF NOT EXISTS config_quotes (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL
);

INSERT INTO config_general (id, "coachNameHeb") 
VALUES ('main', 'ניב כהן')
ON CONFLICT (id) DO NOTHING;
`;

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
  getStatsForUser: (user: User) => { monthly: number; record: number; streak: number };
}

type SortMode = 'name' | 'monthly' | 'record' | 'streak' | 'health' | 'payment';

export const AdminPanel: React.FC<AdminPanelProps> = (props) => {
  const [activeTab, setActiveTab] = useState<'attendance' | 'users' | 'settings'>('attendance');
  const [settingsSection, setSettingsSection] = useState<'general' | 'infrastructure' | 'quotes' | 'connections'>('general');
  const [attendanceSession, setAttendanceSession] = useState<TrainingSession | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortMode>('name');
  const [pushMessage, setPushMessage] = useState('');
  const [sentTracking, setSentTracking] = useState<Record<string, string[]>>({});
  const [saveIndicator, setSaveIndicator] = useState<string | null>(null);

  const normalizePhone = (p: string) => {
    let cleaned = p.replace(/\D/g, '');
    if (cleaned.startsWith('0')) cleaned = '972' + cleaned.substring(1);
    else if (!cleaned.startsWith('972')) cleaned = '972' + cleaned;
    return cleaned;
  };

  const weekDates = useMemo(() => {
    const sun = new Date(); sun.setHours(12, 0, 0, 0); 
    sun.setDate(sun.getDate() - sun.getDay() + (weekOffset * 7));
    return Array.from({length:7}, (_, i) => { 
        const d = new Date(sun); d.setDate(sun.getDate() + i); 
        return d.toISOString().split('T')[0]; 
    });
  }, [weekOffset]);

  const filteredUsers = useMemo(() => {
      let filtered = props.users.filter(u => u.fullName.includes(searchTerm) || u.phone.includes(searchTerm));
      const usersWithStats = filtered.map(u => ({ ...u, stats: props.getStatsForUser(u) }));
      return usersWithStats.sort((a, b) => {
          switch(sortBy) {
              case 'monthly': return b.stats.monthly - a.stats.monthly;
              case 'record': return b.stats.record - a.stats.record;
              case 'streak': return b.stats.streak - a.stats.streak;
              case 'health': return (a.healthDeclarationDate ? 1 : 0) - (b.healthDeclarationDate ? 1 : 0);
              case 'payment': return a.paymentStatus.localeCompare(b.paymentStatus);
              default: return a.fullName.localeCompare(b.fullName);
          }
      });
  }, [props.users, props.getStatsForUser, searchTerm, sortBy]);

  const handleAddLocation = () => {
    const name = prompt('שם המיקום:');
    const address = prompt('כתובת המיקום:');
    if (name && address) {
      props.onUpdateLocations([...props.locations, { id: Date.now().toString(), name, address, color: '#A3E635' }]);
    }
  };

  const handleAddWorkoutType = () => {
    const name = prompt('שם סוג האימון החדש:');
    if (name) {
      if (props.workoutTypes.includes(name)) return alert('סוג אימון זה כבר קיים');
      props.onUpdateWorkoutTypes([...props.workoutTypes, name]);
    }
  };

  const handleAddQuote = () => {
    const text = prompt('הכנס משפט מוטיבציה חדש:');
    if (text) {
      const newQuote: Quote = { id: Date.now().toString(), text };
      dataService.addQuote(newQuote).then(() => {
        window.location.reload(); // Simple refresh for now
      });
    }
  };

  const handleDeleteQuote = (id: string) => {
    if (confirm('בטוח שברצונך למחוק משפט זה?')) {
      dataService.deleteQuote(id).then(() => {
        window.location.reload();
      });
    }
  };

  const handleSaveAllSettings = async () => {
    setSaveIndicator('שומר...');
    try {
      await dataService.saveAppConfig(props.appConfig);
      await dataService.saveLocations(props.locations);
      await dataService.saveWorkoutTypes(props.workoutTypes);
      setSaveIndicator('נשמר בהצלחה ✓');
      setTimeout(() => setSaveIndicator(null), 3000);
    } catch (e) {
      setSaveIndicator('שגיאה בשמירה');
    }
  };

  const sendWhatsAppPush = (user: User, session: TrainingSession) => {
    if (!session) return;
    const dateObj = new Date(session.date);
    const dayName = dateObj.toLocaleDateString('he-IL', { weekday: 'long' });
    const dateFormatted = dateObj.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });
    const message = `היי ${user.fullName.split(' ')[0]}, תזכורת לאימון ${session.type} ביום ${dayName} (${dateFormatted}) בשעה ${session.time}.\n${pushMessage}`;
    const phone = normalizePhone(user.phone);
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
    setSentTracking(prev => ({ ...prev, [session.id]: [...(prev[session.id] || []), user.phone] }));
  };

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
                <div className="flex flex-col sm:flex-row gap-4">
                    <input type="text" placeholder="חיפוש מתאמן..." className="flex-1 bg-gray-800 border border-white/10 p-6 rounded-[30px] text-white outline-none focus:border-red-500 shadow-xl" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
                    <select className="bg-gray-800 border border-white/10 p-4 rounded-[30px] text-white text-sm font-black outline-none" value={sortBy} onChange={e=>setSortBy(e.target.value as SortMode)}>
                        <option value="name">מיון: שם</option>
                        <option value="monthly">מיון: אימונים החודש</option>
                        <option value="record">מיון: שיא אישי</option>
                        <option value="streak">מיון: רצף</option>
                        <option value="health">מיון: הצהרת בריאות</option>
                        <option value="payment">מיון: תשלום</option>
                    </select>
                </div>
                <div className="grid gap-4">
                    {filteredUsers.map(u => (
                       <div key={u.id} className={`bg-gray-800/40 p-6 rounded-[50px] border border-white/5 flex flex-col sm:flex-row justify-between items-center hover:border-red-500/30 transition-all cursor-pointer shadow-2xl ${u.isRestricted ? 'opacity-40 grayscale' : ''}`} onClick={()=>setEditingUser(u)}>
                          <div className="flex items-center gap-6 mb-4 sm:mb-0 w-full sm:w-auto">
                             <div className="w-16 h-16 rounded-full bg-gray-900 border-2 border-white/10 flex items-center justify-center font-black text-2xl text-red-500" style={{ color: u.userColor, borderColor: u.userColor ? `${u.userColor}40` : 'transparent' }}>{u.fullName.charAt(0)}</div>
                             <div>
                                <h3 className="text-white font-black text-xl italic" style={{ color: u.userColor }}>{u.fullName}</h3>
                                <p className="text-xs text-gray-500 font-mono tracking-widest">{u.phone}</p>
                                <div className="flex gap-2 mt-2">
                                   <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase ${u.paymentStatus === PaymentStatus.PAID ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>{u.paymentStatus === PaymentStatus.PAID ? 'שולם ✓' : 'חוב !'}</span>
                                   {u.healthDeclarationDate && <span className="bg-blue-500/10 text-blue-400 px-3 py-1 rounded-lg text-[10px] font-black uppercase">הצהרה ✓</span>}
                                   {u.isRestricted && <span className="bg-gray-700 text-white px-3 py-1 rounded-lg text-[10px] font-black uppercase">חסום ⛔</span>}
                                </div>
                             </div>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-8 text-center w-full sm:w-auto sm:mr-10 border-t sm:border-t-0 sm:border-r border-white/5 pt-4 sm:pt-0 sm:pr-10">
                             <div><p className="text-[10px] text-gray-500 font-black uppercase mb-1">החודש</p><p className="text-3xl font-black text-brand-primary leading-none">{(u as any).stats.monthly}</p></div>
                             <div><p className="text-[10px] text-gray-500 font-black uppercase mb-1">שיא</p><p className="text-3xl font-black text-white leading-none">{(u as any).stats.record}</p></div>
                             <div><p className="text-[10px] text-gray-500 font-black uppercase mb-1">רצף</p><p className="text-3xl font-black text-orange-400 leading-none">{(u as any).stats.streak}</p></div>
                          </div>
                       </div>
                    ))}
                </div>
            </div>
        )}

        {activeTab === 'settings' && (
            <div className="space-y-10">
                <div className="flex gap-2 p-1 bg-gray-900 rounded-2xl overflow-x-auto no-scrollbar">
                    {(['general', 'infrastructure', 'quotes', 'connections'] as const).map(s => (
                        <button key={s} onClick={() => setSettingsSection(s)} className={`flex-1 py-2 px-4 text-[9px] font-black uppercase rounded-xl transition-all whitespace-nowrap ${settingsSection === s ? 'bg-gray-800 text-white' : 'text-gray-600'}`}>
                            {s === 'general' ? 'מידע כללי' : s === 'infrastructure' ? 'מיקומים ואימונים' : s === 'quotes' ? 'מוטיבציה' : 'חיבורים'}
                        </button>
                    ))}
                </div>

                {settingsSection === 'general' && (
                    <div className="bg-gray-800/40 p-8 rounded-[50px] border border-white/5 space-y-8 shadow-2xl">
                        <h3 className="text-white font-black uppercase italic tracking-widest border-b border-white/10 pb-4">מידע כללי 👤</h3>
                        <div className="space-y-3">
                            <label className="text-[10px] text-red-500 font-black uppercase block">הודעה דחופה באתר</label>
                            <input className="w-full bg-red-900/10 border border-red-500/30 p-6 rounded-[30px] text-white font-black italic shadow-inner outline-none focus:border-red-500" value={props.appConfig.urgentMessage || ''} onChange={e=>props.onUpdateAppConfig({...props.appConfig, urgentMessage: e.target.value})} placeholder="כתוב כאן הודעה שתופיע למעלה באדום..." />
                        </div>
                        <div className="space-y-3">
                            <label className="text-[10px] text-brand-primary font-black uppercase block">טקסט אודות (דף נחיתה)</label>
                            <textarea className="w-full bg-gray-800 border border-white/10 p-6 rounded-[30px] text-white font-bold h-48 italic leading-relaxed" value={props.appConfig.coachBio || ''} onChange={e=>props.onUpdateAppConfig({...props.appConfig, coachBio: e.target.value})} placeholder="ספר על עצמך כאן..." />
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

                {settingsSection === 'infrastructure' && (
                    <div className="space-y-8">
                        <div className="bg-gray-800/40 p-8 rounded-[50px] border border-white/5 space-y-4">
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="text-white font-black uppercase italic tracking-widest">מיקומים 📍</h4>
                                <Button onClick={handleAddLocation} size="sm" variant="secondary">הוסף מיקום</Button>
                            </div>
                            <div className="grid gap-2">
                                {props.locations.map(loc => (
                                    <div key={loc.id} className="bg-gray-900/50 p-4 rounded-2xl border border-white/5 flex flex-col gap-2">
                                        <input className="bg-transparent text-white font-bold outline-none focus:text-brand-primary" value={loc.name} onChange={e => props.onUpdateLocations(props.locations.map(l => l.id === loc.id ? {...l, name: e.target.value} : l))} />
                                        <input className="bg-transparent text-[10px] text-gray-500 outline-none focus:text-white" value={loc.address} onChange={e => props.onUpdateLocations(props.locations.map(l => l.id === loc.id ? {...l, address: e.target.value} : l))} />
                                        <button onClick={() => props.onUpdateLocations(props.locations.filter(l => l.id !== loc.id))} className="text-red-500 text-[10px] font-black uppercase text-left">מחיקה</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="bg-gray-800/40 p-8 rounded-[50px] border border-white/5 space-y-4">
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="text-white font-black uppercase italic tracking-widest">סוגי אימון 🏋️</h4>
                                <Button onClick={handleAddWorkoutType} size="sm" variant="secondary">הוסף אימון</Button>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                {props.workoutTypes.map((t, idx) => (
                                    <div key={idx} className="bg-gray-900/50 p-3 rounded-2xl border border-white/5 flex justify-between items-center">
                                        <input className="bg-transparent text-white text-sm font-bold outline-none flex-1" value={t} onChange={e => {
                                          const newList = [...props.workoutTypes];
                                          newList[idx] = e.target.value;
                                          props.onUpdateWorkoutTypes(newList);
                                        }} />
                                        <button onClick={() => props.onUpdateWorkoutTypes(props.workoutTypes.filter(x => x !== t))} className="text-red-500 text-xs mr-2">✕</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {settingsSection === 'quotes' && (
                    <div className="bg-gray-800/40 p-8 rounded-[50px] border border-white/5 space-y-6">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="text-white font-black uppercase italic tracking-widest">משפטי מוטיבציה 🧠</h4>
                            <Button onClick={handleAddQuote} size="sm" variant="secondary">הוסף משפט</Button>
                        </div>
                        <div className="space-y-3">
                            {props.quotes.map(q => (
                                <div key={q.id} className="bg-gray-900/50 p-4 rounded-2xl border border-white/5 flex justify-between items-center group">
                                    <p className="text-white italic text-sm">"{q.text}"</p>
                                    <button onClick={() => handleDeleteQuote(q.id)} className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">🗑️</button>
                                </div>
                            ))}
                            {props.quotes.length === 0 && <p className="text-gray-600 text-center italic py-4">אין משפטים מוגדרים</p>}
                        </div>
                    </div>
                )}

                {settingsSection === 'connections' && (
                    <div className="bg-gray-800/40 p-8 rounded-[40px] border border-white/5 space-y-6 overflow-hidden shadow-2xl">
                        <h3 className="text-white font-black uppercase italic tracking-widest border-b border-white/10 pb-4">חיבורים וסנכרון 🔌</h3>
                        <div className="space-y-4">
                            <label className="text-[10px] text-blue-400 font-black uppercase block">Supabase SQL Setup</label>
                            <pre className="bg-gray-900 p-6 rounded-[30px] text-[10px] text-gray-400 font-mono overflow-auto max-h-96 border border-white/5 no-scrollbar whitespace-pre-wrap">{SUPABASE_SQL}</pre>
                            <Button onClick={() => { navigator.clipboard.writeText(SUPABASE_SQL); alert('SQL העותק ללוח!'); }} size="sm">העתק SQL 📋</Button>
                        </div>
                    </div>
                )}

                <div className="sticky bottom-4 z-[60] bg-brand-black/80 backdrop-blur-xl p-4 rounded-[40px] border border-white/10 shadow-3xl flex flex-col items-center gap-2">
                    {saveIndicator && <p className="text-xs font-black uppercase tracking-widest text-brand-primary animate-pulse">{saveIndicator}</p>}
                    <Button onClick={handleSaveAllSettings} className="w-full py-6 rounded-[40px] text-xl font-black italic shadow-2xl shadow-red-600/20 bg-red-600">שמירת כל השינויים ✅</Button>
                    <Button onClick={props.onExitAdmin} variant="outline" className="w-full py-4 rounded-[40px] font-black italic text-sm uppercase opacity-60">חזרה ללו"ז מתאמנים</Button>
                </div>
            </div>
        )}
      </div>

      {attendanceSession && (
          <div className="fixed inset-0 bg-black/95 z-[200] flex items-center justify-center p-6 backdrop-blur-xl overflow-y-auto no-scrollbar">
              <div className="bg-gray-900 p-8 sm:p-12 rounded-[60px] w-full max-w-4xl border border-white/10 text-right shadow-3xl my-auto" dir="rtl">
                  <div className="flex justify-between mb-8 border-b border-white/5 pb-5">
                      <h3 className="text-3xl font-black text-white italic uppercase">ניהול אימון ⚙️</h3>
                      <button onClick={()=>setAttendanceSession(null)} className="text-gray-500 text-4xl">✕</button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                      <div className="space-y-5">
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="text-[10px] text-gray-500 font-black mb-1 block uppercase">סוג</label>
                                <select className="w-full bg-gray-800 border border-white/10 p-5 rounded-3xl text-white font-bold" value={attendanceSession.type} onChange={e=>setAttendanceSession({...attendanceSession, type: e.target.value})}>
                                    {props.workoutTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div><label className="text-[10px] text-gray-500 font-black mb-1 block uppercase">מיקום</label>
                                <select className="w-full bg-gray-800 border border-white/10 p-5 rounded-3xl text-white font-bold" value={attendanceSession.location} onChange={e=>setAttendanceSession({...attendanceSession, location: e.target.value})}>
                                    {props.locations.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="text-[10px] text-gray-500 font-black mb-1 block uppercase">תאריך</label><input type="date" className="w-full bg-gray-800 p-5 rounded-3xl text-white font-bold" value={attendanceSession.date} onChange={e=>setAttendanceSession({...attendanceSession, date: e.target.value})} /></div>
                            <div><label className="text-[10px] text-gray-500 font-black mb-1 block uppercase">שעה</label><input type="time" className="w-full bg-gray-800 p-5 rounded-3xl text-white font-bold" value={attendanceSession.time} onChange={e=>setAttendanceSession({...attendanceSession, time: e.target.value})} /></div>
                        </div>
                        <textarea className="w-full bg-gray-800 p-5 rounded-3xl text-white font-bold h-24" value={attendanceSession.description || ''} onChange={e=>setAttendanceSession({...attendanceSession, description: e.target.value})} placeholder="דגשים למתאמנים..."></textarea>
                        
                        <div className="bg-gray-800/40 p-6 rounded-[35px] border border-white/5 space-y-4">
                            <label className="text-[10px] text-green-500 font-black uppercase block italic">שליחת הודעת פוש (WhatsApp) 💬</label>
                            <textarea 
                              className="w-full bg-gray-900 border border-white/10 p-4 rounded-2xl text-white text-xs italic" 
                              rows={3}
                              placeholder="כתוב הודעה נוספת כאן... (הפרטים יתווספו אוטומטית)"
                              value={pushMessage}
                              onChange={e => setPushMessage(e.target.value)}
                            />
                        </div>

                        <div className="flex items-center gap-3 bg-brand-primary/10 p-4 rounded-2xl border border-brand-primary/20">
                            <input type="checkbox" id="isHappening" className="w-6 h-6 accent-brand-primary" checked={attendanceSession.manualHasStarted} onChange={e=>setAttendanceSession({...attendanceSession, manualHasStarted: e.target.checked})} />
                            <label htmlFor="isHappening" className="text-brand-primary text-sm font-black uppercase">אימון מתקיים ✓</label>
                        </div>
                      </div>

                      <div className="bg-gray-800/40 p-6 rounded-[35px] max-h-[600px] overflow-y-auto no-scrollbar border border-white/5 space-y-3">
                        <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest border-b border-white/5 pb-2">נוכחות ושליחת פוש ({attendanceSession.registeredPhoneNumbers.length})</p>
                        <div className="space-y-2">
                            {attendanceSession.registeredPhoneNumbers.map(phone => {
                                const u = props.users.find(user => normalizePhone(user.phone) === normalizePhone(phone));
                                const isAttended = (attendanceSession.attendedPhoneNumbers || []).includes(phone);
                                const isSent = (sentTracking[attendanceSession.id] || []).includes(phone);
                                return (
                                    <div key={phone} className={`flex flex-col gap-2 p-4 bg-gray-900/50 rounded-2xl border ${isSent ? 'border-green-500/20' : 'border-white/5'}`}>
                                        <div className="flex justify-between items-center">
                                            <span className="text-white text-sm font-bold">{u ? (u.displayName || u.fullName) : phone}</span>
                                            <div className="flex gap-2">
                                                <button onClick={() => u && sendWhatsAppPush(u, attendanceSession)} className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors ${isSent ? 'bg-green-500 text-white shadow-[0_0_10px_rgba(34,197,94,0.4)]' : 'bg-gray-800 text-gray-500 hover:text-green-500'}`}><svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg></button>
                                                <button onClick={() => { const curr = attendanceSession.attendedPhoneNumbers || []; const up = isAttended ? curr.filter(p => p !== phone) : [...curr, phone]; setAttendanceSession({...attendanceSession, attendedPhoneNumbers: up}); }} className={`px-4 py-2 rounded-xl text-[10px] font-black ${isAttended ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-500'}`}>{isAttended ? 'נכח ✓' : 'לא נכח'}</button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                      </div>
                  </div>
                  <div className="mt-8 flex gap-4">
                      <Button onClick={()=>{ if (attendanceSession.id.length > 15) props.onAddSession(attendanceSession); else props.onUpdateSession(attendanceSession); setAttendanceSession(null); }} className="flex-1 bg-red-600 py-7 rounded-[45px] text-xl font-black italic uppercase shadow-2xl">שמור שינויים ✓</Button>
                      <Button onClick={()=>{if(confirm('למחוק אימון?')){props.onDeleteSession(attendanceSession.id); setAttendanceSession(null);}}} variant="danger" className="px-10 rounded-[45px]">🗑️</Button>
                  </div>
              </div>
          </div>
      )}

      {editingUser && (
        <div className="fixed inset-0 bg-black/95 z-[210] flex items-center justify-center p-6 backdrop-blur-xl overflow-y-auto no-scrollbar">
           <div className="bg-gray-900 p-8 sm:p-12 rounded-[60px] w-full max-w-2xl border border-white/10 text-right shadow-3xl my-auto" dir="rtl">
              <div className="flex justify-between mb-8 border-b border-white/5 pb-5">
                <div>
                    <h3 className="text-3xl font-black text-white italic uppercase" style={{ color: editingUser.userColor }}>{editingUser.fullName}</h3>
                    <p className="text-brand-primary font-black text-xl italic font-mono tracking-widest">{editingUser.phone}</p>
                </div>
                <button onClick={()=>setEditingUser(null)} className="text-gray-500 text-4xl">✕</button>
              </div>
              
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

                  <div className="grid grid-cols-3 gap-4">
                      {Object.entries(props.getStatsForUser(editingUser)).map(([k, v]) => (
                          <div key={k} className="bg-gray-800/50 p-4 rounded-3xl text-center border border-white/5">
                              <p className="text-[9px] text-gray-500 uppercase font-black">{k === 'monthly' ? 'החודש' : k === 'record' ? 'שיא' : 'רצף'}</p>
                              <p className="text-2xl font-black text-white">{v}</p>
                          </div>
                      ))}
                  </div>
                  
                  <div className="bg-gray-800/50 p-6 rounded-[35px] border border-white/5">
                      <h4 className="text-blue-400 font-black uppercase italic mb-4">הצהרת בריאות 📋</h4>
                      {editingUser.healthDeclarationDate ? (
                          <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-2xl mb-4">
                             <p className="text-white font-bold text-sm">נחתמה ב: {editingUser.healthDeclarationDate}</p>
                             <p className="text-gray-400 text-xs">ת.ז.: {editingUser.healthDeclarationId}</p>
                          </div>
                      ) : (
                          <p className="text-gray-600 text-xs italic mb-4">טרם נחתמה הצהרה</p>
                      )}
                      {editingUser.healthDeclarationFile && (
                          <a href={editingUser.healthDeclarationFile} download={`health-${editingUser.fullName}`} className="block w-full text-center py-4 bg-brand-primary/10 text-brand-primary font-black uppercase rounded-2xl border border-brand-primary/20">הורדת קובץ מצורף 📥</a>
                      )}
                  </div>

                  <div className="flex items-center gap-3 bg-red-900/10 p-4 rounded-2xl border border-red-500/20">
                      <input type="checkbox" id="restrictUser" className="w-6 h-6 accent-red-500" checked={editingUser.isRestricted} onChange={e=>setEditingUser({...editingUser, isRestricted: e.target.checked})} />
                      <label htmlFor="restrictUser" className="text-red-500 text-sm font-black uppercase italic">מתאמן חסום להרשמה ⛔</label>
                  </div>
              </div>
              <div className="mt-12 flex gap-4">
                  <Button onClick={()=>{props.onUpdateUser(editingUser); setEditingUser(null);}} className="flex-1 bg-red-600 py-7 rounded-[45px] text-xl font-black italic uppercase shadow-2xl">שמור שינויים ✓</Button>
                  <Button onClick={()=>{if(confirm('למחוק מתאמן?')){props.onDeleteUser(editingUser.id); setEditingUser(null);}}} variant="danger" className="px-10 rounded-[45px]">מחק 🗑️</Button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
