
import React, { useState, useMemo, useEffect } from 'react';
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

  // Local state for settings to prevent re-renders losing focus while typing
  const [localAppConfig, setLocalAppConfig] = useState<AppConfig>(props.appConfig);
  const [localLocations, setLocalLocations] = useState<LocationDef[]>(props.locations);
  const [localWorkoutTypes, setLocalWorkoutTypes] = useState<string[]>(props.workoutTypes);

  // Sync only when tab changes or data is first loaded to avoid interrupting typing
  useEffect(() => {
    if (activeTab !== 'settings') {
      setLocalAppConfig(props.appConfig);
      setLocalLocations(props.locations);
      setLocalWorkoutTypes(props.workoutTypes);
    }
  }, [props.appConfig, props.locations, props.workoutTypes, activeTab]);
  
  const [showGroupSessions, setShowGroupSessions] = useState(true);
  const [showPersonalTraining, setShowPersonalTraining] = useState(true);

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
      ).slice(0, 10);
  }, [traineeSearch, props.users, attendanceSession]);

  const handleAddLocation = () => {
    const name = prompt('שם המיקום:');
    const address = prompt('כתובת המיקום:');
    if (name && address) {
      setLocalLocations([...localLocations, { id: Date.now().toString(), name, address, color: '#A3E635' }]);
    }
  };

  const handleAddWorkoutType = () => {
    const name = prompt('שם סוג האימון החדש:');
    if (name) {
      if (localWorkoutTypes.includes(name)) return alert('סוג אימון זה כבר קיים');
      setLocalWorkoutTypes([...localWorkoutTypes, name]);
    }
  };

  const handleSaveAllSettings = async () => {
    setSaveIndicator('שומר...');
    try {
      await Promise.all([
          dataService.saveAppConfig(localAppConfig),
          dataService.saveLocations(localLocations),
          dataService.saveWorkoutTypes(localWorkoutTypes)
      ]);
      props.onUpdateAppConfig(localAppConfig);
      props.onUpdateLocations(localLocations);
      props.onUpdateWorkoutTypes(localWorkoutTypes);
      setSaveIndicator('נשמר בהצלחה ✓');
      setTimeout(() => setSaveIndicator(null), 3000);
    } catch (e) {
      setSaveIndicator('שגיאה בשמירה');
    }
  };

  const copyWeekSessions = async () => {
    const sessionsToCopy = props.sessions.filter(s => weekDates.includes(s.date));
    if (sessionsToCopy.length === 0) return alert('אין אימונים בשבוע זה להעתקה');
    if (!confirm(`האם להעתיק ${sessionsToCopy.length} אימונים?`)) return;

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
                isCancelled: false, 
                manualHasStarted: false
            };
            await dataService.addSession(newSession);
        }
        setSaveIndicator('שבוע הועתק בהצלחה!');
        setTimeout(() => { setSaveIndicator(null); window.location.reload(); }, 2000);
    } catch (e) { setSaveIndicator('שגיאה בהעתקת שבוע'); }
    setIsCopyingWeek(false);
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
                        <span className="text-red-500 font-black uppercase tracking-[0.3em] bg-red-500/10 px-4 py-1 rounded-full">{weekOffset === 0 ? 'השבוע' : `שבוע ${weekOffset}`}</span>
                        <button onClick={() => setIsCopyingWeek(!isCopyingWeek)} className="text-[10px] text-gray-500 font-black uppercase mt-2 hover:text-red-500 transition-colors underline">שכפל שבוע 📑</button>
                    </div>
                    <button onClick={()=>setWeekOffset(p=>p+1)} className="text-white text-2xl p-2 hover:text-red-500 transition-colors">→</button>
                </div>
                <div className="flex justify-center gap-4 border-t border-white/5 pt-4">
                    <button onClick={() => setShowGroupSessions(!showGroupSessions)} className={`px-4 py-2 rounded-full text-[10px] font-black uppercase transition-all ${showGroupSessions ? 'bg-red-600 text-white' : 'bg-gray-900 text-gray-600'}`}>קבוצתי {showGroupSessions ? '✓' : '✗'}</button>
                    <button onClick={() => setShowPersonalTraining(!showPersonalTraining)} className={`px-4 py-2 rounded-full text-[10px] font-black uppercase transition-all ${showPersonalTraining ? 'bg-blue-600 text-white' : 'bg-gray-900 text-gray-600'}`}>אימון אישי {showPersonalTraining ? '✓' : '✗'}</button>
                </div>
             </div>

             <Button onClick={() => setAttendanceSession({ id: Date.now().toString() + Math.random().toString(36).substr(2, 5), type: localWorkoutTypes[0] || 'פונקציונלי', date: new Date().toISOString().split('T')[0], time: '18:00', location: localLocations[0]?.name || '', maxCapacity: 15, registeredPhoneNumbers: [], attendedPhoneNumbers: [], description: '', isPersonalTraining: false, isZoomSession: false, isCancelled: false })} className="w-full py-7 rounded-[45px] bg-red-600 text-xl font-black italic shadow-2xl">+ יצירת אימון חדש</Button>
             <div className="space-y-12">
              {weekDates.map(date => {
                  let daySessions = props.sessions.filter(s => s.date === date).sort((a,b)=>a.time.localeCompare(b.time));
                  daySessions = daySessions.filter(s => s.isPersonalTraining ? showPersonalTraining : showGroupSessions);
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
          </div>
        )}

        {activeTab === 'users' && (
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row gap-4 mt-6">
                    <input type="text" placeholder="חיפוש מתאמן..." className="flex-1 bg-gray-800 border border-white/10 p-6 rounded-[30px] text-white outline-none focus:border-red-500 shadow-xl" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
                    <select className="bg-gray-800 border border-white/10 p-4 rounded-[30px] text-white text-sm font-black outline-none" value={sortBy} onChange={e=>setSortBy(e.target.value as SortMode)}>
                        <option value="name">מיון: שם</option><option value="monthly">מיון: אימונים החודש</option><option value="record">מיון: שיא אישי</option><option value="streak">מיון: רצף</option><option value="health">מיון: הצהרת בריאות</option><option value="payment">מיון: תשלום</option>
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
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="text-[10px] text-gray-500 font-black mb-1 block uppercase">שם מאמן</label><input className="w-full bg-gray-800 border border-white/10 p-4 rounded-2xl text-white font-bold" value={localAppConfig.coachNameHeb} onChange={e=>setLocalAppConfig({...localAppConfig, coachNameHeb: e.target.value})} /></div>
                            <div><label className="text-[10px] text-gray-500 font-black mb-1 block uppercase">טלפון</label><input className="w-full bg-gray-800 border border-white/10 p-4 rounded-2xl text-white font-bold" value={localAppConfig.coachPhone} onChange={e=>setLocalAppConfig({...localAppConfig, coachPhone: e.target.value})} /></div>
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
                                {localLocations.map(loc => (
                                    <div key={loc.id} className="bg-gray-900/50 p-6 rounded-[30px] border border-white/5 flex flex-col gap-4">
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1 space-y-2">
                                                <label className="text-[9px] text-gray-600 font-black uppercase block">שם</label>
                                                <input className="w-full bg-transparent text-white font-black text-lg outline-none focus:text-brand-primary italic border-b border-white/5 pb-1" value={loc.name} onChange={e => setLocalLocations(localLocations.map(l => l.id === loc.id ? {...l, name: e.target.value} : l))} />
                                                <label className="text-[9px] text-gray-600 font-black uppercase block mt-2">כתובת / Waze</label>
                                                <input className="w-full bg-transparent text-xs text-gray-500 outline-none focus:text-white font-bold" value={loc.address} onChange={e => setLocalLocations(localLocations.map(l => l.id === loc.id ? {...l, address: e.target.value} : l))} />
                                            </div>
                                            <button onClick={() => { if(confirm('למחוק מיקום?')) setLocalLocations(localLocations.filter(l => l.id !== loc.id)) }} className="text-red-500/30 hover:text-red-500 transition-colors p-2 text-xl">🗑️</button>
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
                                {localWorkoutTypes.map((t, idx) => (
                                    <div key={idx} className="bg-gray-900/50 p-3 rounded-2xl border border-white/5 flex justify-between items-center">
                                        <input className="bg-transparent text-white text-sm font-bold outline-none flex-1" value={t} onChange={e => { const newList = [...localWorkoutTypes]; newList[idx] = e.target.value; setLocalWorkoutTypes(newList); }} />
                                        <button onClick={() => setLocalWorkoutTypes(localWorkoutTypes.filter(x => x !== t))} className="text-red-500 text-xs mr-2">✕</button>
                                    </div>
                                ))}
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
                            <input type="text" placeholder="הוספת מתאמן..." className="w-full bg-gray-900 p-4 rounded-2xl text-white text-xs border border-white/5 outline-none focus:border-brand-primary" value={traineeSearch} onChange={(e) => setTraineeSearch(e.target.value)} />
                            {traineeSuggestions.length > 0 && (
                                <div className="absolute top-full left-0 right-0 z-[210] bg-gray-900 border border-white/10 rounded-2xl mt-1 overflow-hidden shadow-2xl">
                                    {traineeSuggestions.map(u => (
                                        <button key={u.id} className="w-full p-4 text-right hover:bg-gray-800 transition-colors flex justify-between items-center group" onClick={() => { const phone = normalizePhone(u.phone); setAttendanceSession({ ...attendanceSession, registeredPhoneNumbers: [...attendanceSession.registeredPhoneNumbers, phone] }); setTraineeSearch(''); }}>
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
                                            <div className="flex items-center gap-2">
                                                <span className="text-white text-sm font-bold">{u ? (u.displayName || u.fullName) : phone}</span>
                                                <a href={`https://wa.me/${phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-green-500 hover:scale-110 transition-transform">
                                                   <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                                                </a>
                                            </div>
                                            <span className="text-[10px] text-gray-500 font-mono">{phone}</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => { const curr = attendanceSession.attendedPhoneNumbers || []; const up = isAttended ? curr.filter(p => p !== phone) : [...curr, phone]; setAttendanceSession({...attendanceSession, attendedPhoneNumbers: up}); }} className={`px-4 py-2 rounded-xl text-[10px] font-black ${isAttended ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-500'}`}>{isAttended ? 'נכח ✓' : 'לא נכח'}</button>
                                            <button onClick={() => { if(confirm('להסיר?')) setAttendanceSession({...attendanceSession, registeredPhoneNumbers: attendanceSession.registeredPhoneNumbers.filter(p => p !== phone)})}} className="text-red-500 text-xs p-2">✕</button>
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
                                    {localWorkoutTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div><label className="text-[10px] text-gray-500 font-black mb-1 block uppercase">מיקום</label>
                                <select className="w-full bg-gray-800 border border-white/10 p-5 rounded-3xl text-white font-bold" value={attendanceSession.location} onChange={e=>setAttendanceSession({...attendanceSession, location: e.target.value})}>
                                    {localLocations.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="text-[10px] text-gray-500 font-black mb-1 block uppercase">תאריך</label><input type="date" className="w-full bg-gray-800 p-5 rounded-3xl text-white font-bold" value={attendanceSession.date} onChange={e=>setAttendanceSession({...attendanceSession, date: e.target.value})} /></div>
                            <div><label className="text-[10px] text-gray-500 font-black mb-1 block uppercase">שעה</label><input type="time" className="w-full bg-gray-800 p-5 rounded-3xl text-white font-bold" value={attendanceSession.time} onChange={e=>setAttendanceSession({...attendanceSession, time: e.target.value})} /></div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 p-4 bg-gray-800/20 rounded-3xl border border-white/5">
                            <div className="flex items-center gap-2">
                                <input type="checkbox" id="isZoom" className="w-6 h-6 accent-blue-500 cursor-pointer" checked={attendanceSession.isZoomSession || false} onChange={e=>setAttendanceSession({...attendanceSession, isZoomSession: e.target.checked})} />
                                <label htmlFor="isZoom" className="text-blue-400 text-[10px] font-black uppercase cursor-pointer">זום 💻</label>
                            </div>
                            <div className="flex items-center gap-2">
                                <input type="checkbox" id="isPersonalTraining" className="w-6 h-6 accent-purple-500 cursor-pointer" checked={attendanceSession.isPersonalTraining || false} onChange={e=>setAttendanceSession({...attendanceSession, isPersonalTraining: e.target.checked})} />
                                <label htmlFor="isPersonalTraining" className="text-purple-400 text-[10px] font-black uppercase cursor-pointer">אישי 🏆</label>
                            </div>
                            <div className="flex items-center gap-2">
                                <input type="checkbox" id="isCancelled" className="w-6 h-6 accent-red-500 cursor-pointer" checked={attendanceSession.isCancelled || false} onChange={e=>setAttendanceSession({...attendanceSession, isCancelled: e.target.checked})} />
                                <label htmlFor="isCancelled" className="text-red-500 text-[10px] font-black uppercase cursor-pointer">מבוטל ❌</label>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 bg-brand-primary/10 p-6 rounded-3xl border border-brand-primary/20">
                            <input type="checkbox" id="isHappening" className="w-8 h-8 accent-brand-primary cursor-pointer" checked={attendanceSession.manualHasStarted || false} onChange={e=>setAttendanceSession({...attendanceSession, manualHasStarted: e.target.checked})} />
                            <label htmlFor="isHappening" className="text-brand-primary text-lg font-black uppercase cursor-pointer flex-1">אימון מתקיים ✓</label>
                        </div>
                      </div>
                  </div>
                  <div className="mt-12 flex gap-4">
                      <Button onClick={()=>{ 
                          const isNew = !props.sessions.find(s => s.id === attendanceSession.id);
                          if (isNew) props.onAddSession(attendanceSession); 
                          else props.onUpdateSession(attendanceSession); 
                          setAttendanceSession(null); 
                      }} className="flex-1 bg-red-600 py-8 rounded-[45px] text-2xl font-black italic uppercase shadow-2xl">שמור שינויים ✓</Button>
                      <Button onClick={()=>{if(confirm('מחיקת אימון?')){props.onDeleteSession(attendanceSession.id); setAttendanceSession(null);}}} variant="danger" className="px-12 rounded-[45px]">מחק 🗑️</Button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
