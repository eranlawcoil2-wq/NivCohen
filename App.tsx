
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { User, TrainingSession, PaymentStatus, LocationDef, AppConfig, WeatherInfo, Quote } from './types';
import { SessionCard } from './components/SessionCard';
import { AdminPanel } from './components/AdminPanel';
import { Button } from './components/Button';
import { getMotivationQuote } from './services/geminiService';
import { getWeatherForDates, getCityCoordinates } from './services/weatherService';
import { dataService } from './services/dataService';

const normalizePhone = (phone: string): string => {
    if (!phone) return '';
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('972')) cleaned = '972' + cleaned.substring(3);
    else if (cleaned.startsWith('0')) cleaned = '972' + cleaned.substring(1);
    else if (!cleaned.startsWith('972')) cleaned = '972' + cleaned;
    return cleaned;
};

const navigateToLocation = (location: string, locations: LocationDef[] = []) => {
    const loc = locations.find(l => l.name === location);
    const query = loc?.address || location;
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
    return 'landing';
  });

  const isAdminMode = currentView === 'admin';
  const isLanding = currentView === 'landing';
  const isChampMode = currentView === 'CHAMP';

  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(() => localStorage.getItem('niv_admin_auth') === 'true');
  const [showUrgent, setShowUrgent] = useState(true);
  const [workoutTypes, setWorkoutTypes] = useState<string[]>([]);
  const [locations, setLocations] = useState<LocationDef[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [appConfig, setAppConfig] = useState<AppConfig>({
      coachNameHeb: 'ניב כהן', coachNameEng: 'NIV COHEN', coachPhone: '0528726618', coachEmail: '', defaultCity: 'נס ציונה', coachAdditionalPhone: 'admin', urgentMessage: '', coachBio: '', healthDeclarationTemplate: 'אני מצהיר כי מצב בריאותי תקין ומאפשר ביצוע פעילות גופנית...'
  });
  const [currentUserPhone, setCurrentUserPhone] = useState<string | null>(() => localStorage.getItem('niv_app_current_phone'));
  const [loginPhoneInput, setLoginPhoneInput] = useState('');
  const [loginNameInput, setLoginNameInput] = useState('');
  const [isNewUserLogin, setIsNewUserLogin] = useState(false);
  const [idNumberInput, setIdNumberInput] = useState('');
  
  const [quote, setQuote] = useState('');
  const [weatherData, setWeatherData] = useState<Record<string, WeatherInfo>>({});
  const [viewingSession, setViewingSession] = useState<TrainingSession | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [hasScrolledToToday, setHasScrolledToToday] = useState(false);
  
  const [traineeWeekOffset, setTraineeWeekOffset] = useState(0);

  const isSyncingRef = useRef(false);

  const currentUser = useMemo(() => users.find(u => normalizePhone(u.phone) === normalizePhone(currentUserPhone || '')), [users, currentUserPhone]);
  
  const handleUpdateProfile = async (updated: User) => {
      setUsers(prev => prev.map(u => u.id === updated.id ? updated : u));
      if (normalizePhone(updated.phone) !== normalizePhone(currentUserPhone || '')) {
          const np = normalizePhone(updated.phone);
          setCurrentUserPhone(np);
          localStorage.setItem('niv_app_current_phone', np);
      }
      await dataService.updateUser(updated);
  };

  const handleSignDeclaration = async () => {
    if (!currentUser) return;
    if (idNumberInput.length < 8) {
        alert('נא להזין מספר תעודת זהות תקין');
        return;
    }
    const now = new Date();
    const updatedUser: User = {
        ...currentUser,
        healthDeclarationId: idNumberInput,
        healthDeclarationDate: now.toLocaleString('he-IL')
    };
    await handleUpdateProfile(updatedUser);
    setIdNumberInput('');
    alert('הצהרת הבריאות נחתמה בהצלחה!');
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
      
      try {
          let newUrl = window.location.origin + window.location.pathname;
          if (view === 'admin') newUrl += '?mode=admin';
          else if (view === 'work') newUrl += '?mode=work';
          else if (view === 'CHAMP') newUrl += '?mode=CHAMP';
          window.history.pushState({}, '', newUrl);
      } catch (e) {
          console.warn("History pushState failed.");
      }
  };

  useEffect(() => {
    const handler = (e: any) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

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

  const monthLeader = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const attendanceMap: Record<string, number> = {};
    sessions.forEach(s => {
      if (new Date(s.date).getMonth() === currentMonth) {
        (s.attendedPhoneNumbers || []).forEach(p => {
          const np = normalizePhone(p);
          attendanceMap[np] = (attendanceMap[np] || 0) + 1;
        });
      }
    });
    let topCount = 0;
    let topPhone = '';
    Object.entries(attendanceMap).forEach(([phone, count]) => {
      if (count > topCount) { topCount = count; topPhone = phone; }
    });
    const leader = users.find(u => normalizePhone(u.phone) === topPhone);
    return { name: leader ? (leader.displayName || leader.fullName.split(' ')[0]) : '---', count: topCount };
  }, [sessions, users]);

  const refreshData = useCallback(async () => {
      if (isSyncingRef.current) return; 
      try {
          const [u, s, locs, types, config, q] = await Promise.all([
              dataService.getUsers(), dataService.getSessions(), dataService.getLocations(), dataService.getWorkoutTypes(), dataService.getAppConfig(), dataService.getQuotes()
          ]);
          setUsers(u); setSessions(s); setLocations(locs); setWorkoutTypes(types); setAppConfig(config); setQuotes(q);
          if (q.length > 0 && !quote) setQuote(q[Math.floor(Math.random() * q.length)].text);
          else if (!quote) getMotivationQuote().then(setQuote);
          
          const coords = await getCityCoordinates(config.defaultCity || 'נס ציונה');
          if (coords) {
              const dates = Array.from({length: 14}, (_, i) => {
                const d = new Date(); d.setDate(d.getDate() - 3 + i);
                return d.toISOString().split('T')[0];
              });
              getWeatherForDates(dates, coords.lat, coords.lon).then(setWeatherData).catch(() => {});
          }
      } catch (e) {
          console.error("Refresh failed:", e);
      }
  }, [quote]);

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 10000); 
    return () => clearInterval(interval);
  }, [refreshData, currentView]); 

  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
      if (!isAdminMode && !isLanding && sessions.length > 0 && !hasScrolledToToday && traineeWeekOffset === 0) {
          setTimeout(() => {
            const el = document.getElementById(`day-${todayStr}`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                setHasScrolledToToday(true);
            }
          }, 600);
      }
  }, [sessions, todayStr, isAdminMode, isLanding, hasScrolledToToday, traineeWeekOffset]);

  const handleRegisterClick = async (sid: string) => {
      if (!currentUserPhone) { document.getElementById('login-modal')?.classList.remove('hidden'); return; }
      if (currentUser?.isRestricted) { alert('חשבונך מוגבל. פנה למאמן.'); return; }
      
      const session = sessions.find(s => s.id === sid);
      if (!session || session.isCancelled) return;

      const phone = normalizePhone(currentUserPhone);
      let updated = { ...session };
      if (session.registeredPhoneNumbers.includes(phone)) {
          updated.registeredPhoneNumbers = session.registeredPhoneNumbers.filter(p => p !== phone);
          updated.attendedPhoneNumbers = (session.attendedPhoneNumbers || []).filter(p => p !== phone);
      } else {
          if (session.registeredPhoneNumbers.length >= session.maxCapacity) { alert('האימון מלא!'); return; }
          updated.registeredPhoneNumbers = [...session.registeredPhoneNumbers, phone];
          updated.attendedPhoneNumbers = [...(session.attendedPhoneNumbers || []), phone];
      }
      
      setSessions(prev => prev.map(s => s.id === sid ? updated : s));
      await dataService.updateSession(updated);
  };

  const handleLoginSubmit = async () => {
    if (loginPhoneInput.length < 9) {
      alert('מספר טלפון לא תקין');
      return;
    }
    const np = normalizePhone(loginPhoneInput);
    const existingUser = users.find(u => normalizePhone(u.phone) === np);

    if (existingUser) {
      setCurrentUserPhone(np);
      localStorage.setItem('niv_app_current_phone', np);
      document.getElementById('login-modal')?.classList.add('hidden');
      refreshData();
    } else {
      if (!isNewUserLogin) {
        setIsNewUserLogin(true);
      } else {
        if (loginNameInput.length < 2) {
          alert('אנא הזן שם מלא');
          return;
        }
        const newUser: User = {
          id: Date.now().toString(),
          fullName: loginNameInput,
          phone: np,
          email: '',
          startDate: new Date().toISOString().split('T')[0],
          paymentStatus: PaymentStatus.PENDING,
          userColor: '#A3E635'
        };
        await dataService.addUser(newUser);
        setUsers(prev => [...prev, newUser]);
        setCurrentUserPhone(np);
        localStorage.setItem('niv_app_current_phone', np);
        document.getElementById('login-modal')?.classList.add('hidden');
        refreshData();
      }
    }
  };

  if (isLanding) {
    return (
      <div className="min-h-screen bg-brand-black flex flex-col items-center justify-center p-8 text-center relative overflow-hidden">
        <div className="absolute inset-0 z-0 flex items-center justify-center opacity-10 pointer-events-none">
            <svg viewBox="0 0 100 100" className="w-[85vw] h-[85vw] text-white">
                <path fill="currentColor" d="M48 0 L52 0 L52 10 L48 10 Z" />
                <path fill="currentColor" d="M48 10 L15 90 L20 90 L50 15 Z" />
                <path fill="currentColor" d="M52 10 L85 90 L80 90 L50 15 Z" />
                <rect x="15" y="90" width="10" height="2" fill="currentColor" />
                <rect x="75" y="90" width="10" height="2" fill="currentColor" />
            </svg>
        </div>
        <div className="z-10 max-w-2xl space-y-12 py-12">
            <div>
                <h1 className="text-7xl sm:text-9xl font-black italic text-white uppercase leading-none tracking-tighter">NIV COHEN</h1>
                <p className="text-xl sm:text-3xl font-black tracking-[0.5em] text-brand-primary uppercase mt-4">CONSISTENCY TRAINING</p>
            </div>
            
            <div className="bg-gray-900/60 backdrop-blur-3xl p-8 sm:p-12 rounded-[50px] sm:rounded-[80px] border border-white/5 shadow-2xl text-right" dir="rtl">
                <h2 className="text-brand-primary font-black text-3xl mb-6 italic">קצת עלי...</h2>
                <div className="space-y-6 text-white text-lg sm:text-xl font-bold leading-relaxed opacity-90 whitespace-pre-wrap">
                    {appConfig.coachBio}
                </div>
            </div>

            <div className="bg-gray-900/40 backdrop-blur-2xl p-8 rounded-[40px] border border-white/5 inline-block">
                <p className="text-xl font-black text-white italic">"{quote || 'הכאב הוא זמני, הגאווה היא נצחית.'}"</p>
            </div>
            
            <div className="pt-8">
               <Button onClick={() => navigateTo('work')} className="py-8 px-16 rounded-[40px] text-2xl font-black italic shadow-2xl animate-bounce">כניסה ללו"ז 🚀</Button>
            </div>
        </div>
        <WhatsAppButton phone={appConfig.coachPhone} />
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isAdminMode ? 'bg-red-950/10' : 'bg-brand-black'} pb-20 font-sans transition-all duration-500`}>
      {appConfig.urgentMessage && showUrgent && (
          <div className="bg-red-600 text-white py-2 px-4 text-center font-black italic text-xs sm:text-sm shadow-xl z-[100] sticky top-0 left-0 right-0 overflow-hidden flex items-center justify-center">
              <div className="animate-pulse flex items-center gap-2">
                  <span>📢</span>
                  <span>{appConfig.urgentMessage}</span>
                  <span>📢</span>
              </div>
              <button onClick={() => setShowUrgent(false)} className="absolute right-4 text-white/70 hover:text-white transition-colors">✕</button>
          </div>
      )}

      <header className={`p-6 border-b border-gray-800/50 backdrop-blur-md sticky top-0 z-[60] ${isAdminMode ? 'bg-red-900/40 border-red-500/30' : 'bg-brand-black/80'} ${appConfig.urgentMessage && showUrgent ? 'mt-0' : ''}`}>
          <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-4">
                  {currentUser && !isAdminMode && (
                      <div className="text-right cursor-pointer group active:scale-95 transition-transform" onClick={() => setShowProfile(true)}>
                          <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest group-hover:text-brand-primary transition-colors text-left">פרופיל אישי</p>
                          <p className="text-white font-black italic text-sm group-hover:text-brand-primary transition-colors" style={{ color: currentUser.userColor || 'white' }}>{currentUser.displayName || currentUser.fullName}</p>
                      </div>
                  )}
              </div>
              <div className="text-center" onClick={() => navigateTo('landing')}>
                  <h1 className="text-3xl sm:text-4xl font-black italic text-white uppercase leading-none transition-all duration-500">NIV COHEN</h1>
                  <p className="text-[10px] sm:text-[12px] font-black tracking-[0.4em] text-brand-primary uppercase mt-1">CONSISTENCY TRAINING</p>
                  {isChampMode && <p className="text-[8px] font-black text-brand-primary mt-1 uppercase italic tracking-widest">CHAMP VIEW 🏆</p>}
              </div>
              <div className="w-20 flex justify-end">
                 {isAdminMode && <button onClick={() => navigateTo('work')} className="bg-gray-800 text-white p-2 rounded-xl text-[10px] font-black uppercase italic border border-white/10">לו"ז</button>}
              </div> 
          </div>
          {currentUser && !isAdminMode && !isChampMode && (
              <div className="grid grid-cols-4 gap-2">
                  <div className="bg-gray-800/40 p-4 rounded-2xl text-center"><p className="text-[9px] text-gray-500 uppercase mb-1">החודש</p><p className="text-brand-primary font-black text-3xl leading-none">{stats.monthly}</p></div>
                  <div className="bg-gray-800/40 p-4 rounded-2xl text-center"><p className="text-[9px] text-gray-500 uppercase mb-1">שיא</p><p className="text-white font-black text-3xl leading-none">{stats.record}</p></div>
                  <div className="bg-orange-500/10 p-4 rounded-2xl text-center"><p className="text-[9px] text-orange-500 uppercase mb-1">רצף 🔥</p><p className="text-orange-400 font-black text-3xl leading-none">{stats.streak}</p></div>
                  <div className="bg-brand-primary/10 p-4 rounded-2xl text-center overflow-hidden"><p className="text-[9px] text-brand-primary uppercase mb-1">אלוף 🏆</p><p className="text-white font-black text-lg font-bold leading-none truncate w-full">{(monthLeader.name as string)}</p></div>
              </div>
          )}
      </header>

      <main className="max-w-4xl mx-auto p-4">
        {isAdminMode ? (
             <AdminPanel 
                users={users} sessions={sessions} primaryColor="#EF4444" workoutTypes={workoutTypes}
                locations={locations} weatherLocation={{name: appConfig.defaultCity, lat:0, lon:0}} paymentLinks={[]} streakGoal={3}
                appConfig={appConfig} quotes={quotes} weatherData={weatherData} onAddUser={async u => { await dataService.addUser(u); setUsers(prev => [...prev, u]); }}
                onUpdateUser={async u => { await dataService.updateUser(u); setUsers(prev => prev.map(x=>x.id===u.id?u:x)); }}
                onAddSession={async s => { 
                    isSyncingRef.current = true;
                    try {
                        await dataService.addSession(s); 
                        setSessions(prev => [...prev, s]); 
                    } finally {
                        isSyncingRef.current = false;
                    }
                }}
                onUpdateSession={async s => { 
                    isSyncingRef.current = true;
                    try {
                        await dataService.updateSession(s);
                        setSessions(prev => prev.map(x=>x.id===s.id?s:x)); 
                    } finally {
                        isSyncingRef.current = false;
                    }
                }}
                onDeleteUser={async id => { await dataService.deleteUser(id); setUsers(prev => prev.filter(x=>x.id!==id)); }}
                onDeleteSession={async id => { 
                    isSyncingRef.current = true;
                    try {
                        await dataService.deleteSession(id); 
                        setSessions(prev => prev.filter(x=>x.id!==id)); 
                    } finally {
                        isSyncingRef.current = false;
                    }
                }}
                onUpdateWorkoutTypes={async t => { await dataService.saveWorkoutTypes(t); setWorkoutTypes(t); refreshData(); }} 
                onUpdateLocations={async l => { await dataService.saveLocations(l); setLocations(l); refreshData(); }}
                onUpdateAppConfig={async c => { setAppConfig(c); }} onExitAdmin={() => navigateTo('work')}
                onDuplicateSession={async s => { 
                    isSyncingRef.current = true;
                    try {
                        const n = {...s, id: Date.now().toString() + Math.random().toString(36).substr(2, 5), registeredPhoneNumbers: [], attendedPhoneNumbers: []}; 
                        await dataService.addSession(n); 
                        setSessions(p=>[...p, n]); 
                    } finally {
                        isSyncingRef.current = false;
                    }
                }}
                onAddToCalendar={downloadICS}
                getStatsForUser={getStatsForUser}
                onColorChange={()=>{}} onUpdateWeatherLocation={()=>{}} onAddPaymentLink={()=>{}} onDeletePaymentLink={()=>{}} onUpdateStreakGoal={()=>{}}
            />
        ) : (
            <div className="space-y-10 pb-20">
              <div className="flex justify-between items-center bg-gray-800/40 p-4 rounded-3xl border border-white/5 shadow-xl">
                <button onClick={()=>setTraineeWeekOffset(p=>p-1)} className="text-white text-2xl p-2 hover:text-brand-primary transition-colors">←</button>
                <div className="flex flex-col items-center">
                    <span className="text-brand-primary font-black uppercase tracking-[0.3em] bg-brand-primary/10 px-4 py-1 rounded-full">{traineeWeekOffset === 0 ? 'השבוע' : traineeWeekOffset === 1 ? 'שבוע הבא' : traineeWeekOffset === -1 ? 'שבוע שעבר' : `בעוד ${traineeWeekOffset} שבועות`}</span>
                </div>
                <button onClick={()=>setTraineeWeekOffset(p=>p+1)} className="text-white text-2xl p-2 hover:text-brand-primary transition-colors">→</button>
              </div>

              {Array.from({length:7}, (_,i) => {
                  const d = new Date(); d.setHours(12, 0, 0, 0); 
                  const dow = d.getDay(); 
                  d.setDate(d.getDate() - dow + i + (traineeWeekOffset * 7));
                  const ds = d.toISOString().split('T')[0];
                  
                  let daySessions = sessions.filter(s => s.date === ds).sort((a,b)=>a.time.localeCompare(b.time));
                  
                  if (isChampMode) {
                      daySessions = daySessions.filter(s => {
                          const isPersonal = !!s.isPersonalTraining;
                          const amRegistered = currentUserPhone && s.registeredPhoneNumbers.includes(normalizePhone(currentUserPhone));
                          return isPersonal && amRegistered && !s.isCancelled;
                      });
                  } else {
                      daySessions = daySessions.filter(s => !s.isHidden && !s.isPersonalTraining && !s.isCancelled);
                  }

                  if (isChampMode && daySessions.length === 0) return null;

                  return (
                      <div key={ds} id={`day-${ds}`} className="relative scroll-mt-[220px]">
                          <div className="sticky top-[140px] z-30 bg-brand-black/90 py-3 border-b-2 border-brand-primary/20 mb-6 flex justify-between items-end px-2">
                             <h2 className={`text-4xl sm:text-5xl font-black italic uppercase tracking-tighter ${ds === todayStr ? 'text-brand-primary' : 'text-gray-500'}`}>{d.toLocaleDateString('he-IL',{weekday:'long'})}</h2>
                             <p className={`text-4xl sm:text-5xl font-black italic tracking-tighter ${ds === todayStr ? 'text-brand-primary' : 'text-gray-500'} opacity-30`}>{d.toLocaleDateString('he-IL',{day:'numeric', month:'numeric'})}</p>
                          </div>
                          <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
                              {daySessions.map(s => <SessionCard key={s.id} session={s} allUsers={users} isRegistered={!!currentUserPhone && s.registeredPhoneNumbers.includes(normalizePhone(currentUserPhone))} onRegisterClick={handleRegisterClick} onViewDetails={(sid) => setViewingSession(sessions.find(x => x.id === sid) || null)} locations={locations} weather={weatherData[ds]} onWazeClick={(l) => navigateToLocation(l, locations)} onAddToCalendar={downloadICS}/>)}
                              {daySessions.length === 0 && !isChampMode && <p className="text-gray-700 text-[9px] uppercase font-black tracking-[0.2em] col-span-full text-center py-8 italic border-2 border-dashed border-gray-900 rounded-[40px]">מנוחה וחידוש כוחות</p>}
                          </div>
                      </div>
                  );
              })}

              <div className="flex justify-between items-center bg-gray-800/40 p-6 rounded-[40px] border border-white/5 shadow-2xl mt-12 mb-20">
                <button onClick={() => { setTraineeWeekOffset(p => p - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="text-white text-3xl p-4 hover:text-brand-primary transition-colors">←</button>
                <div className="flex flex-col items-center">
                    <span className="text-gray-500 text-[10px] font-black uppercase tracking-[0.3em] mb-2">נווט בין שבועות</span>
                    <span className="text-brand-primary font-black uppercase tracking-[0.2em] bg-brand-primary/10 px-6 py-2 rounded-full border border-brand-primary/20">{traineeWeekOffset === 0 ? 'השבוע' : traineeWeekOffset === 1 ? 'שבוע הבא' : traineeWeekOffset === -1 ? 'שבוע שעבר' : `שבוע ${traineeWeekOffset}`}</span>
                </div>
                <button onClick={() => { setTraineeWeekOffset(p => p + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="text-white text-3xl p-4 hover:text-brand-primary transition-colors">→</button>
              </div>
            </div>
        )}
      </main>

      {showProfile && currentUser && (
          <div className="fixed inset-0 bg-black/95 z-[150] flex items-center justify-center p-6 backdrop-blur-2xl overflow-y-auto no-scrollbar">
              <div className="bg-gray-900 p-8 sm:p-12 rounded-[60px] w-full max-w-2xl border border-white/10 text-right shadow-3xl my-auto" dir="rtl">
                <div className="flex justify-between mb-8 border-b border-white/5 pb-5">
                    <h3 className="text-3xl font-black text-white italic uppercase">פרופיל אישי 👤</h3>
                    <button onClick={()=>setShowProfile(false)} className="text-gray-500 text-4xl">✕</button>
                </div>
                <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div><label className="text-[10px] text-gray-500 font-black mb-1 block uppercase">שם מלא</label><input className="w-full bg-gray-800 p-4 rounded-2xl text-white font-bold" value={currentUser.fullName} onChange={e => handleUpdateProfile({...currentUser, fullName: e.target.value})} /></div>
                        <div><label className="text-[10px] text-gray-500 font-black mb-1 block uppercase">כינוי</label><input className="w-full bg-gray-800 p-4 rounded-2xl text-white font-bold" value={currentUser.displayName || ''} onChange={e => handleUpdateProfile({...currentUser, displayName: e.target.value})} /></div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div><label className="text-[10px] text-gray-500 font-black mb-1 block uppercase">טלפון</label><input className="w-full bg-gray-800 p-4 rounded-2xl text-white font-bold font-mono" value={currentUser.phone} onChange={e => handleUpdateProfile({...currentUser, phone: e.target.value})} /></div>
                        <div><label className="text-[10px] text-gray-500 font-black mb-1 block uppercase">אימייל</label><input className="w-full bg-gray-800 p-4 rounded-2xl text-white font-bold" value={currentUser.email} onChange={e => handleUpdateProfile({...currentUser, email: e.target.value})} /></div>
                    </div>
                    <div>
                        <label className="text-[10px] text-gray-500 font-black mb-1 block uppercase">צבע כינוי</label>
                        <input type="color" className="w-full h-12 bg-gray-800 rounded-2xl p-2 cursor-pointer border-none" value={currentUser.userColor || '#A3E635'} onChange={e => handleUpdateProfile({...currentUser, userColor: e.target.value})} />
                    </div>

                    <div className="bg-gray-800/40 p-6 rounded-[40px] border border-white/5 space-y-4">
                        <h4 className="text-white font-black uppercase text-sm italic tracking-widest border-b border-white/10 pb-2">הצהרת בריאות 🩺</h4>
                        {currentUser.healthDeclarationDate ? (
                            <div className="bg-brand-primary/10 p-4 rounded-2xl border border-brand-primary/20 text-center">
                                <p className="text-brand-primary font-black text-xs uppercase mb-1">הצהרה חתומה ✅</p>
                                <p className="text-white text-[10px] font-bold">ת.ז: {currentUser.healthDeclarationId}</p>
                                <p className="text-white text-[10px] font-bold">נחתם ב: {currentUser.healthDeclarationDate}</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="bg-gray-900 p-4 rounded-2xl max-h-32 overflow-y-auto border border-white/5 text-[10px] font-bold text-gray-400 leading-relaxed scrollbar-thin">
                                    {appConfig.healthDeclarationTemplate}
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[9px] text-gray-500 font-black uppercase">הזן מספר תעודת זהות לחתימה:</label>
                                    <input 
                                        type="tel" 
                                        placeholder="תעודת זהות" 
                                        className="w-full bg-gray-900 p-4 rounded-2xl text-white font-bold outline-none border border-white/5 focus:border-brand-primary" 
                                        value={idNumberInput}
                                        onChange={e => setIdNumberInput(e.target.value)}
                                    />
                                    <Button onClick={handleSignDeclaration} className="w-full py-4 rounded-2xl text-xs">קראתי ואני מאשר את ההצהרה ✅</Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                <Button onClick={() => setShowProfile(false)} className="w-full mt-8 py-6 rounded-[40px] bg-white text-brand-black">סגור ✓</Button>
              </div>
          </div>
      )}

      {viewingSession && !isAdminMode && (
        <div className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center p-4 backdrop-blur-2xl">
            <div className="bg-gray-900 p-8 rounded-[50px] w-full max-lg border border-white/10 text-right shadow-3xl overflow-y-auto no-scrollbar max-h-[90vh]" dir="rtl">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h3 className="text-4xl font-black text-white italic leading-none">{viewingSession.type}</h3>
                        <p className="text-brand-primary font-black text-2xl mt-2 italic font-mono tracking-widest">{viewingSession.time}</p>
                        <p className="text-gray-400 text-sm font-black uppercase mt-1">{new Date(viewingSession.date).toLocaleDateString('he-IL', {weekday: 'long', day: 'numeric', month: 'numeric'})}</p>
                        <p className="text-gray-500 text-xs font-black uppercase mt-2 italic tracking-widest opacity-80 flex items-center gap-1"><span className="text-brand-primary">📍</span> {viewingSession.location}</p>
                    </div>
                    <button onClick={() => setViewingSession(null)} className="text-gray-500 text-4xl hover:text-white transition-colors">✕</button>
                </div>
                <div className="space-y-6">
                    {viewingSession.description && <div className="bg-brand-primary/10 border-r-4 border-brand-primary p-4 rounded-l-2xl"><p className="text-white text-sm font-bold leading-tight">{viewingSession.description}</p></div>}
                    <div className="bg-gray-800 p-6 rounded-[35px] border border-white/5">
                        <div className="flex justify-between items-center mb-4">
                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">מי מגיע ({viewingSession.registeredPhoneNumbers.length}/{viewingSession.maxCapacity})</p>
                            <button onClick={() => downloadICS(viewingSession)} className="text-[10px] font-black text-brand-primary uppercase underline italic">הוסף ליומן 📅</button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {viewingSession.registeredPhoneNumbers.map(phone => {
                                const t = users.find(u => normalizePhone(u.phone) === normalizePhone(phone));
                                return (
                                    <div key={phone} className="px-3 py-1.5 rounded-full bg-gray-900 text-white text-[11px] border border-white/5 flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full" style={{ background: t?.userColor || '#A3E635' }}></div>
                                        {t ? (t.displayName || t.fullName.split(' ')[0]) : 'מתאמן'}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    {!Boolean(viewingSession.isPersonalTraining) && (
                        <Button onClick={() => { handleRegisterClick(viewingSession.id); setViewingSession(null); }} className={`w-full py-6 rounded-[40px] text-xl font-black shadow-2xl ${viewingSession.registeredPhoneNumbers.includes(normalizePhone(currentUserPhone || '')) ? 'bg-red-500 shadow-red-500/20' : 'bg-brand-primary shadow-brand-primary/20'}`} disabled={viewingSession.isCancelled || (viewingSession.registeredPhoneNumbers.length >= viewingSession.maxCapacity && !viewingSession.registeredPhoneNumbers.includes(normalizePhone(currentUserPhone || '')))}>
                            {viewingSession.registeredPhoneNumbers.includes(normalizePhone(currentUserPhone || '')) ? 'ביטול הרשמה' : 'הרשמה מהירה ⚡'}
                        </Button>
                    )}
                </div>
            </div>
        </div>
      )}

      {(isLanding || isChampMode) && <WhatsAppButton phone={appConfig.coachPhone} />}
      <div id="login-modal" className="fixed inset-0 bg-black/95 z-[200] hidden flex items-center justify-center p-6 backdrop-blur-xl">
          <div className="bg-gray-900 p-12 rounded-[60px] w-full max-sm border border-gray-800 text-center shadow-3xl">
              <h3 className="text-white font-black text-4xl mb-6 italic uppercase">{isNewUserLogin ? 'ברוך הבא! איך קוראים לך?' : 'מי המתאמן? 🤔'}</h3>
              
              {!isNewUserLogin ? (
                <input 
                  type="tel" 
                  placeholder='05x-xxxxxxx' 
                  className="w-full p-6 bg-gray-800 text-white rounded-[40px] mb-10 text-center text-3xl font-mono outline-none border border-gray-700 focus:border-brand-primary" 
                  value={loginPhoneInput}
                  onChange={(e) => setLoginPhoneInput(e.target.value)}
                />
              ) : (
                <input 
                  type="text" 
                  placeholder='שם מלא' 
                  className="w-full p-6 bg-gray-800 text-white rounded-[40px] mb-10 text-center text-3xl font-black outline-none border border-gray-700 focus:border-brand-primary" 
                  value={loginNameInput}
                  onChange={(e) => setLoginNameInput(e.target.value)}
                  autoFocus
                />
              )}
              
              <Button onClick={handleLoginSubmit} className="w-full py-8 rounded-[45px] shadow-2xl shadow-brand-primary/20">
                {isNewUserLogin ? 'סיום הרשמה 🏁' : 'התחברות 🚀'}
              </Button>
          </div>
      </div>
    </div>
  );
};

export default App;
