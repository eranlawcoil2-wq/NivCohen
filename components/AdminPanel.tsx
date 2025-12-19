
import React, { useState, useMemo, useEffect } from 'react';
import { User, TrainingSession, WeatherLocation, LocationDef, AppConfig, Quote, WeatherInfo, PaymentStatus } from '../types';
import { Button } from './Button';
import { SessionCard } from './SessionCard';
import { dataService } from '../services/dataService';
import { getMotivationQuote } from '../services/geminiService';

interface AdminPanelProps {
  users: User[]; sessions: TrainingSession[]; primaryColor: string; workoutTypes: string[]; locations: LocationDef[];
  weatherLocation: WeatherLocation; weatherData?: Record<string, WeatherInfo>; paymentLinks: any[];
  streakGoal: number; appConfig: AppConfig; quotes: Quote[]; deferredPrompt?: any; onInstall?: () => void;
  onAddUser: (user: User) => void; onUpdateUser: (user: User) => void; onDeleteUser: (userId: string) => void; 
  onAddSession: (session: TrainingSession) => void; onUpdateSession: (session: TrainingSession) => void; onDeleteSession: (id: string) => void;
  onDuplicateSession?: (session: TrainingSession) => void;
  onAddToCalendar?: (session: TrainingSession) => void;
  onColorChange: (color: string) => void; onUpdateWorkoutTypes: (types: string[]) => void; 
  onUpdateLocations: (locations: LocationDef[]) => void; onUpdateWeatherLocation: (location: WeatherLocation) => void;
  onAddPaymentLink: (link: any) => void; onDeletePaymentLink: (id: string) => void; onUpdateStreakGoal: (goal: number) => void;
  onUpdateAppConfig: (config: AppConfig) => void; onExitAdmin: () => void;
  getStatsForUser: (user: User) => { monthly: number; record: number; streak: number };
}

export const AdminPanel: React.FC<AdminPanelProps> = (props) => {
  const [activeTab, setActiveTab] = useState<'attendance' | 'users' | 'settings'>('attendance');
  const [settingsSection, setSettingsSection] = useState<'general' | 'infrastructure' | 'quotes' | 'connections' | 'views'>('general');
  const [attendanceSession, setAttendanceSession] = useState<TrainingSession | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [traineeSearch, setTraineeSearch] = useState('');
  const [saveIndicator, setSaveIndicator] = useState<string | null>(null);
  const [userSortBy, setUserSortBy] = useState<'monthly' | 'record' | 'streak'>('monthly');
  const [showDuplicationOptions, setShowDuplicationOptions] = useState(false);
  
  const [showGroupSessions, setShowGroupSessions] = useState(true);
  const [showPersonalTraining, setShowPersonalTraining] = useState(true);

  const [localAppConfig, setLocalAppConfig] = useState<AppConfig>(props.appConfig);
  const [localLocations, setLocalLocations] = useState<LocationDef[]>(props.locations);
  const [localWorkoutTypes, setLocalWorkoutTypes] = useState<string[]>(props.workoutTypes);
  const [localQuotes, setLocalQuotes] = useState<Quote[]>(props.quotes);
  const [sessionDraft, setSessionDraft] = useState<TrainingSession | null>(null);

  useEffect(() => {
    if (attendanceSession) {
      setSessionDraft({ 
        ...attendanceSession, 
        isPersonalTraining: Boolean(attendanceSession.isPersonalTraining),
        isCancelled: Boolean(attendanceSession.isCancelled),
        isZoomSession: Boolean(attendanceSession.isZoomSession),
        manualHasStarted: Boolean(attendanceSession.manualHasStarted)
      });
    } else setSessionDraft(null);
  }, [attendanceSession]);

  useEffect(() => {
    if (activeTab === 'settings') {
      setLocalAppConfig(props.appConfig);
      setLocalLocations(props.locations);
      setLocalWorkoutTypes(props.workoutTypes);
      setLocalQuotes(props.quotes);
    }
  }, [props.appConfig, props.locations, props.workoutTypes, props.quotes, activeTab]);

  const normalizePhone = (p: string) => {
    if (!p) return '';
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

  const sortedUsers = useMemo(() => {
    return [...props.users]
      .filter(u => u.fullName.includes(searchTerm) || (u.displayName && u.displayName.includes(searchTerm)) || u.phone.includes(searchTerm))
      .sort((a, b) => {
        const statsA = props.getStatsForUser(a);
        const statsB = props.getStatsForUser(b);
        return statsB[userSortBy] - statsA[userSortBy];
      });
  }, [props.users, searchTerm, userSortBy, props.getStatsForUser]);

  const traineeSuggestions = useMemo(() => {
    if (traineeSearch.length < 2) return [];
    return props.users.filter(u => 
      u.fullName.toLowerCase().includes(traineeSearch.toLowerCase()) || 
      (u.displayName && u.displayName.toLowerCase().includes(traineeSearch.toLowerCase())) ||
      normalizePhone(u.phone).includes(traineeSearch)
    ).slice(0, 5);
  }, [props.users, traineeSearch]);

  const getWhatsAppMsg = (s: TrainingSession) => {
    const dateStr = new Date(s.date).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });
    const dayName = new Date(s.date).toLocaleDateString('he-IL', { weekday: 'long' });
    return `מתאמנים יקרים! תזכורת לאימון ${s.type} ביום ${dayName} (${dateStr}) בשעה ${s.time} ב${s.location}. ${s.description || ''} מחכה לראות אתכם! 💪⚡`;
  };

  const performDuplication = async (targetSundayStr: string) => {
    const sessionsToCopy = props.sessions.filter(s => weekDates.includes(s.date));
    if (sessionsToCopy.length === 0) {
        alert('לא נמצאו אימונים לשכפול בשבוע זה.');
        return;
    }

    const targetSunday = new Date(targetSundayStr);
    if (isNaN(targetSunday.getTime())) {
        alert('תאריך לא תקין');
        return;
    }

    const currentSunday = new Date(weekDates[0]);
    const timeDiff = targetSunday.getTime() - currentSunday.getTime();
    const daysDiff = Math.round(timeDiff / (1000 * 3600 * 24));

    setSaveIndicator('משכפל שבוע...');
    for (const s of sessionsToCopy) {
        const oldDate = new Date(s.date);
        const newDate = new Date(oldDate);
        newDate.setDate(oldDate.getDate() + daysDiff);

        const newSession: TrainingSession = {
            ...s,
            id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
            date: newDate.toISOString().split('T')[0],
            registeredPhoneNumbers: [],
            attendedPhoneNumbers: [],
            isCancelled: false,
            manualHasStarted: false
        };
        await dataService.addSession(newSession);
        props.onAddSession(newSession);
    }
    setSaveIndicator('השבוע שוכפל בהצלחה! ✓');
    setShowDuplicationOptions(false);
    setTimeout(() => setSaveIndicator(null), 3000);
  };

  const handleGenerateAIQuote = async () => {
    setSaveIndicator('ה-AI חושב על משפט...');
    const q = await getMotivationQuote();
    setLocalQuotes([...localQuotes, { id: Date.now().toString(), text: q }]);
    setSaveIndicator(null);
  };

  const handleSaveAllSettings = async () => {
    setSaveIndicator('שומר...');
    try {
      await Promise.all([
          dataService.saveAppConfig(localAppConfig),
          dataService.saveLocations(localLocations),
          dataService.saveWorkoutTypes(localWorkoutTypes),
          dataService.saveQuotes(localQuotes)
      ]);
      props.onUpdateAppConfig(localAppConfig);
      props.onUpdateLocations(localLocations);
      props.onUpdateWorkoutTypes(localWorkoutTypes);
      setSaveIndicator('נשמר בהצלחה ✓');
      setTimeout(() => setSaveIndicator(null), 3000);
    } catch (e) { setSaveIndicator('שגיאה בשמירה'); }
  };

  return (
    <div className="bg-brand-black min-h-screen">
      <div className="fixed top-[130px] left-0 right-0 z-[60] bg-brand-black/90 pt-4 border-b border-white/5 pb-4 backdrop-blur-xl px-4">
        <div className="max-w-4xl mx-auto space-y-4">
            <div className="flex gap-2">
            {['settings', 'users', 'attendance'].map(t => (
                <button key={t} onClick={() => setActiveTab(t as any)} className={`flex-1 py-4 rounded-2xl text-sm font-black uppercase tracking-widest transition-all ${activeTab === t ? 'bg-red-600 text-white shadow-xl shadow-red-600/40' : 'bg-gray-800/50 text-gray-500'}`}>
                {t === 'attendance' ? 'נוכחות' : t === 'users' ? 'מתאמנים' : 'הגדרות'}
                </button>
            ))}
            </div>
            {activeTab === 'settings' && (
                <div className="flex gap-2 p-1 bg-gray-900/60 rounded-2xl overflow-x-auto no-scrollbar border border-white/5">
                    {(['views', 'connections', 'quotes', 'infrastructure', 'general'] as const).map(s => (
                        <button key={s} onClick={() => setSettingsSection(s)} className={`flex-1 py-2.5 px-4 text-[11px] font-black uppercase rounded-xl transition-all whitespace-nowrap ${settingsSection === s ? 'bg-gray-800 text-white shadow-lg' : 'text-gray-600'}`}>
                            {s === 'general' ? 'מידע כללי' : s === 'infrastructure' ? 'מיקומים' : s === 'quotes' ? 'מוטיבציה' : s === 'connections' ? 'חיבורים' : 'תצוגות'}
                        </button>
                    ))}
                </div>
            )}
        </div>
      </div>

      <div className="p-4 max-w-4xl mx-auto pt-[200px] sm:pt-[240px] space-y-6 pb-24">
        {activeTab === 'attendance' && (
          <div className="space-y-6">
             <div className="flex flex-col gap-4 bg-gray-800/40 p-5 rounded-3xl border border-white/5 shadow-xl mt-6">
                <div className="flex justify-between items-center">
                    <button onClick={()=>setWeekOffset(p=>p-1)} className="text-white text-2xl p-2 hover:text-red-500 transition-colors">←</button>
                    <div className="flex flex-col items-center">
                        <span className="text-red-500 font-black uppercase tracking-[0.3em] bg-red-500/10 px-4 py-1 rounded-full">{weekOffset === 0 ? 'השבוע' : weekOffset === 1 ? 'שבוע הבא' : weekOffset === -1 ? 'שבוע שעבר' : `שבוע ${weekOffset}`}</span>
                    </div>
                    <button onClick={()=>setWeekOffset(p=>p+1)} className="text-white text-2xl p-2 hover:text-red-500 transition-colors">→</button>
                </div>
                <div className="flex justify-center gap-4 border-t border-white/5 pt-4">
                    <button onClick={() => setShowGroupSessions(!showGroupSessions)} className={`px-4 py-2 rounded-full text-[10px] font-black uppercase transition-all ${showGroupSessions ? 'bg-red-600 text-white' : 'bg-gray-900 text-gray-600'}`}>קבוצתי {showGroupSessions ? '✓' : '✗'}</button>
                    <button onClick={() => setShowPersonalTraining(!showPersonalTraining)} className={`px-4 py-2 rounded-full text-[10px] font-black uppercase transition-all ${showPersonalTraining ? 'bg-blue-600 text-white' : 'bg-gray-900 text-gray-600'}`}>אימון אישי {showPersonalTraining ? '✓' : '✗'}</button>
                </div>
             </div>

             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Button onClick={() => setAttendanceSession({ id: Date.now().toString(), type: props.workoutTypes[0] || 'פונקציונלי', date: new Date().toISOString().split('T')[0], time: '18:00', location: props.locations[0]?.name || '', maxCapacity: 15, registeredPhoneNumbers: [], attendedPhoneNumbers: [], description: '', isPersonalTraining: false, isZoomSession: false, isCancelled: false })} className="py-7 rounded-[45px] bg-red-600 text-xl font-black italic shadow-2xl">+ אימון חדש</Button>
                <Button onClick={() => setShowDuplicationOptions(true)} variant="secondary" className="py-7 rounded-[45px] text-xl font-black italic border-dashed border-2 border-white/20">שכפל שבוע זה 📑</Button>
             </div>

             {showDuplicationOptions && (
                 <div className="bg-gray-900 p-6 rounded-[40px] border border-red-500/30 shadow-2xl animate-install-overlay-animation">
                     <h4 className="text-white font-black uppercase italic mb-4 text-center">לאן לשכפל את השבוע הזה?</h4>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                         <Button onClick={() => performDuplication(new Date(new Date(weekDates[0]).getTime() + 7 * 24 * 3600 * 1000).toISOString().split('T')[0])} className="py-4 bg-red-600">לשבוע הבא ⏩</Button>
                         <div className="flex flex-col gap-2">
                             <label className="text-[10px] text-gray-500 font-black uppercase">בחר יום ראשון (תאריך יעד):</label>
                             <input 
                                type="date" 
                                className="bg-gray-800 p-4 rounded-2xl text-white font-bold border border-white/10"
                                onChange={(e) => { if(e.target.value) performDuplication(e.target.value); }}
                             />
                         </div>
                     </div>
                     <button onClick={() => setShowDuplicationOptions(false)} className="w-full text-center text-gray-500 text-xs font-black mt-4 uppercase">ביטול ✕</button>
                 </div>
             )}

             <div className="space-y-12">
              {weekDates.map(date => {
                  let daySessions = props.sessions.filter(s => s.date === date).sort((a,b)=>a.time.localeCompare(b.time));
                  daySessions = daySessions.filter(s => Boolean(s.isPersonalTraining) ? showPersonalTraining : showGroupSessions);
                  if (daySessions.length === 0) return null;
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

             <div className="flex justify-between items-center bg-gray-900/40 p-6 rounded-[40px] border border-white/5 shadow-2xl mt-12 mb-20">
                <button onClick={() => { setWeekOffset(p => p - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="text-white text-3xl p-4 hover:text-red-500 transition-colors">←</button>
                <div className="flex flex-col items-center">
                    <span className="text-gray-600 text-[10px] font-black uppercase tracking-[0.3em] mb-2">נווט בין שבועות</span>
                    <span className="text-red-500 font-black uppercase tracking-[0.2em] bg-red-500/10 px-6 py-2 rounded-full border border-red-500/20">{weekOffset === 0 ? 'השבוע' : weekOffset === 1 ? 'שבוע הבא' : weekOffset === -1 ? 'שבוע שעבר' : `שבוע ${weekOffset}`}</span>
                </div>
                <button onClick={() => { setWeekOffset(p => p + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="text-white text-3xl p-4 hover:text-red-500 transition-colors">→</button>
             </div>
          </div>
        )}

        {activeTab === 'users' && (
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row gap-4 items-center">
                    <input type="text" placeholder="חיפוש מתאמן..." className="flex-1 bg-gray-800 border border-white/10 p-6 rounded-[30px] text-white outline-none focus:border-red-500 shadow-xl" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
                    <div className="flex gap-2 p-2 bg-gray-900/60 rounded-[30px] border border-white/5">
                        {(['monthly', 'record', 'streak'] as const).map(sort => (
                            <button key={sort} onClick={() => setUserSortBy(sort)} className={`px-4 py-3 rounded-2xl text-[10px] font-black uppercase transition-all ${userSortBy === sort ? 'bg-red-600 text-white' : 'text-gray-500'}`}>
                                {sort === 'monthly' ? 'נוכחות' : sort === 'record' ? 'שיא' : 'רצף'}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="grid gap-4">
                    {sortedUsers.map(u => {
                       const uStats = props.getStatsForUser(u);
                       return (
                       <div key={u.id} onClick={() => setEditingUser(u)} className="bg-gray-800/40 p-6 rounded-[50px] border border-white/5 flex flex-col sm:flex-row justify-between items-center shadow-2xl hover:border-red-500/50 cursor-pointer transition-all">
                          <div className="flex items-center gap-6">
                             <div className="w-16 h-16 rounded-full bg-gray-900 border-2 border-white/10 flex items-center justify-center font-black text-2xl text-red-500 shrink-0" style={{ color: u.userColor }}>{u.fullName.charAt(0)}</div>
                             <div className="truncate max-w-[150px] sm:max-w-none">
                                <h3 className="text-white font-black text-xl italic truncate" style={{ color: u.userColor }}>{u.fullName}</h3>
                                <p className="text-xs text-gray-500 font-mono tracking-widest">{u.phone}</p>
                                {u.isRestricted && <span className="text-red-500 text-[9px] font-black uppercase">חסום 🚫</span>}
                             </div>
                          </div>
                          <div className="grid grid-cols-3 gap-8 text-center mt-4 sm:mt-0">
                             <div><p className="text-[10px] text-gray-500 font-black uppercase mb-1">החודש</p><p className="text-3xl font-black text-brand-primary">{uStats.monthly}</p></div>
                             <div><p className="text-[10px] text-gray-500 font-black uppercase mb-1">שיא</p><p className="text-3xl font-black text-white">{uStats.record}</p></div>
                             <div><p className="text-[10px] text-gray-500 font-black uppercase mb-1">רצף</p><p className="text-3xl font-black text-orange-400">{uStats.streak}</p></div>
                          </div>
                       </div>
                    )})}
                </div>
            </div>
        )}

        {activeTab === 'settings' && (
            <div className="space-y-10 mt-6">
                {settingsSection === 'general' && (
                    <div className="bg-gray-800/40 p-8 rounded-[50px] border border-white/5 space-y-8 shadow-2xl">
                        <h3 className="text-white font-black uppercase italic tracking-widest border-b border-white/10 pb-4">מידע כללי 👤</h3>
                        <div className="space-y-3">
                            <label className="text-[10px] text-red-500 font-black uppercase block">הודעה דחופה באתר</label>
                            <input className="w-full bg-red-900/10 border border-red-500/30 p-6 rounded-[30px] text-white font-black italic shadow-inner outline-none focus:border-red-500" value={localAppConfig.urgentMessage || ''} onChange={e => setLocalAppConfig({...localAppConfig, urgentMessage: e.target.value})} placeholder="כתוב כאן הודעה שתופיע למעלה באדום..." />
                        </div>
                        <div className="space-y-3">
                            <label className="text-[10px] text-brand-primary font-black uppercase block">טקסט אודות (דף נחיתה)</label>
                            <textarea className="w-full bg-gray-800 border border-white/10 p-6 rounded-[30px] text-white font-bold h-48 italic leading-relaxed" value={localAppConfig.coachBio || ''} onChange={e => setLocalAppConfig({...localAppConfig, coachBio: e.target.value})} placeholder="ספר על עצמך כאן..." />
                        </div>
                    </div>
                )}
                
                {settingsSection === 'infrastructure' && (
                    <div className="space-y-8">
                        <div className="bg-gray-800/40 p-8 rounded-[50px] border border-white/5 space-y-4 shadow-2xl">
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="text-white font-black uppercase italic tracking-widest">מיקומים וכתובות 📍</h4>
                                <Button onClick={() => { const n = prompt('שם המיקום:'); if(n) setLocalLocations([...localLocations, {id: Date.now().toString(), name: n, address: n, color: '#A3E635'}]); }} size="sm" variant="secondary">הוסף מיקום</Button>
                            </div>
                            <div className="grid gap-4">
                                {localLocations.map(loc => (
                                    <div key={loc.id} className="bg-gray-900/50 p-6 rounded-[35px] space-y-4 border border-white/5">
                                        <div className="flex justify-between gap-4">
                                            <input className="bg-transparent text-white font-black italic text-lg outline-none flex-1" value={loc.name} onChange={e => setLocalLocations(localLocations.map(l => l.id === loc.id ? {...l, name: e.target.value} : l))} placeholder="שם המיקום (למשל: סטודיו נס ציונה)" />
                                            <div className="flex items-center gap-2">
                                                <input type="color" className="w-8 h-8 rounded-full border-none p-1 cursor-pointer bg-transparent" value={loc.color || '#A3E635'} onChange={e => setLocalLocations(localLocations.map(l => l.id === loc.id ? {...l, color: e.target.value} : l))} />
                                                <button onClick={() => setLocalLocations(localLocations.filter(l => l.id !== loc.id))} className="text-red-500">✕</button>
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] text-gray-500 uppercase font-black">כתובת ל-Waze</label>
                                            <input className="w-full bg-gray-800 p-3 rounded-xl text-white text-xs border border-white/5" value={loc.address} onChange={e => setLocalLocations(localLocations.map(l => l.id === loc.id ? {...l, address: e.target.value} : l))} placeholder="כתובת מדויקת..." />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {settingsSection === 'quotes' && (
                    <div className="bg-gray-800/40 p-8 rounded-[50px] border border-white/5 space-y-8 shadow-2xl">
                        <div className="flex justify-between items-center border-b border-white/10 pb-4">
                            <h3 className="text-white font-black uppercase italic tracking-widest">משפטי מוטיבציה ⚡</h3>
                            <div className="flex gap-2">
                                <Button onClick={handleGenerateAIQuote} size="sm" variant="outline">ייצור AI ✨</Button>
                                <Button onClick={() => { const q = prompt('הכנס משפט מוטיבציה:'); if(q) setLocalQuotes([...localQuotes, {id: Date.now().toString(), text: q}]); }} size="sm" variant="secondary">הוסף ידנית</Button>
                            </div>
                        </div>
                        <div className="grid gap-3">
                            {localQuotes.map(q => (
                                <div key={q.id} className="bg-gray-900/50 p-5 rounded-[30px] border border-white/5 flex justify-between items-center gap-4 group">
                                    <p className="text-white font-bold italic text-sm">"{q.text}"</p>
                                    <button onClick={() => setLocalQuotes(localQuotes.filter(x => x.id !== q.id))} className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                                </div>
                            ))}
                            {localQuotes.length === 0 && <p className="text-center text-gray-500 py-10 italic">אין משפטים מוגדרים. ה-AI ייצר משפטים אוטומטית.</p>}
                        </div>
                    </div>
                )}

                <div className="sticky bottom-4 z-[60] bg-brand-black/80 backdrop-blur-xl p-4 rounded-[40px] border border-white/10 shadow-3xl flex flex-col items-center gap-2">
                    {saveIndicator && <p className="text-xs font-black uppercase tracking-widest text-brand-primary animate-pulse">{saveIndicator}</p>}
                    <Button onClick={handleSaveAllSettings} className="w-full py-6 rounded-[40px] text-xl font-black italic shadow-2xl shadow-red-600/20 bg-red-600">שמירה ✅</Button>
                    <Button onClick={props.onExitAdmin} variant="outline" className="w-full py-4 rounded-[40px] font-black italic text-sm uppercase opacity-60">חזרה ללו"ז</Button>
                </div>
            </div>
        )}
      </div>

      {sessionDraft && (
          <div className="fixed inset-0 bg-black/95 z-[200] flex items-center justify-center p-6 backdrop-blur-xl overflow-y-auto no-scrollbar">
              <div className="bg-gray-900 p-8 sm:p-12 rounded-[60px] w-full max-w-4xl border border-white/10 text-right shadow-3xl my-auto" dir="rtl">
                  <div className="flex justify-between mb-8 border-b border-white/5 pb-5">
                      <h3 className="text-3xl font-black text-white italic uppercase">ניהול אימון ⚙️</h3>
                      <button onClick={()=>setAttendanceSession(null)} className="text-gray-500 text-4xl">✕</button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                      <div className="bg-gray-800/40 p-6 rounded-[35px] max-h-[600px] overflow-y-auto no-scrollbar border border-white/5 space-y-4">
                        <div className="flex justify-between items-center border-b border-white/5 pb-2">
                            <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">נוכחות ({sessionDraft.registeredPhoneNumbers.length})</p>
                            {sessionDraft.registeredPhoneNumbers.length > 0 && (
                                <button onClick={() => { if(confirm('לנקות את כל המתאמנים מהרשימה?')) setSessionDraft({...sessionDraft, registeredPhoneNumbers: [], attendedPhoneNumbers: []}); }} className="text-[10px] text-red-500 font-black uppercase">נקה הכל 🗑️</button>
                            )}
                        </div>
                        <div className="relative">
                            <input type="text" placeholder="הוספת מתאמן..." className="w-full bg-gray-900 p-4 rounded-2xl text-white text-xs border border-white/5 outline-none focus:border-brand-primary" value={traineeSearch} onChange={(e) => setTraineeSearch(e.target.value)} />
                            {traineeSuggestions.length > 0 && (
                                <div className="absolute top-full left-0 right-0 z-[210] bg-gray-900 border border-white/10 rounded-2xl mt-1 overflow-hidden shadow-2xl">
                                    {traineeSuggestions.map(u => (
                                        <button key={u.id} className="w-full p-4 text-right hover:bg-gray-800 transition-colors flex justify-between items-center group" onClick={() => { 
                                            const phone = normalizePhone(u.phone); 
                                            if (!sessionDraft.registeredPhoneNumbers.includes(phone)) {
                                                setSessionDraft({ ...sessionDraft, registeredPhoneNumbers: [...sessionDraft.registeredPhoneNumbers, phone] }); 
                                            }
                                            setTraineeSearch(''); 
                                        }}>
                                            <span className="text-white text-sm font-bold">{u.fullName} {u.displayName ? `(${u.displayName})` : ''}</span>
                                            <span className="text-brand-primary font-black">+ הוסף</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="space-y-2">
                            {sessionDraft.registeredPhoneNumbers.map(phone => {
                                const u = props.users.find(user => normalizePhone(user.phone) === normalizePhone(phone));
                                const isAttended = (sessionDraft.attendedPhoneNumbers || []).includes(phone);
                                return (
                                    <div key={phone} className="flex justify-between items-center p-4 rounded-2xl bg-gray-900/50 border border-white/5">
                                        <div className="flex flex-col">
                                            <span className="text-white text-sm font-bold">{u ? (u.displayName || u.fullName) : phone}</span>
                                            <span className="text-[10px] text-gray-500 font-mono">{phone}</span>
                                        </div>
                                        <div className="flex gap-2 items-center">
                                            <button onClick={() => {
                                                if (!sessionDraft) return;
                                                const msg = getWhatsAppMsg(sessionDraft);
                                                window.open(`https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
                                            }} className="text-green-500 p-2 hover:bg-green-500/10 rounded-full transition-colors">
                                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                                            </button>
                                            <button onClick={() => { 
                                                if (!sessionDraft) return;
                                                const curr = sessionDraft.attendedPhoneNumbers || []; const up = isAttended ? curr.filter(p => p !== phone) : [...curr, phone]; setSessionDraft({...sessionDraft, attendedPhoneNumbers: up}); }} className={`px-4 py-2 rounded-xl text-[10px] font-black ${isAttended ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-500'}`}>{isAttended ? 'נכח' : 'לא נכח'}</button>
                                            <button onClick={() => setSessionDraft({...sessionDraft, registeredPhoneNumbers: sessionDraft.registeredPhoneNumbers.filter(p => p !== phone)})} className="text-red-500 p-2">✕</button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                      </div>
                      <div className="space-y-5">
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="text-[10px] text-gray-500 font-black mb-1 block uppercase">סוג</label><select className="w-full bg-gray-800 p-5 rounded-3xl text-white font-bold" value={sessionDraft.type} onChange={e=>setSessionDraft({...sessionDraft, type: e.target.value})}>{props.workoutTypes.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                            <div><label className="text-[10px] text-gray-500 font-black mb-1 block uppercase">מיקום</label><select className="w-full bg-gray-800 p-5 rounded-3xl text-white font-bold" value={sessionDraft.location} onChange={e=>setSessionDraft({...sessionDraft, location: e.target.value})}>{props.locations.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}</select></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="text-[10px] text-gray-500 font-black mb-1 block uppercase">תאריך</label><input type="date" className="w-full bg-gray-800 p-5 rounded-3xl text-white font-bold" value={sessionDraft.date} onChange={e=>setSessionDraft({...sessionDraft, date: e.target.value})} /></div>
                            <div><label className="text-[10px] text-gray-500 font-black mb-1 block uppercase">שעה</label><input type="time" className="w-full bg-gray-800 p-5 rounded-3xl text-white font-bold" value={sessionDraft.time} onChange={e=>setSessionDraft({...sessionDraft, time: e.target.value})} /></div>
                        </div>
                        <div><label className="text-[10px] text-gray-500 font-black mb-1 block uppercase">דגשים למתאמנים (פוש וואטסאפ)</label><textarea className="w-full bg-gray-800 p-5 rounded-3xl text-white font-bold h-24 text-sm" value={sessionDraft.description || ''} onChange={e=>setSessionDraft({...sessionDraft, description: e.target.value})} placeholder="כתוב כאן דגשים לאימון..."></textarea></div>
                        <Button onClick={() => {
                            if (!sessionDraft) return;
                            const msg = getWhatsAppMsg(sessionDraft);
                            window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
                        }} className="w-full bg-green-600 py-3 rounded-2xl text-xs flex items-center gap-2 justify-center">שלח פוש לקבוצה 📢 ✅</Button>
                        <div className="grid grid-cols-2 gap-2 p-4 bg-gray-800/20 rounded-3xl border border-white/5">
                            <div className="flex items-center gap-2">
                                <input type="checkbox" id="isPersonalDraft" className="w-6 h-6 accent-purple-500 cursor-pointer" checked={Boolean(sessionDraft.isPersonalTraining)} onChange={e=>setSessionDraft({...sessionDraft, isPersonalTraining: e.target.checked})} />
                                <label htmlFor="isPersonalDraft" className="text-purple-400 text-[10px] font-black uppercase cursor-pointer">אישי 🏆</label>
                            </div>
                            <div className="flex items-center gap-2">
                                <input type="checkbox" id="isZoomDraft" className="w-6 h-6 accent-blue-500 cursor-pointer" checked={Boolean(sessionDraft.isZoomSession)} onChange={e=>setSessionDraft({...sessionDraft, isZoomSession: e.target.checked})} />
                                <label htmlFor="isZoomDraft" className="text-blue-500 text-[10px] font-black uppercase cursor-pointer">זום 💻</label>
                            </div>
                            <div className="flex items-center gap-2">
                                <input type="checkbox" id="isCancelledDraft" className="w-6 h-6 accent-red-500 cursor-pointer" checked={Boolean(sessionDraft.isCancelled)} onChange={e=>setSessionDraft({...sessionDraft, isCancelled: e.target.checked})} />
                                <label htmlFor="isCancelledDraft" className="text-red-500 text-[10px] font-black uppercase cursor-pointer">מבוטל ❌</label>
                            </div>
                            <div className="flex items-center gap-2">
                                <input type="checkbox" id="isHappeningDraft" className="w-6 h-6 accent-brand-primary cursor-pointer" checked={Boolean(sessionDraft.manualHasStarted)} onChange={e=>setSessionDraft({...sessionDraft, manualHasStarted: e.target.checked})} />
                                <label htmlFor="isHappeningDraft" className="text-brand-primary text-[10px] font-black uppercase cursor-pointer">מתקיים ✓</label>
                            </div>
                        </div>
                      </div>
                  </div>
                  <div className="mt-12 flex gap-4">
                      <Button onClick={()=>{ 
                          const isNew = !props.sessions.find(s => s.id === sessionDraft.id);
                          const finalSession = {
                            ...sessionDraft,
                            isPersonalTraining: Boolean(sessionDraft.isPersonalTraining),
                            isZoomSession: Boolean(sessionDraft.isZoomSession),
                            isCancelled: Boolean(sessionDraft.isCancelled),
                            manualHasStarted: Boolean(sessionDraft.manualHasStarted)
                          };
                          if (isNew) props.onAddSession(finalSession); else props.onUpdateSession(finalSession); 
                          setAttendanceSession(null); 
                      }} className="flex-1 bg-red-600 py-8 rounded-[45px] text-2xl font-black italic uppercase shadow-2xl">שמור שינויים ✓</Button>
                      <Button onClick={()=>{if(confirm('מחיקת אימון?')){props.onDeleteSession(sessionDraft.id); setAttendanceSession(null);}}} variant="danger" className="px-12 rounded-[45px]">מחק 🗑️</Button>
                  </div>
              </div>
          </div>
      )}

      {editingUser && (
          <div className="fixed inset-0 bg-black/95 z-[200] flex items-center justify-center p-6 backdrop-blur-xl overflow-y-auto no-scrollbar">
              <div className="bg-gray-900 p-8 sm:p-12 rounded-[60px] w-full max-w-2xl border border-white/10 text-right shadow-3xl my-auto" dir="rtl">
                  <div className="flex justify-between mb-8 border-b border-white/5 pb-5">
                      <h3 className="text-3xl font-black text-white italic uppercase">ניהול מתאמן 👤</h3>
                      <button onClick={()=>setEditingUser(null)} className="text-gray-500 text-4xl">✕</button>
                  </div>
                  <div className="space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div><label className="text-[10px] text-gray-500 font-black mb-1 block uppercase">שם מלא</label><input className="w-full bg-gray-800 p-5 rounded-3xl text-white font-bold" value={editingUser.fullName} onChange={e=>setEditingUser({...editingUser, fullName: e.target.value})} /></div>
                        <div><label className="text-[10px] text-gray-500 font-black mb-1 block uppercase">כינוי</label><input className="w-full bg-gray-800 p-5 rounded-3xl text-white font-bold" value={editingUser.displayName || ''} onChange={e=>setEditingUser({...editingUser, displayName: e.target.value})} /></div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div><label className="text-[10px] text-gray-500 font-black mb-1 block uppercase">טלפון</label><input className="w-full bg-gray-800 p-5 rounded-3xl text-white font-bold font-mono" value={editingUser.phone} onChange={e=>setEditingUser({...editingUser, phone: e.target.value})} /></div>
                        <div><label className="text-[10px] text-gray-500 font-black mb-1 block uppercase">סטטוס תשלום</label><select className="w-full bg-gray-800 p-5 rounded-3xl text-white font-bold" value={editingUser.paymentStatus} onChange={e=>setEditingUser({...editingUser, paymentStatus: e.target.value as PaymentStatus})}>
                            <option value={PaymentStatus.PAID}>שולם ✅</option>
                            <option value={PaymentStatus.PENDING}>ממתין ⏳</option>
                            <option value={PaymentStatus.OVERDUE}>חוב ⚠️</option>
                        </select></div>
                      </div>
                      <div className="flex items-center gap-3 p-4 bg-gray-800/20 rounded-3xl border border-white/5">
                        <input type="checkbox" id="isRestrictedEdit" className="w-6 h-6 accent-red-500" checked={!!editingUser.isRestricted} onChange={e=>setEditingUser({...editingUser, isRestricted: e.target.checked})} />
                        <label htmlFor="isRestrictedEdit" className="text-red-500 font-black uppercase text-xs">חסום גישה לאתר 🚫</label>
                      </div>
                      <div className="mt-8 flex gap-4">
                        <Button onClick={()=>{ props.onUpdateUser(editingUser); setEditingUser(null); }} className="flex-1 bg-red-600 py-6 rounded-[40px] text-xl font-black italic uppercase shadow-2xl">שמור ✓</Button>
                        <Button onClick={()=>{if(confirm(`למחוק את ${editingUser.fullName}?`)){props.onDeleteUser(editingUser.id); setEditingUser(null);}}} variant="danger" className="px-8 rounded-[40px]">מחק 🗑️</Button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
