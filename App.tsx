import React, { useState, useEffect, useCallback } from 'react';
import { User, TrainingSession, PaymentStatus, WorkoutType, WeatherLocation, PaymentLink, LocationDef } from './types';
import { COACH_PHONE_NUMBER } from './constants';
import { SessionCard } from './components/SessionCard';
import { AdminPanel } from './components/AdminPanel';
import { Button } from './components/Button';
import { getMotivationQuote } from './services/geminiService';
import { getWeatherForDates, getWeatherIcon, getWeatherDescription } from './services/weatherService';
import { dataService } from './services/dataService';
import { supabase } from './services/supabaseClient';

const normalizePhone = (phone: string): string => {
    if (!phone) return '';
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('972')) cleaned = '0' + cleaned.substring(3);
    return cleaned;
};

function safeJsonParse<T>(key: string, fallback: T): T {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : fallback;
    } catch { return fallback; }
}

const InstallPrompt: React.FC<{ onClose: () => void, onInstall: () => void, canInstall: boolean }> = ({ onClose, onInstall, canInstall }) => (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-brand-primary p-4 z-50 md:hidden animate-in slide-in-from-bottom duration-300">
        <div className="flex justify-between items-start mb-2">
            <h3 className="text-white font-bold text-lg">שמור כאפליקציה!</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>
        {canInstall ? (
            <Button onClick={onInstall} className="w-full py-2 mb-2">התקן אפליקציה 📲</Button>
        ) : (
            <div className="flex items-center gap-2 text-sm text-brand-primary font-bold bg-gray-900/50 p-2 rounded">
                <span>לחץ על שתף ובחר "הוסף למסך הבית"</span>
            </div>
        )}
    </div>
);

const App: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isCloudConnected, setIsCloudConnected] = useState(false);

  const [workoutTypes, setWorkoutTypes] = useState<string[]>(() => safeJsonParse('niv_app_types', Object.values(WorkoutType)));
  const [locations, setLocations] = useState<LocationDef[]>(() => safeJsonParse('niv_app_locations', [
        { id: '1', name: 'פארק הירקון, תל אביב', address: 'שדרות רוקח, תל אביב יפו' },
        { id: '2', name: 'סטודיו פיטנס, רמת גן', address: 'ביאליק 10, רמת גן' },
  ]));
  const [paymentLinks, setPaymentLinks] = useState<PaymentLink[]>(() => safeJsonParse('niv_app_payments', []));
  const [streakGoal, setStreakGoal] = useState<number>(() => parseInt(localStorage.getItem('niv_app_streak_goal') || '3'));
  const [weatherLocation, setWeatherLocation] = useState<WeatherLocation>(() => safeJsonParse('niv_app_weather_loc', { name: 'נס ציונה', lat: 31.93, lon: 34.80 }));
  const [currentUserPhone, setCurrentUserPhone] = useState<string | null>(localStorage.getItem('niv_app_current_phone'));
  const [primaryColor, setPrimaryColor] = useState<string>(localStorage.getItem('niv_app_color') || '#A3E635');
  const [weekOffset, setWeekOffset] = useState(0); 
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginPhone, setLoginPhone] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [viewingSession, setViewingSession] = useState<TrainingSession | null>(null);
  const [quote, setQuote] = useState('');
  const [weatherData, setWeatherData] = useState<Record<string, { maxTemp: number; weatherCode: number }>>({});
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  const refreshData = useCallback(async () => {
      setIsLoadingData(true);
      setIsCloudConnected(!!supabase);
      try {
          const u = await dataService.getUsers();
          const s = await dataService.getSessions();
          setUsers(u); setSessions(s);
      } catch (e) { console.error(e); } finally { setIsLoadingData(false); }
  }, []);

  useEffect(() => { refreshData(); }, [refreshData]);
  
  // URL Based Admin Mode
  useEffect(() => {
      const params = new URLSearchParams(window.location.search);
      if (params.get('mode') === 'admin') {
          setIsAdminMode(true);
      }
  }, []);

  const toggleAdminMode = () => {
      const newMode = !isAdminMode;
      setIsAdminMode(newMode);
      
      const url = new URL(window.location.href);
      if (newMode) {
          url.searchParams.set('mode', 'admin');
      } else {
          url.searchParams.delete('mode');
      }
      window.history.pushState({}, '', url);
  };

  useEffect(() => { localStorage.setItem('niv_app_color', primaryColor); document.documentElement.style.setProperty('--brand-primary', primaryColor); }, [primaryColor]);
  useEffect(() => { getMotivationQuote().then(setQuote); getWeatherForDates(getCurrentWeekDates(0), weatherLocation.lat, weatherLocation.lon).then(setWeatherData); }, []);
  
  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setDeferredPrompt(e); setShowInstallPrompt(true); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = () => {
    if (deferredPrompt) { deferredPrompt.prompt(); setDeferredPrompt(null); setShowInstallPrompt(false); }
  };

  const getMonthlyWorkoutsCount = (phone: string) => {
      const now = new Date();
      return sessions.filter(s => {
          const d = new Date(s.date);
          const attended = s.attendedPhoneNumbers?.includes(normalizePhone(phone)) || s.registeredPhoneNumbers.includes(normalizePhone(phone));
          return d.getMonth() === now.getMonth() && attended;
      }).length;
  };

  const currentUser = users.find(u => normalizePhone(u.phone) === normalizePhone(currentUserPhone || ''));
  const userStats = { currentMonthCount: currentUser ? getMonthlyWorkoutsCount(currentUser.phone) : 0 };

  const getCurrentWeekDates = (offset: number) => {
    const curr = new Date();
    const diff = curr.getDate() - curr.getDay() + (offset * 7);
    const start = new Date(curr.setDate(diff));
    return Array.from({length: 7}, (_, i) => {
        const d = new Date(start); d.setDate(start.getDate() + i);
        return d.toISOString().split('T')[0];
    });
  };
  const weekDates = getCurrentWeekDates(weekOffset);
  const groupedSessions = sessions.reduce((acc, s) => ({...acc, [s.date]: [...(acc[s.date]||[]), s]}), {} as Record<string, TrainingSession[]>);

  const handleRegisterClick = async (sid: string) => {
      if (!currentUserPhone) { setShowLoginModal(true); return; }
      const session = sessions.find(s => s.id === sid);
      if (!session) return;
      const phone = normalizePhone(currentUserPhone);
      const isReg = session.registeredPhoneNumbers.includes(phone);
      if (!isReg && session.registeredPhoneNumbers.length >= session.maxCapacity) { alert('מלא'); return; }
      const updated = { ...session, registeredPhoneNumbers: isReg ? session.registeredPhoneNumbers.filter(p => p !== phone) : [...session.registeredPhoneNumbers, phone] };
      setSessions(prev => prev.map(s => s.id === sid ? updated : s));
      await dataService.updateSession(updated);
  };

  const handleLogin = async () => {
      if (!loginPhone) return;
      const phone = normalizePhone(loginPhone);
      if (!users.find(u => normalizePhone(u.phone) === phone)) {
          if (!newUserName) { alert('הזן שם להרשמה'); return; }
          const newUser = { id: Date.now().toString(), fullName: newUserName, phone, email: '', startDate: new Date().toISOString(), paymentStatus: PaymentStatus.PAID, isNew: true } as User;
          await dataService.addUser(newUser);
          setUsers([...users, newUser]);
      }
      setCurrentUserPhone(phone); localStorage.setItem('niv_app_current_phone', phone); setShowLoginModal(false);
  };

  const mainBackgroundClass = isAdminMode 
    ? 'min-h-screen pb-20 font-sans md:bg-[#330000] bg-brand-black transition-colors duration-500' 
    : 'min-h-screen bg-brand-black pb-20 font-sans transition-colors duration-500';

  return (
    <div className={mainBackgroundClass}>
      <header className="bg-brand-dark p-4 sticky top-0 z-20 border-b border-gray-800 flex justify-between items-center shadow-lg">
          <div><h1 className="text-2xl font-black text-white italic">NIV <span className="text-brand-primary">COHEN</span></h1></div>
          {currentUser && <div className="text-right"><p className="text-white text-xs">היי {currentUser.fullName}</p><button onClick={()=>{setCurrentUserPhone(null); localStorage.removeItem('niv_app_current_phone');}} className="text-xs text-gray-500">התנתק</button></div>}
      </header>

      <main className="max-w-4xl mx-auto p-4">
        {currentUser && (
            <div className="mb-6 bg-gray-900 p-4 rounded-xl border border-gray-800 flex justify-between items-center">
                <div><div className="text-gray-400 text-xs">אימונים החודש</div><div className="text-3xl font-bold text-white">{userStats.currentMonthCount}</div></div>
                <div className="text-right text-gray-500 italic text-sm">"{quote}"</div>
            </div>
        )}

        {isAdminMode ? (
             <AdminPanel 
                users={users} sessions={sessions} primaryColor={primaryColor} workoutTypes={workoutTypes}
                locations={locations} weatherLocation={weatherLocation} paymentLinks={paymentLinks} streakGoal={streakGoal}
                onAddUser={async u => { await dataService.addUser(u); setUsers([...users, u]); }}
                onUpdateUser={async u => { await dataService.updateUser(u); setUsers(users.map(x=>x.id===u.id?u:x)); }}
                onDeleteUser={async id => { await dataService.deleteUser(id); setUsers(users.filter(x=>x.id!==id)); }}
                onAddSession={async s => { await dataService.addSession(s); setSessions([...sessions, s]); }}
                onUpdateSession={async s => { await dataService.updateSession(s); setSessions(sessions.map(x=>x.id===s.id?s:x)); }}
                onDeleteSession={async id => { await dataService.deleteSession(id); setSessions(sessions.filter(x=>x.id!==id)); }}
                onColorChange={setPrimaryColor} onUpdateWorkoutTypes={setWorkoutTypes} onUpdateLocations={setLocations}
                onUpdateWeatherLocation={setWeatherLocation} onAddPaymentLink={l=>setPaymentLinks([...paymentLinks,l])}
                onDeletePaymentLink={id=>setPaymentLinks(paymentLinks.filter(l=>l.id!==id))} onUpdateStreakGoal={setStreakGoal}
                onExitAdmin={()=>{toggleAdminMode(); refreshData();}}
            />
        ) : (
            <>
                <div className="flex justify-between items-center mb-6 bg-gray-800 rounded-full p-1 max-w-sm mx-auto shadow-md">
                    <button onClick={()=>setWeekOffset(p=>p-1)} className="px-4 py-1 text-white hover:bg-gray-700 rounded-full transition-colors">←</button>
                    <span className="text-brand-primary font-bold text-sm">{weekOffset===0?'השבוע':weekOffset===1?'שבוע הבא':`עוד ${weekOffset} שבועות`}</span>
                    <button onClick={()=>setWeekOffset(p=>p+1)} className="px-4 py-1 text-white hover:bg-gray-700 rounded-full transition-colors">→</button>
                </div>
                
                <div className="flex flex-col gap-6"> 
                    {weekDates.slice(0, 6).map(date => {
                        const daySessions = groupedSessions[date] || [];
                        const isToday = new Date().toISOString().split('T')[0] === date;
                        return (
                            <div key={date} className={`rounded-xl border overflow-hidden flex flex-col md:flex-row shadow-lg ${isToday ? 'border-brand-primary bg-gray-800/50' : 'border-gray-800 bg-gray-900/40'}`}>
                                {/* Date Header - Full width on mobile, Sidebar on desktop */}
                                <div className={`p-3 md:w-24 flex justify-between items-center md:flex-col md:justify-center border-b md:border-b-0 md:border-l border-gray-700 ${isToday?'bg-brand-primary/10 text-brand-primary':'bg-gray-800 text-gray-400'}`}>
                                    <div className="flex items-baseline gap-2 md:flex-col md:gap-0 md:text-center">
                                        <span className="font-bold text-lg">{new Date(date).toLocaleDateString('he-IL',{weekday:'short'})}</span>
                                        <span className="text-sm">{new Date(date).getDate()}/{new Date(date).getMonth()+1}</span>
                                    </div>
                                    {weatherData[date] && <div className="text-xs font-mono bg-black/20 px-2 py-0.5 rounded">{Math.round(weatherData[date].maxTemp)}° {getWeatherIcon(weatherData[date].weatherCode)}</div>}
                                </div>
                                
                                {/* Session Grid - 2 Columns on Mobile */}
                                <div className="flex-1 p-3">
                                    {daySessions.length>0 ? (
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                            {daySessions.sort((a,b)=>a.time.localeCompare(b.time)).map(s => (
                                                <div key={s.id} onClick={()=>setViewingSession(s)} className="h-full">
                                                    <SessionCard session={s} allUsers={users} isRegistered={!!currentUserPhone && s.registeredPhoneNumbers.includes(normalizePhone(currentUserPhone))} onRegisterClick={handleRegisterClick} onViewDetails={()=>setViewingSession(s)} weather={weatherData[s.date]}/>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-center text-gray-500 text-sm h-20 bg-black/10 rounded border border-dashed border-gray-800 italic">אין אימונים היום</div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </>
        )}
      </main>

      {viewingSession && (
          <div className="fixed inset-0 bg-black/90 z-50 flex items-end md:items-center justify-center backdrop-blur-sm" onClick={()=>setViewingSession(null)}>
              <div className="bg-gray-800 w-full md:max-w-md rounded-t-2xl md:rounded-2xl border-t border-brand-primary shadow-2xl animate-in slide-in-from-bottom duration-300 max-h-[90vh] flex flex-col" onClick={e=>e.stopPropagation()}>
                  
                  {/* Header Section with Weather and Info (TOP) */}
                  <div className="p-6 bg-gradient-to-b from-gray-700/50 to-gray-800 border-b border-gray-700 relative overflow-hidden">
                      <div className="relative z-10 flex justify-between items-start mb-2">
                           <div>
                               <h2 className="text-3xl text-white font-black leading-none mb-1">{viewingSession.type}</h2>
                               <div className="flex items-center gap-2 mt-2">
                                   <div className="text-brand-primary font-mono font-bold text-lg bg-brand-primary/10 px-2 py-1 rounded">{viewingSession.time}</div>
                                   <div className="text-gray-400 text-sm border border-gray-600 px-2 py-1 rounded">{viewingSession.date}</div>
                               </div>
                           </div>
                           {/* Weather Widget inside Modal */}
                           {weatherData[viewingSession.date] && (
                               <div className="flex flex-col items-center bg-gray-900/50 p-2 rounded-lg border border-gray-600/50 shadow-sm">
                                   <span className="text-2xl">{getWeatherIcon(weatherData[viewingSession.date].weatherCode)}</span>
                                   <span className="text-white font-bold text-sm">{Math.round(weatherData[viewingSession.date].maxTemp)}°</span>
                               </div>
                           )}
                      </div>
                      
                      <div className="relative z-10 flex items-center gap-1.5 text-gray-300 text-sm mb-3">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                           <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                        </svg>
                        <span>{viewingSession.location}</span>
                      </div>

                      <p className="relative z-10 text-gray-300 text-sm leading-relaxed bg-black/20 p-3 rounded-lg border border-white/5">
                        {viewingSession.description || 'ללא תיאור'}
                      </p>
                  </div>

                  {/* Participants List (BOTTOM) */}
                  <div className="flex-1 overflow-y-auto p-4 bg-gray-800">
                      <div className="flex justify-between items-center mb-3">
                          <div className="text-sm font-bold text-white">רשימת משתתפים</div>
                          <div className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">
                              {viewingSession.registeredPhoneNumbers.length} / {viewingSession.maxCapacity}
                          </div>
                      </div>
                      
                      {viewingSession.registeredPhoneNumbers.length > 0 ? (
                          <div className="grid grid-cols-2 gap-2">
                              {viewingSession.registeredPhoneNumbers.map((p,i) => {
                                  const u = users.find(user => normalizePhone(user.phone) === p);
                                  return (
                                    <div key={i} className="bg-gray-700/50 text-gray-200 text-xs px-3 py-2 rounded flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-brand-primary"></div>
                                        {u?.fullName || 'אורח'}
                                    </div>
                                  );
                              })}
                          </div>
                      ) : (
                          <div className="text-center text-gray-600 text-sm py-8">טרם נרשמו מתאמנים</div>
                      )}
                  </div>

                  {/* Action Footer */}
                  <div className="p-4 border-t border-gray-700 bg-gray-900/50">
                      <Button onClick={()=>handleRegisterClick(viewingSession.id)} className="w-full py-3 text-lg font-bold shadow-xl">
                          {currentUserPhone && viewingSession.registeredPhoneNumbers.includes(normalizePhone(currentUserPhone)) ? 'בטל הרשמה ✕' : 'אשר הגעה ✓'}
                      </Button>
                  </div>
              </div>
          </div>
      )}

      {showLoginModal && (
          <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-gray-800 p-6 rounded-xl w-full max-w-sm border border-gray-700 shadow-2xl">
                  <h3 className="text-white font-bold mb-4 text-xl">התחברות / הרשמה</h3>
                  <input type="tel" placeholder="מספר טלפון" className="w-full p-4 bg-gray-900 text-white rounded-lg mb-2 text-lg border border-gray-700 focus:border-brand-primary outline-none" value={loginPhone} onChange={e=>setLoginPhone(e.target.value)}/>
                  <input type="text" placeholder="שם מלא (לנרשמים חדשים)" className="w-full p-4 bg-gray-900 text-white rounded-lg mb-4 border border-gray-700 focus:border-brand-primary outline-none" value={newUserName} onChange={e=>setNewUserName(e.target.value)}/>
                  <div className="flex gap-2">
                      <Button onClick={handleLogin} className="flex-1 py-3">אישור</Button>
                      <Button onClick={()=>setShowLoginModal(false)} variant="secondary" className="flex-1 py-3">ביטול</Button>
                  </div>
              </div>
          </div>
      )}

      {showInstallPrompt && <InstallPrompt onClose={()=>setShowInstallPrompt(false)} onInstall={handleInstallClick} canInstall={!!deferredPrompt}/>}
      
      <footer className="fixed bottom-0 w-full bg-black/90 p-3 flex justify-between items-center border-t border-gray-800 z-50 backdrop-blur-md">
          <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isCloudConnected?'bg-green-500':'bg-red-500 animate-pulse'}`}/>
              <span className="text-xs text-gray-500">{isCloudConnected?'מחובר':'מקומי'}</span>
          </div>
          <button onClick={toggleAdminMode} className="text-gray-600 hover:text-white p-2">⚙️</button>
      </footer>
    </div>
  );
};

export default App;