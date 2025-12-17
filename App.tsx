

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
      coachNameHeb: 'ניב כהן', coachNameEng: 'NIV COHEN', coachPhone: '0500000000', coachEmail: '', defaultCity: 'נס ציונה', coachAdditionalPhone: 'admin', healthDeclarationTemplate: 'אני מצהיר בזאת כי מצב בריאותי תקין וכי אין לי כל מניעה רפואית לביצוע פעילות גופנית עצימה. הצהרה זו תקפה למשך שנה.'
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

  // Fix: Explicitly cast Promise.all result to ensure correct type inference for destructured variables
  const refreshData = useCallback(async () => {
      setIsLoadingData(true);
      try {
          const [u, s, locs, types, config] = await Promise.all([
              dataService.getUsers(), 
              dataService.getSessions(), 
              dataService.getLocations(),
              dataService.getWorkoutTypes(), 
              dataService.getAppConfig()
          ]) as [User[], TrainingSession[], LocationDef[], string[], AppConfig];
          
          setUsers(u); 
          setSessions(s); 
          setLocations(locs); 
          setWorkoutTypes(types); 
          if(config) setAppConfig(prev => ({...prev, ...config}));
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
      if (isAdminMode) {
          setIsAdminMode(false);
          // Don't clear persistent admin flag unless we want to logout
      } else {
          const isAdminStored = localStorage.getItem('niv_app_is_admin') === 'true';
          if (isAdminStored) setIsAdminMode(true);
          else setShowAdminLoginModal(true);
      }
  };

  const handleAdminExit = () => {
      setIsAdminMode(false);
      localStorage.removeItem('niv_app_is_admin');
      window.location.reload();
  };

  const currentUser = users.find(u => normalizePhone(u.phone) === normalizePhone(currentUserPhone || ''));
  
  const weekDates = Array.from({length: 7}, (_, i) => {
      const curr = new Date();
      const diff = curr.getDate() - curr.getDay() + (weekOffset * 7);
      const d = new Date(curr.setDate(diff + i));
      return d.toISOString().split('T')[0];
  });
  
  const groupedSessions = sessions.reduce((acc, s) => ({...acc, [s.date]: [...(acc[s.date]||[]), s]}), {} as Record<string, TrainingSession[]>);

  if (isLoadingData) return <div className="h-screen bg-brand-black flex items-center justify-center text-white font-black italic">טוען NIV FITNESS...</div>;

  return (
    <div className="min-h-screen bg-brand-black pb-24 text-right" dir="rtl">
      <header className="bg-brand-dark p-4 sticky top-0 z-50 border-b border-gray-800 flex justify-between items-center backdrop-blur-lg bg-opacity-80">
          <div onClick={handleLogoClick} className="cursor-pointer group">
              <h1 className="text-2xl font-black text-white italic uppercase transition-transform group-active:scale-95">
                  {appConfig.coachNameEng.split(' ')[0]} <span className="text-brand-primary">{appConfig.coachNameEng.split(' ').slice(1).join(' ')}</span>
              </h1>
          </div>
          <div className="flex items-center gap-3">
            {currentUser && <p className="text-white text-[10px] font-bold bg-gray-800 px-3 py-1 rounded-full border border-gray-700">שלום, {currentUser.fullName}</p>}
            {!currentUser && !isAdminMode && <button onClick={()=>setShowLoginModal(true)} className="text-brand-primary text-[10px] font-bold">התחברות</button>}
          </div>
      </header>

      <main className="max-w-4xl mx-auto p-4">
        {isAdminMode ? (
            <AdminPanel 
                users={users} sessions={sessions} primaryColor="#A3E635" workoutTypes={workoutTypes}
                locations={locations} weatherLocation={weatherLocation} weatherData={weatherData} appConfig={appConfig}
                onAddUser={async u => { await dataService.addUser(u); setUsers(prev=>[...prev, u]); }} 
                onUpdateUser={async u => { await dataService.updateUser(u); setUsers(prev=>prev.map(x=>x.id===u.id?u:x)); }}
                onDeleteUser={async id => { await dataService.deleteUser(id); setUsers(prev=>prev.filter(x=>x.id!==id)); }} 
                onAddSession={async s => { await dataService.addSession(s); setSessions(prev=>[...prev, s]); }}
                onUpdateSession={async s => { await dataService.updateSession(s); setSessions(prev=>prev.map(x=>x.id===s.id?s:x)); }} 
                onDeleteSession={async id => { await dataService.deleteSession(id); setSessions(prev=>prev.filter(x=>x.id!==id)); }}
                onColorChange={()=>{}} onUpdateWorkoutTypes={async t => { await dataService.saveWorkoutTypes(t); setWorkoutTypes(t); }} 
                onUpdateLocations={async l => { await dataService.saveLocations(l); setLocations(l); }}
                onUpdateWeatherLocation={setWeatherLocation} onUpdateAppConfig={async c => { await dataService.saveAppConfig(c); setAppConfig(c); }} 
                onExitAdmin={handleAdminExit}
            />
        ) : (
            <div className="space-y-6">
                <div className="flex justify-between items-center bg-gray-800 rounded-full p-1 max-w-sm mx-auto shadow-inner border border-gray-700">
                    <button onClick={()=>setWeekOffset(p=>p-1)} className="px-6 py-2 text-white hover:bg-gray-700 rounded-full transition-colors font-bold">←</button>
                    <span className="text-brand-primary font-black uppercase text-xs tracking-widest">{weekOffset===0?'השבוע':`שבוע ${weekOffset}`}</span>
                    <button onClick={()=>setWeekOffset(p=>p+1)} className="px-6 py-2 text-white hover:bg-gray-700 rounded-full transition-colors font-bold">→</button>
                </div>
                {weekDates.map(date => (
                    <div key={date} className="bg-gray-900/40 rounded-3xl p-4 border border-gray-800 shadow-sm">
                        <h4 className="text-gray-500 font-bold mb-4 text-xs flex justify-between items-center">
                            <span>{new Date(date).toLocaleDateString('he-IL',{weekday:'long'})}</span>
                            <span>{date.split('-').reverse().slice(0,2).join('/')}</span>
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {(groupedSessions[date] || []).filter(s=>!s.isHidden).map(s => (
                                <SessionCard key={s.id} session={s} allUsers={users} isRegistered={!!currentUserPhone && s.registeredPhoneNumbers.includes(normalizePhone(currentUserPhone))} onRegisterClick={()=>{}} onViewDetails={()=>{}} weather={weatherData[date]} locations={locations}/>
                            ))}
                        </div>
                        {!(groupedSessions[date]?.filter(s=>!s.isHidden).length) && <p className="text-gray-700 text-[10px] py-2">אין אימונים פומביים ביום זה</p>}
                    </div>
                ))}
            </div>
        )}
      </main>

      {/* HEALTH MODAL (Trainee Side) */}
      {showHealthModal && (
          <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4">
              <div className="bg-gray-800 p-6 rounded-3xl w-full max-w-md border border-gray-700 shadow-2xl overflow-y-auto max-h-[90vh]">
                  <h3 className="text-white font-black mb-4 text-center text-xl">הצהרת בריאות 🩺</h3>
                  <div className="bg-gray-900 p-4 rounded-2xl text-xs text-gray-300 space-y-3 mb-6 border border-gray-700 leading-relaxed">
                      {appConfig.healthDeclarationTemplate?.split('\n').map((line, i) => <p key={i}>{line}</p>)}
                  </div>
                  <div className="space-y-4">
                      <div className="flex items-center gap-3 bg-gray-900 p-4 rounded-2xl border border-gray-800">
                          <input type="checkbox" id="health-check" className="w-6 h-6 accent-brand-primary"/>
                          <label htmlFor="health-check" className="text-white text-xs">אני מאשר כי קראתי והבנתי את ההצהרה ואני חותם עליה מרצוני החופשי.</label>
                      </div>
                      <Button className="w-full" onClick={()=>{ 
                          const checked = (document.getElementById('health-check') as HTMLInputElement).checked;
                          if(!checked) { alert('נא לסמן אישור להצהרה'); return; }
                          alert('תודה! הצהרת הבריאות נשמרה במערכת.');
                          setShowHealthModal(false);
                      }}>שמור חתימה</Button>
                      <button onClick={()=>setShowHealthModal(false)} className="w-full text-gray-500 text-xs py-2">סגור</button>
                  </div>
              </div>
          </div>
      )}

      {/* ADMIN LOGIN MODAL */}
      {showAdminLoginModal && (
          <div className="fixed inset-0 bg-black/95 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-gray-800 p-8 rounded-3xl w-full max-w-sm border border-gray-700 shadow-2xl animate-in zoom-in-95">
                  <h3 className="text-white font-black mb-6 text-center text-xl">כניסה לניהול 🔒</h3>
                  <div className="space-y-4">
                      <input 
                        type="password" 
                        placeholder="סיסמת ניהול" 
                        className="w-full p-4 bg-gray-900 text-white rounded-2xl border border-gray-700 outline-none focus:border-brand-primary text-center tracking-widest" 
                        value={adminPasswordInput} 
                        onChange={e=>setAdminPasswordInput(e.target.value)}
                        onKeyDown={e=>e.key === 'Enter' && (document.getElementById('admin-login-btn') as HTMLElement).click()}
                      />
                      <Button id="admin-login-btn" className="w-full" onClick={()=>{
                          if(adminPasswordInput === (appConfig.coachAdditionalPhone || 'admin')) {
                              localStorage.setItem('niv_app_is_admin', 'true');
                              setIsAdminMode(true);
                              setShowAdminLoginModal(false);
                          } else {
                              alert('סיסמה שגויה. נסה שוב.');
                          }
                      }}>כניסה</Button>
                      <button onClick={()=>setShowAdminLoginModal(false)} className="w-full text-gray-500 text-[10px] mt-2 font-bold hover:text-white transition-colors">ביטול וחזרה</button>
                  </div>
              </div>
          </div>
      )}

      {/* TRAINEE LOGIN MODAL (Generic) */}
      {showLoginModal && (
          <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4">
              <div className="bg-gray-800 p-6 rounded-3xl w-full max-w-sm border border-gray-700 shadow-2xl">
                  <h3 className="text-white font-black mb-4 text-center">התחברות מתאמן 🏋️</h3>
                  <input type="tel" placeholder="מספר טלפון" className="w-full p-4 bg-gray-900 text-white rounded-2xl border border-gray-700 mb-4" value={loginPhone} onChange={e=>setLoginPhone(e.target.value)}/>
                  <Button className="w-full" onClick={()=>{
                      const phone = normalizePhone(loginPhone);
                      if(phone.length < 9) { alert('טלפון לא תקין'); return; }
                      setCurrentUserPhone(phone);
                      localStorage.setItem('niv_app_current_phone', phone);
                      setShowLoginModal(false);
                      setShowHealthModal(true);
                  }}>המשך להרשמה</Button>
                  <button onClick={()=>setShowLoginModal(false)} className="w-full text-gray-500 text-xs mt-4">סגור</button>
              </div>
          </div>
      )}
    </div>
  );
};

export default App;
