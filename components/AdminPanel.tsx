
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { User, TrainingSession, WeatherLocation, LocationDef, AppConfig, Quote, WeatherInfo, PaymentStatus } from '../types';
import { Button } from './Button';
import { SessionCard } from './SessionCard';
import { dataService } from '../services/dataService';
import { getWeatherIcon } from '../services/weatherService';

const normalizePhone = (phone: string): string => {
    if (!phone) return '';
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('972')) cleaned = '972' + cleaned.substring(3);
    else if (cleaned.startsWith('0')) cleaned = '972' + cleaned.substring(1);
    else if (!cleaned.startsWith('972')) cleaned = '972' + cleaned;
    return cleaned;
};

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

const PRESET_COLORS = ['#A3E635', '#3B82F6', '#A855F7', '#F97316', '#06B6D4', '#EC4899'];

export const AdminPanel: React.FC<AdminPanelProps> = (props) => {
  const [activeTab, setActiveTab] = useState<'attendance' | 'users' | 'settings'>('attendance');
  const [settingsSection, setSettingsSection] = useState<'general' | 'infrastructure' | 'quotes' | 'connections' | 'views'>('general');
  const [attendanceSession, setAttendanceSession] = useState<TrainingSession | null>(null);
  const [viewingTrainee, setViewingTrainee] = useState<User | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [isCalendarMode, setIsCalendarMode] = useState(false); 
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

  const weekDates = useMemo(() => {
    if (weekOffset === 0 && !isCalendarMode) {
      return Array.from({length: 7}, (_, i) => {
          const d = new Date(); d.setDate(d.getDate() + i);
          return d.toISOString().split('T')[0];
      });
    } else {
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
    setSaveIndicator('מתחיל שמירה...');
    setIsSaving(true);
    let failures: string[] = [];
    
    try {
        try {
            await props.onUpdateAppConfig(localAppConfig);
        } catch (e: any) {
            console.error("Config save failed:", e);
            failures.push("הגדרות כלליות (ייתכן טקסט ארוך מדי)");
        }

        try {
            await dataService.saveLocations(localLocations);
        } catch (e) {
            console.error("Locations save failed:", e);
            failures.push("מיקומים");
        }

        try {
            await dataService.saveWorkoutTypes(localWorkoutTypes);
        } catch (e) {
            console.error("Workout types save failed:", e);
            failures.push("סוגי אימונים");
        }

        try {
            await dataService.saveQuotes(localQuotes);
        } catch (e) {
            console.error("Quotes save failed:", e);
            failures.push("ציטוטים");
        }

        if (failures.length === 0) {
            setSaveIndicator('כל הנתונים נשמרו בהצלחה! ✓');
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 2000);
        } else {
            setSaveIndicator(`שגיאה ב: ${failures.join(', ')} ⚠️`);
        }
        
        setTimeout(() => setSaveIndicator(null), 5000);
    } catch (e) {
        setSaveIndicator('שגיאה חריגה בתהליך השמירה ❌');
        setTimeout(() => setSaveIndicator(null), 5000);
    } finally {
        setIsSaving(false);
    }
  };

  const currentModalHour = sessionDraft ? parseInt(sessionDraft.time.split(':')[0]) : 12;
  const currentModalWeather = sessionDraft ? props.weatherData?.[sessionDraft.date]?.hourly?.[sessionDraft.time.split(':')[0]] : null;
  const isNightModal = currentModalHour >= 18 || currentModalHour < 6;

  const handleSendWhatsAppHighlights = (phone: string, traineeName: string) => {
      if (!sessionDraft) return;
      const dateStr = new Date(sessionDraft.date).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });
      const dayName = new Date(sessionDraft.date).toLocaleDateString('he-IL', { weekday: 'long' });
      const highlights = sessionDraft.description || 'אין דגשים מיוחדים';
      
      const message = `היי ${traineeName}, רציתי לעדכן אותך בדגשים לאימון ${sessionDraft.type} ביום ${dayName} ה-${dateStr} בשעה ${sessionDraft.time}:\n\n*דגשים מהמאמן:* ${highlights}\n\nנתראה שם! 💪`;
      
      const url = `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank');
  };

  const handleDeleteCurrentSession = async () => {
      if (!sessionDraft) return;
      if (!confirm('האם אתה בטוח שברצונך למחוק את האימון לצמיתות?')) return;
      
      setIsSaving(true);
      try {
          await props.onDeleteSession(sessionDraft.id);
          setAttendanceSession(null);
      } catch (e) {
          alert('חלה שגיאה במחיקת האימון');
      } finally {
          setIsSaving(false);
      }
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
                    <button onClick={()=>{setWeekOffset(p=>p-1); setIsCalendarMode(true);}} className="text-white text-2xl p-2 transition-colors">←</button>
                    <div className="flex flex-col items-center">
                        <div className="flex gap-2 mb-2">
                           <button onClick={()=>{setIsCalendarMode(false); setWeekOffset(0);}} className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase transition-all ${!isCalendarMode && weekOffset === 0 ? 'bg-red-600 text-white shadow-lg' : 'bg-gray-900 text-gray-500'}`}>7 ימים</button>
                           <button onClick={()=>{setIsCalendarMode(true); setWeekOffset(0);}} className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase transition-all ${isCalendarMode && weekOffset === 0 ? 'bg-red-600 text-white shadow-lg' : 'bg-gray-900 text-gray-500'}`}>השבוע</button>
                        </div>
                        <span className="text-red-500 font-black uppercase tracking-[0.3em] bg-red-500/10 px-4 py-1 rounded-full text-xs">
                           {isCalendarMode ? `שבוע ${weekOffset === 0 ? 'נוכחי' : weekOffset > 0 ? '+' + weekOffset : weekOffset}` : 'לו"ז קרוב'}
                        </span>
                    </div>
                    <button onClick={()=>{setWeekOffset(p=>p+1); setIsCalendarMode(true);}} className="text-white text-2xl p-2 transition-colors">→</button>
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
                          <div className="flex justify-between items-end border-b border-white/5 pb-2 mb-4 px-2">
                              <h4 className="text-gray-500 font-black text-4xl uppercase tracking-widest">{new Date(date).toLocaleDateString('he-IL', { weekday: 'long' })}</h4>
                              <p className="text-gray-500 font-black text-4xl opacity-30">{new Date(date).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' })}</p>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-2">
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
                <input type="text" placeholder="חיפוש מתאמן..." className="w-full bg-gray-800 border border-white/10 p-6 rounded-[30px] text-white outline-none focus:border-red-500 shadow-xl" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
                <div className="flex gap-2 overflow-x-auto no-scrollbar py-2">
                    {[
                        {id: 'monthly', label: 'החודש'},
                        {id: 'record', label: 'שיא'},
                        {id: 'streak', label: 'רצף'},
                        {id: 'payment', label: 'תשלום'},
                        {id: 'health', label: 'הצהרה'}
                    ].map(opt => (
                        <button key={opt.id} onClick={() => setUserSortBy(opt.id as any)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase whitespace-nowrap border transition-all ${userSortBy === opt.id ? 'bg-red-600 text-white border-red-600' : 'bg-gray-900 text-gray-500 border-white/5'}`}>
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
                        <h3 className="text-white font-black uppercase italic tracking-widest border-b border-white/10 pb-4">מידע כללי 🏋️</h3>
                        <div className="space-y-3">
                            <label className="text-[10px] text-red-500 font-black uppercase block italic">הודעה דחופה באתר (יופיע בראש הלו"ז)</label>
                            <input className="w-full bg-red-900/10 border border-red-500/30 p-6 rounded-[30px] text-white font-black italic outline-none" value={localAppConfig.urgentMessage || ''} onChange={e => setLocalAppConfig({...localAppConfig, urgentMessage: e.target.value})} placeholder="כתוב כאן הודעה דחופה שתוצג למתאמנים..." />
                        </div>
                        <div className="space-y-3">
                            <label className="text-[10px] text-brand-primary font-black uppercase block italic">טקסט אודות (ביוגרפיה)</label>
                            <textarea className="w-full bg-gray-800 border border-white/10 p-6 rounded-[30px] text-white font-bold h-48 italic leading-relaxed focus:border-brand-primary outline-none" value={localAppConfig.coachBio || ''} onChange={e => setLocalAppConfig({...localAppConfig, coachBio: e.target.value})} />
                        </div>
                        <div className="space-y-3 border-t border-white/5 pt-8">
                            <label className="text-[10px] text-purple-400 font-black uppercase block italic">נוסח הצהרת בריאות לחתום 🖋️</label>
                            <p className="text-[8px] text-gray-500 mb-2 italic">זהו הנוסח שיופיע למתאמנים בעת חתימה על ההצהרה.</p>
                            <textarea 
                                className="w-full bg-gray-900/60 border border-purple-500/20 p-6 rounded-[30px] text-white font-bold h-64 italic leading-relaxed focus:border-purple-500 transition-all outline-none text-sm shadow-inner" 
                                value={localAppConfig.healthDeclarationTemplate || ''} 
                                onChange={e => setLocalAppConfig({...localAppConfig, healthDeclarationTemplate: e.target.value})} 
                                placeholder="הכנס כאן את הטקסט המשפטי של הצהרת הבריאות..." 
                            />
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
                                        <button onClick={() => setLocalLocations(localLocations.filter(l => l.id !== loc.id))} className="text-red-500 text-[10px] font-black">מחק ✕</button>
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
                                    <div key={idx} className="flex gap-2 bg-gray-900/60 p-4 rounded-[25px] border border-white/5 items-center">
                                        <input className="flex-1 bg-transparent text-white font-black italic outline-none" value={type} onChange={e => {
                                            const newTypes = [...localWorkoutTypes];
                                            newTypes[idx] = e.target.value;
                                            setLocalWorkoutTypes(newTypes);
                                        }} />
                                        <button onClick={() => setLocalWorkoutTypes(localWorkoutTypes.filter((_, i) => i !== idx))} className="text-red-500 p-1">✕</button>
                                    </div>
                                ))}
                            </div>
                            <Button onClick={() => setLocalWorkoutTypes([...localWorkoutTypes, 'אימון חדש'])} variant="outline" className="w-full rounded-[30px] border-dashed py-4 uppercase text-xs">+ הוסף סוג אימון</Button>
                        </div>
                    </div>
                )}

                {settingsSection === 'quotes' && (
                    <div className="bg-gray-800/40 p-8 rounded-[50px] border border-white/5 space-y-8 shadow-2xl">
                        <h3 className="text-white font-black uppercase italic tracking-widest border-b border-white/10 pb-4">משפטי מוטיבציה 💪</h3>
                        <div className="space-y-4">
                            {localQuotes.map((q, idx) => (
                                <div key={q.id} className="flex gap-2 bg-gray-900/40 p-4 rounded-[25px] border border-white/5">
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
                        <h3 className="text-white font-black uppercase italic tracking-widest border-b border-white/10 pb-4">חיבורים וניהול 🔐</h3>
                        <div className="space-y-6">
                            <div className="p-6 bg-gray-900/60 rounded-[35px] border border-white/5 shadow-inner">
                                <label className="text-[10px] text-gray-500 font-black mb-2 block uppercase italic">סיסמת ניהול (Admin Password)</label>
                                <input className="w-full bg-gray-800 p-4 rounded-2xl text-white font-mono text-xs border border-white/10 outline-none focus:border-brand-primary" value={localAppConfig.coachAdditionalPhone || ''} onChange={e => setLocalAppConfig({...localAppConfig, coachAdditionalPhone: e.target.value})} />
                                <p className="text-[8px] text-gray-600 mt-2 font-black italic">הסיסמה שתשמש לכניסה לממשק הניהול הנוכחי.</p>
                            </div>
                        </div>
                    </div>
                )}
                
                <div className="sticky bottom-4 z-[60] bg-brand-black/80 backdrop-blur-xl p-4 rounded-[40px] border border-white/10 shadow-3xl flex flex-col items-center gap-2">
                    {saveIndicator && <p className={`text-xs font-black uppercase tracking-widest ${saveIndicator.includes('✓') ? 'text-brand-primary' : 'text-red-500'} animate-pulse text-center max-w-[250px]`}>{saveIndicator}</p>}
                    <Button onClick={handleSaveAllSettings} className={`w-full py-6 rounded-[40px] text-xl font-black italic shadow-xl tracking-tighter transition-all ${saveSuccess ? 'bg-green-600' : 'bg-red-600'}`} isLoading={isSaving}>
                        {saveSuccess ? 'נשמר בהצלחה! ✓' : 'שמירת הגדרות ושינויים ✅'}
                    </Button>
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
                                        {/* WHATSAPP HIGHLIGHTS BUTTON */}
                                        <button 
                                            onClick={() => handleSendWhatsAppHighlights(phone, user?.displayName || user?.fullName || 'מתאמן')}
                                            className="p-2 bg-green-500/10 text-green-500 rounded-xl hover:bg-green-500/20 transition-all"
                                            title="שלח דגשים בוואטסאפ"
                                        >
                                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                                            </svg>
                                        </button>
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

                        {/* HIGHLIGHTS EDITOR */}
                        <div className="space-y-2">
                            <label className="text-[10px] text-brand-primary font-black mb-1 block uppercase italic tracking-widest">דגשי המאמן לאימון (Highlights) 👟</label>
                            <textarea 
                                className="w-full bg-gray-800 p-5 rounded-3xl text-white font-bold outline-none border border-white/5 focus:border-brand-primary transition-all h-32 italic leading-tight shadow-inner" 
                                value={sessionDraft.description || ''} 
                                onChange={e=>setSessionDraft({...sessionDraft, description: e.target.value})}
                                placeholder="לדוגמה: להביא מגבת ומים, אימון אינטרוולים עצים..."
                            />
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
                  <div className="mt-12 space-y-4">
                      <Button onClick={async ()=>{ 
                          if (!sessionDraft || isSaving) return;
                          setIsSaving(true);
                          try { 
                              const isNew = !props.sessions.some(s => s.id === sessionDraft.id);
                              if (isNew) {
                                  await props.onAddSession(sessionDraft);
                              } else {
                                  await props.onUpdateSession(sessionDraft); 
                              }
                              setSaveSuccess(true); 
                              setTimeout(() => { setAttendanceSession(null); setSaveSuccess(false); }, 800); 
                          } finally { setIsSaving(false); }
                      }} className={`w-full py-8 rounded-[45px] text-2xl font-black italic shadow-2xl tracking-tighter ${saveSuccess ? 'bg-green-600' : 'bg-red-600'}`} isLoading={isSaving}>{saveSuccess ? 'נשמר בהצלחה! ✓' : 'שמור שינויים ✓'}</Button>
                      
                      <button 
                        onClick={handleDeleteCurrentSession}
                        className="w-full text-red-500/50 hover:text-red-500 font-black uppercase italic text-xs py-2 transition-all"
                      >
                        מחק אימון לצמיתות 🗑️
                      </button>
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
                        <h3 className="text-3xl font-black text-white italic uppercase tracking-tighter">פרופיל מתאמן 👤</h3>
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
                            <label className="text-[9px] text-gray-500 font-black uppercase italic">צבע פרופיל</label>
                            <div className="flex gap-2 justify-end">
                                {PRESET_COLORS.map(c => (
                                    <button key={c} onClick={() => props.onUpdateUser({...viewingTrainee, userColor: c})} className={`w-6 h-6 rounded-full border-2 transition-transform ${viewingTrainee.userColor === c ? 'scale-125 border-white' : 'border-transparent opacity-60'}`} style={{ backgroundColor: c }} />
                                ))}
                            </div>
                        </div>
                      </div>
                      
                      <div className="bg-gray-800/20 p-6 rounded-[35px] border border-white/5 space-y-4 shadow-inner">
                         <div className="flex justify-between items-center border-b border-white/5 pb-3">
                            <span className="text-gray-500 text-xs font-black uppercase italic">הצהרת בריאות</span>
                            <span className={`text-[10px] font-black px-3 py-1 rounded-full ${viewingTrainee.healthDeclarationDate ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                                {viewingTrainee.healthDeclarationDate ? 'חתום ✓' : 'לא חתום ⚠️'}
                            </span>
                         </div>
                         {viewingTrainee.healthDeclarationDate && (
                             <div className="grid grid-cols-2 gap-4 pt-2">
                                <div className="p-3 bg-gray-900/60 rounded-2xl">
                                    <p className="text-[8px] text-gray-500 uppercase font-black mb-1">תאריך חתימה</p>
                                    <p className="text-white text-xs font-bold">{viewingTrainee.healthDeclarationDate}</p>
                                </div>
                                <div className="p-3 bg-gray-900/60 rounded-2xl">
                                    <p className="text-[8px] text-gray-500 uppercase font-black mb-1">מספר זהות</p>
                                    <p className="text-white text-xs font-bold">{viewingTrainee.healthDeclarationId || 'חסר'}</p>
                                </div>
                             </div>
                         )}
                      </div>

                      <div className="grid grid-cols-3 gap-4 border-t border-white/5 pt-8">
                         <div className="text-center p-4 bg-gray-900/40 rounded-3xl border border-white/5 shadow-inner">
                            <p className="text-[8px] text-gray-500 font-black uppercase italic mb-1">חודש נוכחי</p>
                            <p className="text-2xl font-black text-brand-primary">{props.getStatsForUser(viewingTrainee).monthly}</p>
                         </div>
                         <div className="text-center p-4 bg-gray-900/40 rounded-3xl border border-white/5 shadow-inner">
                            <p className="text-[8px] text-gray-500 font-black uppercase italic mb-1">שיא היסטורי</p>
                            <p className="text-2xl font-black text-white">{props.getStatsForUser(viewingTrainee).record}</p>
                         </div>
                         <div className="text-center p-4 bg-gray-900/40 rounded-3xl border border-white/5 shadow-inner">
                            <p className="text-[8px] text-gray-500 font-black uppercase italic mb-1">רצף נוכחי</p>
                            <p className="text-2xl font-black text-orange-400">{props.getStatsForUser(viewingTrainee).streak}</p>
                         </div>
                      </div>

                      <div className="pt-4 flex flex-col gap-3">
                        <Button onClick={()=>setViewingTrainee(null)} className="w-full rounded-[30px] py-6 font-black italic uppercase tracking-widest bg-gray-800 text-white hover:bg-gray-700 shadow-xl">סגור פרופיל</Button>
                        <button onClick={() => { if(confirm('למחוק מתאמן? הפעולה לא ניתנת לביטול.')) { props.onDeleteUser(viewingTrainee.id); setViewingTrainee(null); } }} className="text-red-500/40 text-[10px] uppercase font-black hover:text-red-500 transition-colors py-2">מחק מתאמן לצמיתות 🗑️</button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
