
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { User, TrainingSession, PaymentStatus, LocationDef, AppConfig, WeatherInfo, Quote } from './types';
import { SessionCard } from './components/SessionCard';
import { AdminPanel } from './components/AdminPanel';
import { Button } from './components/Button';
import { getMotivationQuote } from './services/geminiService';
import { getWeatherForDates } from './services/weatherService';
import { dataService } from './services/dataService';

const normalizePhone = (phone: string): string => {
    if (!phone) return '';
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('972')) cleaned = '0' + cleaned.substring(3);
    else if (!cleaned.startsWith('0')) cleaned = '0' + cleaned;
    return cleaned;
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

interface InstallPromptProps {
    isAdmin: boolean;
    deferredPrompt: any;
}

const InstallPromptOverlay: React.FC<InstallPromptProps> = ({ isAdmin, deferredPrompt }) => {
    const [visible, setVisible] = useState(false);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

    useEffect(() => {
        // Only show if not installed and we are in a relevant view
        if (!isStandalone) {
            const timer = setTimeout(() => setVisible(true), 3000);
            return () => clearTimeout(timer);
        }
    }, [isStandalone]);

    if (!visible || isStandalone) return null;

    const triggerInstall = async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            await deferredPrompt.userChoice;
            setVisible(false);
        } else if (isIOS) {
            // High-end instruction modal for iOS
            setVisible(true);
        } else {
            alert('כדי להתקין: לחץ על שלוש הנקודות בדפדפן ובחר "התקן אפליקציה"');
            setVisible(false);
        }
    };

    return (
        <div className="fixed inset-x-0 bottom-0 z-[150] p-6 ios-prompt-animation">
            <div className={`bg-gray-900 border-2 rounded-[40px] p-6 shadow-3xl text-right flex flex-col items-center gap-4 ${isAdmin ? 'border-red-500' : 'border-brand-primary'}`} dir="rtl">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-brand-black text-2xl font-black ${isAdmin ? 'bg-red-500' : 'bg-brand-primary'}`}>NIV</div>
                <div className="text-center">
                    <h4 className="text-white font-black text-xl mb-1">הורד את האפליקציה למסך הבית</h4>
                    <p className="text-gray-400 text-sm">לגישה מהירה ונוחה ללו"ז האימונים שלך</p>
                </div>
                
                {isIOS ? (
                    <div className="bg-gray-800/50 p-4 rounded-3xl w-full text-sm text-gray-300 flex flex-col gap-3">
                        <div className="flex items-center gap-3">
                            <span className="bg-gray-700 w-8 h-8 rounded-full flex items-center justify-center font-bold text-white">1</span>
                            <span>לחץ על כפתור השיתוף בתחתית הדפדפן (ריבוע עם חץ)</span>
                            <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="bg-gray-700 w-8 h-8 rounded-full flex items-center justify-center font-bold text-white">2</span>
                            <span>גלול מטה ובחר ב-"הוסף למסך הבית"</span>
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                        </div>
                        <button onClick={() => setVisible(false)} className="mt-2 text-brand-primary font-bold text-center w-full py-2">הבנתי, תודה</button>
                    </div>
                ) : (
                    <div className="flex gap-4 w-full">
                        <Button onClick={triggerInstall} className={`flex-1 py-4 rounded-3xl ${isAdmin ? 'bg-red-500' : 'bg-brand-primary'}`}>התקן עכשיו 🚀</Button>
                        <button onClick={() => setVisible(false)} className="px-6 text-gray-500 font-bold">לא עכשיו</button>
                    </div>
                )}
            </div>
        </div>
    );
};

const App: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  
  const getInitialView = () => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    if (mode === 'admin') return 'admin';
    if (mode === 'work') return 'work';
    return 'landing';
  };

  const [currentView, setCurrentView] = useState<'landing' | 'work' | 'admin'>(getInitialView());
  const isAdminMode = currentView === 'admin';
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(localStorage.getItem('niv_admin_auth') === 'true');
  
  const [workoutTypes, setWorkoutTypes] = useState<string[]>([]);
  const [locations, setLocations] = useState<LocationDef[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [appConfig, setAppConfig] = useState<AppConfig>({
      coachNameHeb: 'ניב כהן', coachNameEng: 'NIV COHEN', coachPhone: '0500000000', coachEmail: '', defaultCity: 'נס ציונה', coachAdditionalPhone: 'admin', urgentMessage: ''
  });
  const [currentUserPhone, setCurrentUserPhone] = useState<string | null>(localStorage.getItem('niv_app_current_phone'));
  const [quote, setQuote] = useState('');
  const [weatherData, setWeatherData] = useState<Record<string, WeatherInfo>>({});
  const [viewingSession, setViewingSession] = useState<TrainingSession | null>(null);

  const currentUser = useMemo(() => users.find(u => normalizePhone(u.phone) === normalizePhone(currentUserPhone || '')), [users, currentUserPhone]);
  
  const navigateTo = (view: 'landing' | 'work' | 'admin') => {
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
      let newUrl = window.location.origin;
      if (view === 'admin') newUrl += '/?mode=admin';
      else if (view === 'work') newUrl += '/?mode=work';
      
      window.history.pushState({}, '', newUrl);
  };

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const stats = useMemo(() => {
    if (!currentUser) return { monthly: 0, record: 0, streak: 0 };
    const phone = normalizePhone(currentUser.phone);
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
    return { monthly: monthlyCount, record: Math.max(currentUser.monthlyRecord || 0, monthlyCount), streak };
  }, [currentUser, sessions]);

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

  useEffect(() => {
    document.documentElement.style.setProperty('--brand-primary', isAdminMode ? '#EF4444' : '#A3E635');
  }, [isAdminMode]);

  const refreshData = useCallback(async () => {
      try {
          const [u, s, locs, types, config, q] = await Promise.all([
              dataService.getUsers(), dataService.getSessions(), dataService.getLocations(), dataService.getWorkoutTypes(), dataService.getAppConfig(), dataService.getQuotes()
          ]);
          setUsers(u); setSessions(s); setLocations(locs); setWorkoutTypes(types); setAppConfig(config); setQuotes(q);
          if (q.length > 0) {
            setQuote(q[Math.floor(Math.random() * q.length)].text);
          } else {
            getMotivationQuote().then(setQuote);
          }
          const dates = Array.from({length: 14}, (_, i) => {
            const d = new Date(); d.setDate(d.getDate() - 3 + i);
            return d.toISOString().split('T')[0];
          });
          getWeatherForDates(dates).then(setWeatherData);
      } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { refreshData(); }, [refreshData]);

  const handleRegisterClick = async (sid: string) => {
      if (!currentUserPhone) { document.getElementById('login-modal')?.classList.remove('hidden'); return; }
      const session = sessions.find(s => s.id === sid);
      if (!session || session.isCancelled) return;
      const phone = normalizePhone(currentUserPhone);
      let updated = { ...session };
      if (session.registeredPhoneNumbers.includes(phone)) {
          updated.registeredPhoneNumbers = session.registeredPhoneNumbers.filter(p => p !== phone);
      } else {
          if (session.registeredPhoneNumbers.length >= session.maxCapacity) { alert('האימון מלא!'); return; }
          updated.registeredPhoneNumbers = [...session.registeredPhoneNumbers, phone];
      }
      setSessions(prev => prev.map(s => s.id === sid ? updated : s));
      await dataService.updateSession(updated);
  };

  const todayStr = new Date().toISOString().split('T')[0];

  const addToCalendar = (session: TrainingSession) => {
      const cleanDate = session.date.replace(/-/g, '');
      const cleanTime = session.time.replace(':', '');
      const start = `${cleanDate}T${cleanTime}00`;
      const [h, m] = session.time.split(':').map(Number);
      const endHour = (h + 1).toString().padStart(2, '0');
      const end = `${cleanDate}T${endHour}${m.toString().padStart(2, '0')}00`;
      const url = `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent('אימון: ' + session.type)}&dates=${start}/${end}&location=${encodeURIComponent(session.location)}`;
      window.open(url, '_blank');
  };

  const navigateToLocation = (locationName: string) => {
      const loc = locations.find(l => l.name === locationName);
      const addr = loc ? loc.address : locationName;
      window.open(`https://waze.com/ul?q=${encodeURIComponent(addr)}`, '_blank');
  };

  const handleDuplicateSession = async (session: TrainingSession) => {
      const newSession = { ...session, id: Date.now().toString(), registeredPhoneNumbers: [], attendedPhoneNumbers: [] };
      setSessions(prev => [...prev, newSession]);
      await dataService.addSession(newSession);
  };

  if (currentView === 'landing') {
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
        <div className="z-10 max-w-2xl space-y-12">
            <h1 className="text-8xl sm:text-9xl font-black italic text-white uppercase leading-none tracking-tighter">NIV COHEN</h1>
            <p className="text-2xl sm:text-4xl font-black tracking-[0.5em] text-brand-primary uppercase mt-4">CONSISTENCY TRAINING</p>
            <div className="bg-gray-900/60 backdrop-blur-2xl p-10 rounded-[60px] border border-white/5 shadow-2xl">
                <p className="text-2xl font-black text-white italic">"{quote || 'הכאב הוא זמני, הגאווה היא נצחית.'}"</p>
            </div>
            <Button onClick={() => navigateTo('work')} className="py-8 rounded-[45px] text-2xl font-black italic uppercase">כניסה ללו"ז אימונים ⚡</Button>
            <button onClick={() => navigateTo('admin')} className="text-gray-700 text-xs font-bold hover:text-red-500 transition-colors mt-10">ניהול מאמן</button>
        </div>
        <WhatsAppButton phone={appConfig.coachPhone} />
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isAdminMode ? 'bg-red-950/10' : 'bg-brand-black'} pb-20 font-sans transition-all duration-500`}>
      <header className={`p-6 border-b border-gray-800/50 backdrop-blur-md sticky top-0 z-50 ${isAdminMode ? 'bg-red-900/40 border-red-500/30' : 'bg-brand-black/80'}`}>
          <div className="flex justify-between items-center mb-6">
              <div onClick={() => navigateTo('landing')} className="cursor-pointer group">
                  <h1 className="text-5xl font-black italic text-white uppercase leading-none transition-all duration-500 group-hover:text-brand-primary">NIV COHEN</h1>
                  <p className="text-[16px] font-black tracking-[0.4em] text-brand-primary uppercase mt-1">CONSISTENCY TRAINING</p>
              </div>
              {currentUser && !isAdminMode && (
                  <div className="text-right cursor-pointer" onClick={() => navigateTo('landing')}>
                      <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">פרופיל אישי</p>
                      <p className="text-white font-black italic text-sm" style={{ color: currentUser.userColor || 'white' }}>{currentUser.displayName || currentUser.fullName}</p>
                  </div>
              )}
          </div>
          {currentUser && !isAdminMode && (
              <div className="grid grid-cols-4 gap-2">
                  <div className="bg-gray-800/40 p-4 rounded-2xl text-center"><p className="text-[9px] text-gray-500 uppercase mb-1">החודש</p><p className="text-brand-primary font-black text-3xl leading-none">{stats.monthly}</p></div>
                  <div className="bg-gray-800/40 p-4 rounded-2xl text-center"><p className="text-[9px] text-gray-500 uppercase mb-1">שיא</p><p className="text-white font-black text-3xl leading-none">{stats.record}</p></div>
                  <div className="bg-orange-500/10 p-4 rounded-2xl text-center"><p className="text-[9px] text-orange-500 uppercase mb-1">רצף 🔥</p><p className="text-orange-400 font-black text-3xl leading-none">{stats.streak}</p></div>
                  <div className="bg-brand-primary/10 p-4 rounded-2xl text-center overflow-hidden"><p className="text-[9px] text-brand-primary uppercase mb-1">אלוף 🏆</p><p className="text-white font-black text-lg leading-none truncate w-full">{monthLeader.name}</p></div>
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
                onDeleteUser={async id => { await dataService.deleteUser(id); setUsers(prev => prev.filter(x=>x.id!==id)); }}
                onAddSession={async s => { await dataService.addSession(s); setSessions(prev => [...prev, s]); }}
                onUpdateSession={async s => { await dataService.updateSession(s); setSessions(prev => prev.map(x=>x.id===s.id?s:x)); }}
                onDeleteSession={async id => { await dataService.deleteSession(id); setSessions(prev => prev.filter(x=>x.id!==id)); }}
                onUpdateWorkoutTypes={async t => { await dataService.saveWorkoutTypes(t); setWorkoutTypes(t); refreshData(); }} 
                onUpdateLocations={async l => { await dataService.saveLocations(l); setLocations(l); refreshData(); }}
                onUpdateAppConfig={async c => { await dataService.saveAppConfig(c); setAppConfig(c); }} onExitAdmin={() => navigateTo('work')}
                onDuplicateSession={handleDuplicateSession}
                onAddToCalendar={addToCalendar}
                onColorChange={()=>{}} onUpdateWeatherLocation={()=>{}} onAddPaymentLink={()=>{}} onDeletePaymentLink={()=>{}} onUpdateStreakGoal={()=>{}}
            />
        ) : (
            <div className="space-y-16 pb-20">
              {Array.from({length:7}, (_,i) => {
                  const d = new Date();
                  d.setHours(12, 0, 0, 0); // Normalized noon for TZ safety
                  const dayOfWeek = d.getDay(); 
                  d.setDate(d.getDate() - dayOfWeek + i);
                  const dateStr = d.toISOString().split('T')[0];
                  const daySessions = sessions.filter(s => s.date === dateStr && !s.isHidden).sort((a,b)=>a.time.localeCompare(b.time));
                  return (
                      <div key={dateStr} className="relative">
                          <div className="sticky top-[140px] z-30 bg-brand-black/90 py-3 border-b-2 border-brand-primary/20 mb-6 flex justify-between items-end px-2">
                             <h2 className={`text-4xl font-black italic uppercase tracking-tighter ${dateStr === todayStr ? 'text-brand-primary' : 'text-gray-500'}`}>
                                {d.toLocaleDateString('he-IL',{weekday:'long'})}
                             </h2>
                             <p className="text-[10px] font-black text-gray-700 uppercase">{d.toLocaleDateString('he-IL',{day:'numeric', month:'numeric'})}</p>
                          </div>
                          <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
                              {daySessions.map(s => <SessionCard key={s.id} session={s} allUsers={users} isRegistered={!!currentUserPhone && s.registeredPhoneNumbers.includes(normalizePhone(currentUserPhone))} onRegisterClick={handleRegisterClick} onViewDetails={(sid) => setViewingSession(sessions.find(x => x.id === sid) || null)} locations={locations} weather={weatherData[s.date]}/>)}
                              {daySessions.length === 0 && <p className="text-gray-700 text-[9px] uppercase font-black tracking-[0.2em] col-span-full text-center py-8 italic border-2 border-dashed border-gray-900 rounded-[40px]">מנוחה וחידוש כוחות</p>}
                          </div>
                      </div>
                  );
              })}
            </div>
        )}
      </main>

      {viewingSession && !isAdminMode && (
        <div className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center p-4 backdrop-blur-2xl">
            <div className="bg-gray-900 p-8 rounded-[50px] w-full max-w-lg border border-white/10 text-right shadow-3xl overflow-y-auto no-scrollbar max-h-[90vh]" dir="rtl">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h3 className="text-4xl font-black text-white italic leading-none">{viewingSession.type}</h3>
                        <p className="text-brand-primary font-black text-2xl mt-2 italic font-mono tracking-widest">{viewingSession.time}</p>
                    </div>
                    <button onClick={() => setViewingSession(null)} className="text-gray-500 text-3xl hover:text-white transition-colors">✕</button>
                </div>
                <div className="space-y-6">
                    {viewingSession.description && (
                        <div className="p-5 bg-brand-primary/10 border border-brand-primary/20 rounded-[30px]">
                            <p className="text-white text-sm font-bold leading-relaxed">{viewingSession.description}</p>
                        </div>
                    )}
                    {viewingSession.isZoomSession && viewingSession.zoomLink && (
                        <a href={viewingSession.zoomLink} target="_blank" rel="noreferrer" className="block p-5 bg-blue-600/10 border border-blue-500/20 rounded-[30px] text-blue-400 text-center font-black italic">
                             כנס לאימון זום 🎥
                        </a>
                    )}
                    <div className="bg-gray-800 p-6 rounded-[35px] border border-white/5">
                        <p className="text-[10px] font-black text-gray-500 uppercase mb-3 tracking-widest">נרשמו ({viewingSession.registeredPhoneNumbers.length}/{viewingSession.maxCapacity})</p>
                        <div className="flex flex-wrap gap-2">
                            {viewingSession.registeredPhoneNumbers.length > 0 ? viewingSession.registeredPhoneNumbers.map(phone => {
                                const t = users.find(u => normalizePhone(u.phone) === normalizePhone(phone));
                                return (
                                    <div key={phone} className="px-3 py-1.5 rounded-full bg-gray-900 text-white text-[11px] border border-white/5 flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full" style={{ background: t?.userColor || '#A3E635' }}></div>
                                        {t ? (t.displayName || t.fullName.split(' ')[0]) : 'מתאמן'}
                                    </div>
                                );
                            }) : <p className="text-gray-600 text-xs italic">עדיין אין נרשמים...</p>}
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Button onClick={() => navigateToLocation(viewingSession.location)} className="py-5 rounded-[30px] bg-blue-600/20 text-blue-400 border border-blue-500/20 flex items-center justify-center gap-2">
                            <span>🚙</span> Waze
                        </Button>
                        <Button onClick={() => addToCalendar(viewingSession)} className="py-5 rounded-[30px] bg-brand-primary/20 text-brand-primary border border-brand-primary/20 flex items-center justify-center gap-2">
                            <span>📅</span> ליומן
                        </Button>
                    </div>
                    <Button 
                        onClick={() => { handleRegisterClick(viewingSession.id); setViewingSession(null); }} 
                        className={`w-full py-6 rounded-[40px] text-xl font-black italic shadow-2xl ${viewingSession.registeredPhoneNumbers.includes(normalizePhone(currentUserPhone || '')) ? 'bg-red-500 shadow-red-500/20' : 'bg-brand-primary shadow-brand-primary/20'}`}
                        disabled={viewingSession.isCancelled || (viewingSession.registeredPhoneNumbers.length >= viewingSession.maxCapacity && !viewingSession.registeredPhoneNumbers.includes(normalizePhone(currentUserPhone || '')))}
                    >
                        {viewingSession.registeredPhoneNumbers.includes(normalizePhone(currentUserPhone || '')) ? 'ביטול הרשמה' : 'הרשמה מהירה ⚡'}
                    </Button>
                </div>
            </div>
        </div>
      )}

      <InstallPromptOverlay isAdmin={isAdminMode} deferredPrompt={deferredPrompt} />
      <WhatsAppButton phone={appConfig.coachPhone} />
      
      <div id="login-modal" className="fixed inset-0 bg-black/95 z-[200] hidden flex items-center justify-center p-6 backdrop-blur-xl">
          <div className="bg-gray-900 p-12 rounded-[60px] w-full max-w-sm border border-gray-800 text-center shadow-3xl">
              <h3 className="text-white font-black text-4xl mb-6 italic uppercase">מי המתאמן? 🤔</h3>
              <input type="tel" id="user-phone" placeholder='05x-xxxxxxx' className="w-full p-8 bg-gray-800 text-white rounded-[40px] mb-10 text-center text-5xl font-mono outline-none border border-gray-700 focus:border-brand-primary" />
              <Button onClick={() => { 
                  const p = (document.getElementById('user-phone') as HTMLInputElement).value;
                  if(p.length >= 9) { setCurrentUserPhone(p); localStorage.setItem('niv_app_current_phone', p); document.getElementById('login-modal')?.classList.add('hidden'); }
                  else alert('מספר לא תקין');
              }} className="w-full py-8 rounded-[45px] shadow-2xl shadow-brand-primary/20">התחברות 🚀</Button>
          </div>
      </div>
    </div>
  );
};

export default App;
