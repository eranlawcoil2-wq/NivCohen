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
    return cleaned;
};

const normalizePhoneForWhatsapp = (phone: string): string => {
    let p = normalizePhone(phone);
    if (p.startsWith('0')) p = '972' + p.substring(1);
    return p;
};

function safeJsonParse<T>(key: string, fallback: T): T {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : fallback;
    } catch { return fallback; }
}

const WhatsAppIcon = () => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.008-.57-.008-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
    </svg>
);

const App: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isCloudConnected, setIsCloudConnected] = useState(false);

  const [workoutTypes, setWorkoutTypes] = useState<string[]>(() => safeJsonParse('niv_app_types', Object.values(WorkoutType)));
  const [locations, setLocations] = useState<LocationDef[]>(() => safeJsonParse('niv_app_locations', []));
  const [customQuotes, setCustomQuotes] = useState<Quote[]>([]);
  
  const [appConfig, setAppConfig] = useState<AppConfig>({
      coachNameHeb: 'ניב כהן',
      coachNameEng: 'NIV COHEN',
      coachPhone: '0500000000',
      coachEmail: '',
      defaultCity: 'נס ציונה',
      coachAdditionalPhone: 'admin'
  });

  const [paymentLinks, setPaymentLinks] = useState<PaymentLink[]>(() => safeJsonParse('niv_app_payments', []));
  const [streakGoal, setStreakGoal] = useState<number>(() => parseInt(localStorage.getItem('niv_app_streak_goal') || '3'));
  const [weatherLocation, setWeatherLocation] = useState<WeatherLocation>(() => safeJsonParse('niv_app_weather_loc', { name: 'נס ציונה', lat: 31.93, lon: 34.80 }));
  const [currentUserPhone, setCurrentUserPhone] = useState<string | null>(localStorage.getItem('niv_app_current_phone'));
  const [primaryColor, setPrimaryColor] = useState<string>(localStorage.getItem('niv_app_color') || '#A3E635');
  const [weekOffset, setWeekOffset] = useState(0); 
  const [isAdminMode, setIsAdminMode] = useState<boolean>(() => localStorage.getItem('niv_app_is_admin') === 'true' || new URLSearchParams(window.location.search).get('mode') === 'admin');
  
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showAdminLoginModal, setShowAdminLoginModal] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [viewingSession, setViewingSession] = useState<TrainingSession | null>(null);
  const [quote, setQuote] = useState('');
  const [weatherData, setWeatherData] = useState<Record<string, WeatherInfo>>({});

  const refreshData = useCallback(async () => {
      setIsLoadingData(true);
      setIsCloudConnected(!!supabase);
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

          // Update weather city if changed
          if (config.defaultCity && config.defaultCity !== weatherLocation.name) {
             const coords = await getCityCoordinates(config.defaultCity);
             if (coords) setWeatherLocation(coords);
          }
      } catch (e) { console.error(e); } finally { setIsLoadingData(false); }
  }, [weatherLocation.name]);

  useEffect(() => { refreshData(); }, [refreshData]);

  const handleUpdateAppConfig = async (newConfig: AppConfig) => {
      await dataService.saveAppConfig(newConfig);
      setAppConfig(newConfig);
      // If city changed, trigger weather update
      const coords = await getCityCoordinates(newConfig.defaultCity);
      if (coords) setWeatherLocation(coords);
  };

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
      if (!session) return;
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
    <div className={`min-h-screen ${isAdminMode ? 'bg-brand-black border-t-4 border-brand-danger' : 'bg-brand-black'} pb-20 font-sans`}>
      <header className="bg-brand-dark p-4 sticky top-0 z-20 border-b border-gray-800 flex justify-between items-center shadow-lg">
          <div onClick={() => setShowAdminLoginModal(true)} className="cursor-pointer group select-none">
              <h1 className="text-2xl font-black text-white italic uppercase">
                  {firstName} <span className="text-brand-primary">{lastName}</span>
              </h1>
          </div>
          {currentUser && (
              <div className="text-right">
                  <p className="text-white text-xs font-bold">היי <span style={{color: currentUser.userColor}}>{currentUser.fullName}</span></p>
                  <button onClick={()=>{setCurrentUserPhone(null); localStorage.removeItem('niv_app_current_phone');}} className="text-[10px] text-gray-500">התנתק</button>
              </div>
          )}
      </header>

      <main className="max-w-4xl mx-auto p-4">
        {isAdminMode ? (
             <AdminPanel 
                users={users} sessions={sessions} primaryColor={primaryColor} workoutTypes={workoutTypes}
                locations={locations} weatherLocation={weatherLocation} paymentLinks={paymentLinks} streakGoal={streakGoal}
                appConfig={appConfig} quotes={customQuotes} weatherData={weatherData}
                onAddUser={async u => { await dataService.addUser(u); setUsers([...users, u]); }}
                onUpdateUser={async u => { await dataService.updateUser(u); setUsers(users.map(x=>x.id===u.id?u:x)); }}
                onDeleteUser={async id => { await dataService.deleteUser(id); setUsers(users.filter(x=>x.id!==id)); }}
                onAddSession={async s => { await dataService.addSession(s); setSessions([...sessions, s]); }}
                onUpdateSession={async s => { await dataService.updateSession(s); setSessions(sessions.map(x=>x.id===s.id?s:x)); }}
                onDeleteSession={async id => { await dataService.deleteSession(id); setSessions(sessions.filter(x=>x.id!==id)); }}
                onColorChange={setPrimaryColor} onUpdateWorkoutTypes={async t => { await dataService.saveWorkoutTypes(t); setWorkoutTypes(t); }} 
                onUpdateLocations={async l => { await dataService.saveLocations(l); setLocations(l); }}
                onUpdateWeatherLocation={setWeatherLocation} onAddPaymentLink={l=>setPaymentLinks([...paymentLinks,l])}
                onDeletePaymentLink={id=>setPaymentLinks(paymentLinks.filter(l=>l.id!==id))} onUpdateStreakGoal={setStreakGoal}
                onUpdateAppConfig={handleUpdateAppConfig} onExitAdmin={() => { localStorage.removeItem('niv_app_is_admin'); setIsAdminMode(false); }}
            />
        ) : (
            <div className="space-y-6">
                <div className="flex justify-between items-center mb-6 bg-gray-800 rounded-full p-1 max-w-sm mx-auto">
                    <button onClick={()=>setWeekOffset(p=>p-1)} className="px-4 py-1 text-white">←</button>
                    <span className="text-brand-primary font-bold text-sm">{weekOffset===0?'השבוע':'שבוע הבא'}</span>
                    <button onClick={()=>setWeekOffset(p=>p+1)} className="px-4 py-1 text-white">→</button>
                </div>
                {Array.from({length:7}, (_,i) => {
                    const d = new Date(); d.setDate(d.getDate() - d.getDay() + (weekOffset*7) + i);
                    const dateStr = d.toISOString().split('T')[0];
                    const daySessions = (groupedSessions[dateStr] || []).filter(s => !s.isHidden);
                    return (
                        <div key={dateStr} className="bg-gray-900/40 rounded-xl border border-gray-800 p-3">
                            <div className="text-gray-400 text-xs font-bold mb-3 border-b border-gray-800 pb-1">{d.toLocaleDateString('he-IL',{weekday:'long', day:'numeric'})}</div>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {daySessions.map(s => <SessionCard key={s.id} session={s} allUsers={users} isRegistered={!!currentUserPhone && s.registeredPhoneNumbers.includes(normalizePhone(currentUserPhone))} onRegisterClick={handleRegisterClick} onViewDetails={()=>setViewingSession(s)} weather={weatherData[s.date]} locations={locations}/>)}
                            </div>
                        </div>
                    );
                })}
            </div>
        )}
      </main>

      {showAdminLoginModal && (
          <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
              <div className="bg-gray-800 p-6 rounded-xl w-full max-w-sm border border-gray-700">
                  <h3 className="text-white font-bold mb-4 text-center">כניסת מנהל 🔒</h3>
                  <input type="password" placeholder='סיסמא' className="w-full p-4 bg-gray-900 text-white rounded-lg mb-4 text-center border border-gray-700 outline-none" value={adminPasswordInput} onChange={e=>setAdminPasswordInput(e.target.value)} />
                  <Button onClick={() => { if(adminPasswordInput === (appConfig.coachAdditionalPhone || 'admin')) { setIsAdminMode(true); localStorage.setItem('niv_app_is_admin', 'true'); setShowAdminLoginModal(false); } else alert('שגוי'); }} className="w-full">כניסה</Button>
              </div>
          </div>
      )}
    </div>
  );
};

export default App;