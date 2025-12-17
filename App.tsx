
import React, { useState, useEffect, useCallback } from 'react';
import { User, TrainingSession, PaymentStatus, WorkoutType, WeatherLocation, PaymentLink, LocationDef, AppConfig, Quote, WeatherInfo } from './types';
import { SessionCard } from './components/SessionCard';
import { AdminPanel } from './components/AdminPanel';
import { Button } from './components/Button';
import { getMotivationQuote } from './services/geminiService';
import { getWeatherForDates, getWeatherIcon, getCityCoordinates } from './services/weatherService';
import { dataService } from './services/dataService';
import { supabase } from './services/supabaseClient';

const normalizePhone = (phone: string): string => {
    if (!phone) return '';
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('972')) cleaned = '0' + cleaned.substring(3);
    else if (cleaned.startsWith('0')) {} 
    else cleaned = '0' + cleaned;
    return cleaned;
};

function safeJsonParse<T>(key: string, fallback: T): T {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : fallback;
    } catch { return fallback; }
}

const App: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  const [workoutTypes, setWorkoutTypes] = useState<string[]>(() => safeJsonParse('niv_app_types', Object.values(WorkoutType)));
  const [locations, setLocations] = useState<LocationDef[]>(() => safeJsonParse('niv_app_locations', []));
  const [customQuotes, setCustomQuotes] = useState<Quote[]>([]);
  
  const [appConfig, setAppConfig] = useState<AppConfig>({
      coachNameHeb: 'ניב כהן',
      coachNameEng: 'NIV COHEN',
      coachPhone: '0502264663',
      coachEmail: '',
      defaultCity: 'נס ציונה',
      coachAdditionalPhone: 'admin'
  });

  const [paymentLinks, setPaymentLinks] = useState<PaymentLink[]>(() => safeJsonParse('niv_app_payments', []));
  const [weatherLocation, setWeatherLocation] = useState<WeatherLocation>(() => safeJsonParse('niv_app_weather_loc', { name: 'נס ציונה', lat: 31.93, lon: 34.80 }));
  const [currentUserPhone, setCurrentUserPhone] = useState<string | null>(localStorage.getItem('niv_app_current_phone'));
  const [primaryColor, setPrimaryColor] = useState<string>(localStorage.getItem('niv_app_color') || '#A3E635');
  const [weekOffset, setWeekOffset] = useState(0); 
  const [isAdminMode, setIsAdminMode] = useState<boolean>(false);
  
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showAdminLoginModal, setShowAdminLoginModal] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [quote, setQuote] = useState('');
  const [weatherData, setWeatherData] = useState<Record<string, WeatherInfo>>({});
  // Added viewingSession state to fix the error in the training session list
  const [viewingSession, setViewingSession] = useState<TrainingSession | null>(null);

  const refreshData = useCallback(async () => {
      setIsLoadingData(true);
      try {
          const u = await dataService.getUsers();
          const s = await dataService.getSessions();
          setUsers(u); setSessions(s);
          const locs = await dataService.getLocations(); if (locs.length) setLocations(locs);
          const types = await dataService.getWorkoutTypes(); if (types.length) setWorkoutTypes(types);
          const config = await dataService.getAppConfig(); setAppConfig(config);
          const quotes = await dataService.getQuotes(); setCustomQuotes(quotes);
          
          if (quotes.length) setQuote(quotes[Math.floor(Math.random()*quotes.length)].text);
          else getMotivationQuote().then(setQuote);

          if (config.defaultCity && config.defaultCity !== weatherLocation.name) {
             const coords = await getCityCoordinates(config.defaultCity);
             if (coords) setWeatherLocation(coords);
          }
      } catch (e) { console.error(e); } finally { setIsLoadingData(false); }
  }, [weatherLocation.name]);

  useEffect(() => { refreshData(); }, [refreshData]);

  useEffect(() => {
    const dates = Array.from({length: 14}, (_, i) => {
       const d = new Date(); d.setDate(d.getDate() - 7 + i);
       return d.toISOString().split('T')[0];
    });
    getWeatherForDates(dates, weatherLocation.lat, weatherLocation.lon).then(setWeatherData);
  }, [weatherLocation]);

  const currentUser = users.find(u => normalizePhone(u.phone) === normalizePhone(currentUserPhone || ''));
  const groupedSessions = sessions.reduce((acc, s) => ({...acc, [s.date]: [...(acc[s.date]||[]), s]}), {} as Record<string, TrainingSession[]>);

  const handleRegisterClick = async (sid: string) => {
      if (!currentUserPhone) { setShowLoginModal(true); return; }
      const session = sessions.find(s => s.id === sid);
      if (!session || session.isCancelled) return;
      const phone = normalizePhone(currentUserPhone);
      let updatedSession = { ...session };
      if (session.registeredPhoneNumbers.includes(phone)) {
          updatedSession.registeredPhoneNumbers = session.registeredPhoneNumbers.filter(p => p !== phone);
      } else {
          updatedSession.registeredPhoneNumbers = [...session.registeredPhoneNumbers, phone];
      }
      setSessions(prev => prev.map(s => s.id === sid ? updatedSession : s));
      await dataService.updateSession(updatedSession);
  };

  const nameParts = appConfig.coachNameEng.split(' ');
  const firstName = nameParts[0] || 'NIV';
  const lastName = nameParts.slice(1).join(' ') || 'COHEN';

  return (
    <div className={`min-h-screen bg-brand-black pb-20 font-sans`}>
      {/* Urgent Message Banner */}
      {appConfig.urgentMessage && !isAdminMode && (
          <div className="bg-red-600 text-white text-center py-2 px-4 text-xs font-black animate-pulse z-50 sticky top-0 shadow-lg">
             📢 {appConfig.urgentMessage}
          </div>
      )}

      <header className={`bg-brand-dark p-4 sticky ${appConfig.urgentMessage && !isAdminMode ? 'top-8' : 'top-0'} z-20 border-b border-gray-800 flex justify-between items-center shadow-xl`}>
          <div onClick={() => isAdminMode ? setIsAdminMode(false) : setShowAdminLoginModal(true)} className="cursor-pointer select-none group">
              <h1 className="text-2xl font-black text-white italic uppercase leading-none group-active:scale-95 transition-transform">
                  {firstName} <span className="text-brand-primary">{lastName}</span>
              </h1>
              {isAdminMode && <span className="text-[10px] text-brand-primary font-bold uppercase tracking-widest block mt-1">חזרה למסך מתאמנים</span>}
          </div>
          {currentUser && !isAdminMode && (
              <div className="text-right">
                  <p className="text-white text-xs font-bold">היי <span style={{color: currentUser.userColor}}>{currentUser.fullName}</span></p>
                  <button onClick={()=>{setCurrentUserPhone(null); localStorage.removeItem('niv_app_current_phone');}} className="text-[10px] text-gray-500 hover:text-white transition-colors">התנתק</button>
              </div>
          )}
      </header>

      <main className="max-w-4xl mx-auto p-4">
        {isAdminMode ? (
             <AdminPanel 
                users={users} sessions={sessions} primaryColor={primaryColor} workoutTypes={workoutTypes}
                locations={locations} weatherLocation={weatherLocation} paymentLinks={paymentLinks} streakGoal={3}
                appConfig={appConfig} quotes={customQuotes} weatherData={weatherData}
                onAddUser={async u => { await dataService.addUser(u); setUsers([...users, u]); }}
                onUpdateUser={async u => { await dataService.updateUser(u); setUsers(users.map(x=>x.id===u.id?u:x)); }}
                onDeleteUser={async id => { await dataService.deleteUser(id); setUsers(users.filter(x=>x.id!==id)); }}
                onAddSession={async s => { await dataService.addSession(s); setSessions([...sessions, s]); }}
                onUpdateSession={async s => { await dataService.updateSession(s); setSessions(sessions.map(x=>x.id===s.id?s:x)); }}
                onDeleteSession={async id => { await dataService.deleteSession(id); setSessions(sessions.filter(x=>x.id!==id)); }}
                onColorChange={setPrimaryColor} onUpdateWorkoutTypes={async t => { await dataService.saveWorkoutTypes(t); setWorkoutTypes(t); }} 
                onUpdateLocations={async l => { await dataService.saveLocations(l); setLocations(l); }}
                onUpdateWeatherLocation={setWeatherLocation} onAddPaymentLink={()=>{}} onDeletePaymentLink={()=>{}} onUpdateStreakGoal={()=>{}}
                onUpdateAppConfig={async c => { await dataService.saveAppConfig(c); setAppConfig(c); }} onExitAdmin={() => setIsAdminMode(false)}
            />
        ) : (
            <div className="space-y-6">
                {/* Motivation Quote */}
                {quote && (
                    <div className="text-center bg-gray-900/60 p-6 rounded-3xl border border-gray-800/50 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-2 opacity-10">
                           <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor"><path d="M14.017 21L14.017 18C14.017 16.8954 14.9124 16 16.017 16H19.017C19.5693 16 20.017 15.5523 20.017 15V9C20.017 8.44772 19.5693 8 19.017 8H15.017C14.4647 8 14.017 8.44772 14.017 9V11C14.017 11.5523 13.5693 12 13.017 12H11.017C10.4647 12 10.017 11.5523 10.017 11V9C10.017 6.79086 11.8079 5 14.017 5H19.017C21.2261 5 23.017 6.79086 23.017 9V15C23.017 18.3137 20.3307 21 17.017 21H14.017ZM1.017 21L1.017 18C1.017 16.8954 1.91243 16 3.017 16H6.017C6.56928 16 7.017 15.5523 7.017 15V9C7.017 8.44772 6.56928 8 6.017 8H2.017C1.46472 8 1.017 8.44772 1.017 9V11C1.017 11.5523 0.569282 12 0.017 12H-1.983C-2.53528 12 -3.017 11.5523 -3.017 11V9C-3.017 6.79086 -1.22614 5 1.017 5H6.017C8.22614 5 10.017 6.79086 10.017 9V15C10.017 18.3137 7.33072 21 4.017 21H1.017Z"/></svg>
                        </div>
                        <p className="text-xl font-bold text-white italic leading-relaxed relative z-10">"{quote}"</p>
                    </div>
                )}

                <div className="flex justify-between items-center bg-gray-800 rounded-full p-1 max-w-sm mx-auto shadow-lg border border-gray-700">
                    <button onClick={()=>setWeekOffset(p=>p-1)} className="px-6 py-2 text-white hover:text-brand-primary transition-colors">←</button>
                    <span className="text-brand-primary font-black text-[10px] uppercase tracking-widest">{weekOffset===0?'השבוע':'שבוע הבא'}</span>
                    <button onClick={()=>setWeekOffset(p=>p+1)} className="px-6 py-2 text-white hover:text-brand-primary transition-colors">→</button>
                </div>

                <div className="space-y-6">
                  {Array.from({length:7}, (_,i) => {
                      const d = new Date(); d.setDate(d.getDate() - d.getDay() + (weekOffset*7) + i);
                      const dateStr = d.toISOString().split('T')[0];
                      const daySessions = (groupedSessions[dateStr] || []).filter(s => !s.isHidden);
                      if (daySessions.length === 0 && weekOffset !== 0) return null;
                      return (
                          <div key={dateStr} className="bg-gray-900/30 rounded-3xl p-5 border border-gray-800/40">
                              <div className="text-gray-500 text-[10px] font-black mb-4 border-b border-gray-800/50 pb-2 flex justify-between items-center uppercase tracking-tighter">
                                  <span>{d.toLocaleDateString('he-IL',{weekday:'long', day:'numeric', month:'numeric'})}</span>
                                  {weatherData[dateStr] && <span className="flex items-center gap-1">{getWeatherIcon(weatherData[dateStr].weatherCode)} {Math.round(weatherData[dateStr].maxTemp)}°</span>}
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                  {daySessions.map(s => (
                                    <SessionCard 
                                      key={s.id} 
                                      session={s} 
                                      allUsers={users} 
                                      isRegistered={!!currentUserPhone && s.registeredPhoneNumbers.includes(normalizePhone(currentUserPhone))} 
                                      onRegisterClick={handleRegisterClick} 
                                      onViewDetails={()=>setViewingSession(s)} 
                                      weather={weatherData[s.date]} 
                                      locations={locations}
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

      {/* MODAL: VIEW SESSION DETAILS */}
      {viewingSession && (
          <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4 backdrop-blur-md">
              <div className="bg-gray-900 p-8 rounded-[40px] w-full max-w-md border border-gray-800 shadow-2xl">
                  <div className="flex justify-between items-start mb-6">
                      <div>
                          <h3 className="text-2xl font-black text-white italic leading-none">{viewingSession.type}</h3>
                          <p className="text-brand-primary font-mono text-xs mt-1 uppercase tracking-tighter">{viewingSession.time} | {viewingSession.date}</p>
                      </div>
                      <button onClick={()=>setViewingSession(null)} className="text-gray-500 text-3xl">✕</button>
                  </div>
                  <div className="space-y-4 mb-8 text-right">
                      <p className="text-gray-400 text-sm leading-relaxed">{viewingSession.description || 'אין תיאור זמין לאימון זה.'}</p>
                      <div className="pt-4 border-t border-gray-800">
                          <p className="text-white font-bold text-xs mb-1">📍 מיקום: {viewingSession.location}</p>
                          <p className="text-gray-500 text-[10px] font-bold">רשומים: {viewingSession.registeredPhoneNumbers.length} / {viewingSession.maxCapacity}</p>
                      </div>
                  </div>
                  <Button onClick={() => { handleRegisterClick(viewingSession.id); setViewingSession(null); }} className="w-full py-5 rounded-3xl shadow-xl shadow-brand-primary/20">
                      {viewingSession.registeredPhoneNumbers.includes(normalizePhone(currentUserPhone || '')) ? 'ביטול רישום' : 'הרשמה מהירה'}
                  </Button>
              </div>
          </div>
      )}

      {showAdminLoginModal && (
          <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4 backdrop-blur-md">
              <div className="bg-gray-900 p-8 rounded-3xl w-full max-w-sm border border-gray-800 shadow-2xl">
                  <h3 className="text-white font-black text-xl mb-6 text-center italic uppercase">כניסת מאמן 🔒</h3>
                  <input type="password" placeholder='סיסמת ניהול' className="w-full p-4 bg-gray-800 text-white rounded-2xl mb-4 text-center border border-gray-700 outline-none focus:border-brand-primary transition-all text-xl" value={adminPasswordInput} onChange={e=>setAdminPasswordInput(e.target.value)} />
                  <Button onClick={() => { if(adminPasswordInput === (appConfig.coachAdditionalPhone || 'admin')) { setIsAdminMode(true); setShowAdminLoginModal(false); setAdminPasswordInput(''); } else alert('שגוי'); }} className="w-full py-4 rounded-2xl">כניסה למערכת</Button>
                  <button onClick={()=>setShowAdminLoginModal(false)} className="w-full text-gray-600 text-[10px] mt-4 uppercase font-bold">ביטול</button>
              </div>
          </div>
      )}

      {showLoginModal && (
          <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4 backdrop-blur-md">
              <div className="bg-gray-900 p-8 rounded-3xl w-full max-w-sm border border-gray-800 shadow-2xl">
                  <h3 className="text-white font-black text-xl mb-2 text-center italic uppercase">מי המתאמן? 🤔</h3>
                  <p className="text-gray-500 text-[10px] text-center mb-6 font-bold uppercase">הכנס מספר טלפון כדי להירשם לאימון</p>
                  <input type="tel" placeholder='05x-xxxxxxx' className="w-full p-4 bg-gray-800 text-white rounded-2xl mb-4 text-center border border-gray-700 outline-none focus:border-brand-primary text-2xl font-mono" value={adminPasswordInput} onChange={e=>setAdminPasswordInput(e.target.value)} />
                  <Button onClick={() => { if(adminPasswordInput.length >= 9) { setCurrentUserPhone(adminPasswordInput); localStorage.setItem('niv_app_current_phone', adminPasswordInput); setShowLoginModal(false); setAdminPasswordInput(''); } else alert('מספר לא תקין'); }} className="w-full py-4 rounded-2xl">המשך לאימון 🚀</Button>
                  <button onClick={()=>setShowLoginModal(false)} className="w-full text-gray-600 text-[10px] mt-4 uppercase font-bold">סגור</button>
              </div>
          </div>
      )}
    </div>
  );
};

export default App;
