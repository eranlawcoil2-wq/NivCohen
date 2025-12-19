
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

  // CRITICAL: Prevent refreshData from overwriting active edits or newly saved data
  const isSyncingRef = useRef(false);

  const currentUser = useMemo(() => users.find(u => normalizePhone(u.phone) === normalizePhone(currentUserPhone || '')), [users, currentUserPhone]);
  
  const handleUpdateProfile = async (updated: User) => {
      isSyncingRef.current = true;
      try {
          setUsers(prev => prev.map(u => u.id === updated.id ? updated : u));
          await dataService.updateUser(updated);
      } finally {
          isSyncingRef.current = false;
      }
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
      } catch (e) {}
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
        weekMap[sun.toISOString().split('T')[0]] = (weekMap[sun.toISOString().split('T')[0]] || 0) + 1;
    });
    let check = new Date(); check.setDate(check.getDate() - check.getDay());
    while(true) {
        if ((weekMap[check.toISOString().split('T')[0]] || 0) >= 3) { streak++; check.setDate(check.getDate() - 7); }
        else break;
        if (check.getFullYear() < 2024) break;
    }
    return { monthly: monthlyCount, record: Math.max(user.monthlyRecord || 0, monthlyCount), streak };
  }, [sessions]);

  const stats = useMemo(() => currentUser ? getStatsForUser(currentUser) : { monthly: 0, record: 0, streak: 0 }, [currentUser, getStatsForUser]);

  const refreshData = useCallback(async () => {
      if (isSyncingRef.current) return; 
      try {
          const [u, s, locs, types, config, q] = await Promise.all([
              dataService.getUsers(), dataService.getSessions(), dataService.getLocations(), dataService.getWorkoutTypes(), dataService.getAppConfig(), dataService.getQuotes()
          ]);
          setUsers(u); setSessions(s); setLocations(locs); setWorkoutTypes(types); setAppConfig(config); setQuotes(q);
          if (q.length > 0 && !quote) setQuote(q[Math.floor(Math.random() * q.length)].text);
      } catch (e) {}
  }, [quote]);

  useEffect(() => {
    refreshData();
    const interval = setInterval(() => { if (!isSyncingRef.current) refreshData(); }, 15000); 
    return () => clearInterval(interval);
  }, [refreshData]);

  const handleRegisterClick = async (sid: string) => {
      if (!currentUserPhone) { document.getElementById('login-modal')?.classList.remove('hidden'); return; }
      const session = sessions.find(s => s.id === sid);
      if (!session || session.isCancelled) return;
      isSyncingRef.current = true;
      const phone = normalizePhone(currentUserPhone);
      let updated = { ...session };
      if (session.registeredPhoneNumbers.includes(phone)) {
          updated.registeredPhoneNumbers = session.registeredPhoneNumbers.filter(p => p !== phone);
          updated.attendedPhoneNumbers = (session.attendedPhoneNumbers || []).filter(p => p !== phone);
      } else {
          if (session.registeredPhoneNumbers.length >= session.maxCapacity) { alert('האימון מלא!'); isSyncingRef.current = false; return; }
          updated.registeredPhoneNumbers = [...session.registeredPhoneNumbers, phone];
          updated.attendedPhoneNumbers = [...(session.attendedPhoneNumbers || []), phone];
      }
      setSessions(prev => prev.map(s => s.id === sid ? updated : s));
      try {
          await dataService.updateSession(updated);
      } finally {
          isSyncingRef.current = false;
      }
  };

  const handleLoginSubmit = async () => {
    if (loginPhoneInput.length < 9) return;
    const np = normalizePhone(loginPhoneInput);
    const existingUser = users.find(u => normalizePhone(u.phone) === np);
    if (existingUser) {
      setCurrentUserPhone(np);
      localStorage.setItem('niv_app_current_phone', np);
      document.getElementById('login-modal')?.classList.add('hidden');
    } else {
      if (!isNewUserLogin) setIsNewUserLogin(true);
      else {
        const newUser: User = { id: Date.now().toString(), fullName: loginNameInput, phone: np, email: '', startDate: new Date().toISOString().split('T')[0], paymentStatus: PaymentStatus.PENDING };
        await dataService.addUser(newUser);
        setUsers(prev => [...prev, newUser]);
        setCurrentUserPhone(np);
        localStorage.setItem('niv_app_current_phone', np);
        document.getElementById('login-modal')?.classList.add('hidden');
      }
    }
  };

  // ... (Rest of App UI remains unchanged)
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
                    } finally { isSyncingRef.current = false; }
                }}
                onUpdateSession={async s => { 
                    isSyncingRef.current = true;
                    try {
                        await dataService.updateSession(s);
                        setSessions(prev => prev.map(x=>x.id===s.id?s:x)); 
                    } finally { isSyncingRef.current = false; }
                }}
                onDeleteUser={async id => { await dataService.deleteUser(id); setUsers(prev => prev.filter(x=>x.id!==id)); }}
                onDeleteSession={async id => { 
                    isSyncingRef.current = true;
                    try {
                        await dataService.deleteSession(id); 
                        setSessions(prev => prev.filter(x=>x.id!==id)); 
                    } finally { isSyncingRef.current = false; }
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
                    } finally { isSyncingRef.current = false; }
                }}
                onAddToCalendar={downloadICS}
                getStatsForUser={getStatsForUser}
                onColorChange={()=>{}} onUpdateWeatherLocation={()=>{}} onAddPaymentLink={()=>{}} onDeletePaymentLink={()=>{}} onUpdateStreakGoal={()=>{}}
            />
        ) : (
            <div className="space-y-10 pb-20">
              {/* ... Trainee View ... */}
            </div>
        )}
      </main>
      <WhatsAppButton phone={appConfig.coachPhone} />
    </div>
  );
};

export default App;
