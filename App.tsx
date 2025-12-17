
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { User, TrainingSession, PaymentStatus, WorkoutType, WeatherLocation, PaymentLink, LocationDef, AppConfig, Quote, WeatherInfo } from './types';
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
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isAdminMode, setIsAdminMode] = useState<boolean>(false);
  const [workoutTypes, setWorkoutTypes] = useState<string[]>([]);
  const [locations, setLocations] = useState<LocationDef[]>([]);
  const [appConfig, setAppConfig] = useState<AppConfig>({
      coachNameHeb: 'ניב כהן', coachNameEng: 'NIV COHEN', coachPhone: '0502264663', coachEmail: '', defaultCity: 'נס ציונה', coachAdditionalPhone: 'admin'
  });
  const [currentUserPhone, setCurrentUserPhone] = useState<string | null>(localStorage.getItem('niv_app_current_phone'));
  const [quote, setQuote] = useState('');
  const [weatherData, setWeatherData] = useState<Record<string, WeatherInfo>>({});
  const [viewingSession, setViewingSession] = useState<TrainingSession | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // Stats Logic
  const currentUser = useMemo(() => users.find(u => normalizePhone(u.phone) === normalizePhone(currentUserPhone || '')), [users, currentUserPhone]);
  
  const stats = useMemo(() => {
    if (!currentUser) return { monthly: 0, record: 0, streak: 0 };
    const phone = normalizePhone(currentUser.phone);
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const attendedSessions = sessions.filter(s => 
        (s.attendedPhoneNumbers?.includes(phone) || (!s.attendedPhoneNumbers && s.registeredPhoneNumbers.includes(phone)))
    );

    const monthlyCount = attendedSessions.filter(s => {
        const d = new Date(s.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }).length;

    // Streak logic: Weeks with 3+ workouts
    const weekMap: Record<string, number> = {};
    attendedSessions.forEach(s => {
        const d = new Date(s.date);
        const sun = new Date(d);
        sun.setDate(d.getDate() - d.getDay());
        const key = sun.toISOString().split('T')[0];
        weekMap[key] = (weekMap[key] || 0) + 1;
    });

    let streak = 0;
    let checkDate = new Date();
    checkDate.setDate(checkDate.getDate() - checkDate.getDay());
    while(true) {
        const key = checkDate.toISOString().split('T')[0];
        if ((weekMap[key] || 0) >= 3) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 7);
        } else break;
        if (checkDate.getFullYear() < 2024) break;
    }
    
    const currentPB = currentUser.monthlyRecord || 0;
    const effectivePB = Math.max(currentPB, monthlyCount);

    return { monthly: monthlyCount, record: effectivePB, streak: streak };
  }, [currentUser, sessions]);

  // Global Stats - Month Leader
  const monthLeader = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const counts: Record<string, number> = {};
    
    sessions.forEach(s => {
        const d = new Date(s.date);
        if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
            (s.attendedPhoneNumbers || s.registeredPhoneNumbers).forEach(p => {
                const norm = normalizePhone(p);
                counts[norm] = (counts[norm] || 0) + 1;
            });
        }
    });

    let max = 0;
    let leaderPhone = '';
    Object.entries(counts).forEach(([phone, count]) => {
        if (count > max) { max = count; leaderPhone = phone; }
    });

    const leader = users.find(u => normalizePhone(u.phone) === leaderPhone);
    return { name: leader?.fullName.split(' ')[0] || '---', count: max };
  }, [sessions, users]);

  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setDeferredPrompt(null);
    }
  };

  const refreshData = useCallback(async () => {
      setIsLoadingData(true);
      try {
          const [u, s, locs, types, config] = await Promise.all([
              dataService.getUsers(), dataService.getSessions(), dataService.getLocations(), dataService.getWorkoutTypes(), dataService.getAppConfig()
          ]);
          setUsers(u); setSessions(s); setLocations(locs); setWorkoutTypes(types); setAppConfig(config);
          getMotivationQuote().then(setQuote);
          
          const dates = Array.from({length: 14}, (_, i) => {
            const d = new Date(); d.setDate(d.getDate() - 3 + i);
            return d.toISOString().split('T')[0];
          });
          getWeatherForDates(dates).then(setWeatherData);
      } catch (e) { console.error(e); } finally { setIsLoadingData(false); }
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
          if (session.registeredPhoneNumbers.length >= session.maxCapacity) {
              alert('האימון מלא!'); return;
          }
          updated.registeredPhoneNumbers = [...session.registeredPhoneNumbers, phone];
      }
      setSessions(prev => prev.map(s => s.id === sid ? updated : s));
      await dataService.updateSession(updated);
  };

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className={`min-h-screen ${isAdminMode ? 'bg-red-950/10' : 'bg-brand-black'} pb-20 font-sans transition-colors duration-500`}>
      {/* PWA Promo */}
      {deferredPrompt && !isAdminMode && (
          <div className="bg-brand-primary p-3 flex justify-between items-center px-6 sticky top-0 z-50 shadow-xl border-b border-black/20">
              <span className="text-black font-black text-[10px] uppercase italic">התקן את האפליקציה למסך הבית!</span>
              <button onClick={handleInstall} className="bg-black text-white px-4 py-1 rounded-full text-[9px] font-bold">הוספה</button>
          </div>
      )}

      {/* Urgent Message */}
      {appConfig.urgentMessage && !isAdminMode && (
          <div className="bg-red-600 text-white text-center py-2 px-4 text-[11px] font-black animate-pulse z-40 sticky top-0 shadow-lg">
             📢 {appConfig.urgentMessage}
          </div>
      )}

      <header className={`p-6 sticky top-0 z-40 border-b border-gray-800/50 backdrop-blur-md ${isAdminMode ? 'bg-red-900/20 border-red-500/30' : 'bg-brand-dark/80'}`}>
          <div className="flex justify-between items-center mb-6">
              <div onClick={() => isAdminMode ? setIsAdminMode(false) : document.getElementById('admin-modal')?.classList.remove('hidden')} className="cursor-pointer group">
                  <h1 className={`text-2xl font-black italic uppercase leading-none transition-all ${isAdminMode ? 'text-red-500' : 'text-white'}`}>
                      {appConfig.coachNameEng.split(' ')[0]} <span className={isAdminMode ? 'text-white' : 'text-brand-primary'}>{appConfig.coachNameEng.split(' ').slice(1).join(' ')}</span>
                  </h1>
                  <p className="text-[8px] font-black tracking-[0.4em] text-gray-500 uppercase mt-1">CONSIST TRAINING</p>
              </div>
              {currentUser && !isAdminMode && (
                  <button onClick={()=>{setCurrentUserPhone(null); localStorage.removeItem('niv_app_current_phone');}} className="text-[9px] text-gray-500 font-bold uppercase border border-gray-800 px-3 py-1 rounded-full">התנתק</button>
              )}
          </div>

          {currentUser && !isAdminMode && (
              <div className="grid grid-cols-4 gap-2">
                  <div className="bg-gray-800/50 p-3 rounded-2xl border border-gray-700 flex flex-col items-center justify-center text-center">
                     <p className="text-[8px] text-gray-500 font-black uppercase tracking-tighter mb-1">החודש</p>
                     <p className="text-brand-primary font-black text-xl leading-none">{stats.monthly}</p>
                  </div>
                  <div className="bg-gray-800/50 p-3 rounded-2xl border border-gray-700 flex flex-col items-center justify-center text-center">
                     <p className="text-[8px] text-gray-500 font-black uppercase tracking-tighter mb-1">שיא חודשי</p>
                     <p className="text-white font-black text-xl leading-none">{stats.record}</p>
                  </div>
                  <div className="bg-orange-500/10 p-3 rounded-2xl border border-orange-500/30 flex flex-col items-center justify-center text-center">
                     <p className="text-[8px] text-orange-500 font-black uppercase tracking-tighter mb-1 flex items-center gap-1">רצף 🔥</p>
                     <p className="text-orange-400 font-black text-xl leading-none">{stats.streak}</p>
                  </div>
                  <div className="bg-brand-primary/10 p-3 rounded-2xl border border-brand-primary/30 flex flex-col items-center justify-center text-center overflow-hidden">
                     <p className="text-[8px] text-brand-primary font-black uppercase tracking-tighter mb-1 flex items-center gap-1">אלוף 🏆</p>
                     <p className="text-white font-black text-[10px] leading-none truncate w-full">{monthLeader.name}</p>
                     <p className="text-brand-primary font-black text-[9px] mt-1">{monthLeader.count}</p>
                  </div>
              </div>
          )}
      </header>

      <main className="max-w-4xl mx-auto p-4">
        {isAdminMode ? (
             <AdminPanel 
                users={users} sessions={sessions} primaryColor="#EF4444" workoutTypes={workoutTypes}
                locations={locations} weatherLocation={{name: appConfig.defaultCity, lat:0, lon:0}} paymentLinks={[]} streakGoal={3}
                appConfig={appConfig} quotes={[]} weatherData={weatherData}
                onAddUser={async u => { await dataService.addUser(u); setUsers([...users, u]); }}
                onUpdateUser={async u => { await dataService.updateUser(u); setUsers(users.map(x=>x.id===u.id?u:x)); }}
                onDeleteUser={async id => { await dataService.deleteUser(id); setUsers(users.filter(x=>x.id!==id)); }}
                onAddSession={async s => { await dataService.addSession(s); setSessions([...sessions, s]); }}
                onUpdateSession={async s => { await dataService.updateSession(s); setSessions(sessions.map(x=>x.id===s.id?s:x)); }}
                onDeleteSession={async id => { await dataService.deleteSession(id); setSessions(sessions.filter(x=>x.id!==id)); }}
                onColorChange={()=>{}} onUpdateWorkoutTypes={async t => { await dataService.saveWorkoutTypes(t); setWorkoutTypes(t); }} 
                onUpdateLocations={async l => { await dataService.saveLocations(l); setLocations(l); }}
                onUpdateWeatherLocation={()=>{}} onAddPaymentLink={()=>{}} onDeletePaymentLink={()=>{}} onUpdateStreakGoal={()=>{}}
                onUpdateAppConfig={async c => { await dataService.saveAppConfig(c); setAppConfig(c); }} onExitAdmin={() => setIsAdminMode(false)}
            />
        ) : (
            <div className="space-y-6">
                {quote && (
                    <div className="text-center bg-gray-900/40 p-10 rounded-[40px] border border-gray-800/30">
                        <p className="text-2xl font-black text-white italic leading-tight">"{quote}"</p>
                    </div>
                )}
                <div className="space-y-10">
                  {Array.from({length:7}, (_,i) => {
                      const d = new Date(); d.setDate(d.getDate() - d.getDay() + i);
                      const dateStr = d.toISOString().split('T')[0];
                      const isToday = dateStr === todayStr;
                      const daySessions = sessions.filter(s => s.date === dateStr && !s.isHidden).sort((a,b)=>a.time.localeCompare(b.time));
                      return (
                          <div 
                            key={dateStr} 
                            className={`rounded-[50px] p-8 border transition-all duration-500 ${isToday ? 'bg-brand-primary/10 border-brand-primary/40' : 'bg-gray-900/10 border-gray-800/20'}`}
                          >
                              <div className="flex justify-between items-center mb-8 border-b border-gray-800/30 pb-2">
                                  <h2 className={`text-[10px] font-black uppercase tracking-[0.2em] ${isToday ? 'text-white' : 'text-gray-600'}`}>
                                      {d.toLocaleDateString('he-IL',{weekday:'long', day:'numeric', month:'numeric'})}
                                  </h2>
                                  {weatherData[dateStr] && <span className="text-gray-500 text-xs font-bold">{getWeatherIcon(weatherData[dateStr].weatherCode)} {Math.round(weatherData[dateStr].maxTemp)}°</span>}
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                  {daySessions.map(s => <SessionCard key={s.id} session={s} allUsers={users} isRegistered={!!currentUserPhone && s.registeredPhoneNumbers.includes(normalizePhone(currentUserPhone))} onRegisterClick={handleRegisterClick} onViewDetails={()=>setViewingSession(s)} locations={locations} weather={weatherData[s.date]}/>)}
                                  {daySessions.length === 0 && <p className="text-gray-700 text-[10px] uppercase font-black tracking-widest col-span-full text-center py-4 italic">יום מנוחה</p>}
                              </div>
                          </div>
                      );
                  })}
                </div>
            </div>
        )}
      </main>

      {/* Admin Login Modal */}
      <div id="admin-modal" className="fixed inset-0 bg-black/95 z-50 hidden flex items-center justify-center p-4 backdrop-blur-xl">
          <div className="bg-gray-900 p-12 rounded-[50px] w-full max-w-sm border border-gray-800 shadow-2xl">
              <h3 className="text-white font-black text-3xl mb-8 text-center italic uppercase">כניסת מאמן 🔒</h3>
              <input type="password" id="admin-pass" placeholder='סיסמה' className="w-full p-6 bg-gray-800 text-white rounded-3xl mb-4 text-center border border-gray-700 outline-none focus:border-red-500 text-3xl font-mono" />
              <Button onClick={() => { 
                  const pass = (document.getElementById('admin-pass') as HTMLInputElement).value;
                  if(pass === (appConfig.coachAdditionalPhone || 'admin')) { setIsAdminMode(true); document.getElementById('admin-modal')?.classList.add('hidden'); }
                  else alert('סיסמה שגויה');
              }} className="w-full py-6 rounded-3xl bg-red-600 hover:bg-red-500 text-white shadow-xl shadow-red-600/20">כניסה למערכת</Button>
              <button onClick={()=>document.getElementById('admin-modal')?.classList.add('hidden')} className="w-full text-gray-700 text-[10px] mt-8 uppercase font-black tracking-widest hover:text-white transition-colors">ביטול</button>
          </div>
      </div>

      {/* Trainee Login Modal */}
      <div id="login-modal" className="fixed inset-0 bg-black/95 z-50 hidden flex items-center justify-center p-4 backdrop-blur-xl">
          <div className="bg-gray-900 p-12 rounded-[50px] w-full max-w-sm border border-gray-800 shadow-2xl text-center">
              <h3 className="text-white font-black text-3xl mb-2 italic uppercase">מי המתאמן? 🤔</h3>
              <p className="text-gray-500 text-[10px] mb-10 font-black uppercase tracking-widest">הכנס מספר טלפון להרשמה</p>
              <input type="tel" id="user-phone" placeholder='05x-xxxxxxx' className="w-full p-6 bg-gray-800 text-white rounded-3xl mb-8 text-center border border-gray-700 outline-none focus:border-brand-primary text-4xl font-mono" />
              <Button onClick={() => { 
                  const p = (document.getElementById('user-phone') as HTMLInputElement).value;
                  if(p.length >= 9) { setCurrentUserPhone(p); localStorage.setItem('niv_app_current_phone', p); document.getElementById('login-modal')?.classList.add('hidden'); }
                  else alert('מספר לא תקין');
              }} className="w-full py-6 rounded-3xl shadow-2xl shadow-brand-primary/20">התחברות 🚀</Button>
          </div>
      </div>
    </div>
  );
};

export default App;
