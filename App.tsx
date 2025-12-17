
import React, { useState, useEffect, useCallback } from 'react';
import { User, TrainingSession, PaymentStatus, WorkoutType, WeatherLocation, LocationDef, AppConfig, Quote, WeatherInfo } from './types';
import { SessionCard } from './components/SessionCard';
import { AdminPanel } from './components/AdminPanel';
import { Button } from './components/Button';
import { getMotivationQuote } from './services/geminiService';
import { getWeatherForDates } from './services/weatherService';
import { dataService } from './services/dataService';
import { supabase } from './services/supabaseClient';

const normalizePhone = (phone: string): string => {
    if (!phone) return '';
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('972')) cleaned = '0' + cleaned.substring(3);
    return cleaned;
};

const App: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isCloudConnected, setIsCloudConnected] = useState(false);

  const [workoutTypes, setWorkoutTypes] = useState<string[]>([]);
  const [locations, setLocations] = useState<LocationDef[]>([]);
  const [appConfig, setAppConfig] = useState<AppConfig>({
      coachNameHeb: 'ניב כהן', coachNameEng: 'NIV COHEN', coachPhone: '0500000000', coachEmail: '', defaultCity: 'נס ציונה', coachAdditionalPhone: 'admin', healthDeclarationTemplate: 'אני מצהיר כי מצב בריאותי תקין...'
  });

  const [currentUserPhone, setCurrentUserPhone] = useState<string | null>(localStorage.getItem('niv_app_current_phone'));
  const [weekOffset, setWeekOffset] = useState(0); 
  const [weatherLocation, setWeatherLocation] = useState<WeatherLocation>({ name: 'נס ציונה', lat: 31.93, lon: 34.80 });

  const [isAdminMode, setIsAdminMode] = useState<boolean>(localStorage.getItem('niv_app_is_admin') === 'true');
  const [showAdminLoginModal, setShowAdminLoginModal] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showHealthModal, setShowHealthModal] = useState(false);
  const [loginPhone, setLoginPhone] = useState('');

  const [weatherData, setWeatherData] = useState<Record<string, WeatherInfo>>({});

  /**
   * Refactored refreshData to avoid Promise.all tuple inference issues that caused unknown[] type errors.
   */
  const refreshData = useCallback(async () => {
      setIsLoadingData(true);
      try {
          // Fetching data using Promise.all then casting results explicitly to fix unknown[] issues
          const results = await Promise.all([
              dataService.getUsers(), 
              dataService.getSessions(), 
              dataService.getLocations(),
              dataService.getWorkoutTypes(), 
              dataService.getAppConfig()
          ]);
          
          const u = results[0] as User[];
          const s = results[1] as TrainingSession[];
          const locs = results[2] as LocationDef[];
          const types = results[3] as string[];
          const config = results[4] as AppConfig;

          setUsers(u); 
          setSessions(s); 
          setLocations(locs); 
          setWorkoutTypes(types); 
          setAppConfig(config);
          setIsCloudConnected(!!supabase);
      } catch (e) { 
          console.error("Refresh Data Error:", e); 
      } finally { 
          setIsLoadingData(false); 
      }
  }, []);

  useEffect(() => { refreshData(); }, [refreshData]);

  useEffect(() => {
    if (sessions.length > 0) {
      const dates = Array.from(new Set(sessions.map(s => s.date)));
      getWeatherForDates(dates, weatherLocation.lat, weatherLocation.lon).then(setWeatherData);
    }
  }, [sessions, weatherLocation]);

  const handleLogoClick = () => {
      if (isAdminMode) setIsAdminMode(false);
      else if (localStorage.getItem('niv_app_is_admin') === 'true') setIsAdminMode(true);
      else setShowAdminLoginModal(true);
  };

  const currentUser = users.find(u => normalizePhone(u.phone) === normalizePhone(currentUserPhone || ''));
  const weekDates = Array.from({length: 7}, (_, i) => {
      const curr = new Date();
      const diff = curr.getDate() - curr.getDay() + (weekOffset * 7);
      const d = new Date(curr.setDate(diff + i));
      return d.toISOString().split('T')[0];
  });
  const groupedSessions = sessions.reduce((acc, s) => ({...acc, [s.date]: [...(acc[s.date]||[]), s]}), {} as Record<string, TrainingSession[]>);

  if (isLoadingData) return <div className="h-screen bg-brand-black flex items-center justify-center text-white">טוען נתונים...</div>;

  return (
    <div className="min-h-screen bg-brand-black pb-24 text-right" dir="rtl">
      <header className="bg-brand-dark p-4 sticky top-0 z-20 border-b border-gray-800 flex justify-between items-center">
          <div onClick={handleLogoClick} className="cursor-pointer">
              <h1 className="text-2xl font-black text-white italic uppercase">
                  {appConfig.coachNameEng.split(' ')[0]} <span className="text-brand-primary">{appConfig.coachNameEng.split(' ').slice(1).join(' ')}</span>
              </h1>
          </div>
          {currentUser && <p className="text-white text-xs font-bold">היי, {currentUser.fullName}</p>}
      </header>

      <main className="max-w-4xl mx-auto p-4">
        {isAdminMode ? (
            <AdminPanel 
                users={users} sessions={sessions} primaryColor="#A3E635" workoutTypes={workoutTypes}
                locations={locations} weatherLocation={weatherLocation} appConfig={appConfig}
                onAddUser={u => setUsers([...users, u])} onUpdateUser={u => setUsers(users.map(x=>x.id===u.id?u:x))}
                onDeleteUser={id => setUsers(users.filter(x=>x.id!==id))} onAddSession={s => setSessions([...sessions, s])}
                onUpdateSession={s => setSessions(sessions.map(x=>x.id===s.id?s:x))} onDeleteSession={id => setSessions(sessions.filter(x=>x.id!==id))}
                onColorChange={()=>{}} onUpdateWorkoutTypes={setWorkoutTypes} onUpdateLocations={setLocations}
                onUpdateWeatherLocation={setWeatherLocation} onUpdateAppConfig={setAppConfig} onExitAdmin={()=>setIsAdminMode(false)}
            />
        ) : (
            <div className="space-y-6">
                <div className="flex justify-between items-center bg-gray-800 rounded-full p-1 max-w-sm mx-auto">
                    <button onClick={()=>setWeekOffset(p=>p-1)} className="px-4 text-white">←</button>
                    <span className="text-brand-primary font-bold">{weekOffset===0?'השבוע':`שבוע ${weekOffset}`}</span>
                    <button onClick={()=>setWeekOffset(p=>p+1)} className="px-4 text-white">→</button>
                </div>
                {weekDates.map(date => (
                    <div key={date} className="bg-gray-900/40 rounded-xl p-3 border border-gray-800">
                        <h4 className="text-gray-400 font-bold mb-3">{new Date(date).toLocaleDateString('he-IL',{weekday:'long'})}</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {(groupedSessions[date] || []).filter(s=>!s.isHidden).map(s => (
                                <SessionCard key={s.id} session={s} allUsers={users} isRegistered={!!currentUserPhone && s.registeredPhoneNumbers.includes(normalizePhone(currentUserPhone))} onRegisterClick={()=>{}} onViewDetails={()=>{}} weather={weatherData[s.date]} locations={locations}/>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        )}
      </main>

      {showAdminLoginModal && (
          <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4">
              <div className="bg-gray-800 p-6 rounded-xl w-full max-w-sm border border-gray-700">
                  <h3 className="text-white font-bold mb-4">כניסה לניהול 🔒</h3>
                  <input type="password" placeholder="סיסמה" className="w-full p-3 bg-gray-900 text-white rounded mb-4" value={adminPasswordInput} onChange={e=>setAdminPasswordInput(e.target.value)}/>
                  <Button className="w-full" onClick={()=>{
                      if(adminPasswordInput === (appConfig.coachAdditionalPhone || 'admin')) {
                          localStorage.setItem('niv_app_is_admin', 'true'); setIsAdminMode(true); setShowAdminLoginModal(false);
                      } else alert('שגוי');
                  }}>כניסה</Button>
                  <button onClick={()=>setShowAdminLoginModal(false)} className="w-full text-gray-500 text-xs mt-2">סגור</button>
              </div>
          </div>
      )}
    </div>
  );
};

export default App;
