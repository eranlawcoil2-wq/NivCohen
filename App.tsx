
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { User, TrainingSession, PaymentStatus, LocationDef, AppConfig, WeatherInfo, Quote } from './types';
import { SessionCard } from './components/SessionCard';
import { AdminPanel } from './components/AdminPanel';
import { Button } from './components/Button';
import { getMotivationQuote } from './services/geminiService';
import { getWeatherForDates, getCityCoordinates, getWeatherIcon } from './services/weatherService';
import { dataService } from './services/dataService';

const normalizePhone = (phone: string): string => {
    if (!phone) return '';
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('972')) cleaned = '972' + cleaned.substring(3);
    else if (cleaned.startsWith('0')) cleaned = '972' + cleaned.substring(1);
    else if (!cleaned.startsWith('972')) cleaned = '972' + cleaned;
    return cleaned;
};

const navigateToLocation = (query: string) => {
    if (!query) return;
    window.open(`https://waze.com/ul?q=${encodeURIComponent(query)}`, '_blank');
};

const downloadICS = (session: TrainingSession) => {
    const cleanDate = session.date.replace(/-/g, '');
    const cleanTime = session.time.replace(':', '');
    const start = `${cleanDate}T${cleanTime}00`;
    const [h, m] = session.time.split(':').map(Number);
    const endHour = (h + 1).toString().padStart(2, '0');
    const end = `${cleanDate}T${endHour}${m.toString().padStart(2, '0')}00`;
    
    const icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Niv Cohen Fitness//NONSGML v1.0//EN',
        'BEGIN:VEVENT',
        `DTSTART:${start}`,
        `DTEND:${end}`,
        `SUMMARY:אימון ${session.type} - ניב כהן`,
        `DESCRIPTION:${session.description || ''}`,
        `LOCATION:${session.location}`,
        'END:VEVENT',
        'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `workout-${session.date}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

const PRESET_COLORS = ['#A3E635', '#3B82F6', '#A855F7', '#F97316', '#06B6D4', '#EC4899'];

const WhatsAppButton: React.FC<{ phone: string }> = ({ phone }) => (
    <a 
        href={`https://wa.me/${phone.replace(/\D/g, '')}`} 
        target="_blank" 
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-[100] bg-green-500 text-white p-4 rounded-full shadow-2xl shadow-green-500/40 whatsapp-float flex items-center justify-center transition-transform hover:scale-110 active:scale-90"
        aria-label="WhatsApp"
    >
        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
    </a>
);

const App: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [currentView, setCurrentView] = useState<'landing' | 'work' | 'admin' | 'CHAMP'>(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    if (mode === 'CHAMP') return 'CHAMP';
    if (mode === 'admin') return 'admin';
    if (mode === 'work') return 'work';
    const savedPhone = localStorage.getItem('niv_app_current_phone');
    return savedPhone ? 'work' : 'landing';
  });

  const isAdminMode = currentView === 'admin';
  const isLanding = currentView === 'landing';

  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(() => localStorage.getItem('niv_admin_auth') === 'true');
  const [showUrgent, setShowUrgent] = useState(true);
  const [workoutTypes, setWorkoutTypes] = useState<string[]>([]);
  const [locations, setLocations] = useState<LocationDef[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [appConfig, setAppConfig] = useState<AppConfig>({
      coachNameHeb: 'ניב כהן', coachNameEng: 'NIV COHEN', coachPhone: '0528726618', coachEmail: '', defaultCity: 'נס ציונה', coachAdditionalPhone: 'admin', urgentMessage: '', coachBio: '', healthDeclarationTemplate: 'אני מצהיר כי מצב בריאותי תקין ומאפשר ביצוע פעילות גופנית...'
  });
  const [currentUserPhone, setCurrentUserPhone] = useState<string | null>(() => localStorage.getItem('niv_app_current_phone'));
  const [loginPhoneInput, setLoginPhoneInput] = useState('');
  const [loginNameInput, setLoginNameInput] = useState('');
  const [isNewUserLogin, setIsNewUserLogin] = useState(false);
  const [idNumberInput, setIdNumberInput] = useState('');
  const [signingHealth, setSigningHealth] = useState(false);
  
  const [quote, setQuote] = useState('');
  const [weatherData, setWeatherData] = useState<Record<string, WeatherInfo>>({});
  const [viewingSession, setViewingSession] = useState<TrainingSession | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [traineeWeekOffset, setTraineeWeekOffset] = useState(0);
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);

  const isSyncingRef = useRef(false);

  const currentUser = useMemo(() => users.find(u => normalizePhone(u.phone) === normalizePhone(currentUserPhone || '')), [users, currentUserPhone]);
  
  useEffect(() => {
    if (currentUser && !currentUser.healthDeclarationDate && !signingHealth && !isAdminMode && !isLanding) {
        setSigningHealth(true);
    }
  }, [currentUser, signingHealth, isAdminMode, isLanding]);

  const handleUpdateProfile = async (updated: User) => {
      isSyncingRef.current = true;
      try {
          setUsers(prev => prev.map(u => u.id === updated.id ? updated : u));
          await dataService.updateUser(updated);
      } finally {
          isSyncingRef.current = false;
      }
  };

  const handleUpdateAppConfig = async (config: AppConfig) => {
      setAppConfig(config);
      await dataService.saveAppConfig(config);
  };

  const navigateTo = (view: 'landing' | 'work' | 'admin' | 'CHAMP') => {
      if (view === 'admin' && !isAdminAuthenticated) {
          const pass = prompt('קוד גישה למאמן:');
          if(pass === (appConfig.coachAdditionalPhone || 'admin')) {
              setIsAdminAuthenticated(true);
              localStorage.setItem('niv_admin_auth', 'true');
          } else {
              return;
          }
      }
      setCurrentView(view);
  };

  const getStatsForUser = useCallback((user: User) => {
    if (!user) return { monthly: 0, record: 0, streak: 0 };
    const phone = normalizePhone(user.phone);
    const now = new Date();
    const attendedSessions = sessions.filter(s => (s.attendedPhoneNumbers || []).includes(phone));
    const monthlyCount = attendedSessions.filter(s => {
        const d = new Date(s.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    
    let streak = 0;
    const weekMap: Record<string, number> = {};
    attendedSessions.forEach(s => {
        const d = new Date(s.date);
        const sun = new Date(d); sun.setDate(d.getDate() - d.getDay()); 
        const key = sun.toISOString().split('T')[0];
        weekMap[key] = (weekMap[key] || 0) + 1;
    });
    let check = new Date(); check.setDate(check.getDate() - check.getDay());
    while(true) {
        const key = check.toISOString().split('T')[0];
        if ((weekMap[key] || 0) >= 3) { streak++; check.setDate(check.getDate() - 7); }
        else break;
        if (check.getFullYear() < 2024) break;
    }
    return { monthly: monthlyCount, record: Math.max(user.monthlyRecord || 0, monthlyCount), streak };
  }, [sessions]);

  const stats = useMemo(() => currentUser ? getStatsForUser(currentUser) : { monthly: 0, record: 0, streak: 0 }, [currentUser, getStatsForUser]);

  const championTrainee = useMemo(() => {
    const now = new Date();
    const traineesWithCounts = users.map(u => {
        const attended = sessions.filter(s => (s.attendedPhoneNumbers || []).includes(normalizePhone(u.phone)));
        const monthly = attended.filter(s => {
            const d = new Date(s.date);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        }).length;
        return { name: u.displayName || u.fullName, count: monthly };
    });
    return traineesWithCounts.sort((a,b) => b.count - a.count)[0] || { name: 'אין עדיין', count: 0 };
  }, [users, sessions]);

  const traineeWeekDates = useMemo(() => {
    if (traineeWeekOffset === 0) {
        return Array.from({length: 7}, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() + i);
            return d.toISOString().split('T')[0];
        });
    } else {
        const sun = new Date();
        sun.setDate(sun.getDate() - sun.getDay() + (traineeWeekOffset * 7));
        return Array.from({length: 7}, (_, i) => {
            const d = new Date(sun);
            d.setDate(sun.getDate() + i);
            return d.toISOString().split('T')[0];
        });
    }
  }, [traineeWeekOffset]);

  const refreshData = useCallback(async () => {
      if (isSyncingRef.current) return; 
      setIsSyncing(true);
      try {
          const [u, s, locs, types, config, q] = await Promise.all([
              dataService.getUsers(), dataService.getSessions(), dataService.getLocations(), dataService.getWorkoutTypes(), dataService.getAppConfig(), dataService.getQuotes()
          ]);
          setUsers(u); setSessions(s); setLocations(locs); setWorkoutTypes(types); setAppConfig(config); setQuotes(q);
          if (q.length > 0) setQuote(q[Math.floor(Math.random() * q.length)].text);
          
          const weather = await getWeatherForDates(traineeWeekDates);
          setWeatherData(prev => ({...prev, ...weather}));
      } catch (e) {}
      setIsSyncing(false);
  }, [traineeWeekDates]);

  useEffect(() => {
    refreshData();
    const interval = setInterval(() => { if (!isSyncingRef.current) refreshData(); }, 30000); 
    return () => clearInterval(interval);
  }, [refreshData]);

  const handleRegisterClick = async (sid: string) => {
      if (!currentUserPhone) { 
          setPendingSessionId(sid);
          document.getElementById('login-modal')?.classList.remove('hidden'); 
          return; 
      }
      if (currentUser && !currentUser.healthDeclarationDate) {
          alert('עליך לחתום על הצהרת בריאות לפני ההרשמה.');
          setSigningHealth(true);
          return;
      }
      const session = sessions.find(s => s.id === sid);
      if (!session || session.isCancelled) return;
      isSyncingRef.current = true;
      const phone = normalizePhone(currentUserPhone);
      let updated = { ...session };
      if (session.registeredPhoneNumbers.includes(phone)) {
          updated.registeredPhoneNumbers = session.registeredPhoneNumbers.filter(p => p !== phone);
      } else {
          if (session.registeredPhoneNumbers.length >= session.maxCapacity) { alert('האימון מלא!'); isSyncingRef.current = false; return; }
          updated.registeredPhoneNumbers = [...session.registeredPhoneNumbers, phone];
      }
      setSessions(prev => prev.map(s => s.id === sid ? updated : s));
      try { await dataService.updateSession(updated); } finally { isSyncingRef.current = false; }
  };

  const handleLoginSubmit = async () => {
    if (loginPhoneInput.length < 9) return;
    const np = normalizePhone(loginPhoneInput);
    const existingUser = users.find(u => normalizePhone(u.phone) === np);
    if (!existingUser) {
      if (!isNewUserLogin) { setIsNewUserLogin(true); return; }
      else {
        const newUser: User = { id: Date.now().toString(), fullName: loginNameInput, phone: np, email: '', startDate: new Date().toISOString().split('T')[0], paymentStatus: PaymentStatus.PENDING };
        await dataService.addUser(newUser);
        setUsers(prev => [...prev, newUser]);
        setCurrentUserPhone(np);
        localStorage.setItem('niv_app_current_phone', np);
        document.getElementById('login-modal')?.classList.add('hidden');
        setSigningHealth(true); 
      }
    } else {
        setCurrentUserPhone(np);
        localStorage.setItem('niv_app_current_phone', np);
        document.getElementById('login-modal')?.classList.add('hidden');
    }
  };

  const handleSignHealth = async () => {
      if (!idNumberInput || !currentUser) return;
      const updated = {
          ...currentUser,
          healthDeclarationDate: new Date().toLocaleDateString('he-IL'),
          healthDeclarationId: idNumberInput
      };
      await handleUpdateProfile(updated);
      setSigningHealth(false);
      setIdNumberInput('');
  };

  const handleLogout = () => {
      localStorage.removeItem('niv_app_current_phone');
      setCurrentUserPhone(null);
      setShowProfile(false);
      navigateTo('landing');
  };

  if (isLanding) {
    return (
      <div className="min-h-screen bg-brand-black flex flex-col items-center justify-center p-8 text-center relative overflow-hidden cursor-pointer" onClick={() => navigateTo('work')}>
        <div className="z-10 max-w-2xl space-y-12 py-12">
            <div>
                <h1 className="text-7xl sm:text-9xl font-black italic text-white uppercase tracking-tighter">NIV COHEN</h1>
                <p className="text-xl sm:text-3xl font-black tracking-[0.5em] text-brand-primary uppercase mt-4">CONSISTENCY TRAINING</p>
            </div>
            <div className="bg-gray-900/40 backdrop-blur-2xl p-8 rounded-[40px] border border-white/5 inline-block">
                <p className="text-xl font-black text-white italic">"{quote || 'הכאב הוא זמני, הגאווה היא נצחית.'}"</p>
            </div>
            <div className="pt-8 animate-pulse text-gray-500 font-black uppercase tracking-widest text-xs">לחץ לכניסה</div>
        </div>
        <WhatsAppButton phone={appConfig.coachPhone} />
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isAdminMode ? 'bg-red-950/10' : 'bg-brand-black'} pb-20 font-sans transition-all duration-500`}>
      <header className={`p-6 border-b border-gray-800/50 backdrop-blur-md sticky top-0 z-[60] ${isAdminMode ? 'bg-red-900/40' : 'bg-brand-black/80'}`}>
          <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-4">
                  {currentUser && !isAdminMode && (
                      <div className="text-right cursor-pointer group" onClick={() => setShowProfile(true)}>
                          <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest text-left group-hover:text-brand-primary transition-colors">פרופיל אישי</p>
                          <p className="text-white font-black italic text-sm" style={{ color: currentUser.userColor || 'white' }}>{currentUser.displayName || currentUser.fullName}</p>
                      </div>
                  )}
                  {isSyncing && <div className="w-4 h-4 border-2 border-brand-primary border-t-transparent rounded-full animate-spin ml-2"></div>}
              </div>
              <div className="text-center" onClick={() => navigateTo('landing')}>
                  <h1 className="text-3xl sm:text-4xl font-black italic text-white uppercase leading-none">NIV COHEN</h1>
                  <p className="text-[10px] sm:text-[12px] font-black tracking-[0.4em] text-brand-primary uppercase mt-1">CONSISTENCY TRAINING</p>
              </div>
              <div className="w-20 flex justify-end">
                 {isAdminMode && <button onClick={() => navigateTo('work')} className="bg-gray-800 text-white p-2 rounded-xl text-[10px] font-black uppercase italic">לו"ז</button>}
              </div> 
          </div>
      </header>

      <main className="max-w-4xl mx-auto p-4">
        {isAdminMode ? (
             <AdminPanel 
                users={users} sessions={sessions} primaryColor="#EF4444" workoutTypes={workoutTypes}
                locations={locations} weatherLocation={{name: appConfig.defaultCity, lat:0, lon:0}} paymentLinks={[]} streakGoal={3}
                appConfig={appConfig} quotes={quotes} weatherData={weatherData} onAddUser={async u => { await dataService.addUser(u); setUsers(prev => [...prev, u]); }}
                onUpdateUser={async u => { await dataService.updateUser(u); setUsers(prev => prev.map(x=>x.id===u.id?u:x)); }}
                onAddSession={async s => { isSyncingRef.current = true; try { await dataService.addSession(s); setSessions(prev => [...prev, s]); } finally { isSyncingRef.current = false; } }}
                onUpdateSession={async s => { isSyncingRef.current = true; try { await dataService.updateSession(s); setSessions(prev => prev.map(x=>x.id===s.id?s:x)); } finally { isSyncingRef.current = false; } }}
                onDeleteUser={async id => { await dataService.deleteUser(id); setUsers(prev => prev.filter(x=>x.id!==id)); }}
                onDeleteSession={async id => { isSyncingRef.current = true; try { await dataService.deleteSession(id); setSessions(prev => prev.filter(x=>x.id!==id)); } finally { isSyncingRef.current = false; } }}
                onUpdateWorkoutTypes={async t => { await dataService.saveWorkoutTypes(t); setWorkoutTypes(t); refreshData(); }} 
                onUpdateLocations={async l => { await dataService.saveLocations(l); setLocations(l); refreshData(); }}
                onUpdateAppConfig={handleUpdateAppConfig} onExitAdmin={() => navigateTo('work')}
                onDuplicateSession={async s => { isSyncingRef.current = true; try { const n = {...s, id: Date.now().toString()+Math.random(), registeredPhoneNumbers: [], attendedPhoneNumbers: []}; await dataService.addSession(n); setSessions(p=>[...p, n]); } finally { isSyncingRef.current = false; } }}
                onAddToCalendar={downloadICS} getStatsForUser={getStatsForUser}
                onColorChange={()=>{}} onUpdateWeatherLocation={()=>{}} onAddPaymentLink={()=>{}} onDeletePaymentLink={()=>{}} onUpdateStreakGoal={()=>{}}
            />
        ) : (
            <div className="space-y-10 pb-20">
              {/* URGENT MESSAGE BANNER */}
              {appConfig.urgentMessage && showUrgent && (
                <div className="bg-red-600/20 border-2 border-red-600 p-6 rounded-[40px] mb-8 flex items-center justify-between gap-4 animate-pulse relative overflow-hidden">
                  <div className="flex items-center gap-4">
                    <span className="text-3xl">🚨</span>
                    <div>
                        <p className="text-red-500 font-black text-[10px] uppercase tracking-widest mb-1">הודעה דחופה מהמאמן</p>
                        <p className="text-white font-black text-lg sm:text-xl italic leading-tight">{appConfig.urgentMessage}</p>
                    </div>
                  </div>
                  <button onClick={() => setShowUrgent(false)} className="text-red-500/50 hover:text-red-500 p-2 text-xl">✕</button>
                </div>
              )}

              {currentUser && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-gray-800/40 p-4 rounded-[30px] border border-white/5 text-center flex flex-col justify-center h-28">
                          <p className="text-[9px] text-gray-500 font-black uppercase mb-1">החודש</p>
                          <p className="text-2xl font-black text-brand-primary">{stats.monthly}</p>
                      </div>
                      <div className="bg-gray-800/40 p-4 rounded-[30px] border border-white/5 text-center flex flex-col justify-center h-28">
                          <p className="text-[9px] text-gray-500 font-black uppercase mb-1">שיא חודשי</p>
                          <p className="text-2xl font-black text-white">{stats.record}</p>
                      </div>
                      <div className="bg-gray-800/40 p-4 rounded-[30px] border border-white/5 text-center flex flex-col justify-center h-28">
                          <p className="text-[9px] text-gray-500 font-black uppercase mb-1">רצף (3+ בשבוע)</p>
                          <p className="text-2xl font-black text-orange-400">{stats.streak}</p>
                      </div>
                      <div className="bg-brand-primary/10 p-4 rounded-[30px] border border-brand-primary/30 text-center flex flex-col justify-center h-28 border-2 border-brand-primary/60">
                          <p className="text-[9px] text-brand-primary font-black uppercase mb-1">👑 אלוף החודש</p>
                          <p className="text-xs font-black text-white truncate px-1">{championTrainee.name}</p>
                          <p className="text-lg font-black text-brand-primary">{championTrainee.count}</p>
                      </div>
                  </div>
              )}

              <div className="flex flex-col gap-4">
                  <div className="flex justify-center gap-2">
                      <button onClick={() => setTraineeWeekOffset(0)} className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase transition-all ${traineeWeekOffset === 0 ? 'bg-brand-primary text-black shadow-lg shadow-brand-primary/20' : 'bg-gray-800/50 text-gray-500'}`}>השבוע</button>
                      <button onClick={() => setTraineeWeekOffset(1)} className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase transition-all ${traineeWeekOffset === 1 ? 'bg-brand-primary text-black shadow-lg shadow-brand-primary/20' : 'bg-gray-800/50 text-gray-500'}`}>שבוע הבא</button>
                  </div>
                  <div className="bg-gray-800/40 p-5 rounded-[40px] border border-white/5 flex justify-between items-center px-4">
                      <button onClick={()=>setTraineeWeekOffset(p=>p-1)} className="text-white text-2xl p-2 hover:text-brand-primary transition-colors">←</button>
                      <div className="text-center">
                          <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">
                              {new Date(traineeWeekDates[0]).toLocaleDateString('he-IL', {day:'numeric', month:'short'})} - {new Date(traineeWeekDates[6]).toLocaleDateString('he-IL', {day:'numeric', month:'short'})}
                          </p>
                          <span className="text-brand-primary font-black uppercase tracking-[0.2em] bg-brand-primary/10 px-6 py-2 rounded-full text-[11px]">
                              {traineeWeekOffset === 0 ? 'לו"ז קרוב' : `שבוע ${traineeWeekOffset > 0 ? '+' : ''}${traineeWeekOffset}`}
                          </span>
                      </div>
                      <button onClick={()=>setTraineeWeekOffset(p=>p+1)} className="text-white text-2xl p-2 hover:text-brand-primary transition-colors">→</button>
                  </div>
              </div>

              <div className="space-y-12">
                  {traineeWeekDates.map(date => {
                      const daySessions = sessions.filter(s => s.date === date).sort((a,b)=>a.time.localeCompare(b.time));
                      if (daySessions.length === 0) return null;
                      return (
                          <div key={date}>
                              <div className="flex justify-between items-end border-b border-white/5 pb-2 mb-6 px-2">
                                  <h4 className="text-gray-500 font-black text-3xl uppercase">{new Date(date).toLocaleDateString('he-IL', { weekday: 'long' })}</h4>
                                  <p className="text-gray-500 font-black text-xl opacity-30">{new Date(date).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' })}</p>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                  {daySessions.map(s => (
                                      <SessionCard 
                                          key={s.id} session={s} allUsers={users} locations={locations} weather={weatherData[s.date]} isAdmin={false}
                                          isRegistered={!!currentUser && s.registeredPhoneNumbers.includes(normalizePhone(currentUser.phone))} 
                                          onRegisterClick={handleRegisterClick} 
                                          onViewDetails={(sid) => setViewingSession(sessions.find(x => x.id === sid) || null)}
                                          onWazeClick={navigateToLocation} onAddToCalendar={downloadICS}
                                      />
                                  ))}
                              </div>
                          </div>
                      );
                  })}
              </div>
            </div>
        )}
      </main>

      {showProfile && currentUser && (
          <div className="fixed inset-0 bg-black/95 z-[500] flex items-center justify-center p-6 backdrop-blur-3xl overflow-y-auto no-scrollbar" dir="rtl">
              <div className="bg-gray-900 p-8 sm:p-12 rounded-[60px] w-full max-w-2xl border border-white/10 shadow-3xl text-right">
                  <div className="flex justify-between items-center mb-10 border-b border-white/5 pb-6">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center font-black text-2xl border-2" style={{borderColor: currentUser.userColor || 'white', color: currentUser.userColor || 'white'}}>{currentUser.fullName.charAt(0)}</div>
                        <h3 className="text-3xl font-black text-white italic uppercase tracking-tighter">פרופיל אישי 👤</h3>
                      </div>
                      <button onClick={()=>setShowProfile(false)} className="text-gray-500 text-4xl hover:text-white transition-colors">✕</button>
                  </div>

                  <div className="space-y-10">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] text-gray-500 font-black uppercase italic">שם לתצוגה</label>
                            <input 
                                className="w-full bg-gray-800 p-4 rounded-2xl text-white font-bold border border-white/5 focus:border-brand-primary outline-none transition-all" 
                                value={currentUser.displayName || currentUser.fullName} 
                                onChange={(e) => handleUpdateProfile({...currentUser, displayName: e.target.value})}
                                placeholder="איך תרצה שנקרא לך?"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] text-gray-500 font-black uppercase italic">צבע פרופיל</label>
                            <div className="flex gap-2 justify-end py-2">
                                {PRESET_COLORS.map(c => (
                                    <button 
                                        key={c} 
                                        onClick={() => handleUpdateProfile({...currentUser, userColor: c})}
                                        className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${currentUser.userColor === c ? 'scale-125 border-white shadow-lg' : 'border-transparent opacity-60'}`}
                                        style={{ backgroundColor: c }}
                                    />
                                ))}
                            </div>
                        </div>
                      </div>

                      <div className="bg-gray-800/20 p-6 rounded-[40px] border border-white/5 shadow-inner space-y-4">
                          <h4 className="text-brand-primary font-black uppercase italic tracking-widest text-xs">הסטטיסטיקה שלי 🔥</h4>
                          <div className="grid grid-cols-3 gap-4">
                             <div className="text-center">
                                <p className="text-[8px] text-gray-500 font-black uppercase">החודש</p>
                                <p className="text-3xl font-black text-white">{stats.monthly}</p>
                             </div>
                             <div className="text-center">
                                <p className="text-[8px] text-gray-500 font-black uppercase">שיא</p>
                                <p className="text-3xl font-black text-white">{stats.record}</p>
                             </div>
                             <div className="text-center">
                                <p className="text-[8px] text-gray-500 font-black uppercase">רצף</p>
                                <p className="text-3xl font-black text-orange-400">{stats.streak}</p>
                             </div>
                          </div>
                      </div>

                      <div className="pt-8 border-t border-white/5 flex flex-col gap-4">
                          <Button onClick={()=>setShowProfile(false)} className="w-full rounded-[30px] py-6 font-black italic uppercase tracking-widest bg-white text-black hover:bg-gray-200 shadow-xl transition-all">סגור ורענן</Button>
                          <button 
                            onClick={handleLogout} 
                            className="text-red-500 font-black uppercase italic text-xs py-4 hover:underline transition-all"
                          >
                            התנתק מהמערכת 🚪
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {viewingSession && !isAdminMode && (
          <div className="fixed inset-0 bg-black/95 z-[500] flex items-center justify-center p-6 backdrop-blur-3xl overflow-y-auto" dir="rtl">
              <div className="bg-gray-900 p-8 sm:p-12 rounded-[60px] w-full max-w-2xl border border-white/10 shadow-3xl text-right">
                  <div className="flex justify-between items-center mb-8 border-b border-white/5 pb-4">
                      <h3 className="text-3xl font-black text-white italic uppercase">פרטי אימון 👟</h3>
                      <button onClick={()=>setViewingSession(null)} className="text-gray-500 text-4xl hover:text-white transition-colors">✕</button>
                  </div>
                  <div className="space-y-8">
                      <div>
                          <p className="text-brand-primary font-black text-4xl italic uppercase">{viewingSession.type}</p>
                          <p className="text-white font-black text-xl mt-2">{new Date(viewingSession.date).toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'numeric' })} בשעה {viewingSession.time}</p>
                          <p className="text-gray-500 font-black mt-1">📍 {viewingSession.location}</p>
                      </div>
                      
                      {viewingSession.description && (
                          <div className="bg-brand-primary/10 border-r-4 border-brand-primary p-6 rounded-l-[30px]">
                              <p className="text-brand-primary text-[10px] font-black uppercase mb-2">דגשי המאמן:</p>
                              <p className="text-white text-lg font-bold italic leading-relaxed whitespace-pre-wrap">{viewingSession.description}</p>
                          </div>
                      )}

                      <div className="space-y-4">
                          <h5 className="text-gray-500 font-black uppercase italic tracking-widest text-sm border-b border-white/10 pb-2">מי מגיע ({viewingSession.registeredPhoneNumbers.length}/{viewingSession.maxCapacity})</h5>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-48 overflow-y-auto no-scrollbar">
                              {viewingSession.registeredPhoneNumbers.map(phone => {
                                  const user = users.find(u => normalizePhone(u.phone) === normalizePhone(phone));
                                  return (
                                      <div key={phone} className="bg-gray-800/40 p-3 rounded-2xl flex items-center gap-3 border border-white/5">
                                          <div className="w-8 h-8 rounded-full bg-gray-900 flex items-center justify-center font-black text-[10px]" style={{ color: user?.userColor || '#A3E635' }}>{user?.fullName.charAt(0) || '?'}</div>
                                          <span className="text-white text-xs font-bold truncate">{user?.displayName || user?.fullName || 'מתאמן'}</span>
                                      </div>
                                  );
                              })}
                          </div>
                      </div>

                      <div className="pt-6 border-t border-white/5 flex gap-4">
                          <Button onClick={()=>setViewingSession(null)} className="flex-1 rounded-[30px] py-5 font-black italic uppercase shadow-xl">סגור</Button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {signingHealth && (
          <div className="fixed inset-0 bg-brand-black z-[1000] flex flex-col p-6 overflow-y-auto no-scrollbar text-right" dir="rtl">
              <div className="max-w-2xl mx-auto w-full space-y-8 py-10">
                  <h3 className="text-4xl font-black text-brand-primary italic uppercase mb-10">הצהרת בריאות 🖋️</h3>
                  <div className="bg-gray-800/40 p-8 rounded-[50px] border border-white/10 text-white text-lg leading-relaxed font-bold whitespace-pre-wrap shadow-inner">
                      {appConfig.healthDeclarationTemplate || 'אני מצהיר בזאת כי מצב בריאותי תקין ומאפשר ביצוע פעילות גופנית מאומצת.'}
                  </div>
                  <div className="space-y-4">
                      <label className="text-gray-500 font-black text-sm uppercase">תעודת זהות</label>
                      <input type="tel" className="w-full bg-gray-900 p-6 rounded-[30px] text-white font-black text-2xl border border-white/10 focus:border-brand-primary outline-none transition-all" value={idNumberInput} onChange={e=>setIdNumberInput(e.target.value)} placeholder="הקש ת.ז מלאה" />
                  </div>
                  <div className="pt-10">
                      <Button onClick={handleSignHealth} className="w-full py-8 rounded-[40px] text-2xl font-black italic bg-brand-primary text-black shadow-2xl" disabled={!idNumberInput}>חתימה ואישור ✓</Button>
                  </div>
              </div>
          </div>
      )}

      <div id="login-modal" className="hidden fixed inset-0 bg-black/95 z-[500] flex items-center justify-center p-6 backdrop-blur-3xl">
          <div className="bg-gray-900 p-10 rounded-[60px] w-full max-w-md border border-white/10 shadow-3xl text-right" dir="rtl">
              <h3 className="text-3xl font-black text-brand-primary italic uppercase mb-8">התחברות ⚡</h3>
              <div className="space-y-6">
                  <div>
                      <label className="text-[10px] text-gray-500 font-black mb-2 block uppercase tracking-widest">מספר טלפון</label>
                      <input type="tel" className="w-full bg-gray-800 p-6 rounded-[30px] text-white font-black text-xl border border-white/5 focus:border-brand-primary outline-none transition-all shadow-inner" value={loginPhoneInput} onChange={e=>setLoginPhoneInput(e.target.value)} placeholder="05XXXXXXXX" />
                  </div>
                  {isNewUserLogin && (
                      <div className="animate-pulse">
                          <label className="text-[10px] text-brand-primary font-black mb-2 block uppercase italic">שם מלא (משתמש חדש)</label>
                          <input type="text" className="w-full bg-gray-800 p-6 rounded-[30px] text-white font-black border border-brand-primary outline-none shadow-inner" value={loginNameInput} onChange={e=>setLoginNameInput(e.target.value)} />
                      </div>
                  )}
                  <Button onClick={handleLoginSubmit} className="w-full py-6 rounded-[30px] text-xl font-black italic shadow-2xl bg-brand-primary text-black">המשך ✓</Button>
                  <button onClick={() => { document.getElementById('login-modal')?.classList.add('hidden'); }} className="w-full text-center text-gray-600 font-black text-xs uppercase mt-4 hover:text-white transition-colors">חזרה</button>
              </div>
          </div>
      </div>

      <WhatsAppButton phone={appConfig.coachPhone} />
    </div>
  );
};

export default App;
