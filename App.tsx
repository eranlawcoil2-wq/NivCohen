
import React, { useState, useEffect, useCallback } from 'react';
import { User, TrainingSession, PaymentStatus, WorkoutType, WeatherLocation, PaymentLink, LocationDef, AppConfig, Quote, WeatherInfo } from './types';
import { SessionCard } from './components/SessionCard';
import { AdminPanel } from './components/AdminPanel';
import { Button } from './components/Button';
import { getMotivationQuote } from './services/geminiService';
import { getWeatherForDates, getWeatherIcon } from './services/weatherService';
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
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.008-.57-.008-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
    </svg>
);

const DownloadIcon = () => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
);

const App: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isCloudConnected, setIsCloudConnected] = useState(false);

  const [workoutTypes, setWorkoutTypes] = useState<string[]>(() => safeJsonParse('niv_app_types', Object.values(WorkoutType)));
  const [locations, setLocations] = useState<LocationDef[]>(() => safeJsonParse('niv_app_locations', [
        { id: '1', name: 'כיכר הפרפר, נס ציונה', address: 'כיכר הפרפר, נס ציונה', color: '#A3E635' },
        { id: '2', name: 'סטודיו נס ציונה', address: 'נס ציונה', color: '#3B82F6' },
  ]));
  
  const [appConfig, setAppConfig] = useState<AppConfig>({
      coachNameHeb: 'ניב כהן', coachNameEng: 'NIV COHEN', coachPhone: '0500000000', coachEmail: '', defaultCity: 'נס ציונה', coachAdditionalPhone: 'admin'
  });

  const [currentUserPhone, setCurrentUserPhone] = useState<string | null>(localStorage.getItem('niv_app_current_phone'));
  const [primaryColor, setPrimaryColor] = useState<string>(localStorage.getItem('niv_app_color') || '#A3E635');
  const [weekOffset, setWeekOffset] = useState(0); 
  
  // Fix: Added missing weatherLocation state
  const [weatherLocation, setWeatherLocation] = useState<WeatherLocation>(() => safeJsonParse('niv_app_weather_loc', {
      name: 'נס ציונה',
      lat: 31.93,
      lon: 34.80
  }));

  const [isAdminMode, setIsAdminMode] = useState<boolean>(() => {
      const fromStorage = localStorage.getItem('niv_app_is_admin') === 'true';
      return fromStorage || new URLSearchParams(window.location.search).get('mode') === 'admin';
  });
  
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showAdminLoginModal, setShowAdminLoginModal] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showHealthModal, setShowHealthModal] = useState(false);

  const [loginPhone, setLoginPhone] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [isNewUser, setIsNewUser] = useState(false);

  const [viewingSession, setViewingSession] = useState<TrainingSession | null>(null);
  const [quote, setQuote] = useState('');
  const [weatherData, setWeatherData] = useState<Record<string, WeatherInfo>>({});
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  const refreshData = useCallback(async () => {
      setIsLoadingData(true);
      try {
          const [u, s, locs, types, config, quotes] = await Promise.all([
              dataService.getUsers(), dataService.getSessions(), dataService.getLocations(),
              dataService.getWorkoutTypes(), dataService.getAppConfig(), dataService.getQuotes()
          ]);
          setUsers(u); setSessions(s);
          if (locs?.length) setLocations(locs);
          if (types?.length) setWorkoutTypes(types);
          setAppConfig(config);
          if (quotes?.length) setQuote(quotes[Math.floor(Math.random() * quotes.length)].text);
          else getMotivationQuote().then(setQuote);
          document.title = `${config.coachNameHeb} - אימוני כושר`;
          setIsCloudConnected(!!supabase);
      } catch (e) { console.error(e); } finally { setIsLoadingData(false); }
  }, []);

  useEffect(() => { refreshData(); }, [refreshData]);

  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Fetch weather when sessions or weatherLocation changes
  useEffect(() => {
    if (sessions.length > 0) {
      const dates = Array.from(new Set(sessions.map(s => s.date)));
      getWeatherForDates(dates, weatherLocation.lat, weatherLocation.lon).then(setWeatherData);
    }
  }, [sessions, weatherLocation]);

  const handleRegisterClick = async (sid: string) => {
      if (!currentUserPhone) { 
          setLoginPhone(''); 
          setNewUserName(''); 
          setIsNewUser(false);
          setShowLoginModal(true); 
          return; 
      }
      const phone = normalizePhone(currentUserPhone);
      const user = users.find(u => normalizePhone(u.phone) === phone);
      if (user?.isRestricted) { alert('🚫 המנוי שלך מוגבל.'); return; }
      
      const session = sessions.find(s => s.id === sid);
      if (!session) return;
      
      let updated = { ...session };
      if (session.registeredPhoneNumbers.includes(phone)) {
          updated.registeredPhoneNumbers = session.registeredPhoneNumbers.filter(p => p !== phone);
          if (updated.waitingList?.length) {
              const [next, ...rest] = updated.waitingList;
              updated.registeredPhoneNumbers.push(next);
              updated.waitingList = rest;
          }
      } else {
          if (session.registeredPhoneNumbers.length < session.maxCapacity) {
              updated.registeredPhoneNumbers = [...session.registeredPhoneNumbers, phone];
          } else {
              if (confirm('האימון מלא. להיכנס להמתנה?')) {
                  updated.waitingList = [...(session.waitingList || []), phone];
              } else return;
          }
      }
      setSessions(prev => prev.map(s => s.id === sid ? updated : s));
      await dataService.updateSession(updated);
  };

  const handleLogin = async () => {
      if (!loginPhone || loginPhone.length < 9) { alert('נא להזין מספר טלפון תקין'); return; }
      const phone = normalizePhone(loginPhone);
      const existingUser = users.find(u => normalizePhone(u.phone) === phone);
      
      if (!existingUser) {
          if (!isNewUser) {
              setIsNewUser(true);
              return; // Prompt for name
          }
          if (!newUserName) { alert('נא להזין שם מלא להרשמה'); return; }
          const newUser: User = { 
              id: Date.now().toString(), fullName: newUserName, phone, email: '', 
              startDate: new Date().toISOString(), paymentStatus: PaymentStatus.PAID, isNew: true 
          };
          await dataService.addUser(newUser);
          setUsers(prev => [...prev, newUser]);
      }
      setCurrentUserPhone(phone);
      localStorage.setItem('niv_app_current_phone', phone);
      setShowLoginModal(false);
  };

  const handleHealthSubmit = async (data: {id: string, file?: string}) => {
      const u = users.find(u => normalizePhone(u.phone) === normalizePhone(currentUserPhone || ''));
      if (!u) return;
      const updated = { ...u, healthDeclarationId: data.id, healthDeclarationFile: data.file, healthDeclarationDate: new Date().toISOString() };
      await dataService.updateUser(updated);
      setUsers(users.map(x => x.id === u.id ? updated : x));
      setShowHealthModal(false);
      alert('הצהרת הבריאות נשמרה בהצלחה!');
  };

  const currentUser = users.find(u => normalizePhone(u.phone) === normalizePhone(currentUserPhone || ''));
  const weekDates = getCurrentWeekDates(weekOffset);
  const groupedSessions = sessions.reduce((acc, s) => ({...acc, [s.date]: [...(acc[s.date]||[]), s]}), {} as Record<string, TrainingSession[]>);

  return (
    <div className="min-h-screen bg-brand-black pb-24 text-right" dir="rtl">
      <header className="bg-brand-dark p-4 sticky top-0 z-20 border-b border-gray-800 flex justify-between items-center shadow-lg">
          <div onClick={() => isAdminMode ? (localStorage.removeItem('niv_app_is_admin'), window.location.reload()) : setShowAdminLoginModal(true)} className="cursor-pointer">
              <h1 className="text-2xl font-black text-white italic uppercase">
                  {appConfig.coachNameEng.split(' ')[0]} <span className="text-brand-primary">{appConfig.coachNameEng.split(' ').slice(1).join(' ')}</span>
              </h1>
          </div>
          {currentUser && (
              <div className="flex flex-col items-end">
                  <p className="text-white text-xs font-bold">היי <span style={{color: currentUser.userColor}}>{currentUser.displayName || currentUser.fullName}</span></p>
                  <div className="flex gap-2">
                      <button onClick={() => setShowProfileModal(true)} className="text-[10px] text-brand-primary">פרופיל</button>
                      <button onClick={() => setShowHealthModal(true)} className="text-[10px] text-yellow-500">הצהרת בריאות</button>
                      <button onClick={() => {setCurrentUserPhone(null); localStorage.removeItem('niv_app_current_phone');}} className="text-[10px] text-gray-500">התנתק</button>
                  </div>
              </div>
          )}
      </header>

      <main className="max-w-4xl mx-auto p-4">
        {isAdminMode ? (
             <AdminPanel 
                users={users} sessions={sessions} primaryColor={primaryColor} workoutTypes={workoutTypes}
                locations={locations} weatherLocation={weatherLocation} paymentLinks={[]} streakGoal={3}
                appConfig={appConfig} weatherData={weatherData}
                onAddUser={async u => { await dataService.addUser(u); setUsers([...users, u]); }}
                onUpdateUser={async u => { await dataService.updateUser(u); setUsers(users.map(x=>x.id===u.id?u:x)); }}
                onDeleteUser={async id => { await dataService.deleteUser(id); setUsers(users.filter(x=>x.id!==id)); }}
                onAddSession={async s => { await dataService.addSession(s); setSessions([...sessions, s]); }}
                onUpdateSession={async s => { await dataService.updateSession(s); setSessions(sessions.map(x=>x.id===s.id?s:x)); }}
                onDeleteSession={async id => { await dataService.deleteSession(id); setSessions(sessions.filter(x=>x.id!==id)); }}
                onColorChange={setPrimaryColor} onUpdateWorkoutTypes={async t => { await dataService.saveWorkoutTypes(t); setWorkoutTypes(t); }} 
                onUpdateLocations={async l => { await dataService.saveLocations(l); setLocations(l); }}
                onUpdateWeatherLocation={(loc) => {
                    setWeatherLocation(loc);
                    localStorage.setItem('niv_app_weather_loc', JSON.stringify(loc));
                }} onAddPaymentLink={()=>{}} onDeletePaymentLink={()=>{}} onUpdateStreakGoal={()=>{}}
                onUpdateAppConfig={async c => { await dataService.saveAppConfig(c); setAppConfig(c); }}
                onExitAdmin={() => { localStorage.removeItem('niv_app_is_admin'); window.location.reload(); }}
            />
        ) : (
            <>
                {appConfig.urgentMessage && <div className="bg-red-600 text-white p-2 rounded-lg mb-4 text-center font-bold animate-pulse">{appConfig.urgentMessage}</div>}
                <div className="flex justify-between items-center mb-6 bg-gray-800 rounded-full p-1 max-w-sm mx-auto shadow-md">
                    <button onClick={()=>setWeekOffset(p=>p-1)} className="px-4 py-1 text-white hover:bg-gray-700 rounded-full">←</button>
                    <span className="text-brand-primary font-bold text-sm">{weekOffset===0?'השבוע':`שבוע ${weekOffset}`}</span>
                    <button onClick={()=>setWeekOffset(p=>p+1)} className="px-4 py-1 text-white hover:bg-gray-700 rounded-full">→</button>
                </div>
                <div className="flex flex-col gap-6"> 
                    {weekDates.map(date => {
                        const daySessions = (groupedSessions[date] || []).filter(s => !s.isHidden);
                        return (
                            <div key={date} className="rounded-xl border border-gray-800 bg-gray-900/40 overflow-hidden flex flex-col md:flex-row shadow-lg">
                                <div className="p-3 md:w-24 flex justify-between items-center md:flex-col md:justify-center bg-gray-800 text-gray-400 border-l border-gray-700">
                                    <span className="font-bold text-lg">{new Date(date).toLocaleDateString('he-IL',{weekday:'short'})}</span>
                                    <span className="text-sm">{date.split('-').reverse().slice(0,2).join('/')}</span>
                                </div>
                                <div className="flex-1 p-3 grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {daySessions.map(s => <SessionCard key={s.id} session={s} allUsers={users} isRegistered={!!currentUserPhone && s.registeredPhoneNumbers.includes(normalizePhone(currentUserPhone))} onRegisterClick={handleRegisterClick} onViewDetails={()=>setViewingSession(s)} weather={weatherData[s.date]} locations={locations}/>)}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </>
        )}
      </main>

      {/* Login Modal */}
      {showLoginModal && (
          <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
              <div className="bg-gray-800 p-6 rounded-xl w-full max-w-sm border border-gray-700">
                  <h3 className="text-white font-bold mb-4 text-center">התחברות מתאמן 🔐</h3>
                  <div className="space-y-4">
                    <input type="tel" placeholder="מספר טלפון (לדוגמה: 0501234567)" className="w-full p-3 bg-gray-900 text-white rounded border border-gray-700" value={loginPhone} onChange={e=>setLoginPhone(e.target.value)}/>
                    {isNewUser && (
                        <input type="text" placeholder="שם מלא (להרשמה)" className="w-full p-3 bg-gray-900 text-white rounded border border-gray-700 animate-in slide-in-from-top-2" value={newUserName} onChange={e=>setNewUserName(e.target.value)}/>
                    )}
                    <Button onClick={handleLogin} className="w-full">המשך</Button>
                    <button onClick={() => setShowLoginModal(false)} className="w-full text-gray-500 text-sm mt-2">ביטול</button>
                  </div>
              </div>
          </div>
      )}

      {/* Health Declaration Modal */}
      {showHealthModal && (
          <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
              <div className="bg-gray-800 p-6 rounded-xl w-full max-w-md border border-gray-700 overflow-y-auto max-h-[90vh]">
                  <h3 className="text-white font-bold mb-4 text-center">הצהרת בריאות 🩺</h3>
                  <div className="bg-gray-900 p-4 rounded text-xs text-gray-400 space-y-2 mb-4">
                      <p>אני מצהיר בזאת כי מצב בריאותי תקין וכי אין לי כל מניעה רפואית לביצוע פעילות גופנית עצימה.</p>
                      <p>התחייבות זו תקפה למשך שנה מיום חתימתה.</p>
                  </div>
                  <div className="space-y-4">
                      <input type="text" placeholder="מספר תעודת זהות" className="w-full p-3 bg-gray-900 text-white rounded border border-gray-700" id="health-id"/>
                      <div className="border border-dashed border-gray-600 p-4 rounded text-center">
                          <label className="cursor-pointer text-brand-primary text-sm">
                              📂 העלאת קובץ חתום (אופציונלי)
                              <input type="file" className="hidden" onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                      const reader = new FileReader();
                                      reader.onloadend = () => (window as any).tempHealthFile = reader.result;
                                      reader.readAsDataURL(file);
                                  }
                              }}/>
                          </label>
                      </div>
                      <div className="flex items-center gap-2">
                          <input type="checkbox" id="health-sign" className="w-5 h-5 accent-brand-primary"/>
                          <label htmlFor="health-sign" className="text-white text-sm">אני מאשר את הצהרת הבריאות וחתימתי האלקטרונית</label>
                      </div>
                      <Button onClick={() => {
                          const id = (document.getElementById('health-id') as HTMLInputElement).value;
                          const signed = (document.getElementById('health-sign') as HTMLInputElement).checked;
                          if (!id || !signed) { alert('נא למלא ת.ז ולסמן אישור'); return; }
                          handleHealthSubmit({ id, file: (window as any).tempHealthFile });
                      }} className="w-full">שלח הצהרה</Button>
                      <button onClick={() => setShowHealthModal(false)} className="w-full text-gray-500 text-sm">סגור</button>
                  </div>
              </div>
          </div>
      )}

      {/* Admin Login Modal */}
      {showAdminLoginModal && (
          <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
              <div className="bg-gray-800 p-6 rounded-xl w-full max-w-sm border border-gray-700">
                  <h3 className="text-white font-bold mb-4 text-center">כניסה לניהול 🔒</h3>
                  <input type="password" placeholder="סיסמת ניהול" className="w-full p-3 bg-gray-900 text-white rounded mb-4 border border-gray-700" value={adminPasswordInput} onChange={e=>setAdminPasswordInput(e.target.value)}/>
                  <Button onClick={() => {
                      if (adminPasswordInput === (appConfig.coachAdditionalPhone || 'admin')) {
                          localStorage.setItem('niv_app_is_admin', 'true');
                          window.location.reload();
                      } else alert('סיסמא שגויה');
                  }} className="w-full">כניסה</Button>
                  <button onClick={()=>setShowAdminLoginModal(false)} className="w-full text-gray-500 text-sm mt-2">ביטול</button>
              </div>
          </div>
      )}

      {/* Profile Modal */}
      {showProfileModal && currentUser && (
          <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
              <div className="bg-gray-800 p-6 rounded-xl w-full max-w-md border border-gray-700">
                  <h3 className="text-white font-bold mb-4">פרופיל מתאמן 👤</h3>
                  <div className="space-y-3">
                      <input type="text" placeholder="שם מלא" className="w-full p-3 bg-gray-900 text-white rounded border border-gray-700" defaultValue={currentUser.fullName} id="profile-name"/>
                      <input type="text" placeholder="כינוי" className="w-full p-3 bg-gray-900 text-white rounded border border-gray-700" defaultValue={currentUser.displayName} id="profile-nick"/>
                      <div className="flex items-center gap-2">
                          <label className="text-gray-400 text-sm">צבע שם:</label>
                          <input type="color" className="w-10 h-10 bg-transparent" defaultValue={currentUser.userColor} id="profile-color"/>
                      </div>
                  </div>
                  <div className="flex gap-2 mt-6">
                      <Button onClick={async () => {
                          const fullName = (document.getElementById('profile-name') as HTMLInputElement).value;
                          const displayName = (document.getElementById('profile-nick') as HTMLInputElement).value;
                          const userColor = (document.getElementById('profile-color') as HTMLInputElement).value;
                          const updated = { ...currentUser, fullName, displayName, userColor };
                          await dataService.updateUser(updated);
                          setUsers(users.map(u => u.id === currentUser.id ? updated : u));
                          setShowProfileModal(false);
                      }} className="flex-1">שמור</Button>
                      <Button onClick={()=>setShowProfileModal(false)} variant="secondary" className="flex-1">ביטול</Button>
                  </div>
              </div>
          </div>
      )}

      <footer className="fixed bottom-0 w-full bg-black/90 p-3 flex justify-between items-center border-t border-gray-800 z-50 backdrop-blur-md">
          <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isCloudConnected?'bg-green-500':'bg-red-500 animate-pulse'}`}/>
              <span className="text-[10px] text-gray-500">{isCloudConnected?'מחובר':'מקומי'}</span>
          </div>
          <div className="flex items-center gap-2">
              <button onClick={() => deferredPrompt ? deferredPrompt.prompt() : alert('האפליקציה כבר מותקנת או שאינה נתמכת בדפדפן זה')} className="bg-brand-primary text-brand-black px-3 py-1.5 rounded-full flex items-center gap-2 text-xs font-bold">
                  <DownloadIcon /><span>הורד אפליקציה</span>
              </button>
              <a href={`https://wa.me/${normalizePhoneForWhatsapp(appConfig.coachPhone)}`} target="_blank" rel="noreferrer" className="bg-[#25D366] text-white px-3 py-1.5 rounded-full flex items-center gap-2 text-xs font-bold">
                  <WhatsAppIcon /><span>שלח הודעה</span>
              </a>
          </div>
      </footer>
    </div>
  );
};

const getCurrentWeekDates = (offset: number) => {
  const curr = new Date();
  const diff = curr.getDate() - curr.getDay() + (offset * 7);
  const start = new Date(curr.setDate(diff));
  return Array.from({length: 7}, (_, i) => { 
      const d = new Date(start); d.setDate(start.getDate() + i);
      return d.toISOString().split('T')[0];
  });
};

export default App;
