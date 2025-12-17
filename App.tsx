
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { User, TrainingSession, PaymentStatus, WorkoutType, WeatherLocation, LocationDef, AppConfig, WeatherInfo, Quote } from './types';
import { SessionCard } from './components/SessionCard';
import { AdminPanel } from './components/AdminPanel';
import { Button } from './components/Button';
import { getMotivationQuote } from './services/geminiService';
import { getWeatherForDates, getWeatherIcon } from './services/weatherService';
import { dataService } from './services/dataService';

const normalizePhone = (phone: string): string => {
    if (!phone) return '';
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('972')) cleaned = '0' + cleaned.substring(3);
    else if (!cleaned.startsWith('0')) cleaned = '0' + cleaned;
    return cleaned;
};

const App: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  
  const getInitialView = () => {
    const path = window.location.pathname.toUpperCase();
    if (path.includes('/ADMIN')) return 'admin';
    if (path.includes('/WORK')) return 'work';
    return 'landing';
  };

  const [currentView, setCurrentView] = useState<'landing' | 'work' | 'admin'>(getInitialView());
  const isAdminMode = currentView === 'admin';
  
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isLinksModalOpen, setIsLinksModalOpen] = useState(false);
  const [workoutTypes, setWorkoutTypes] = useState<string[]>([]);
  const [locations, setLocations] = useState<LocationDef[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [appConfig, setAppConfig] = useState<AppConfig>({
      coachNameHeb: 'ניב כהן', coachNameEng: 'NIV COHEN', coachPhone: '0502264663', coachEmail: '', defaultCity: 'נס ציונה', coachAdditionalPhone: 'admin', urgentMessage: ''
  });
  const [currentUserPhone, setCurrentUserPhone] = useState<string | null>(localStorage.getItem('niv_app_current_phone'));
  const [quote, setQuote] = useState('');
  const [weatherData, setWeatherData] = useState<Record<string, WeatherInfo>>({});
  const [viewingSession, setViewingSession] = useState<TrainingSession | null>(null);

  const currentUser = useMemo(() => users.find(u => normalizePhone(u.phone) === normalizePhone(currentUserPhone || '')), [users, currentUserPhone]);
  
  const navigateTo = (view: 'landing' | 'work' | 'admin') => {
      setCurrentView(view);
      const path = view === 'landing' ? '/' : `/${view.toUpperCase()}`;
      window.history.pushState({}, '', path);
  };

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setDeferredPrompt(null);
    }
  };

  const stats = useMemo(() => {
    if (!currentUser) return { monthly: 0, record: 0, streak: 0 };
    const phone = normalizePhone(currentUser.phone);
    const now = new Date();
    const attendedSessions = sessions.filter(s => s.attendedPhoneNumbers?.includes(phone));
    const monthlyCount = attendedSessions.filter(s => {
        const d = new Date(s.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    
    const weekMap: Record<string, number> = {};
    attendedSessions.forEach(s => {
        const d = new Date(s.date);
        const sun = new Date(d); sun.setDate(d.getDate() - d.getDay()); // Sunday-start
        const key = sun.toISOString().split('T')[0];
        weekMap[key] = (weekMap[key] || 0) + 1;
    });
    let streak = 0;
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

  const handleUpdateProfile = async (updatedUser: User) => {
      setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
      await dataService.updateUser(updatedUser);
  };

  const todayStr = new Date().toISOString().split('T')[0];

  // --- Landing Page View ---
  if (currentView === 'landing') {
    return (
      <div className="min-h-screen bg-brand-black flex flex-col items-center justify-center p-8 text-center relative overflow-hidden">
        {/* Abstract Black TRX Silhouette */}
        <div className="absolute inset-0 z-0 flex items-center justify-center opacity-20 pointer-events-none">
            <svg viewBox="0 0 100 100" className="w-[85vw] h-[85vw] text-black">
                <path fill="currentColor" d="M48 0 L52 0 L52 10 L48 10 Z" />
                <path fill="currentColor" d="M48 10 L15 90 L20 90 L50 15 Z" />
                <path fill="currentColor" d="M52 10 L85 90 L80 90 L50 15 Z" />
                <rect x="15" y="90" width="10" height="2" fill="currentColor" />
                <rect x="75" y="90" width="10" height="2" fill="currentColor" />
                <path fill="currentColor" d="M48 30 Q50 28 52 30 L53 50 L47 50 Z" />
                <path fill="currentColor" d="M44 50 L56 50 L60 95 L40 95 Z" />
            </svg>
        </div>

        <div className="z-10 max-w-2xl space-y-12">
            <div>
                <h1 className="text-8xl sm:text-9xl font-black italic text-white uppercase leading-none tracking-tighter shadow-brand-primary/10">NIV COHEN</h1>
                <p className="text-2xl sm:text-4xl font-black tracking-[0.5em] text-brand-primary uppercase mt-4">CONSIST TRAINING</p>
            </div>

            <div className="space-y-6">
                <h2 className="text-4xl font-black text-white italic leading-tight underline decoration-brand-primary/50 underline-offset-8">אימוני כוח עקביים ללא פשרות.</h2>
                <div className="space-y-4 max-w-md mx-auto">
                  <p className="text-gray-400 font-bold text-xl leading-relaxed">
                    בניית חוסן גופני ומנטלי דרך עבודה קשה, התמדה וליווי אישי מקצועי. <br/>
                    הצטרפו לקהילת המתאמנים של ניב כהן.
                  </p>
                </div>
            </div>

            <div className="bg-gray-900/60 backdrop-blur-2xl p-10 rounded-[60px] border border-white/5 shadow-3xl">
                <p className="text-2xl font-black text-white italic leading-snug">"{quote || 'הכאב הוא זמני, הגאווה היא נצחית.'}"</p>
            </div>

            <div className="flex flex-col gap-5 pt-8">
                <Button onClick={() => navigateTo('work')} className="py-8 rounded-[45px] text-2xl font-black italic uppercase shadow-2xl shadow-brand-primary/20">כניסה ללו"ז אימונים ⚡</Button>
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isAdminMode ? 'bg-red-950/10' : 'bg-brand-black'} pb-20 font-sans transition-all duration-500`}>
      <div className="sticky top-0 z-50">
        {appConfig.urgentMessage && !isAdminMode && (
            <div className="bg-red-600 text-white p-3 text-center text-[10px] font-black uppercase tracking-widest animate-pulse shadow-lg">
               🚨 {appConfig.urgentMessage}
            </div>
        )}

        <header className={`p-6 border-b border-gray-800/50 backdrop-blur-md ${isAdminMode ? 'bg-red-900/40 border-red-500/30' : 'bg-brand-black/80'}`}>
            <div className="flex justify-between items-center mb-6">
                <div 
                    onClick={() => {
                        if(currentView === 'work'){
                            const pass = prompt('קוד גישה למאמן:');
                            if(pass === (appConfig.coachAdditionalPhone || 'admin')) navigateTo('admin');
                            else navigateTo('landing');
                        } else {
                            navigateTo('landing');
                        }
                    }} 
                    className="cursor-pointer group"
                >
                    <h1 className="text-5xl font-black italic text-white uppercase leading-none transition-all duration-500 group-hover:text-brand-primary">
                        NIV COHEN
                    </h1>
                    <p className="text-[16px] font-black tracking-[0.4em] text-brand-primary uppercase mt-1">CONSIST TRAINING</p>
                </div>
                {currentUser && !isAdminMode && (
                    <div className="flex items-center gap-3">
                      <div onClick={() => setIsLinksModalOpen(true)} className="bg-gray-800 p-2.5 rounded-2xl border border-white/5 cursor-pointer hover:bg-white/10 transition-colors shadow-xl">
                          <span className="text-xl">🔗</span>
                      </div>
                      <div onClick={() => setIsProfileModalOpen(true)} className="text-right cursor-pointer group">
                          <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest group-hover:text-brand-primary transition-colors">פרופיל אישי</p>
                          <p className="text-white font-black italic text-sm" style={{ color: currentUser.userColor || 'white' }}>{currentUser.displayName || currentUser.fullName}</p>
                      </div>
                    </div>
                )}
            </div>

            {currentUser && !isAdminMode && (
                <div className="grid grid-cols-4 gap-2">
                    <div className="bg-gray-800/40 p-4 rounded-2xl border border-white/5 flex flex-col items-center justify-center text-center">
                       <p className="text-[9px] text-gray-500 font-bold uppercase mb-1">החודש</p>
                       <p className="text-brand-primary font-black text-3xl leading-none">{stats.monthly}</p>
                    </div>
                    <div className="bg-gray-800/40 p-4 rounded-2xl border border-white/5 flex flex-col items-center justify-center text-center">
                       <p className="text-[9px] text-gray-500 font-bold uppercase mb-1">שיא</p>
                       <p className="text-white font-black text-3xl leading-none">{stats.record}</p>
                    </div>
                    <div className="bg-orange-500/10 p-4 rounded-2xl border border-orange-500/20 flex flex-col items-center justify-center text-center">
                       <p className="text-[9px] text-orange-500 font-bold uppercase mb-1 flex items-center gap-1">רצף 🔥</p>
                       <p className="text-orange-400 font-black text-3xl leading-none">{stats.streak}</p>
                    </div>
                    <div className="bg-brand-primary/10 p-4 rounded-2xl border border-brand-primary/20 flex flex-col items-center justify-center text-center overflow-hidden">
                       <p className="text-[9px] text-brand-primary font-bold uppercase mb-1">אלוף 🏆</p>
                       <p className="text-white font-black text-lg leading-none truncate w-full">{monthLeader.name}</p>
                    </div>
                </div>
            )}
        </header>
      </div>

      <main className="max-w-4xl mx-auto p-4">
        {isAdminMode ? (
             <AdminPanel 
                users={users} sessions={sessions} primaryColor="#EF4444" workoutTypes={workoutTypes}
                locations={locations} weatherLocation={{name: appConfig.defaultCity, lat:0, lon:0}} paymentLinks={[]} streakGoal={3}
                appConfig={appConfig} quotes={quotes} weatherData={weatherData} deferredPrompt={deferredPrompt} onInstall={handleInstallClick}
                onAddUser={async u => { await dataService.addUser(u); setUsers(prev => [...prev, u]); }}
                onUpdateUser={async u => { await dataService.updateUser(u); setUsers(prev => prev.map(x=>x.id===u.id?u:x)); }}
                onDeleteUser={async id => { await dataService.deleteUser(id); setUsers(prev => prev.filter(x=>x.id!==id)); }}
                onAddSession={async s => { await dataService.addSession(s); setSessions(prev => [...prev, s]); }}
                onUpdateSession={async s => { await dataService.updateSession(s); setSessions(prev => prev.map(x=>x.id===s.id?s:x)); }}
                onDeleteSession={async id => { await dataService.deleteSession(id); setSessions(prev => prev.filter(x=>x.id!==id)); }}
                onColorChange={()=>{}} onUpdateWorkoutTypes={async t => { await dataService.saveWorkoutTypes(t); setWorkoutTypes(t); refreshData(); }} 
                onUpdateLocations={async l => { await dataService.saveLocations(l); setLocations(l); refreshData(); }}
                onUpdateWeatherLocation={()=>{}} onAddPaymentLink={()=>{}} onDeletePaymentLink={()=>{}} onUpdateStreakGoal={()=>{}}
                onUpdateAppConfig={async c => { await dataService.saveAppConfig(c); setAppConfig(c); }} onExitAdmin={() => navigateTo('landing')}
            />
        ) : (
            <div className="space-y-6">
                {quote && <div className="text-center bg-gray-900/40 p-8 rounded-[40px] border border-gray-800/30"><p className="text-xl font-black text-white italic leading-tight">"{quote}"</p></div>}
                
                {deferredPrompt && (
                   <div className="p-6 bg-blue-600/10 border border-blue-600/20 rounded-[45px] flex flex-col items-center gap-4">
                      <p className="text-blue-400 font-black text-sm uppercase tracking-widest text-center italic">NIV WORK - זמין להורדה למסך הבית</p>
                      <Button onClick={handleInstallClick} className="w-full py-5 rounded-[35px] bg-blue-600 text-white font-black uppercase text-xs shadow-2xl shadow-blue-600/20">📲 הורד עכשיו</Button>
                   </div>
                )}

                <div className="space-y-16 pb-20">
                  {Array.from({length:7}, (_,i) => {
                      const d = new Date();
                      const dayOfWeek = d.getDay(); // Sunday-start
                      d.setDate(d.getDate() - dayOfWeek + i);
                      
                      const dateStr = d.toISOString().split('T')[0];
                      const isToday = dateStr === todayStr;
                      const daySessions = sessions.filter(s => s.date === dateStr && !s.isHidden).sort((a,b)=>a.time.localeCompare(b.time));
                      return (
                          <div key={dateStr} className="relative">
                              <div className="sticky top-[10px] z-30 bg-brand-black/90 backdrop-blur-md py-3 border-b-2 border-brand-primary/20 mb-6 flex justify-between items-end px-2">
                                 <h2 className={`text-4xl font-black italic uppercase tracking-tighter ${isToday ? 'text-brand-primary' : 'text-gray-500'}`}>
                                     {d.toLocaleDateString('he-IL',{weekday:'long'})}
                                 </h2>
                                 <div className="text-left">
                                    <p className="text-[10px] font-black text-gray-700 tracking-[0.4em] uppercase">{d.toLocaleDateString('he-IL',{day:'numeric', month:'numeric'})}</p>
                                    {isToday && <span className="bg-brand-primary text-black text-[8px] font-black px-2 py-0.5 rounded-full uppercase italic">Today</span>}
                                 </div>
                              </div>

                              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
                                  {daySessions.map(s => <SessionCard key={s.id} session={s} allUsers={users} isRegistered={!!currentUserPhone && s.registeredPhoneNumbers.includes(normalizePhone(currentUserPhone))} onRegisterClick={handleRegisterClick} onViewDetails={()=>setViewingSession(s)} locations={locations} weather={weatherData[s.date]}/>)}
                                  {daySessions.length === 0 && <p className="text-gray-700 text-[9px] uppercase font-black tracking-[0.2em] col-span-full text-center py-8 italic border-2 border-dashed border-gray-900 rounded-[40px]">מנוחה וחידוש כוחות</p>}
                              </div>
                          </div>
                      );
                  })}
                </div>
            </div>
        )}
      </main>

      {/* Modals */}
      {isLinksModalOpen && (
        <div className="fixed inset-0 bg-black/95 z-[70] flex items-center justify-center p-6 backdrop-blur-2xl">
            <div className="bg-gray-900 p-8 rounded-[50px] w-full max-w-sm border border-white/10 flex flex-col shadow-3xl text-right" dir="rtl">
                <div className="flex justify-between items-center mb-10">
                    <h3 className="text-3xl font-black text-white italic uppercase">חיבורים 🔗</h3>
                    <button onClick={() => setIsLinksModalOpen(false)} className="text-gray-500 text-3xl">✕</button>
                </div>
                <div className="space-y-4">
                    <button onClick={()=>window.open(`https://wa.me/${appConfig.coachPhone}`, '_blank')} className="w-full p-6 bg-green-500/10 border border-green-500/20 rounded-[35px] flex items-center gap-5 hover:bg-green-500/20 transition-all">
                        <span className="text-4xl">💬</span>
                        <div className="text-right">
                           <p className="text-green-500 font-black text-xl italic uppercase">WhatsApp</p>
                           <p className="text-green-500/60 text-[9px] uppercase font-bold tracking-widest">שיחה ישירה עם ניב</p>
                        </div>
                    </button>
                    <button onClick={()=>window.open('https://instagram.com/niv.cohen_fitness', '_blank')} className="w-full p-6 bg-pink-500/10 border border-pink-500/20 rounded-[35px] flex items-center gap-5 hover:bg-pink-500/20 transition-all">
                        <span className="text-4xl">📸</span>
                        <div className="text-right">
                           <p className="text-pink-500 font-black text-xl italic uppercase">Instagram</p>
                           <p className="text-pink-500/60 text-[9px] uppercase font-bold tracking-widest">עקבו אחרינו</p>
                        </div>
                    </button>
                </div>
                <Button onClick={() => setIsLinksModalOpen(false)} className="w-full py-6 mt-10 rounded-[40px] font-black italic uppercase">סגור</Button>
            </div>
        </div>
      )}

      {isProfileModalOpen && currentUser && (
        <div className="fixed inset-0 bg-black/95 z-[70] flex items-center justify-center p-4 backdrop-blur-2xl overflow-y-auto no-scrollbar">
            <div className="bg-gray-900 p-8 rounded-[50px] w-full max-w-lg border border-white/10 flex flex-col shadow-3xl text-right my-auto" dir="rtl">
                <div className="flex justify-between items-center mb-8 border-b border-white/5 pb-4">
                    <h3 className="text-3xl font-black text-white italic uppercase">פרופיל אישי 👤</h3>
                    <button onClick={() => setIsProfileModalOpen(false)} className="text-gray-500 text-3xl">✕</button>
                </div>
                
                <div className="space-y-6 overflow-y-auto max-h-[70vh] px-2 no-scrollbar">
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] text-gray-500 font-black uppercase block mb-2">שם מלא</label>
                                <input className="w-full bg-gray-800 border border-white/10 p-5 rounded-3xl text-white font-bold text-lg outline-none focus:border-brand-primary" value={currentUser.fullName || ''} onChange={e => handleUpdateProfile({...currentUser, fullName: e.target.value})} />
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-500 font-black uppercase block mb-2">כינוי</label>
                                <input className="w-full bg-gray-800 border border-white/10 p-5 rounded-3xl text-white font-bold outline-none focus:border-brand-primary" value={currentUser.displayName || ''} onChange={e => handleUpdateProfile({...currentUser, displayName: e.target.value})} placeholder="כינוי..." />
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] text-gray-500 font-black uppercase block mb-2">מספר טלפון</label>
                            <input className="w-full bg-gray-800/50 border border-white/5 p-5 rounded-3xl text-gray-500 font-mono text-xl" value={currentUser.phone} disabled />
                        </div>
                        <div>
                            <label className="text-[10px] text-gray-500 font-black uppercase block mb-2">צבע אישי</label>
                            <input type="color" className="w-full h-16 bg-gray-800 border border-white/10 rounded-3xl p-1 cursor-pointer" value={currentUser.userColor || '#A3E635'} onChange={e => handleUpdateProfile({...currentUser, userColor: e.target.value})} />
                        </div>
                    </div>

                    <div className="bg-brand-primary/5 p-6 rounded-[35px] border border-brand-primary/20 space-y-4">
                        <h4 className="text-brand-primary font-black uppercase italic text-xs tracking-widest border-b border-brand-primary/10 pb-2">📜 הצהרת בריאות דיגיטלית</h4>
                        <p className="text-gray-400 text-[11px] leading-relaxed italic">אני מצהיר בזאת כי מצבי הבריאותי תקין ומאפשר לי לבצע פעילות גופנית עצימה בשיטת CONSIST TRAINING.</p>
                        
                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <label className="text-[9px] text-gray-400 font-black block mb-2">מספר תעודת זהות</label>
                                <input className="w-full bg-gray-900 border border-white/5 p-4 rounded-2xl text-white font-mono text-lg" placeholder="123456789" value={currentUser.healthDeclarationId || ''} onChange={e => handleUpdateProfile({...currentUser, healthDeclarationId: e.target.value})} />
                            </div>
                            <div className="flex items-center gap-4 bg-gray-900/50 p-5 rounded-2xl">
                                <input type="checkbox" id="health-check" className="w-8 h-8 rounded-xl bg-gray-800 border-white/10" checked={!!currentUser.healthDeclarationDate} onChange={e => handleUpdateProfile({...currentUser, healthDeclarationDate: e.target.checked ? new Date().toISOString() : ''})} />
                                <label htmlFor="health-check" className="text-white text-xs font-black uppercase tracking-tighter">אני מאשר את נכונות ההצהרה {currentUser.healthDeclarationDate && <span className="text-[8px] opacity-50 block mt-1 italic">נחתם ב: {new Date(currentUser.healthDeclarationDate).toLocaleString('he-IL')}</span>}</label>
                            </div>
                        </div>
                    </div>
                </div>
                <Button onClick={() => setIsProfileModalOpen(false)} className="w-full py-6 mt-10 rounded-[40px] text-xl font-black italic uppercase">שמור שינויים ✓</Button>
            </div>
        </div>
      )}

      {viewingSession && !isAdminMode && (
        <div className="fixed inset-0 bg-black/95 z-[60] flex items-center justify-center p-4 backdrop-blur-xl">
           <div className="bg-gray-900 p-10 rounded-[50px] w-full max-w-md border border-gray-800 flex flex-col shadow-3xl text-right" dir="rtl">
              <div className="flex justify-between items-start mb-8">
                 <div>
                    <h3 className="text-4xl font-black text-white italic uppercase leading-none mb-2">{viewingSession.type}</h3>
                    <div className="flex items-center gap-3">
                      <p className="text-brand-primary font-mono text-2xl font-black uppercase tracking-widest">{viewingSession.time}</p>
                    </div>
                 </div>
                 <button onClick={()=>setViewingSession(null)} className="text-gray-500 text-4xl">✕</button>
              </div>
              <Button onClick={() => { handleRegisterClick(viewingSession.id); setViewingSession(null); }} className="w-full py-7 mt-12 rounded-[45px] text-2xl font-black italic uppercase shadow-2xl shadow-brand-primary/20">
                 {viewingSession.registeredPhoneNumbers.includes(normalizePhone(currentUserPhone || '')) ? 'ביטול הרשמה' : 'הרשמה לאימון ⚡'}
              </Button>
           </div>
        </div>
      )}
      
      {/* Login Modal */}
      <div id="login-modal" className="fixed inset-0 bg-black/95 z-50 hidden flex items-center justify-center p-6 backdrop-blur-xl text-center">
          <div className="bg-gray-900 p-12 rounded-[60px] w-full max-w-sm border border-gray-800 shadow-2xl">
              <h3 className="text-white font-black text-4xl mb-3 italic uppercase">מי המתאמן? 🤔</h3>
              <input type="tel" id="user-phone" placeholder='05x-xxxxxxx' className="w-full p-8 bg-gray-800 text-white rounded-[40px] mb-10 text-center border border-gray-700 outline-none focus:border-brand-primary text-5xl font-mono" />
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
