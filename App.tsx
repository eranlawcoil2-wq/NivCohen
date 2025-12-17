import React, { useState, useEffect, useCallback } from 'react';
import { User, TrainingSession, PaymentStatus, WorkoutType, WeatherLocation, PaymentLink, LocationDef, AppConfig, Quote, WeatherInfo } from './types';
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

const InstallPrompt: React.FC<{ onClose: () => void, onInstall: () => void, canInstall: boolean, isIos: boolean }> = ({ onClose, onInstall, canInstall, isIos }) => (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
        <div className="bg-gray-800 border border-gray-700 p-6 rounded-2xl shadow-2xl w-full max-w-sm relative mb-4">
            <button onClick={onClose} className="absolute top-3 left-3 text-gray-400 hover:text-white p-2">✕</button>
            <div className="text-center mb-4">
                <div className="text-4xl mb-2">📲</div>
                <h3 className="text-white font-black text-xl mb-1">הורד את האפליקציה!</h3>
            </div>
            
            {isIos ? (
                 <div className="bg-gray-900/80 rounded-xl p-4 text-sm text-gray-300 space-y-3 relative text-right" dir="rtl">
                     <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 text-brand-primary animate-bounce text-2xl">⬇</div>
                     <p className="font-bold text-white text-center mb-2">איך מתקינים באייפון?</p>
                     <div className="flex items-center gap-3">
                         <span className="bg-gray-700 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0">1</span>
                         <span>לחץ על כפתור השיתוף <span className="inline-block align-middle mx-1"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg></span> למטה</span>
                     </div>
                     <div className="flex items-center gap-3">
                         <span className="bg-gray-700 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0">2</span>
                         <span>גלול ובחר <b>"הוסף למסך הבית"</b></span>
                     </div>
                     <div className="flex items-center gap-3">
                         <span className="bg-gray-700 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0">3</span>
                         <span>לחץ על <b>"הוסף"</b> למעלה</span>
                     </div>
                 </div>
            ) : canInstall ? (
                <Button onClick={onInstall} className="w-full py-3 text-lg shadow-xl shadow-brand-primary/20">התקן עכשיו</Button>
            ) : (
                <div className="bg-gray-900/80 rounded-xl p-4 text-sm text-gray-300 space-y-3 relative text-right" dir="rtl">
                    <div className="absolute -bottom-8 right-8 text-brand-primary animate-bounce text-2xl">⬇</div>
                    <p className="font-bold text-white text-center mb-2">איך מתקינים בדפדפן?</p>
                    <div className="flex items-center gap-3">
                        <span className="bg-gray-700 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0">1</span>
                        <span>לחץ על תפריט הדפדפן (3 נקודות)</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="bg-gray-700 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0">2</span>
                        <span>בחר באפשרות <b>"התקן אפליקציה"</b> או <b>"הוסף למסך הבית"</b></span>
                    </div>
                </div>
            )}
        </div>
    </div>
);

// --- ICS File Generation Helper ---
const downloadIcsFile = (session: TrainingSession, coachName: string) => {
    const startTime = new Date(`${session.date}T${session.time}`);
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour duration

    const formatDate = (date: Date) => date.toISOString().replace(/-|:|\.\d\d\d/g, "");

    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//NivCohenFitness//IL
CALSCALE:GREGORIAN
BEGIN:VEVENT
DTSTART:${formatDate(startTime)}
DTEND:${formatDate(endTime)}
SUMMARY:אימון ${session.type} - ${coachName}
DESCRIPTION:${session.description || 'אימון כושר'}
LOCATION:${session.location}
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', `workout_${session.date}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

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
  
  const [isAdminMode, setIsAdminMode] = useState<boolean>(() => {
      const fromStorage = localStorage.getItem('niv_app_is_admin') === 'true';
      const fromUrl = new URLSearchParams(window.location.search).get('mode') === 'admin';
      return fromStorage || fromUrl;
  });
  
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showAdminLoginModal, setShowAdminLoginModal] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showStreakTooltip, setShowStreakTooltip] = useState(false);
  const [showLegalModal, setShowLegalModal] = useState(false);
  const [legalTab, setLegalTab] = useState<'privacy' | 'terms' | 'health'>('privacy');

  const [loginPhone, setLoginPhone] = useState('');
  const [newUserName, setNewUserName] = useState('');
  
  const [editProfileData, setEditProfileData] = useState<{fullName: string, email: string, displayName: string, userColor: string, phone: string, healthFile?: string}>({ fullName: '', email: '', displayName: '', userColor: '#A3E635', phone: '', healthFile: '' });

  const [viewingSession, setViewingSession] = useState<TrainingSession | null>(null);
  const [quote, setQuote] = useState('');
  const [weatherData, setWeatherData] = useState<Record<string, WeatherInfo>>({});
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
      const locs = localStorage.getItem('niv_app_locations');
      if (locs && locs.includes('פארק הירקון')) {
          localStorage.removeItem('niv_app_locations');
          window.location.reload();
      }
  }, []);

  const handleLogoClick = () => {
      if (isAdminMode) {
          localStorage.removeItem('niv_app_is_admin');
          window.location.href = '/'; 
      } else {
          setAdminPasswordInput('');
          setShowAdminLoginModal(true);
      }
  };

  const handleAdminLoginSubmit = () => {
      const requiredPassword = appConfig.coachAdditionalPhone?.trim() || 'admin'; 
      if (adminPasswordInput === requiredPassword) {
          localStorage.setItem('niv_app_is_admin', 'true');
          window.location.href = '/?mode=admin';
      } else {
          alert('סיסמא שגויה. נסה שוב.');
      }
  };

  const refreshData = useCallback(async () => {
      setIsLoadingData(true);
      const connected = !!supabase;
      setIsCloudConnected(connected);
      
      try {
          const u = await dataService.getUsers();
          const s = await dataService.getSessions();
          setUsers(u); 
          setSessions(s);

          const locs = await dataService.getLocations();
          if (locs && locs.length > 0) setLocations(locs);

          const types = await dataService.getWorkoutTypes();
          if (types && types.length > 0) setWorkoutTypes(types);
          
          const config = await dataService.getAppConfig();
          setAppConfig(config);

          const quotes = await dataService.getQuotes();
          setCustomQuotes(quotes);

          if (quotes && quotes.length > 0) {
              const randomQuote = quotes[Math.floor(Math.random() * quotes.length)].text;
              setQuote(randomQuote);
          } else {
               getMotivationQuote().then(setQuote);
          }
          
          document.title = `${config.coachNameHeb} - אימוני כושר`;

      } catch (e) { 
          console.error(e); 
      } finally { 
          setIsLoadingData(false); 
      }
  }, []);

  useEffect(() => { refreshData(); }, [refreshData]);

  useEffect(() => {
      const handleVisibilityChange = () => {
          if (document.visibilityState === 'visible') {
              refreshData();
          }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);
      return () => {
          document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
  }, [refreshData]);

  const handleUpdateLocations = async (newLocations: LocationDef[]) => {
      const currentIds = newLocations.map(l => l.id);
      const deleted = locations.filter(l => !currentIds.includes(l.id));
      for (const d of deleted) await dataService.deleteLocation(d.id);
      await dataService.saveLocations(newLocations);
      setLocations(newLocations);
  };

  const handleUpdateWorkoutTypes = async (newTypes: string[]) => {
      const deleted = workoutTypes.filter(t => !newTypes.includes(t));
      for (const d of deleted) await dataService.deleteWorkoutType(d);
      await dataService.saveWorkoutTypes(newTypes);
      setWorkoutTypes(newTypes);
  };
  
  const handleUpdateAppConfig = async (newConfig: AppConfig) => {
      await dataService.saveAppConfig(newConfig);
      setAppConfig(newConfig);
      document.title = `${newConfig.coachNameHeb} - אימוני כושר`;
  };

  const handleAddQuote = async (text: string) => {
      const newQuote: Quote = { id: Date.now().toString(), text };
      await dataService.addQuote(newQuote);
      setCustomQuotes([...customQuotes, newQuote]);
  };

  const handleDeleteQuote = async (id: string) => {
      await dataService.deleteQuote(id);
      setCustomQuotes(customQuotes.filter(q => q.id !== id));
  };
  
  useEffect(() => {
      const params = new URLSearchParams(window.location.search);
      const isParamAdmin = params.get('mode') === 'admin';
      
      const updateIcon = (isAdmin: boolean) => {
          const color = isAdmin ? '%23EF4444' : '%23A3E635'; 
          const svgIcon = `data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect width=%22100%22 height=%22100%22 fill=%22${color}%22/><text x=%2250%22 y=%2250%22 font-family=%22sans-serif%22 font-weight=%22900%22 font-size=%2240%22 text-anchor=%22middle%22 dy=%22.35em%22 fill=%22%23121212%22>NIV</text></svg>`;
          const linkIcon = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
          const linkApple = document.querySelector("link[rel='apple-touch-icon']") as HTMLLinkElement;
          if (linkIcon) linkIcon.href = svgIcon;
          if (linkApple) linkApple.href = svgIcon;
      };
      updateIcon(isParamAdmin || isAdminMode);
  }, [isAdminMode]);

  useEffect(() => { localStorage.setItem('niv_app_color', primaryColor); document.documentElement.style.setProperty('--brand-primary', primaryColor); }, [primaryColor]);
  
  const getCurrentWeekDates = (offset: number) => {
    const curr = new Date();
    const diff = curr.getDate() - curr.getDay() + (offset * 7);
    const start = new Date(curr.setDate(diff));
    return Array.from({length: 7}, (_, i) => { 
        const d = new Date(start); d.setDate(start.getDate() + i);
        return d.toISOString().split('T')[0];
    });
  };

  useEffect(() => { getWeatherForDates(getCurrentWeekDates(0), weatherLocation.lat, weatherLocation.lon).then(setWeatherData); }, []);
  
  useEffect(() => {
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIos(iOS);
    const isInStandaloneMode = ('standalone' in window.navigator) && (window.navigator as any).standalone;
    const handler = (e: Event) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = () => {
    if (deferredPrompt) { deferredPrompt.prompt(); setDeferredPrompt(null); }
    else { setShowInstallPrompt(true); }
  };

  const getMonthlyWorkoutsCount = (phone: string) => {
      const normalized = normalizePhone(phone);
      const now = new Date();
      return sessions.filter(s => {
          const d = new Date(s.date);
          const isRegistered = s.registeredPhoneNumbers?.includes(normalized);
          const hasAttendedList = s.attendedPhoneNumbers !== undefined && s.attendedPhoneNumbers !== null;
          let didAttend = hasAttendedList ? s.attendedPhoneNumbers!.includes(normalized) : isRegistered;
          return d.getMonth() === now.getMonth() && didAttend;
      }).length;
  };

  const calculateStreak = (phone: string) => {
      if (!sessions || sessions.length === 0) return 0;
      const normalized = normalizePhone(phone);
      const userSessions = sessions.filter(s => {
         const hasAttendedList = s.attendedPhoneNumbers !== undefined && s.attendedPhoneNumbers !== null;
         return hasAttendedList ? s.attendedPhoneNumbers!.includes(normalized) : s.registeredPhoneNumbers?.includes(normalized);
      }).map(s => new Date(s.date));

      if (userSessions.length === 0) return 0;
      const weeks: Record<string, number> = {};
      userSessions.forEach(d => {
          const startOfWeek = new Date(d);
          startOfWeek.setDate(d.getDate() - d.getDay());
          startOfWeek.setHours(0,0,0,0);
          const key = startOfWeek.toISOString().split('T')[0];
          weeks[key] = (weeks[key] || 0) + 1;
      });

      let currentStreak = 0;
      const today = new Date();
      let checkDate = new Date(today.setDate(today.getDate() - today.getDay()));
      checkDate.setHours(0,0,0,0);

      while(true) {
          const count = weeks[checkDate.toISOString().split('T')[0]] || 0;
          if (count >= 3) { currentStreak++; } 
          else if (checkDate.getTime() < new Date().getTime() - 7 * 24 * 60 * 60 * 1000) break;
          checkDate.setDate(checkDate.getDate() - 7);
          if (checkDate.getFullYear() < 2023) break; 
      }
      return currentStreak;
  };

  const currentUser = users.find(u => normalizePhone(u.phone) === normalizePhone(currentUserPhone || ''));
  const streakCount = currentUser ? calculateStreak(currentUser.phone) : 0;
  const userStats = { currentMonthCount: currentUser ? getMonthlyWorkoutsCount(currentUser.phone) : 0, monthlyRecord: currentUser?.monthlyRecord || 0 };

  const weekDates = getCurrentWeekDates(weekOffset);
  const groupedSessions = sessions.reduce((acc, s) => ({...acc, [s.date]: [...(acc[s.date]||[]), s]}), {} as Record<string, TrainingSession[]>);

  const handleRegisterClick = async (sid: string) => {
      if (!currentUserPhone) { setShowLoginModal(true); return; }
      const currentUserObj = users.find(u => normalizePhone(u.phone) === normalizePhone(currentUserPhone));
      if (currentUserObj?.isRestricted) { alert('🚫 המנוי שלך מוגבל.'); return; }
      const session = sessions.find(s => s.id === sid);
      if (!session) return;
      const phone = normalizePhone(currentUserPhone);
      let updatedSession = { ...session };
      
      if (session.registeredPhoneNumbers?.includes(phone)) {
          updatedSession.registeredPhoneNumbers = session.registeredPhoneNumbers.filter(p => p !== phone);
          if (updatedSession.waitingList?.length) {
              const [next, ...rest] = updatedSession.waitingList;
              updatedSession.registeredPhoneNumbers.push(next);
              updatedSession.waitingList = rest;
          }
      } else if (session.waitingList?.includes(phone)) {
          updatedSession.waitingList = session.waitingList.filter(p => p !== phone);
      } else {
          if (session.registeredPhoneNumbers.length < session.maxCapacity) {
              updatedSession.registeredPhoneNumbers = [...session.registeredPhoneNumbers, phone];
          } else {
              if (confirm('האימון מלא. היכנס להמתנה?')) {
                  updatedSession.waitingList = [...(session.waitingList || []), phone];
              } else return;
          }
      }
      setSessions(prev => prev.map(s => s.id === sid ? updatedSession : s));
      if (viewingSession?.id === sid) setViewingSession(updatedSession);
      await dataService.updateSession(updatedSession);
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

  const handleUpdateProfile = async () => {
      if (!currentUser) return;
      const updatedUser: User = { ...currentUser, fullName: editProfileData.fullName, email: editProfileData.email, displayName: editProfileData.displayName, userColor: editProfileData.userColor, phone: normalizePhone(editProfileData.phone) };
      await dataService.updateUser(updatedUser);
      setUsers(users.map(u => u.id === currentUser.id ? updatedUser : u));
      setShowProfileModal(false);
  };

  return (
    <div className={isAdminMode ? 'min-h-screen pb-24 bg-brand-black md:bg-[#330000]' : 'min-h-screen bg-brand-black pb-24 text-right'} dir="rtl">
      <header className="bg-brand-dark p-4 sticky top-0 z-20 border-b border-gray-800 flex justify-between items-center shadow-lg">
          <div onClick={handleLogoClick} className="cursor-pointer group select-none">
              <h1 className="text-2xl font-black text-white italic uppercase">
                  {appConfig.coachNameEng.split(' ')[0]} <span className="text-brand-primary">{appConfig.coachNameEng.split(' ').slice(1).join(' ')}</span>
              </h1>
          </div>
          {currentUser && (
              <div className="flex flex-col items-end">
                  <p className="text-white text-xs font-bold">היי <span style={{color: currentUser.userColor}}>{currentUser.displayName || currentUser.fullName}</span></p>
                  <div className="flex gap-2">
                      <button onClick={() => { setEditProfileData({...currentUser, phone: currentUser.phone}); setShowProfileModal(true); }} className="text-[10px] text-brand-primary">ערוך פרופיל</button>
                      <button onClick={()=>{setCurrentUserPhone(null); localStorage.removeItem('niv_app_current_phone');}} className="text-[10px] text-gray-500">התנתק</button>
                  </div>
              </div>
          )}
      </header>

      <main className="max-w-4xl mx-auto p-4">
        {currentUser && (
            <div className="mb-6 p-4 rounded-xl border border-gray-800 bg-gray-900 flex justify-between items-start relative overflow-hidden">
                <div className="flex flex-col gap-1">
                    <div className="text-gray-400 text-xs">אימונים החודש</div>
                    <div className="text-3xl font-bold text-white">{userStats.currentMonthCount}</div>
                    <div className="text-xs text-gray-500">שיא אישי: <span className="text-brand-primary font-bold">{Math.max(userStats.monthlyRecord, userStats.currentMonthCount)}</span></div>
                </div>
                <div className="flex flex-col items-center" onClick={() => setShowStreakTooltip(!showStreakTooltip)}>
                    <div className="text-4xl mb-1 filter drop-shadow-lg">🏆</div>
                    <div className="bg-brand-primary/20 text-brand-primary text-xs px-2 py-0.5 rounded-full font-bold">רצפים: {streakCount}</div>
                </div>
                {appConfig.urgentMessage ? (
                    <div className="absolute inset-x-0 bottom-0 bg-red-600 text-white text-[10px] font-bold py-1 text-center animate-pulse">{appConfig.urgentMessage}</div>
                ) : (
                    <div className="absolute bottom-2 left-4 text-[10px] text-gray-600 italic">"{quote}"</div>
                )}
            </div>
        )}

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
                onColorChange={setPrimaryColor} onUpdateWorkoutTypes={handleUpdateWorkoutTypes} onUpdateLocations={handleUpdateLocations}
                onUpdateWeatherLocation={setWeatherLocation} onAddPaymentLink={l=>setPaymentLinks([...paymentLinks,l])}
                onDeletePaymentLink={id=>setPaymentLinks(paymentLinks.filter(l=>l.id!==id))} onUpdateStreakGoal={setStreakGoal}
                onUpdateAppConfig={handleUpdateAppConfig} onAddQuote={handleAddQuote} onDeleteQuote={handleDeleteQuote}
                onExitAdmin={() => { localStorage.removeItem('niv_app_is_admin'); window.location.href = '/'; }}
            />
        ) : (
            <>
                <div className="flex justify-between items-center mb-6 bg-gray-800 rounded-full p-1 max-w-sm mx-auto shadow-md">
                    <button onClick={()=>setWeekOffset(p=>p-1)} className="px-4 py-1 text-white hover:bg-gray-700 rounded-full transition-colors">←</button>
                    <span className="text-brand-primary font-bold text-sm">{weekOffset===0?'השבוע':`שבוע ${weekOffset}`}</span>
                    <button onClick={()=>setWeekOffset(p=>p+1)} className="px-4 py-1 text-white hover:bg-gray-700 rounded-full transition-colors">→</button>
                </div>
                <div className="flex flex-col gap-6"> 
                    {weekDates.map(date => {
                        const daySessions = (groupedSessions[date] || []).filter(s => !s.isHidden);
                        const isToday = new Date().toISOString().split('T')[0] === date;
                        return (
                            <div key={date} className={`rounded-xl border overflow-hidden flex flex-col md:flex-row shadow-lg ${isToday ? 'border-brand-primary bg-gray-800/50' : 'border-gray-800 bg-gray-900/40'}`}>
                                <div className={`p-3 md:w-24 flex justify-between items-center md:flex-col md:justify-center border-b md:border-b-0 md:border-l border-gray-700 ${isToday?'bg-brand-primary/10 text-brand-primary':'bg-gray-800 text-gray-400'}`}>
                                    <div className="flex items-baseline gap-2 md:flex-col md:text-center">
                                        <span className="font-bold text-lg">{new Date(date).toLocaleDateString('he-IL',{weekday:'short'})}</span>
                                        <span className="text-sm">{new Date(date).getDate()}/{new Date(date).getMonth()+1}</span>
                                    </div>
                                    {weatherData[date] && <div className="text-[10px] font-mono">{Math.round(weatherData[date].maxTemp)}° {getWeatherIcon(weatherData[date].weatherCode)}</div>}
                                </div>
                                <div className="flex-1 p-3 grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {daySessions.map(s => <SessionCard key={s.id} session={s} allUsers={users} isRegistered={!!currentUserPhone && s.registeredPhoneNumbers?.includes(normalizePhone(currentUserPhone))} onRegisterClick={handleRegisterClick} onViewDetails={()=>setViewingSession(s)} weather={weatherData[s.date]} locations={locations}/>)}
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
              <div className="bg-gray-800 w-full md:max-w-md rounded-t-2xl md:rounded-2xl border-t border-brand-primary shadow-2xl p-6" onClick={e=>e.stopPropagation()}>
                  <h2 className="text-3xl text-white font-black mb-1">{viewingSession.type}</h2>
                  <p className="text-brand-primary font-mono mb-4">{viewingSession.time} | {viewingSession.location}</p>
                  <p className="text-gray-300 text-sm mb-6 bg-black/20 p-3 rounded-lg">{viewingSession.description || 'ללא תיאור'}</p>
                  <div className="space-y-2 mb-6 max-h-40 overflow-y-auto">
                      <div className="text-xs text-gray-500 font-bold mb-1">רשומים ({viewingSession.registeredPhoneNumbers.length}/{viewingSession.maxCapacity}):</div>
                      <div className="grid grid-cols-2 gap-2">
                        {viewingSession.registeredPhoneNumbers.map(p => {
                            const u = users.find(user => normalizePhone(user.phone) === p);
                            return <div key={p} className="bg-gray-700/50 text-gray-200 text-[10px] px-2 py-1 rounded border border-gray-600 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{backgroundColor: u?.userColor || '#fff'}}/>{u?.displayName || u?.fullName || 'מתאמן'}</div>
                        })}
                      </div>
                  </div>
                  <Button onClick={()=>handleRegisterClick(viewingSession.id)} className="w-full py-4 text-xl">
                      {viewingSession.registeredPhoneNumbers.includes(normalizePhone(currentUserPhone || '')) ? 'בטל הרשמה ✕' : 'הירשם עכשיו +'}
                  </Button>
              </div>
          </div>
      )}

      {showLoginModal && (
          <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
              <div className="bg-gray-800 p-6 rounded-xl w-full max-w-sm border border-gray-700">
                  <h3 className="text-white font-bold mb-4 text-center">התחברות מתאמן 🔐</h3>
                  <input type="tel" placeholder="מספר טלפון" className="w-full p-3 bg-gray-900 text-white rounded mb-2 border border-gray-700" value={loginPhone} onChange={e=>setLoginPhone(e.target.value)}/>
                  {!users.some(u=>normalizePhone(u.phone)===normalizePhone(loginPhone)) && loginPhone.length > 8 && (
                      <input type="text" placeholder="שם מלא (להרשמה)" className="w-full p-3 bg-gray-900 text-white rounded mb-2 border border-gray-700" value={newUserName} onChange={e=>setNewUserName(e.target.value)}/>
                  )}
                  <Button onClick={handleLogin} className="w-full mt-2">המשך</Button>
              </div>
          </div>
      )}

      {showAdminLoginModal && (
          <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
              <div className="bg-gray-800 p-6 rounded-xl w-full max-w-sm border border-gray-700">
                  <h3 className="text-white font-bold mb-4 text-center">כניסה לניהול 🔒</h3>
                  <input type="password" placeholder="סיסמת ניהול" className="w-full p-3 bg-gray-900 text-white rounded mb-4 border border-gray-700" value={adminPasswordInput} onChange={e=>setAdminPasswordInput(e.target.value)}/>
                  <Button onClick={handleAdminLoginSubmit} className="w-full">כניסה</Button>
                  <Button onClick={()=>setShowAdminLoginModal(false)} variant="secondary" className="w-full mt-2">ביטול</Button>
              </div>
          </div>
      )}

      {showProfileModal && (
          <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
              <div className="bg-gray-800 p-6 rounded-xl w-full max-w-md border border-gray-700">
                  <h3 className="text-white font-bold mb-4">פרופיל מתאמן 👤</h3>
                  <div className="space-y-3">
                      <input type="text" placeholder="שם מלא" className="w-full p-3 bg-gray-900 text-white rounded border border-gray-700" value={editProfileData.fullName} onChange={e=>setEditProfileData({...editProfileData, fullName: e.target.value})}/>
                      <input type="text" placeholder="כינוי (שם שיוצג לאחרים)" className="w-full p-3 bg-gray-900 text-white rounded border border-gray-700" value={editProfileData.displayName} onChange={e=>setEditProfileData({...editProfileData, displayName: e.target.value})}/>
                      <input type="tel" placeholder="טלפון" className="w-full p-3 bg-gray-900 text-white rounded border border-gray-700" value={editProfileData.phone} onChange={e=>setEditProfileData({...editProfileData, phone: e.target.value})}/>
                      <div className="flex items-center gap-2">
                          <label className="text-gray-400 text-sm">צבע שם:</label>
                          <input type="color" className="w-full h-10 bg-transparent" value={editProfileData.userColor} onChange={e=>setEditProfileData({...editProfileData, userColor: e.target.value})}/>
                      </div>
                  </div>
                  <div className="flex gap-2 mt-6">
                      <Button onClick={handleUpdateProfile} className="flex-1">שמור שינויים</Button>
                      <Button onClick={()=>setShowProfileModal(false)} variant="secondary" className="flex-1">ביטול</Button>
                  </div>
              </div>
          </div>
      )}

      {showInstallPrompt && <InstallPrompt onClose={()=>setShowInstallPrompt(false)} onInstall={handleInstallClick} canInstall={!!deferredPrompt} isIos={isIos}/>}
      
      <footer className="fixed bottom-0 w-full bg-black/90 p-3 flex justify-between items-center border-t border-gray-800 z-50 backdrop-blur-md">
          <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isCloudConnected?'bg-green-500':'bg-red-500 animate-pulse'}`}/>
              <span className="text-[10px] text-gray-500">{isCloudConnected?'מחובר':'מקומי'}</span>
          </div>
          <div className="flex items-center gap-2">
              <button 
                  onClick={handleInstallClick} 
                  className="bg-brand-primary text-brand-black px-3 py-1.5 rounded-full flex items-center gap-2 transition-all shadow-lg text-xs font-bold"
              >
                  <DownloadIcon />
                  <span>הורד אפליקציה</span>
              </button>
              <a href={`https://wa.me/${normalizePhoneForWhatsapp(appConfig.coachPhone)}`} target="_blank" rel="noreferrer" className="bg-[#25D366] text-white px-3 py-1.5 rounded-full flex items-center gap-2 transition-all shadow-lg text-xs font-bold">
                  <WhatsAppIcon />
                  <span>שלח הודעה</span>
              </a>
          </div>
      </footer>
    </div>
  );
};

export default App;