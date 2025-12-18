
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
  getStatsForUser: (user: User) => { monthly: number; record: number; streak: number };
}

type SortMode = 'name' | 'monthly' | 'record' | 'streak' | 'health' | 'payment';

export const AdminPanel: React.FC<AdminPanelProps> = (props) => {
  const [activeTab, setActiveTab] = useState<'attendance' | 'users' | 'settings'>('attendance');
  const [settingsSection, setSettingsSection] = useState<'general' | 'infrastructure' | 'quotes' | 'connections' | 'views'>('general');
  const [attendanceSession, setAttendanceSession] = useState<TrainingSession | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [traineeSearch, setTraineeSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortMode>('name');
  const [saveIndicator, setSaveIndicator] = useState<string | null>(null);
  const [isCopyingWeek, setIsCopyingWeek] = useState(false);
  const [targetCopyWeekOffset, setTargetCopyWeekOffset] = useState(1);

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
      let filtered = props.users.filter(u => u.fullName.includes(searchTerm) || u.phone.includes(searchTerm) || u.email?.includes(searchTerm));
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

  const traineeSuggestions = useMemo(() => {
      if (!traineeSearch || !attendanceSession) return [];
      const search = traineeSearch.toLowerCase();
      return props.users.filter(u => 
          (u.fullName.toLowerCase().includes(search) || u.phone.includes(search)) && 
          !attendanceSession.registeredPhoneNumbers.includes(normalizePhone(u.phone))
      ).slice(0, 5);
  }, [traineeSearch, props.users, attendanceSession]);

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
        window.location.reload(); 
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

  const copyWeekSessions = async () => {
    const sessionsToCopy = props.sessions.filter(s => weekDates.includes(s.date));
    if (sessionsToCopy.length === 0) return alert('אין אימונים בשבוע זה להעתקה');
    
    const confirmMsg = `האם להעתיק ${sessionsToCopy.length} אימונים לשבוע המבוקש? (המתאמנים לא יועתקו)`;
    if (!confirm(confirmMsg)) return;

    setSaveIndicator('מעתיק שבוע...');
    try {
        const daysDiff = (targetCopyWeekOffset - weekOffset) * 7;
        for (const session of sessionsToCopy) {
            const originalDate = new Date(session.date);
            originalDate.setDate(originalDate.getDate() + daysDiff);
            const newDateStr = originalDate.toISOString().split('T')[0];
            
            const newSession: TrainingSession = {
                ...session,
                id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                date: newDateStr,
                registeredPhoneNumbers: [],
                attendedPhoneNumbers: [],
                waitingList: [],
                isCancelled: false, 
                manualHasStarted: false
            };
            await dataService.addSession(newSession);
        }
        setSaveIndicator('שבוע הועתק בהצלחה!');
        setTimeout(() => { setSaveIndicator(null); window.location.reload(); }, 2000);
    } catch (e) {
        setSaveIndicator('שגיאה בהעתקת שבוע');
    }
    setIsCopyingWeek(false);
  };

  const shareView = (mode: 'work' | 'admin') => {
      const url = window.location.origin + '?mode=' + mode;
      if (navigator.share) {
          navigator.share({ title: 'לו"ז ניב כהן', url });
      } else {
          navigator.clipboard.writeText(url);
          alert('הקישור הועתק ללוח!');
      }
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
                <div className="flex flex-col items-center">
                    <span className="text-red-500 font-black uppercase tracking-[0.3em] bg-red-500/10 px-4 py-1 rounded-full">{weekOffset === 0 ? 'השבוע' : `שבוע ${weekOffset}`}</span>
                    <button onClick={() => setIsCopyingWeek(!isCopyingWeek)} className="text-[10px] text-gray-500 font-black uppercase mt-2 hover:text-red-500 transition-colors underline">שכפל שבוע 📑</button>
                </div>
                <button onClick={()=>setWeekOffset(p=>p+1)} className="text-white text-2xl p-2 hover:text-red-500 transition-colors">→</button>
             </div>

             {isCopyingWeek && (
                 <div className="bg-gray-800/60 p-6 rounded-[35px] border border-red-500/30 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-300">
                    <h4 className="text-white font-black italic uppercase text-center">שכפול כל האימונים 📑</h4>
                    <p className="text-xs text-gray-400 text-center">העתקת האימונים מהתצוגה הנוכחית ({weekOffset === 0 ? 'השבוע' : `שבוע ${weekOffset}`}) אל:</p>
                    <div className="flex items-center justify-center gap-4">
                        <select 
                            className="bg-gray-900 text-white p-3 rounded-2xl border border-white/10 font-black outline-none"
                            value={targetCopyWeekOffset}
                            onChange={(e) => setTargetCopyWeekOffset(Number(e.target.value))}
                        >
                            {Array.from({length: 8}, (_, i) => (
                                <option key={i} value={i-2}>{i-2 === 0 ? 'השבוע' : `שבוע ${i-2}`}</option>
                            ))}
                        </select>
                        <Button onClick={copyWeekSessions} className="bg-red-600 px-8">בצע שכפול 🚀</Button>
                        <button onClick={() => setIsCopyingWeek(false)} className="text-gray-500 text-sm font-black uppercase">ביטול</button>
                    </div>
                 </div>
             )}

             <Button onClick={() => setAttendanceSession({ id: Date.now().toString() + Math.random().toString(36).substr(2, 5), type: props.workoutTypes[0] || 'פונקציונלי', date: new Date().toISOString().split('T')[0], time: '18:00', location: props.locations[0]?.name || '', maxCapacity: 15, registeredPhoneNumbers: [], attendedPhoneNumbers: [], description: '' })} className="w-full py-7 rounded-[45px] bg-red-600 text-xl font-black italic shadow-2xl">+ יצירת אימון חדש</Button>
             <div className="space-y-12">
              {weekDates.map(date => {
                  const daySessions = props.sessions.filter(s => s.date === date).sort((a,b)=>a.time.localeCompare(b.time));
                  return (
                      <div key={date}>
                          <div className="flex justify-between items-end border-b border-white/5 pb-2 mb-4">
                              <h4 className="text-gray-500 font-black text-4xl uppercase tracking-widest">{new Date(date).toLocaleDateString('he-IL', { weekday: 'long' })}</h4>
                              <p className="text-gray-500 font-black text-4xl uppercase tracking-widest opacity-30">{new Date(date).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' })}</p>
                          </div>
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
                                <p className="text-[10px] text-gray-600 italic truncate max-w-[200px]">{u.email || 'אין אימייל'}</p>
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
                    {(['general', 'infrastructure', 'quotes', 'connections', 'views'] as const).map(s => (
                        <button key={s} onClick={() => setSettingsSection(s)} className={`flex-1 py-2 px-4 text-[9px] font-black uppercase rounded-xl transition-all whitespace-nowrap ${settingsSection === s ? 'bg-gray-800 text-white' : 'text-gray-600'}`}>
                            {s === 'general' ? 'מידע כללי' : s === 'infrastructure' ? 'מיקומים' : s === 'quotes' ? 'מוטיבציה' : s === 'connections' ? 'חיבורים' : 'תצוגות'}
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
                        <div className="bg-gray-800/40 p-8 rounded-[50px] border border-white/5 space-y-4 shadow-2xl">
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="text-white font-black uppercase italic tracking-widest">מיקומים 📍</h4>
                                <Button onClick={handleAddLocation} size="sm" variant="secondary">הוסף מיקום</Button>
                            </div>
                            <div className="grid gap-4">
                                {props.locations.map(loc => (
                                    <div key={loc.id} className="bg-gray-900/50 p-6 rounded-[30px] border border-white/5 flex flex-col gap-4">
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1 space-y-2">
                                                <label className="text-[9px] text-gray-600 font-black uppercase block">שם</label>
                                                <input className="w-full bg-transparent text-white font-black text-lg outline-none focus:text-brand-primary italic border-b border-white/5 pb-1" value={loc.name} onChange={e => props.onUpdateLocations(props.locations.map(l => l.id === loc.id ? {...l, name: e.target.value} : l))} />
                                                <label className="text-[9px] text-gray-600 font-black uppercase block mt-2">כתובת / Waze</label>
                                                <input className="w-full bg-transparent text-xs text-gray-500 outline-none focus:text-white font-bold" value={loc.address} onChange={e => props.onUpdateLocations(props.locations.map(l => l.id === loc.id ? {...l, address: e.target.value} : l))} />
                                            </div>
                                            <button onClick={() => { if(confirm('למחוק מיקום?')) props.onUpdateLocations(props.locations.filter(l => l.id !== loc.id)) }} className="text-red-500/30 hover:text-red-500 transition-colors p-2 text-xl">🗑️</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="bg-gray-800/40 p-8 rounded-[50px] border border-white/5 space-y-4 shadow-2xl">
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
                    <div className="bg-gray-800/40 p-8 rounded-[50px] border border-white/5 space-y-6 shadow-2xl">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="text-white font-black uppercase italic tracking-widest">משפטי מוטיבציה 🧠</h4>
                            <Button onClick={handleAddQuote} size="sm" variant="secondary">הוסף משפט</Button>
                        </div>
                        <div className="space-y-3">
                            {props.quotes.map(q => (
                                <div key={q.id} className="bg-gray-900/50 p-4 rounded-2xl border border-white/5 flex justify-between items-center group">
                                    <p className="text-white italic text-sm">"{q.text}"</p>
                                    <button onClick={() => handleDeleteQuote(q.id)} className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-2">🗑️</button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {settingsSection === 'connections' && (
                    <div className="bg-gray-800/40 p-8 rounded-[50px] border border-white/5 space-y-8 shadow-2xl">
                        <h3 className="text-white font-black uppercase italic tracking-widest border-b border-white/10 pb-4">חיבורים ואינטגרציות 🔌</h3>
                        <div className="bg-blue-900/10 border border-blue-500/20 p-6 rounded-[30px] space-y-4">
                            <h4 className="text-blue-400 font-black text-sm uppercase">Supabase (בסיס נתונים)</h4>
                            <p className="text-xs text-gray-400 leading-relaxed">
                                החיבור ל-Supabase מאפשר שמירה עמידה של נתוני המתאמנים והאימונים בענן.
                            </p>
                            <div className="space-y-2">
                                <label className="text-[10px] text-gray-500 uppercase font-black block">מצב חיבור:</label>
                                <p className="text-xs text-green-500 font-black">פעיל - xjqlluobnzpgpttprmio.supabase.co ✅</p>
                            </div>
                        </div>
                        <div className="bg-red-900/10 border border-red-500/20 p-6 rounded-[30px] space-y-4">
                            <h4 className="text-red-400 font-black text-sm uppercase">Google Gemini AI</h4>
                            <p className="text-xs text-gray-400 leading-relaxed">
                                האפליקציה משתמשת ב-Gemini 3.0 Flash ליצירת תיאורי אימון ומשפטי מוטיבציה באופן אוטומטי.
                            </p>
                            <div className="bg-black/40 p-4 rounded-xl border border-white/5">
                                <p className="text-[10px] text-gray-500 uppercase font-black mb-1">מצב חיבור:</p>
                                <p className="text-xs text-green-500 font-black">פעיל - API Key מזוהה ✅</p>
                            </div>
                        </div>
                    </div>
                )}

                {settingsSection === 'views' && (
                    <div className="bg-gray-800/40 p-8 rounded-[50px] border border-white/5 space-y-8 shadow-2xl">
                        <h3 className="text-white font-black uppercase italic tracking-widest border-b border-white/10 pb-4">קישורים לשיתוף 🔗</h3>
                        <div className="grid gap-6">
                            <div className="bg-brand-primary/10 border border-brand-primary/20 p-8 rounded-[40px] flex flex-col items-center gap-4 group hover:bg-brand-primary/20 transition-all cursor-pointer" onClick={() => shareView('work')}>
                                <div className="text-5xl">🏋️</div>
                                <div className="text-center">
                                    <h4 className="text-brand-primary font-black uppercase italic text-xl">תצוגת מתאמן</h4>
                                    <p className="text-xs text-gray-500 mt-1">לוח אימונים, הרשמה ופרופיל אישי</p>
                                </div>
                                <Button className="w-full bg-brand-primary text-black py-4 rounded-2xl">שתף קישור מתאמנים 📤</Button>
                            </div>
                            <div className="bg-red-600/10 border border-red-600/20 p-8 rounded-[40px] flex flex-col items-center gap-4 group hover:bg-red-600/20 transition-all cursor-pointer" onClick={() => shareView('admin')}>
                                <div className="text-5xl">⚙️</div>
                                <div className="text-center">
                                    <h4 className="text-red-500 font-black uppercase italic text-xl">תצוגת מאמן</h4>
                                    <p className="text-xs text-gray-500 mt-1">ניהול נוכחות, מתאמנים והגדרות מערכת</p>
                                </div>
                                <Button className="w-full bg-red-600 text-white py-4 rounded-2xl">שתף קישור מאמן 📤</Button>
                            </div>
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
                      <div className="bg-gray-800/40 p-6 rounded-[35px] max-h-[600px] overflow-y-auto no-scrollbar border border-white/5 space-y-4">
                        <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest border-b border-white/5 pb-2">נוכחות ({attendanceSession.registeredPhoneNumbers.length})</p>
                        <div className="relative">
                            <input 
                                type="text" 
                                placeholder="הוספת מתאמן..." 
                                className="w-full bg-gray-900 p-4 rounded-2xl text-white text-xs border border-white/5 outline-none focus:border-brand-primary"
                                value={traineeSearch}
                                onChange={(e) => setTraineeSearch(e.target.value)}
                            />
                            {traineeSuggestions.length > 0 && (
                                <div className="absolute top-full left-0 right-0 z-30 bg-gray-900 border border-white/10 rounded-2xl mt-1 overflow-hidden shadow-2xl">
                                    {traineeSuggestions.map(u => (
                                        <button 
                                            key={u.id} 
                                            className="w-full p-4 text-right hover:bg-gray-800 transition-colors flex justify-between items-center group"
                                            onClick={() => {
                                                const phone = normalizePhone(u.phone);
                                                setAttendanceSession({
                                                    ...attendanceSession,
                                                    registeredPhoneNumbers: [...attendanceSession.registeredPhoneNumbers, phone]
                                                });
                                                setTraineeSearch('');
                                            }}
                                        >
                                            <span className="text-white text-sm font-bold">{u.fullName}</span>
                                            <span className="text-brand-primary opacity-0 group-hover:opacity-100">+ הוסף</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="space-y-2">
                            {attendanceSession.registeredPhoneNumbers.map(phone => {
                                const u = props.users.find(user => normalizePhone(user.phone) === normalizePhone(phone));
                                const isAttended = (attendanceSession.attendedPhoneNumbers || []).includes(phone);
                                return (
                                    <div key={phone} className="flex justify-between items-center p-4 rounded-2xl bg-gray-900/50 border border-white/5">
                                        <div className="flex flex-col">
                                            <span className="text-white text-sm font-bold">{u ? (u.displayName || u.fullName) : phone}</span>
                                            <span className="text-[10px] text-gray-500 font-mono">{phone}</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => { const curr = attendanceSession.attendedPhoneNumbers || []; const up = isAttended ? curr.filter(p => p !== phone) : [...curr, phone]; setAttendanceSession({...attendanceSession, attendedPhoneNumbers: up}); }} className={`px-4 py-2 rounded-xl text-[10px] font-black ${isAttended ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-500'}`}>{isAttended ? 'נכח ✓' : 'לא נכח'}</button>
                                            <button onClick={() => { if(confirm('להסיר מהאימון?')) setAttendanceSession({...attendanceSession, registeredPhoneNumbers: attendanceSession.registeredPhoneNumbers.filter(p => p !== phone)})}} className="text-red-500 text-xs p-2">✕</button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                      </div>
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
                        <div>
                            <label className="text-[10px] text-gray-500 font-black mb-1 block uppercase">דגשים למתאמנים</label>
                            <textarea className="w-full bg-gray-800 p-5 rounded-3xl text-white font-bold h-24 text-sm leading-relaxed" value={attendanceSession.description || ''} onChange={e=>setAttendanceSession({...attendanceSession, description: e.target.value})} placeholder="כתוב כאן דגשים..."></textarea>
                        </div>
                        <div className="grid grid-cols-3 gap-2 p-4 bg-gray-800/20 rounded-3xl border border-white/5">
                            <div className="flex items-center gap-2">
                                <input type="checkbox" id="isZoom" className="w-4 h-4 accent-blue-500" checked={attendanceSession.isZoomSession || false} onChange={e=>setAttendanceSession({...attendanceSession, isZoomSession: e.target.checked})} />
                                <label htmlFor="isZoom" className="text-blue-400 text-[9px] font-black uppercase cursor-pointer">זום 💻</label>
                            </div>
                            <div className="flex items-center gap-2">
                                <input type="checkbox" id="isHidden" className="w-4 h-4 accent-orange-500" checked={attendanceSession.isHidden || false} onChange={e=>setAttendanceSession({...attendanceSession, isHidden: e.target.checked})} />
                                <label htmlFor="isHidden" className="text-orange-400 text-[9px] font-black uppercase cursor-pointer">נסתר 👁️‍🗨️</label>
                            </div>
                            <div className="flex items-center gap-2">
                                <input type="checkbox" id="isCancelled" className="w-4 h-4 accent-red-500" checked={attendanceSession.isCancelled || false} onChange={e=>setAttendanceSession({...attendanceSession, isCancelled: e.target.checked})} />
                                <label htmlFor="isCancelled" className="text-red-500 text-[9px] font-black uppercase cursor-pointer">מבוטל ❌</label>
                            </div>
                        </div>
                        {attendanceSession.isZoomSession && (
                            <div className="space-y-1">
                                <label className="text-[10px] text-blue-500 font-black uppercase px-2">לינק לזום</label>
                                <input className="w-full bg-blue-900/10 border border-blue-500/20 p-4 rounded-2xl text-white font-mono text-xs" value={attendanceSession.zoomLink || ''} onChange={e=>setAttendanceSession({...attendanceSession, zoomLink: e.target.value})} placeholder="https://zoom.us/..." />
                            </div>
                        )}
                        <div className="flex items-center gap-3 bg-brand-primary/10 p-4 rounded-2xl border border-brand-primary/20">
                            <input type="checkbox" id="isHappening" className="w-6 h-6 accent-brand-primary" checked={attendanceSession.manualHasStarted || false} onChange={e=>setAttendanceSession({...attendanceSession, manualHasStarted: e.target.checked})} />
                            <label htmlFor="isHappening" className="text-brand-primary text-sm font-black uppercase cursor-pointer">אימון מתקיים ✓</label>
                        </div>
                      </div>
                  </div>
                  <div className="mt-8 flex gap-4">
                      <Button onClick={()=>{ const isNew = !props.sessions.find(s => s.id === attendanceSession.id); if (isNew) props.onAddSession(attendanceSession); else props.onUpdateSession(attendanceSession); setAttendanceSession(null); }} className="flex-1 bg-red-600 py-7 rounded-[45px] text-xl font-black italic uppercase shadow-2xl">שמור שינויים ✓</Button>
                      <Button onClick={()=>{if(confirm('מחיקת אימון?')){props.onDeleteSession(attendanceSession.id); setAttendanceSession(null);}}} variant="danger" className="px-10 rounded-[45px]">מחק 🗑️</Button>
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
                  <div>
                      <label className="text-[10px] text-gray-500 font-black mb-1 block uppercase">אימייל</label>
                      <input className="w-full bg-gray-800 p-5 rounded-3xl text-white font-bold font-mono" value={editingUser.email || ''} onChange={e=>setEditingUser({...editingUser, email: e.target.value})} />
                  </div>
                  <div className="bg-gray-800/50 p-6 rounded-[35px] border border-white/5">
                      <h4 className="text-blue-400 font-black uppercase italic mb-4">הצהרת בריאות 📋</h4>
                      {editingUser.healthDeclarationDate ? (
                          <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-2xl mb-4 text-white">
                             <p className="font-bold text-sm">נחתמה ב: {editingUser.healthDeclarationDate}</p>
                             <p className="text-gray-400 text-xs mt-1">ת.ז.: {editingUser.healthDeclarationId}</p>
                          </div>
                      ) : (
                          <p className="text-gray-600 text-xs italic mb-4">טרם נחתמה הצהרה</p>
                      )}
                      {editingUser.healthDeclarationFile && (
                          <a href={editingUser.healthDeclarationFile} download={`health-${editingUser.fullName}`} className="block w-full text-center py-4 bg-brand-primary/10 text-brand-primary font-black uppercase rounded-2xl border border-brand-primary/20">הורדת קובץ מצורף 📥</a>
                      )}
                  </div>
                  <div className="flex items-center gap-3 bg-red-900/10 p-4 rounded-2xl border border-red-500/20">
                      <input type="checkbox" id="restrictUser" className="w-6 h-6 accent-red-500" checked={editingUser.isRestricted || false} onChange={e=>setEditingUser({...editingUser, isRestricted: e.target.checked})} />
                      <label htmlFor="restrictUser" className="text-red-500 text-sm font-black uppercase italic">מתאמן חסום להרשמה ⛔</label>
                  </div>
              </div>
              <div className="mt-12 flex gap-4">
                  <Button onClick={()=>{props.onUpdateUser(editingUser); setEditingUser(null);}} className="flex-1 bg-red-600 py-7 rounded-[45px] text-xl font-black italic uppercase shadow-2xl">שמור שינויים ✓</Button>
                  <Button onClick={()=>{if(confirm('מחיקת מתאמן?')){props.onDeleteUser(editingUser.id); setEditingUser(null);}}} variant="danger" className="px-10 rounded-[45px]">מחק 🗑️</Button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
