
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { User, TrainingSession, WeatherLocation, LocationDef, AppConfig, Quote, WeatherInfo, PaymentStatus } from '../types';
import { Button } from './Button';
import { SessionCard } from './SessionCard';
import { dataService } from '../services/dataService';
import { getWeatherIcon } from '../services/weatherService';

interface AdminPanelProps {
  users: User[]; sessions: TrainingSession[]; primaryColor: string; workoutTypes: string[]; locations: LocationDef[];
  weatherLocation: WeatherLocation; weatherData?: Record<string, WeatherInfo>; paymentLinks: any[];
  streakGoal: number; appConfig: AppConfig; quotes: Quote[]; deferredPrompt?: any; onInstall?: () => void;
  onAddUser: (user: User) => void; onUpdateUser: (user: User) => void; onDeleteUser: (userId: string) => void; 
  onAddSession: (session: TrainingSession) => Promise<void>; 
  onUpdateSession: (session: TrainingSession) => Promise<void>; 
  onDeleteSession: (id: string) => Promise<void>;
  onDuplicateSession?: (session: TrainingSession) => Promise<void>;
  onAddToCalendar?: (session: TrainingSession) => void;
  onColorChange: (color: string) => void; onUpdateWorkoutTypes: (types: string[]) => void; 
  onUpdateLocations: (locations: LocationDef[]) => void; onUpdateWeatherLocation: (location: WeatherLocation) => void;
  onAddPaymentLink: (link: any) => void; onDeletePaymentLink: (id: string) => void; onUpdateStreakGoal: (goal: number) => void;
  onUpdateAppConfig: (config: AppConfig) => Promise<void>; onExitAdmin: () => void;
  getStatsForUser: (user: User) => { monthly: number; record: number; streak: number };
}

export const AdminPanel: React.FC<AdminPanelProps> = (props) => {
  const [activeTab, setActiveTab] = useState<'attendance' | 'users' | 'settings'>('attendance');
  const [settingsSection, setSettingsSection] = useState<'general' | 'infrastructure' | 'quotes' | 'connections' | 'views'>('general');
  const [attendanceSession, setAttendanceSession] = useState<TrainingSession | null>(null);
  const [viewingTrainee, setViewingTrainee] = useState<User | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [isCalendarMode, setIsCalendarMode] = useState(false); // Sunday-Saturday view
  const [searchTerm, setSearchTerm] = useState('');
  const [saveIndicator, setSaveIndicator] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [userSortBy, setUserSortBy] = useState<'monthly' | 'record' | 'streak' | 'payment' | 'health'>('monthly');

  const [localAppConfig, setLocalAppConfig] = useState<AppConfig>(props.appConfig);
  const [localLocations, setLocalLocations] = useState<LocationDef[]>(props.locations);
  const [localWorkoutTypes, setLocalWorkoutTypes] = useState<string[]>(props.workoutTypes);
  const [localQuotes, setLocalQuotes] = useState<Quote[]>(props.quotes);
  const [sessionDraft, setSessionDraft] = useState<TrainingSession | null>(null);

  useEffect(() => {
    if (!isSaving) {
      setLocalAppConfig(props.appConfig);
      setLocalLocations(props.locations);
      setLocalWorkoutTypes(props.workoutTypes);
      setLocalQuotes(props.quotes);
    }
  }, [props.appConfig, props.locations, props.workoutTypes, props.quotes, isSaving]);

  useEffect(() => {
    if (attendanceSession) {
      setSessionDraft({ ...attendanceSession });
    } else setSessionDraft(null);
  }, [attendanceSession]);

  const normalizePhone = (p: string) => {
    if (!p) return '';
    let cleaned = p.replace(/\D/g, '');
    if (cleaned.startsWith('0')) cleaned = '972' + cleaned.substring(1);
    else if (!cleaned.startsWith('972')) cleaned = '972' + cleaned;
    return cleaned;
  };

  const weekDates = useMemo(() => {
    if (weekOffset === 0 && !isCalendarMode) {
      // ROLLING 7 DAYS FROM TODAY (INITIAL COACH VIEW)
      return Array.from({length: 7}, (_, i) => {
          const d = new Date(); d.setDate(d.getDate() + i);
          return d.toISOString().split('T')[0];
      });
    } else {
      // CALENDAR WEEK (SUNDAY-SATURDAY) - TRIGGERED BY BUTTONS
      const sun = new Date(); sun.setDate(sun.getDate() - sun.getDay() + (weekOffset * 7));
      return Array.from({length: 7}, (_, i) => {
          const d = new Date(sun); d.setDate(sun.getDate() + i);
          return d.toISOString().split('T')[0];
      });
    }
  }, [weekOffset, isCalendarMode]);

  const sortedUsers = useMemo(() => {
    return [...props.users]
      .filter(u => u.fullName.includes(searchTerm) || (u.displayName && u.displayName.includes(searchTerm)) || u.phone.includes(searchTerm))
      .sort((a, b) => {
        if (userSortBy === 'payment') return (a.paymentStatus || '').localeCompare(b.paymentStatus || '');
        if (userSortBy === 'health') return (a.healthDeclarationDate ? -1 : 1) - (b.healthDeclarationDate ? -1 : 1);
        const statsA = props.getStatsForUser(a);
        const statsB = props.getStatsForUser(b);
        return statsB[userSortBy as any] - statsA[userSortBy as any];
      });
  }, [props.users, searchTerm, userSortBy, props.getStatsForUser]);

  const handleSaveAllSettings = async () => {
    setSaveIndicator('שומר הגדרות...');
    setIsSaving(true);
    try {
      await Promise.all([
          props.onUpdateAppConfig(localAppConfig),
          dataService.saveLocations(localLocations),
          dataService.saveWorkoutTypes(localWorkoutTypes),
          dataService.saveQuotes(localQuotes)
      ]);
      setSaveIndicator('הכל נשמר בהצלחה ✓');
      setTimeout(() => setSaveIndicator(null), 3000);
    } catch (e) { 
      setSaveIndicator('שגיאה בשמירה ⚠️'); 
    } finally {
        setIsSaving(false);
    }
  };

  const currentModalHour = sessionDraft ? parseInt(sessionDraft.time.split(':')[0]) : 12;
  const currentModalWeather = sessionDraft ? props.weatherData?.[sessionDraft.date]?.hourly?.[sessionDraft.time.split(':')[0]] : null;
  const isNightModal = currentModalHour >= 18 || currentModalHour < 6;

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
                    {(['connections', 'quotes', 'infrastructure', 'general'] as const).map(s => (
                        <button key={s} onClick={() => setSettingsSection(s)} className={`flex-1 py-2.5 px-4 text-[11px] font-black uppercase rounded-xl transition-all whitespace-nowrap ${settingsSection === s ? 'bg-gray-800 text-white' : 'text-gray-600'}`}>
                            {s === 'general' ? 'כללי' : s === 'infrastructure' ? 'מיקומים/סוגים' : s === 'quotes' ? 'ציטוטים' : 'חיבורים'}
                        </button>
                    ))}
                </div>
            )}
        </div>
      </div>

      <div className="p-4 max-w-4xl mx-auto pt-[200px] sm:pt-[240px] space-y-6 pb-24" dir="rtl">
        {activeTab === 'attendance' && (
          <div className="space-y-6">
             <div className="flex flex-col gap-4 bg-gray-800/40 p-5 rounded-3xl border border-white/5 shadow-xl">
                <div className="flex justify-between items-center">
                    <button onClick={()=>{setWeekOffset(p=>p-1); setIsCalendarMode(true);}} className="text-white text-2xl p-2 hover:text-red-500 transition-colors">←</button>
                    <div className="flex flex-col items-center">
                        <div className="flex gap-2 mb-2">
                           <button onClick={()=>{setIsCalendarMode(false); setWeekOffset(0);}} className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase transition-all ${!isCalendarMode && weekOffset === 0 ? 'bg-red-600 text-white shadow-lg' : 'bg-gray-900 text-gray-500'}`}>7 ימים</button>
                           <button onClick={()=>{setIsCalendarMode(true); setWeekOffset(0);}} className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase transition-all ${isCalendarMode && weekOffset === 0 ? 'bg-red-600 text-white shadow-lg' : 'bg-gray-900 text-gray-500'}`}>השבוע</button>
                        </div>
                        <span className="text-red-500 font-black uppercase tracking-[0.3em] bg-red-500/10 px-4 py-1 rounded-full text-xs">
                           {isCalendarMode ? `שבוע ${weekOffset === 0 ? 'נוכחי' : weekOffset > 0 ? '+' + weekOffset : weekOffset}` : 'לו"ז קרוב (Rolling)'}
                        </span>
                    </div>
                    <button onClick={()=>{setWeekOffset(p=>p+1); setIsCalendarMode(true);}} className="text-white text-2xl p-2 hover:text-red-500 transition-colors">→</button>
                </div>
             </div>
             <div className="grid grid-cols-1">
                <Button onClick={() => setAttendanceSession({ id: Date.now().toString(), type: props.workoutTypes[0], date: new Date().toISOString().split('T')[0], time: '18:00', location: props.locations[0]?.name || '', maxCapacity: 15, registeredPhoneNumbers: [], attendedPhoneNumbers: [], description: '', isPersonalTraining: false, isZoomSession: false, isCancelled: false, manualHasStarted: null })} className="py-7 rounded-[45px] bg-red-600 text-xl font-black italic shadow-2xl tracking-tighter uppercase">+ אימון חדש</Button>
             </div>
             <div className="space-y-12">
              {weekDates.map(date => {
                  let daySessions = props.sessions.filter(s => s.date === date).sort((a,b)=>a.time.localeCompare(b.time));
                  if (daySessions.length === 0) return null;
                  return (
                      <div key={date}>
                          <div className="flex justify-between items-end border-b border-white/5 pb-2 mb-4">
                              <h4 className="text-gray-500 font-black text-4xl uppercase tracking-widest">{new Date(date).toLocaleDateString('he-IL', { weekday: 'long' })}</h4>
                              <p className="text-gray-500 font-black text-4xl opacity-30">{new Date(date).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' })}</p>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {daySessions.map(s => <SessionCard key={s.id} session={s} allUsers={props.users} isRegistered={false} onRegisterClick={()=>{}} onViewDetails={(sid) => setAttendanceSession(props.sessions.find(x => x.id === sid) || null)} isAdmin={true} locations={props.locations} weather={props.weatherData?.[s.date]} />)}
                          </div>
                      </div>
                  );
              })}
             </div>
          </div>
        )}

        {activeTab === 'users' && (
            <div className="space-y-6">
                <input type="text" placeholder="חיפוש מתאמן..." className="w-full bg-gray-800 border border-white/10 p-6 rounded-[30px] text-white outline-none focus:border-red-500 transition-all shadow-xl" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
                <div className="flex gap-2 overflow-x-auto no-scrollbar py-2">
                    {[
                        {id: 'monthly', label: 'החודש'},
                        {id: 'record', label: 'שיא'},
                        {id: 'streak', label: 'רצף'},
                        {id: 'payment', label: 'תשלום'},
                        {id: 'health', label: 'הצהרה'}
                    ].map(opt => (
                        <button key={opt.id} onClick={() => setUserSortBy(opt.id as any)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase whitespace-nowrap border transition-all ${userSortBy === opt.id ? 'bg-red-600 text-white border-red-600 shadow-md shadow-red-600/20' : 'bg-gray-900 text-gray-500 border-white/5'}`}>
                            {opt.label}
                        </button>
                    ))}
                </div>
                <div className="grid gap-4">
                    {sortedUsers.map(u => {
                       const traineeStats = props.getStatsForUser(u);
                       return (
                       <div key={u.id} onClick={() => setViewingTrainee(u)} className="bg-gray-800/40 p-6 rounded-[40px] border border-white/5 flex flex-col sm:flex-row justify-between sm:items-center gap-6 shadow-2xl hover:border-red-500/50 cursor-pointer transition-all">
                          <div className="flex items-center gap-6">
                             <div className="w-16 h-16 rounded-full bg-gray-900 border-2 flex items-center justify-center font-black text-2xl" style={{ borderColor: (u.userColor || '#A3E635') + '40', color: u.userColor || '#A3E635' }}>{u.fullName.charAt(0)}</div>
                             <div>
                                <h3 className="text-white font-black text-xl italic">{u.displayName || u.fullName}</h3>
                                <p className="text-xs text-gray-500 font-mono tracking-tighter">{u.phone}</p>
                                <div className="flex gap-2 mt-2">
                                    <span className={`text-[8px] font-black px-2 py-0.5 rounded-full ${u.healthDeclarationDate ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>{u.healthDeclarationDate ? `חתום: ${u.healthDeclarationDate}` : 'חסר חתימה ⚠️'}</span>
                                    <span className={`text-[8px] font-black px-2 py-0.5 rounded-full ${u.paymentStatus === PaymentStatus.PAID ? 'bg-green-500/10 text-green-500' : 'bg-orange-500/10 text-orange-500'}`}>{u.paymentStatus === PaymentStatus.PAID ? 'שולם' : 'ממתין'}</span>
                                </div>
                             </div>
                          </div>
                          <div className="flex gap-4 sm:justify-end">
                             <div className="bg-gray-900/50 p-2 rounded-xl text-center min-w-[55px] border border-white/5">
                                <p className="text-[7px] text-gray-500 font-black uppercase">חודש</p>
                                <p className="text-lg font-black text-brand-primary">{traineeStats.monthly}</p>
                             </div>
                             <div className="bg-gray-900/50 p-2 rounded-xl text-center min-w-[55px] border border-white/5">
                                <p className="text-[7px] text-gray-500 font-black uppercase">שיא</p>
                                <p className="text-lg font-black text-white">{traineeStats.record}</p>
                             </div>
                             <div className="bg-gray-900/50 p-2 rounded-xl text-center min-w-[55px] border border-white/5">
                                <p className="text-[7px] text-gray-500 font-black uppercase">רצף</p>
                                <p className="text-lg font-black text-orange-400">{traineeStats.streak}</p>
                             </div>
                          </div>
                       </div>
                       );
                    })}
                </div>
            </div>
        )}

        {activeTab === 'settings' && (
            <div className="space-y-10 mt-6">
                {settingsSection === 'general' && (
                    <div className="bg-gray-800/40 p-8 rounded-[50px] border border-white/5 space-y-8 shadow-2xl">
                        <h3 className="text-white font-black uppercase italic tracking-widest border-b border-white/10 pb-4">מידע כללי</h3>
                        <div className="space-y-3">
                            <label className="text-[10px] text-red-500 font-black uppercase block">הודעה דחופה באתר</label>
                            <input className="w-full bg-red-900/10 border border-red-500/30 p-6 rounded-[30px] text-white font-black italic outline-none" value={localAppConfig.urgentMessage || ''} onChange={e => setLocalAppConfig({...localAppConfig, urgentMessage: e.target.value})} placeholder="כתוב כאן הודעה דחופה..." />
                        </div>
                        <div className="space-y-3">
                            <label className="text-[10px] text-brand-primary font-black uppercase block">טקסט אודות (ביוגרפיה)</label>
                            <textarea className="w-full bg-gray-800 border border-white/10 p-6 rounded-[30px] text-white font-bold h-48 italic leading-relaxed focus:border-brand-primary transition-all outline-none" value={localAppConfig.coachBio || ''} onChange={e => setLocalAppConfig({...localAppConfig, coachBio: e.target.value})} />
                        </div>
                        <div className="space-y-3 border-t border-white/5 pt-8">
                            <label className="text-[10px] text-purple-400 font-black uppercase block italic">נוסח הצהרת בריאות לחתום 🖋️</label>
                            <textarea className="w-full bg-gray-800 border border-white/10 p-6 rounded-[30px] text-white font-bold h-64 italic leading-relaxed focus:border-purple-500 transition-all outline-none text-sm" value={localAppConfig.healthDeclarationTemplate || ''} onChange={e => setLocalAppConfig({...localAppConfig, healthDeclarationTemplate: e.target.value})} placeholder="הכנס כאן את הטקסט המשפטי של הצהרת הבריאות..." />
                        </div>
                    </div>
                )}

                {settingsSection === 'infrastructure' && (
                    <div className="bg-gray-800/40 p-8 rounded-[50px] border border-white/5 space-y-12 shadow-2xl">
                        <div className="space-y-8">
                            <h3 className="text-white font-black uppercase italic tracking-widest border-b border-white/10 pb-4">ניהול מיקומים 📍</h3>
                            {localLocations.map((loc, idx) => (
                                <div key={loc.id} className="p-6 bg-gray-900/60 rounded-[35px] border border-white/5 space-y-4 shadow-inner">
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-500 font-black text-[10px] uppercase">מיקום #{idx + 1}</span>
                                        <button onClick={() => setLocalLocations(localLocations.filter(l => l.id !== loc.id))} className="text-red-500 text-[10px] font-black hover:underline">מחק ✕</button>
                                    </div>
                                    <div className="grid grid-cols-1 gap-4">
                                        <input className="bg-gray-800 border border-white/5 p-4 rounded-2xl text-white font-bold outline-none focus:border-brand-primary" value={loc.name} placeholder="שם המקום" onChange={e => {
                                            const newLocs = [...localLocations];
                                            newLocs[idx].name = e.target.value;
                                            setLocalLocations(newLocs);
                                        }} />
                                        <input className="bg-gray-800 border border-white/5 p-4 rounded-2xl text-white text-xs font-bold outline-none focus:border-brand-primary" value={loc.address || ''} placeholder="כתובת Waze מלאה" onChange={e => {
                                            const newLocs = [...localLocations];
                                            newLocs[idx].address = e.target.value;
                                            setLocalLocations(newLocs);
                                        }} />
                                    </div>
                                </div>
                            ))}
                            <Button onClick={() => setLocalLocations([...localLocations, {id: Date.now().toString(), name: '', address: ''}])} variant="outline" className="w-full rounded-[30px] border-dashed py-4 uppercase text-xs">+ הוסף מיקום חדש</Button>
                        </div>

                        <div className="space-y-8 border-t border-white/5 pt-12">
                            <h3 className="text-white font-black uppercase italic tracking-widest border-b border-white/10 pb-4">סוגי אימונים 👟</h3>
                            <div className="grid grid-cols-2 gap-3">
                                {localWorkoutTypes.map((type, idx) => (
                                    <div key={idx} className="flex gap-2 bg-gray-900/60 p-4 rounded-[25px] border border-white/5 items-center shadow-sm">
                                        <input className="flex-1 bg-transparent text-white font-black italic outline-none" value={type} onChange={e => {
                                            const newTypes = [...localWorkoutTypes];
                                            newTypes[idx] = e.target.value;
                                            setLocalWorkoutTypes(newTypes);
                                        }} />
                                        <button onClick={() => setLocalWorkoutTypes(localWorkoutTypes.filter((_, i) => i !== idx))} className="text-red-500 p-1">✕</button>
                                    </div>
                                ))}
                            </div>
                            <Button onClick={() => setLocalWorkoutTypes([...localWorkoutTypes, 'סוג אימון חדש'])} variant="outline" className="w-full rounded-[30px] border-dashed py-4 uppercase text-xs">+ הוסף סוג אימון</Button>
                        </div>
                    </div>
                )}

                {settingsSection === 'quotes' && (
                    <div className="bg-gray-800/40 p-8 rounded-[50px] border border-white/5 space-y-8 shadow-2xl">
                        <h3 className="text-white font-black uppercase italic tracking-widest border-b border-white/10 pb-4">משפטי מוטיבציה 💪</h3>
                        <div className="space-y-4">
                            {localQuotes.map((q, idx) => (
                                <div key={q.id} className="flex gap-2 bg-gray-900/40 p-4 rounded-[25px] border border-white/5 shadow-inner">
                                    <input className="flex-1 bg-transparent text-white font-bold italic outline-none" value={q.text} onChange={e => {
                                        const newQuotes = [...localQuotes];
                                        newQuotes[idx].text = e.target.value;
                                        setLocalQuotes(newQuotes);
                                    }} />
                                    <button onClick={() => setLocalQuotes(localQuotes.filter(item => item.id !== q.id))} className="text-red-500 px-2 font-black">✕</button>
                                </div>
                            ))}
                            <Button onClick={() => setLocalQuotes([...localQuotes, {id: Date.now().toString(), text: ''}])} variant="outline" className="w-full rounded-2xl border-dashed py-4 uppercase text-xs tracking-widest">+ הוסף משפט חדש</Button>
                        </div>
                    </div>
                )}

                {settingsSection === 'connections' && (
                    <div className="bg-gray-800/40 p-8 rounded-[50px] border border-white/5 space-y-8 shadow-2xl">
                        <h3 className="text-white font-black uppercase italic tracking-widest border-b border-white/10 pb-4">חיבורים וניהול</h3>
                        <div className="space-y-6">
                            <div className="p-6 bg-gray-900/60 rounded-[35px] border border-white/5 shadow-inner">
                                <label className="text-[10px] text-gray-500 font-black mb-2 block uppercase">סיסמת ניהול (Admin Password)</label>
                                <input className="w-full bg-gray-800 p-4 rounded-2xl text-white font-mono text-xs border border-white/10 outline-none focus:border-brand-primary" value={localAppConfig.coachAdditionalPhone || ''} onChange={e => setLocalAppConfig({...localAppConfig, coachAdditionalPhone: e.target.value})} />
                                <p className="text-[8px] text-gray-600 mt-2 font-black italic">המילה שתשמש כסיסמת הכניסה לממשק המאמן.</p>
                            </div>
                        </div>
                    </div>
                )}
                
                <div className="sticky bottom-4 z-[60] bg-brand-black/80 backdrop-blur-xl p-4 rounded-[40px] border border-white/10 shadow-3xl flex flex-col items-center gap-2">
                    {saveIndicator && <p className="text-xs font-black uppercase tracking-widest text-brand-primary animate-pulse">{saveIndicator}</p>}
                    <Button onClick={handleSaveAllSettings} className="w-full py-6 rounded-[40px] text-xl font-black italic bg-red-600 shadow-xl tracking-tighter" isLoading={isSaving}>שמירת הגדרות ושינויים ✅</Button>
                    <Button onClick={props.onExitAdmin} variant="outline" className="w-full py-4 rounded-[40px] font-black text-sm uppercase opacity-60 italic">חזרה ללו"ז הכללי</Button>
                </div>
            </div>
        )}
      </div>

      {attendanceSession && sessionDraft && (
          <div className="fixed inset-0 bg-black/95 z-[200] flex items-center justify-center p-6 backdrop-blur-xl overflow-y-auto no-scrollbar">
              <div className="bg-gray-900 p-8 sm:p-12 rounded-[60px] w-full max-w-4xl border border-white/10 text-right shadow-3xl" dir="rtl">
                  <div className="flex justify-between mb-8 border-b border-white/5 pb-5 items-center">
                      <div className="flex items-center gap-4">
                          <h3 className="text-3xl font-black text-white italic uppercase tracking-tighter">ניהול אימון ⚙️</h3>
                          {currentModalWeather && <span className="text-brand-primary font-black bg-brand-primary/10 px-3 py-1 rounded-full text-[10px] uppercase">{Math.round(currentModalWeather.temp)}° {getWeatherIcon(currentModalWeather.weatherCode, isNightModal)}</span>}
                      </div>
                      <button onClick={()=>setAttendanceSession(null)} className="text-gray-500 text-4xl hover:text-white transition-colors">✕</button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                      <div className="bg-gray-800/40 p-6 rounded-[35px] max-h-[500px] overflow-y-auto border border-white/5 space-y-4 shadow-inner no-scrollbar">
                        <p className="text-gray-500 text-[10px] font-black uppercase mb-4 italic tracking-widest">רשימת נוכחות ({sessionDraft.registeredPhoneNumbers.length})</p>
                        <div className="space-y-2">
                            {sessionDraft.registeredPhoneNumbers.map(phone => {
                                const user = props.users.find(u => normalizePhone(u.phone) === normalizePhone(phone));
                                return (
                                <div key={phone} className="flex justify-between items-center p-4 rounded-2xl bg-gray-900/50 border border-white/5 hover:border-brand-primary/30 transition-all">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center font-black text-[10px]" style={{color: user?.userColor || 'white'}}>{user?.fullName.charAt(0) || '?'}</div>
                                        <span className="text-white text-sm font-bold italic">{user?.fullName || phone}</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => {
                                            const curr = sessionDraft.attendedPhoneNumbers || [];
                                            const up = curr.includes(phone) ? curr.filter(p => p !== phone) : [...curr, phone];
                                            setSessionDraft({...sessionDraft, attendedPhoneNumbers: up});
                                        }} className={`px-4 py-2 rounded-xl text-[10px] font-black italic uppercase transition-all ${sessionDraft.attendedPhoneNumbers?.includes(phone) ? 'bg-brand-primary text-black' : 'bg-gray-800 text-gray-500 hover:bg-gray-700'}`}>
                                            {sessionDraft.attendedPhoneNumbers?.includes(phone) ? 'נכח ✓' : 'לא סומן'}
                                        </button>
                                        <button onClick={() => { if(confirm('לבטל רישום?')) setSessionDraft({...sessionDraft, registeredPhoneNumbers: sessionDraft.registeredPhoneNumbers.filter(p => p !== phone)}) }} className="text-red-500 p-2 hover:bg-red-500/10 rounded-lg">✕</button>
                                    </div>
                                </div>
                            )})}
                            {sessionDraft.registeredPhoneNumbers.length === 0 && <p className="text-gray-600 text-xs text-center py-10 italic">אין נרשמים לאימון זה עדיין.</p>}
                        </div>
                      </div>
                      <div className="space-y-5">
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="text-[10px] text-gray-500 font-black mb-1 block uppercase italic">סוג אימון</label><select className="w-full bg-gray-800 p-5 rounded-3xl text-white font-bold outline-none border border-white/5 focus:border-brand-primary transition-all" value={sessionDraft.type} onChange={e=>setSessionDraft({...sessionDraft, type: e.target.value})}>{props.workoutTypes.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                            <div><label className="text-[10px] text-gray-500 font-black mb-1 block uppercase italic">מיקום</label><select className="w-full bg-gray-800 p-5 rounded-3xl text-white font-bold outline-none border border-white/5 focus:border-brand-primary transition-all" value={sessionDraft.location} onChange={e=>setSessionDraft({...sessionDraft, location: e.target.value})}>{props.locations.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}</select></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="text-[10px] text-gray-500 font-black mb-1 block uppercase italic">תאריך</label><input type="date" className="w-full bg-gray-800 p-5 rounded-3xl text-white font-bold outline-none border border-white/5" value={sessionDraft.date} onChange={e=>setSessionDraft({...sessionDraft, date: e.target.value})} /></div>
                            <div><label className="text-[10px] text-gray-500 font-black mb-1 block uppercase italic">שעה</label><input type="time" className="w-full bg-gray-800 p-5 rounded-3xl text-white font-bold outline-none border border-white/5" value={sessionDraft.time} onChange={e=>setSessionDraft({...sessionDraft, time: e.target.value})} /></div>
                        </div>
                        <div className="space-y-4 pt-4 border-t border-white/5">
                            <div className="flex items-center gap-4 bg-gray-800/20 p-4 rounded-3xl border border-white/5 hover:border-blue-500/30 transition-all cursor-pointer" onClick={()=>setSessionDraft({...sessionDraft, isZoomSession: !sessionDraft.isZoomSession})}>
                                <input type="checkbox" id="isZoomDraft" className="w-6 h-6 accent-blue-500" checked={!!sessionDraft.isZoomSession} readOnly />
                                <label htmlFor="isZoomDraft" className="text-blue-400 text-xs font-black uppercase italic tracking-widest cursor-pointer">אימון זום 📹</label>
                            </div>
                            <div className="flex items-center gap-4 bg-gray-800/20 p-4 rounded-3xl border border-white/5 hover:border-red-500/30 transition-all cursor-pointer" onClick={()=>setSessionDraft({...sessionDraft, isCancelled: !sessionDraft.isCancelled})}>
                                <input type="checkbox" id="isCancelledDraft" className="w-6 h-6 accent-red-500" checked={!!sessionDraft.isCancelled} readOnly />
                                <label htmlFor="isCancelledDraft" className="text-red-500 text-xs font-black uppercase italic tracking-widest cursor-pointer">אימון מבוטל ❌</label>
                            </div>
                            <div className="space-y-2 bg-gray-900/40 p-4 rounded-3xl border border-white/5">
                                <label className="text-[10px] text-gray-500 font-black uppercase block italic mb-2">סטטוס תצוגה ידני (Override)</label>
                                <div className="flex gap-2">
                                    <button onClick={() => setSessionDraft({...sessionDraft, manualHasStarted: null})} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase italic transition-all ${sessionDraft.manualHasStarted === null ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-800 text-gray-500'}`}>אוטומטי (3ש')</button>
                                    <button onClick={() => setSessionDraft({...sessionDraft, manualHasStarted: true})} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase italic transition-all ${sessionDraft.manualHasStarted === true ? 'bg-brand-primary text-black shadow-lg' : 'bg-gray-800 text-gray-500'}`}>פעיל ✓</button>
                                    <button onClick={() => setSessionDraft({...sessionDraft, manualHasStarted: false})} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase italic transition-all ${sessionDraft.manualHasStarted === false ? 'bg-red-600 text-white shadow-lg' : 'bg-gray-800 text-gray-500'}`}>מושבת ✗</button>
                                </div>
                            </div>
                        </div>
                      </div>
                  </div>
                  <div className="mt-12">
                      <Button onClick={async ()=>{ 
                          if (!sessionDraft || isSaving) return;
                          setIsSaving(true);
                          try { await props.onUpdateSession(sessionDraft); setSaveSuccess(true); setTimeout(() => { setAttendanceSession(null); setSaveSuccess(false); }, 800); } finally { setIsSaving(false); }
                      }} className={`w-full py-8 rounded-[45px] text-2xl font-black italic shadow-2xl tracking-tighter ${saveSuccess ? 'bg-green-600' : 'bg-red-600'}`} isLoading={isSaving}>{saveSuccess ? 'נשמר בהצלחה! ✓' : 'שמור שינויים ✓'}</Button>
                  </div>
              </div>
          </div>
      )}

      {viewingTrainee && (
          <div className="fixed inset-0 bg-black/95 z-[500] flex items-center justify-center p-6 backdrop-blur-3xl overflow-y-auto no-scrollbar">
              <div className="bg-gray-900 p-8 sm:p-12 rounded-[60px] w-full max-w-2xl border border-white/10 shadow-3xl text-right" dir="rtl">
                  <div className="flex justify-between items-center mb-10 border-b border-white/5 pb-6">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center font-black text-2xl border-2" style={{borderColor: viewingTrainee.userColor || 'white', color: viewingTrainee.userColor || 'white'}}>{viewingTrainee.fullName.charAt(0)}</div>
                        <h3 className="text-3xl font-black text-white italic uppercase tracking-tighter">פרופיל מתאמן</h3>
                      </div>
                      <button onClick={()=>setViewingTrainee(null)} className="text-gray-500 text-4xl">✕</button>
                  </div>
                  <div className="space-y-10">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[9px] text-gray-500 font-black uppercase italic">סטטוס תשלום</label>
                            <select className="w-full bg-gray-800 p-4 rounded-2xl text-white font-bold outline-none border border-white/5 focus:border-brand-primary" value={viewingTrainee.paymentStatus} onChange={e => props.onUpdateUser({...viewingTrainee, paymentStatus: e.target.value as PaymentStatus})}>
                                <option value={PaymentStatus.PAID}>שולם / מנוי פעיל</option>
                                <option value={PaymentStatus.PENDING}>ממתין לתשלום</option>
                                <option value={PaymentStatus.OVERDUE}>באיחור / לא פעיל</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[9px] text-gray-500 font-black uppercase italic">מחיקת משתמש</label>
                            <Button variant="danger" className="w-full py-4 rounded-2xl text-xs font-black" onClick={() => { if(confirm('למחוק מתאמן? הפעולה לא ניתנת לביטול.')) { props.onDeleteUser(viewingTrainee.id); setViewingTrainee(null); } }}>מחק לצמיתות 🗑️</Button>
                        </div>
                      </div>
                      
                      <div className="bg-gray-800/20 p-6 rounded-[35px] border border-white/5 space-y-4">
                         <div className="flex justify-between items-center border-b border-white/5 pb-3">
                            <span className="text-gray-500 text-xs font-black uppercase italic">הצהרת בריאות</span>
                            <span className={`text-[10px] font-black px-3 py-1 rounded-full ${viewingTrainee.healthDeclarationDate ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                                {viewingTrainee.healthDeclarationDate ? 'חתום ✓' : 'לא חתום ⚠️'}
                            </span>
                         </div>
                         {viewingTrainee.healthDeclarationDate && (
                             <div className="space-y-2">
                                <p className="text-white text-sm font-bold">תאריך חתימה: {viewingTrainee.healthDeclarationDate}</p>
                                <p className="text-white text-sm font-bold">מספר זהות: {viewingTrainee.healthDeclarationId || 'לא צוין'}</p>
                             </div>
                         )}
                      </div>

                      <div className="grid grid-cols-3 gap-4 border-t border-white/5 pt-8">
                         <div className="text-center p-4 bg-gray-900/40 rounded-3xl border border-white/5">
                            <p className="text-[8px] text-gray-500 font-black uppercase">החודש</p>
                            <p className="text-2xl font-black text-brand-primary">{props.getStatsForUser(viewingTrainee).monthly}</p>
                         </div>
                         <div className="text-center p-4 bg-gray-900/40 rounded-3xl border border-white/5">
                            <p className="text-[8px] text-gray-500 font-black uppercase">שיא</p>
                            <p className="text-2xl font-black text-white">{props.getStatsForUser(viewingTrainee).record}</p>
                         </div>
                         <div className="text-center p-4 bg-gray-900/40 rounded-3xl border border-white/5">
                            <p className="text-[8px] text-gray-500 font-black uppercase">רצף</p>
                            <p className="text-2xl font-black text-orange-400">{props.getStatsForUser(viewingTrainee).streak}</p>
                         </div>
                      </div>

                      <Button onClick={()=>setViewingTrainee(null)} className="w-full rounded-[30px] py-6 font-black italic uppercase tracking-widest bg-gray-800 text-white hover:bg-gray-700">סגור חלון עריכה</Button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
