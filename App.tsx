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
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.008-.57-.008-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
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
                 <div className="bg-gray-900/80 rounded-xl p-4 text-sm text-gray-300 space-y-3 relative">
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
                <div className="bg-gray-900/80 rounded-xl p-4 text-sm text-gray-300 space-y-3 relative">
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

// --- Legal Texts ---
const LEGAL_TEXTS = {
    privacy: `
**מדיניות פרטיות**

1. **איסוף מידע:** האפליקציה אוספת את שמך, מספר הטלפון וכתובת האימייל שלך לצורך ניהול הרישום לאימונים, מעקב נוכחות ויצירת קשר בלבד.
2. **שימוש במידע:** המידע משמש אך ורק את צוות האימון לצורך תפעול שוטף. המידע אינו מועבר לצד שלישי, אינו נמכר ואינו משמש לפרסום חיצוני.
3. **אבטחת מידע:** אנו נוקטים באמצעים סבירים לאבטחת המידע, אך השימוש באפליקציה הוא על אחריות המשתמש בלבד.
4. **מחיקת מידע:** ניתן לבקש מחיקת פרטים בכל עת בפנייה ישירה למאמן.
    `,
    terms: `
**תנאי שימוש והסרת אחריות**

1. **אחריות המשתמש:** ההשתתפות באימונים היא על אחריות המתאמן/ת בלבד.
2. **הסרת אחריות:** המאמן, המפעילים ומפתחי האפליקציה אינם נושאים באחריות לכל נזק גופני, בריאותי או רכושי שעלול להיגרם במהלך האימונים, לפניהם או אחריהם.
3. **כשירות רפואית:** בעצם ההרשמה לאימון, המתאמן מצהיר כי הוא כשיר רפואית לביצוע פעילות גופנית בעצימות הנדרשת.
4. **שינויים וביטולים:** המאמן שומר לעצמו את הזכות לשנות מועדי אימונים, מיקומים או לבטלם בהתראה סבירה.
    `,
    health: `
**הצהרת בריאות**

אני החתום/ה מטה מצהיר/ה בזאת כי:
1. הנני בריא/ה וכשיר/ה לעסוק בפעילות גופנית מאומצת.
2. לא ידוע לי על שום מגבלה רפואית המונעת ממני להשתתף באימונים.
3. התייעצתי עם רופא טרם תחילת הפעילות במידת הצורך.
4. במידה ויחול שינוי במצבי הבריאותי, חובתי לדווח על כך למאמן באופן מיידי ולהפסיק את הפעילות עד לקבלת אישור רפואי חדש.
5. אני משחרר/ת את המאמן מכל אחריות לכל פגיעה או נזק גופני שעלול להיגרם לי כתוצאה מהאימון.
    `
};

const App: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isCloudConnected, setIsCloudConnected] = useState(false);

  // Defaults - initially loaded from local storage, then updated from DB
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
      coachAdditionalPhone: 'admin' // Default password for new sessions or fallback
  });

  const [paymentLinks, setPaymentLinks] = useState<PaymentLink[]>(() => safeJsonParse('niv_app_payments', []));
  const [streakGoal, setStreakGoal] = useState<number>(() => parseInt(localStorage.getItem('niv_app_streak_goal') || '3'));
  const [weatherLocation, setWeatherLocation] = useState<WeatherLocation>(() => safeJsonParse('niv_app_weather_loc', { name: 'נס ציונה', lat: 31.93, lon: 34.80 }));
  const [currentUserPhone, setCurrentUserPhone] = useState<string | null>(localStorage.getItem('niv_app_current_phone'));
  const [primaryColor, setPrimaryColor] = useState<string>(localStorage.getItem('niv_app_color') || '#A3E635');
  const [weekOffset, setWeekOffset] = useState(0); 
  
  // Initialize admin mode from localStorage to persist login
  // Also check URL param to ensure we don't get into inconsistent state
  const [isAdminMode, setIsAdminMode] = useState<boolean>(() => {
      const fromStorage = localStorage.getItem('niv_app_is_admin') === 'true';
      const fromUrl = new URLSearchParams(window.location.search).get('mode') === 'admin';
      return fromStorage || fromUrl;
  });
  
  // Modals State
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showAdminLoginModal, setShowAdminLoginModal] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showStreakTooltip, setShowStreakTooltip] = useState(false);
  const [showLegalModal, setShowLegalModal] = useState(false);
  const [legalTab, setLegalTab] = useState<'privacy' | 'terms' | 'health'>('privacy');

  // Login State
  const [loginPhone, setLoginPhone] = useState('');
  const [newUserName, setNewUserName] = useState('');
  
  // Profile Edit State
  const [editProfileData, setEditProfileData] = useState<{fullName: string, email: string, displayName: string, userColor: string, phone: string, healthFile?: string}>({ fullName: '', email: '', displayName: '', userColor: '#A3E635', phone: '', healthFile: '' });

  // Digital Signature State
  const [signId, setSignId] = useState('');
  const [signCheck, setSignCheck] = useState(false);

  const [viewingSession, setViewingSession] = useState<TrainingSession | null>(null);
  const [quote, setQuote] = useState('');
  // CHANGED: Use WeatherInfo Record
  const [weatherData, setWeatherData] = useState<Record<string, WeatherInfo>>({});
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isIos, setIsIos] = useState(false);

  // --- AUTO-FIX EFFECT: Clean old cache if detected ---
  useEffect(() => {
      const locs = localStorage.getItem('niv_app_locations');
      if (locs && locs.includes('פארק הירקון')) {
          console.log('Detected old default location (Park Hayarkon). Clearing cache to fetch fresh data...');
          localStorage.removeItem('niv_app_locations');
          // Reload to re-fetch
          window.location.reload();
      }
  }, []);

  // --- URL Admin Check ---
  useEffect(() => {
      const checkAdmin = () => {
          const isPathAdmin = window.location.pathname === '/admin';
          const isParamAdmin = new URLSearchParams(window.location.search).get('mode') === 'admin';
          if (isPathAdmin || isParamAdmin) {
              // If already logged in (via localStorage check in useState), fine.
              // If not, show login modal.
              if (!isAdminMode) {
                  setShowAdminLoginModal(true);
              }
          }
      };
      checkAdmin();
      window.addEventListener('popstate', checkAdmin);
      return () => window.removeEventListener('popstate', checkAdmin);
  }, [isAdminMode]);

  const handleLogoClick = () => {
      if (isAdminMode) {
          // If already in admin mode, exit via hard reload to clear URL
          localStorage.removeItem('niv_app_is_admin');
          window.location.href = '/'; 
      } else {
          // If not in admin mode, show password modal
          setAdminPasswordInput('');
          setShowAdminLoginModal(true);
      }
  };

  const handleAdminLoginSubmit = () => {
      // Logic changed: fallback is now 'admin' instead of '123456'
      const requiredPassword = appConfig.coachAdditionalPhone?.trim() || 'admin'; 
      if (adminPasswordInput === requiredPassword) {
          localStorage.setItem('niv_app_is_admin', 'true'); // Persist Login
          // FORCE RELOAD to apply red theme manifest in index.html
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
          // Always fetch from data service which handles switch between cloud/local
          const u = await dataService.getUsers();
          const s = await dataService.getSessions();
          
          setUsers(u); 
          setSessions(s);

          // Fetch Configs
          const locs = await dataService.getLocations();
          if (locs && locs.length > 0) setLocations(locs);

          const types = await dataService.getWorkoutTypes();
          if (types && types.length > 0) setWorkoutTypes(types);
          
          const config = await dataService.getAppConfig();
          setAppConfig(config);

          const quotes = await dataService.getQuotes();
          setCustomQuotes(quotes);

          // Quote Logic: Priority to Custom, Fallback to Gemini
          if (quotes && quotes.length > 0) {
              const randomQuote = quotes[Math.floor(Math.random() * quotes.length)].text;
              setQuote(randomQuote);
          } else {
               getMotivationQuote().then(setQuote);
          }
          
          // Update document title
          document.title = `${config.coachNameHeb} - אימוני כושר`;

      } catch (e) { 
          console.error(e); 
      } finally { 
          setIsLoadingData(false); 
      }
  }, []);

  useEffect(() => { refreshData(); }, [refreshData]);

  // Handle visibility change to refresh data when app comes to foreground
  useEffect(() => {
      const handleVisibilityChange = () => {
          if (document.visibilityState === 'visible') {
              console.log('App is visible, refreshing data...');
              refreshData();
          }
      };
      
      document.addEventListener('visibilitychange', handleVisibilityChange);
      return () => {
          document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
  }, [refreshData]);

  // Handlers for updating config
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
  useEffect(() => { getWeatherForDates(getCurrentWeekDates(0), weatherLocation.lat, weatherLocation.lon).then(setWeatherData); }, []);
  
  useEffect(() => {
    // Detect iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIos(iOS);
    
    // Check if running in standalone mode (installed)
    const isInStandaloneMode = ('standalone' in window.navigator) && (window.navigator as any).standalone;
    
    // Android PWA prompt
    const handler = (e: Event) => { e.preventDefault(); setDeferredPrompt(e); setShowInstallPrompt(true); };
    window.addEventListener('beforeinstallprompt', handler);

    // Show prompt for iOS if not installed
    if (iOS && !isInStandaloneMode) {
        setTimeout(() => {
             // Optional: Auto show on first visit? For now kept manual via button
        }, 1000);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = () => {
    if (deferredPrompt) { deferredPrompt.prompt(); setDeferredPrompt(null); setShowInstallPrompt(false); }
    else if (isIos) { setShowInstallPrompt(true); }
    else { setShowInstallPrompt(true); /* Show generic instructions for desktop/other */ }
  };

  const getMonthlyWorkoutsCount = (phone: string) => {
      const normalized = normalizePhone(phone);
      const now = new Date();
      return sessions.filter(s => {
          const d = new Date(s.date);
          const isRegistered = s.registeredPhoneNumbers?.includes(normalized);
          
          // Logic: If attendedPhoneNumbers exists (not null), check it. 
          // If it doesn't exist (null/undefined), assume registered = attended (auto V).
          const hasAttendedList = s.attendedPhoneNumbers !== undefined && s.attendedPhoneNumbers !== null;
          
          let didAttend = false;
          if (hasAttendedList) {
              didAttend = s.attendedPhoneNumbers!.includes(normalized);
          } else {
              didAttend = isRegistered || false;
          }

          return d.getMonth() === now.getMonth() && didAttend;
      }).length;
  };

  const calculateStreak = (phone: string) => {
      if (!sessions || sessions.length === 0) return 0;
      const normalized = normalizePhone(phone);
      
      const userSessions = sessions.filter(s => {
         const isRegistered = s.registeredPhoneNumbers?.includes(normalized);
         const hasAttendedList = s.attendedPhoneNumbers !== undefined && s.attendedPhoneNumbers !== null;
         
         if (hasAttendedList) {
             return s.attendedPhoneNumbers!.includes(normalized);
         } else {
             return isRegistered;
         }
      }).map(s => new Date(s.date));

      if (userSessions.length === 0) return 0;

      const weeks: Record<string, number> = {};
      userSessions.forEach(d => {
          const day = d.getDay();
          const diff = d.getDate() - day; 
          const startOfWeek = new Date(d);
          startOfWeek.setDate(diff);
          startOfWeek.setHours(0,0,0,0);
          const key = startOfWeek.toISOString().split('T')[0];
          weeks[key] = (weeks[key] || 0) + 1;
      });

      let currentStreak = 0;
      const today = new Date();
      const diff = today.getDate() - today.getDay();
      let checkDate = new Date(today.setDate(diff));
      checkDate.setHours(0,0,0,0);

      while(true) {
          const key = checkDate.toISOString().split('T')[0];
          const count = weeks[key] || 0;
          if (count >= 3) { 
              currentStreak++;
          } else {
              const isCurrentWeek = checkDate.getTime() >= new Date().setHours(0,0,0,0) - 7 * 24 * 60 * 60 * 1000;
              if (!isCurrentWeek) {
                  break; 
              }
          }
          checkDate.setDate(checkDate.getDate() - 7);
          if (checkDate.getFullYear() < 2023) break; 
      }
      return currentStreak;
  };

  const currentUser = users.find(u => normalizePhone(u.phone) === normalizePhone(currentUserPhone || ''));
  const streakCount = currentUser ? calculateStreak(currentUser.phone) : 0;
  const userStats = { 
      currentMonthCount: currentUser ? getMonthlyWorkoutsCount(currentUser.phone) : 0,
      monthlyRecord: currentUser?.monthlyRecord || 0
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
  const weekDates = getCurrentWeekDates(weekOffset);
  const groupedSessions = sessions.reduce((acc, s) => ({...acc, [s.date]: [...(acc[s.date]||[]), s]}), {} as Record<string, TrainingSession[]>);

  const handleRegisterClick = async (sid: string) => {
      if (!currentUserPhone) { setShowLoginModal(true); return; }
      
      const currentUserObj = users.find(u => normalizePhone(u.phone) === normalizePhone(currentUserPhone));
      if (currentUserObj && currentUserObj.isRestricted) {
          alert('🚫 המנוי שלך מוגבל כרגע ואינו יכול להירשם לאימונים.\nאנא פנה למאמן להסדרת הסטטוס.');
          return;
      }

      const session = sessions.find(s => s.id === sid);
      if (!session) return;
      const phone = normalizePhone(currentUserPhone);
      const isReg = session.registeredPhoneNumbers.includes(phone);
      if (!isReg && session.registeredPhoneNumbers.length >= session.maxCapacity) { alert('מלא'); return; }
      
      const updated = { ...session, registeredPhoneNumbers: isReg ? session.registeredPhoneNumbers.filter(p => p !== phone) : [...session.registeredPhoneNumbers, phone] };
      
      // OPTIMISTIC UPDATE
      setSessions(prev => prev.map(s => s.id === sid ? updated : s));
      
      // CRITICAL FIX: If the modal is open for this session, update it too!
      if (viewingSession && viewingSession.id === sid) {
          setViewingSession(updated);
      }

      try {
          await dataService.updateSession(updated);
      } catch (e) {
          alert('שגיאה בעדכון ההרשמה, נסה שנית');
          refreshData(); // Revert on error
      }
  };

  const handleAddToCalendar = () => {
      if (!viewingSession) return;
      downloadIcsFile(viewingSession, appConfig.coachNameHeb);
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

  const handleOpenProfile = () => {
      if (currentUser) {
          setEditProfileData({ 
              fullName: currentUser.fullName, 
              email: currentUser.email,
              displayName: currentUser.displayName || '',
              userColor: currentUser.userColor || '#A3E635',
              phone: currentUser.phone,
              healthFile: currentUser.healthDeclarationFile || ''
          });
          setShowProfileModal(true);
      }
  };

  const handleUpdateProfile = async () => {
      if (!currentUser) return;
      if (!editProfileData.fullName || !editProfileData.phone) return alert('שם וטלפון חובה');
      
      const newPhone = normalizePhone(editProfileData.phone);
      
      const updatedUser: User = { 
          ...currentUser, 
          fullName: editProfileData.fullName, 
          email: editProfileData.email,
          displayName: editProfileData.displayName,
          userColor: editProfileData.userColor,
          phone: newPhone,
          healthDeclarationFile: editProfileData.healthFile
      };
      
      try {
          await dataService.updateUser(updatedUser);
          setUsers(users.map(u => u.id === currentUser.id ? updatedUser : u));
          if (newPhone !== normalizePhone(currentUserPhone || '')) {
              localStorage.setItem('niv_app_current_phone', newPhone);
              setCurrentUserPhone(newPhone);
          }
          setShowProfileModal(false);
          alert('פרופיל עודכן!');
      } catch (error) {
          alert('שגיאה בעדכון, ייתכן שהטלפון כבר קיים במערכת');
      }
  };

  const handleHealthFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          if (file.size > 200 * 1024) { // 200KB limit
             alert('הקובץ גדול מדי (מקסימום 200KB). נסה לכווץ או לצלם מסך.');
             return;
          }

          const reader = new FileReader();
          reader.onload = (ev) => {
              if (ev.target?.result) {
                  setEditProfileData(prev => ({ ...prev, healthFile: ev.target!.result as string }));
              }
          };
          reader.readAsDataURL(file);
      }
  };
  
  const handleDigitalSign = async () => {
      if (!currentUser) return;
      if (!signId || signId.length < 8) { alert('נא להזין מספר ת"ז תקין'); return; }
      if (!signCheck) { alert('עליך לאשר את ההצהרה בתיבת הסימון'); return; }
      
      const now = new Date().toISOString();
      const updatedUser: User = {
          ...currentUser,
          healthDeclarationDate: now,
          healthDeclarationId: signId
      };
      
      try {
          await dataService.updateUser(updatedUser);
          setUsers(users.map(u => u.id === currentUser.id ? updatedUser : u));
          alert('הצהרת בריאות נחתמה בהצלחה! ✅');
          setShowLegalModal(false);
          setSignId('');
          setSignCheck(false);
      } catch (e) {
          alert('שגיאה בחתימה, נסה שנית');
      }
  };

  const openLegal = (tab: 'privacy' | 'terms' | 'health') => {
      setLegalTab(tab);
      if (tab === 'health' && currentUser) {
          setSignId(currentUser.healthDeclarationId || '');
      }
      setShowLegalModal(true);
  };

  const mainBackgroundClass = isAdminMode 
    ? 'min-h-screen pb-20 font-sans md:bg-[#330000] bg-brand-black transition-colors duration-500' 
    : 'min-h-screen bg-brand-black pb-20 font-sans transition-colors duration-500';

  return (
    <div className={mainBackgroundClass}>
      <header className="bg-brand-dark p-4 sticky top-0 z-20 border-b border-gray-800 flex justify-between items-center shadow-lg">
          <div onClick={handleLogoClick} className="cursor-pointer group select-none">
              <h1 className="text-2xl font-black text-white italic uppercase group-hover:opacity-80 transition-opacity">
                  {appConfig.coachNameEng.split(' ')[0]} <span className="text-brand-primary">{appConfig.coachNameEng.split(' ').slice(1).join(' ')}</span>
              </h1>
          </div>
          {currentUser && (
              <div className="text-right flex items-center gap-3">
                  <div>
                    <p className="text-white text-xs font-bold">היי <span style={{color: currentUser.userColor}}>{currentUser.displayName || currentUser.fullName}</span></p>
                    <div className="flex gap-2 justify-end">
                        <button onClick={handleOpenProfile} className="text-[10px] text-brand-primary hover:underline">ערוך פרופיל</button>
                        <span className="text-gray-600 text-[10px]">|</span>
                        <button onClick={()=>{setCurrentUserPhone(null); localStorage.removeItem('niv_app_current_phone');}} className="text-[10px] text-gray-500 hover:text-white">התנתק</button>
                    </div>
                  </div>
              </div>
          )}
      </header>

      <main className="max-w-4xl mx-auto p-4">
        {currentUser && (
            <div className={`mb-6 p-4 rounded-xl border relative ${currentUser.isRestricted ? 'bg-red-900/20 border-red-500/50' : 'bg-gray-900 border-gray-800'}`}>
                {currentUser.isRestricted && (
                    <div className="absolute top-2 left-2 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                        חשבון מוגבל
                    </div>
                )}
                <div className="flex justify-between items-start mb-2">
                     <div className="flex flex-col gap-1">
                         <div className="text-gray-400 text-xs">אימונים החודש</div>
                         <div className="text-3xl font-bold text-white">{userStats.currentMonthCount}</div>
                         <div className="text-xs text-gray-500">שיא אישי: <span className="text-brand-primary font-bold">{Math.max(userStats.monthlyRecord, userStats.currentMonthCount)}</span></div>
                     </div>
                     <div className="flex flex-col items-center" onClick={() => setShowStreakTooltip(!showStreakTooltip)}>
                        <div className="text-4xl mb-1 cursor-help filter drop-shadow-lg">🏆</div>
                        <div className="bg-brand-primary/20 text-brand-primary text-xs px-2 py-0.5 rounded-full font-bold">
                           רצפים: {streakCount}
                        </div>
                     </div>
                </div>
                {showStreakTooltip && (
                    <div className="absolute top-20 left-4 bg-gray-800 border border-gray-600 p-3 rounded shadow-xl text-xs z-10 max-w-[200px] animate-in fade-in">
                        <p className="text-white font-bold mb-1">איך שומרים על הרצף? 🔥</p>
                        <p className="text-gray-300">בצע לפחות 3 אימונים בשבוע כדי להגדיל את הסטרייק שלך ולקבל את הכתר!</p>
                        <button className="text-brand-primary mt-2 text-[10px] underline" onClick={()=>setShowStreakTooltip(false)}>סגור</button>
                    </div>
                )}
                
                {appConfig.urgentMessage && appConfig.urgentMessage.trim().length > 0 ? (
                    <div className="bg-red-600 border border-red-400 text-white font-black text-center p-3 rounded-lg shadow-lg mt-2 animate-pulse flex flex-col items-center justify-center">
                        <span className="text-xl">📢</span>
                        <span className="text-sm">{appConfig.urgentMessage}</span>
                    </div>
                ) : (
                    <div className="text-right text-gray-500 italic text-sm mt-2 border-t border-gray-800 pt-2">"{quote}"</div>
                )}
            </div>
        )}

        {isAdminMode ? (
             <AdminPanel 
                users={users} sessions={sessions} primaryColor={primaryColor} workoutTypes={workoutTypes}
                locations={locations} weatherLocation={weatherLocation} paymentLinks={paymentLinks} streakGoal={streakGoal}
                appConfig={appConfig}
                quotes={customQuotes}
                weatherData={weatherData} // Pass weather data to Admin
                onAddUser={async u => { await dataService.addUser(u); setUsers([...users, u]); }}
                onUpdateUser={async u => { await dataService.updateUser(u); setUsers(users.map(x=>x.id===u.id?u:x)); }}
                onDeleteUser={async id => { await dataService.deleteUser(id); setUsers(users.filter(x=>x.id!==id)); }}
                onAddSession={async s => { 
                    try {
                        await dataService.addSession(s); 
                        setSessions(prev => [...prev, s]); 
                    } catch(e) { throw e; }
                }}
                onUpdateSession={async s => { 
                    try {
                        await dataService.updateSession(s); 
                        setSessions(prev => prev.map(x=>x.id===s.id?s:x)); 
                    } catch(e) { throw e; }
                }}
                onDeleteSession={async id => { await dataService.deleteSession(id); setSessions(sessions.filter(x=>x.id!==id)); }}
                onColorChange={setPrimaryColor} 
                onUpdateWorkoutTypes={handleUpdateWorkoutTypes} 
                onUpdateLocations={handleUpdateLocations}
                onUpdateWeatherLocation={setWeatherLocation} onAddPaymentLink={l=>setPaymentLinks([...paymentLinks,l])}
                onDeletePaymentLink={id=>setPaymentLinks(paymentLinks.filter(l=>l.id!==id))} onUpdateStreakGoal={setStreakGoal}
                onUpdateAppConfig={handleUpdateAppConfig}
                onAddQuote={handleAddQuote}
                onDeleteQuote={handleDeleteQuote}
                onExitAdmin={() => { 
                    localStorage.removeItem('niv_app_is_admin');
                    window.location.href = '/'; 
                }}
            />
        ) : (
            <>
                <div className="flex justify-between items-center mb-6 bg-gray-800 rounded-full p-1 max-w-sm mx-auto shadow-md">
                    <button onClick={()=>setWeekOffset(p=>p-1)} className="px-4 py-1 text-white hover:bg-gray-700 rounded-full transition-colors">←</button>
                    <span className="text-brand-primary font-bold text-sm">{weekOffset===0?'השבוע':weekOffset===1?'שבוע הבא':`עוד ${weekOffset} שבועות`}</span>
                    <button onClick={()=>setWeekOffset(p=>p+1)} className="px-4 py-1 text-white hover:bg-gray-700 rounded-full transition-colors">→</button>
                </div>
                
                <div className="flex flex-col gap-6"> 
                    {weekDates.map(date => {
                        // Filter hidden sessions for trainees
                        const daySessions = (groupedSessions[date] || []).filter(s => !s.isHidden);
                        const isToday = new Date().toISOString().split('T')[0] === date;
                        return (
                            <div key={date} className={`rounded-xl border overflow-hidden flex flex-col md:flex-row shadow-lg ${isToday ? 'border-brand-primary bg-gray-800/50' : 'border-gray-800 bg-gray-900/40'}`}>
                                <div className={`p-3 md:w-24 flex justify-between items-center md:flex-col md:justify-center border-b md:border-b-0 md:border-l border-gray-700 ${isToday?'bg-brand-primary/10 text-brand-primary':'bg-gray-800 text-gray-400'}`}>
                                    <div className="flex items-baseline gap-2 md:flex-col md:gap-0 md:text-center">
                                        <span className="font-bold text-lg">{new Date(date).toLocaleDateString('he-IL',{weekday:'short'})}</span>
                                        <span className="text-sm">{new Date(date).getDate()}/{new Date(date).getMonth()+1}</span>
                                    </div>
                                    {weatherData[date] && <div className="text-xs font-mono bg-black/20 px-2 py-0.5 rounded">{Math.round(weatherData[date].maxTemp)}° {getWeatherIcon(weatherData[date].weatherCode)}</div>}
                                </div>
                                
                                <div className="flex-1 p-3">
                                    {daySessions.length>0 ? (
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                            {daySessions.sort((a,b)=>a.time.localeCompare(b.time)).map(s => (
                                                <div key={s.id} onClick={()=>setViewingSession(s)} className="h-full">
                                                    <SessionCard session={s} allUsers={users} isRegistered={!!currentUserPhone && s.registeredPhoneNumbers.includes(normalizePhone(currentUserPhone))} onRegisterClick={handleRegisterClick} onViewDetails={()=>setViewingSession(s)} weather={weatherData[s.date]} locations={locations}/>
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

      {/* Admin Login Modal */}
      {showAdminLoginModal && (
          <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-gray-800 p-6 rounded-xl w-full max-w-sm border border-gray-700 shadow-2xl">
                  <h3 className="text-white font-bold mb-4 text-xl text-center">כניסה לניהול 🔒</h3>
                  <p className="text-gray-400 text-sm mb-2 text-center">הכנס את סיסמת הניהול</p>
                  <input 
                    type="password" 
                    placeholder='הזן סיסמא (ברירת מחדל: admin)'
                    className="w-full p-4 bg-gray-900 text-white rounded-lg mb-4 text-center text-lg border border-gray-700 focus:border-brand-primary outline-none" 
                    value={adminPasswordInput} 
                    onChange={e=>setAdminPasswordInput(e.target.value)}
                  />
                  <div className="flex gap-2">
                      <Button onClick={handleAdminLoginSubmit} className="flex-1 py-3">כניסה</Button>
                      <Button onClick={()=>setShowAdminLoginModal(false)} variant="secondary" className="flex-1 py-3">ביטול</Button>
                  </div>
              </div>
          </div>
      )}

      {/* ... (Viewing Session, Login, Profile Modals - Unchanged) ... */}
      {viewingSession && (
          <div className="fixed inset-0 bg-black/90 z-50 flex items-end md:items-center justify-center backdrop-blur-sm" onClick={()=>setViewingSession(null)}>
              <div className="bg-gray-800 w-full md:max-w-md rounded-t-2xl md:rounded-2xl border-t border-brand-primary shadow-2xl animate-in slide-in-from-bottom duration-300 max-h-[90vh] flex flex-col" onClick={e=>e.stopPropagation()}>
                  <div className="p-6 bg-gradient-to-b from-gray-700/50 to-gray-800 border-b border-gray-700 relative overflow-hidden">
                      <div className="relative z-10 flex justify-between items-start mb-2">
                           <div>
                               <h2 className="text-3xl text-white font-black leading-none mb-1">{viewingSession.type}</h2>
                               <div className="flex items-center gap-2 mt-2">
                                   <div className="text-brand-primary font-mono font-bold text-lg bg-brand-primary/10 px-2 py-1 rounded">{viewingSession.time}</div>
                                   <div className="text-gray-400 text-sm border border-gray-600 px-2 py-1 rounded">
                                       {new Date(viewingSession.date).toLocaleDateString('he-IL', { weekday: 'long' })}, {viewingSession.date}
                                   </div>
                               </div>
                           </div>
                           {weatherData[viewingSession.date] && (
                               <div className="flex flex-col items-center bg-gray-900/50 p-2 rounded-lg border border-gray-600/50 shadow-sm">
                                   <span className="text-2xl">{getWeatherIcon(weatherData[viewingSession.date].weatherCode)}</span>
                                   <span className="text-white font-bold text-sm">{Math.round(weatherData[viewingSession.date].maxTemp)}°</span>
                               </div>
                           )}
                      </div>
                      <div className="relative z-10 flex justify-between items-center text-gray-300 text-sm mb-3">
                        <div className="flex items-center gap-1.5">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>
                            <span>{viewingSession.location}</span>
                        </div>
                        <a href={`https://waze.com/ul?q=${encodeURIComponent(viewingSession.location)}&navigate=yes`} target="_blank" rel="noopener noreferrer" className="bg-gray-700 hover:bg-gray-600 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1 transition-colors border border-gray-600"><span>נווט</span><span>🚗</span></a>
                      </div>
                      <p className="relative z-10 text-gray-300 text-sm leading-relaxed bg-black/20 p-3 rounded-lg border border-white/5">{viewingSession.description || 'ללא תיאור'}</p>
                      <div className="relative z-10 mt-3 flex"><Button onClick={handleAddToCalendar} size="sm" variant="secondary" className="w-full text-xs gap-2">📅 הוסף ליומן (קובץ) {appConfig.coachNameHeb}</Button></div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 bg-gray-800">
                      <div className="flex justify-between items-center mb-3">
                          <div className="text-sm font-bold text-white">רשימת משתתפים</div>
                          <div className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">{viewingSession.registeredPhoneNumbers.length} / {viewingSession.maxCapacity}</div>
                      </div>
                      {viewingSession.registeredPhoneNumbers.length > 0 ? (
                          <div className="grid grid-cols-2 gap-2">
                              {viewingSession.registeredPhoneNumbers.map((p,i) => {
                                  const u = users.find(user => normalizePhone(user.phone) === p);
                                  const displayName = u?.displayName || u?.fullName || 'אורח';
                                  const color = u?.userColor || '#A3E635';
                                  
                                  return (
                                    <div key={i} className="bg-gray-700/50 text-gray-200 text-xs px-3 py-2 rounded flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full shadow-sm" style={{ backgroundColor: color }}></div>
                                        <span style={{ color: color }} className="font-bold">{displayName}</span>
                                    </div>
                                  );
                              })}
                          </div>
                      ) : <div className="text-center text-gray-600 text-sm py-8">טרם נרשמו מתאמנים</div>}
                  </div>
                  <div className="p-4 border-t border-gray-700 bg-gray-900/50">
                      <Button onClick={()=>handleRegisterClick(viewingSession.id)} className="w-full py-3 text-lg font-bold shadow-xl">
                          {currentUserPhone && viewingSession.registeredPhoneNumbers.includes(normalizePhone(currentUserPhone)) ? 'בטל הרשמה ✕' : 'הירשם לאימון +'}
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
                  {(!users.find(u => normalizePhone(u.phone) === normalizePhone(loginPhone)) && loginPhone.length >= 9) && (
                      <input type="text" placeholder="שם מלא (לנרשמים חדשים)" className="w-full p-4 bg-gray-900 text-white rounded-lg mb-4 border border-gray-700 focus:border-brand-primary outline-none" value={newUserName} onChange={e=>setNewUserName(e.target.value)}/>
                  )}
                  <div className="flex gap-2">
                      <Button onClick={handleLogin} className="flex-1 py-3">אישור</Button>
                      <Button onClick={()=>setShowLoginModal(false)} variant="secondary" className="flex-1 py-3">ביטול</Button>
                  </div>
              </div>
          </div>
      )}

      {showProfileModal && (
           <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-gray-800 p-6 rounded-xl w-full max-w-sm border border-gray-700 shadow-2xl overflow-y-auto max-h-[90vh]">
                  <h3 className="text-white font-bold mb-4 text-xl">עריכת פרופיל</h3>
                  <div className="space-y-4 mb-6">
                      <div><label className="text-xs text-gray-400 mb-1 block">שם מלא</label><input type="text" className="w-full p-3 bg-gray-900 text-white rounded-lg border border-gray-700 focus:border-brand-primary outline-none" value={editProfileData.fullName} onChange={e=>setEditProfileData({...editProfileData, fullName: e.target.value})}/></div>
                      <div><label className="text-xs text-gray-400 mb-1 block">טלפון</label><input type="tel" className="w-full p-3 bg-gray-900 text-white rounded-lg border border-gray-700 focus:border-brand-primary outline-none" value={editProfileData.phone} onChange={e=>setEditProfileData({...editProfileData, phone: e.target.value})}/></div>
                      <div><label className="text-xs text-gray-400 mb-1 block">כינוי באפליקציה</label><input type="text" className="w-full p-3 bg-gray-900 text-white rounded-lg border border-gray-700 focus:border-brand-primary outline-none" value={editProfileData.displayName} onChange={e=>setEditProfileData({...editProfileData, displayName: e.target.value})}/></div>
                      <div><label className="text-xs text-gray-400 mb-1 block">אימייל</label><input type="email" className="w-full p-3 bg-gray-900 text-white rounded-lg border border-gray-700 focus:border-brand-primary outline-none" value={editProfileData.email} onChange={e=>setEditProfileData({...editProfileData, email: e.target.value})}/></div>
                      <div>
                          <label className="text-xs text-gray-400 mb-1 flex justify-between items-center">
                              <span>הצהרת בריאות</span>
                              <button onClick={() => openLegal('health')} className="text-brand-primary underline text-[10px]">חתום על הצהרה</button>
                          </label>
                          <div className={`flex items-center gap-2 p-3 rounded border ${currentUser?.healthDeclarationDate ? 'bg-green-900/20 border-green-500/50' : 'bg-gray-900 border-gray-700'}`}>
                              {currentUser?.healthDeclarationDate ? (
                                  <div className="flex flex-col">
                                      <span className="text-green-500 font-bold text-sm">✓ נחתם דיגיטלית</span>
                                      <span className="text-[10px] text-gray-400">בתאריך: {new Date(currentUser.healthDeclarationDate).toLocaleDateString('he-IL')}</span>
                                  </div>
                              ) : (
                                  <div className="text-sm text-gray-400">טרם נחתם</div>
                              )}
                          </div>
                      </div>
                      <div><label className="text-xs text-gray-400 mb-1 block">צבע משתמש</label><div className="flex items-center gap-2"><input type="color" className="w-12 h-12 rounded cursor-pointer bg-transparent border-none" value={editProfileData.userColor} onChange={e=>setEditProfileData({...editProfileData, userColor: e.target.value})}/><span className="text-gray-400 text-sm">{editProfileData.userColor}</span></div></div>
                  </div>
                  <div className="flex gap-2">
                      <Button onClick={handleUpdateProfile} className="flex-1 py-3">שמור</Button>
                      <Button onClick={()=>setShowProfileModal(false)} variant="secondary" className="flex-1 py-3">ביטול</Button>
                  </div>
              </div>
          </div>
      )}
      
      {showLegalModal && (
          <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-gray-800 p-6 rounded-xl w-full max-w-lg border border-gray-700 shadow-2xl h-[80vh] flex flex-col">
                  <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-2">
                      <h3 className="text-white font-bold text-xl">מידע משפטי</h3>
                      <button onClick={()=>setShowLegalModal(false)} className="text-gray-400 hover:text-white">✕</button>
                  </div>
                  <div className="flex gap-2 mb-4">
                      <button onClick={()=>setLegalTab('privacy')} className={`px-3 py-1 rounded text-sm ${legalTab==='privacy'?'bg-brand-primary text-black':'bg-gray-700 text-gray-300'}`}>פרטיות</button>
                      <button onClick={()=>setLegalTab('terms')} className={`px-3 py-1 rounded text-sm ${legalTab==='terms'?'bg-brand-primary text-black':'bg-gray-700 text-gray-300'}`}>תנאי שימוש</button>
                      <button onClick={()=>setLegalTab('health')} className={`px-3 py-1 rounded text-sm ${legalTab==='health'?'bg-brand-primary text-black':'bg-gray-700 text-gray-300'}`}>הצהרת בריאות</button>
                  </div>
                  <div className="flex-1 overflow-y-auto bg-gray-900/50 rounded border border-gray-700/50 p-3">
                      <div className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed mb-6">
                          {LEGAL_TEXTS[legalTab]}
                      </div>
                      
                      {/* Health Declaration Form */}
                      {legalTab === 'health' && currentUser && (
                          <div className="border-t border-gray-700 pt-4 mt-4">
                              <h4 className="text-white font-bold mb-3">חתימה ואישור</h4>
                              
                              <div className="space-y-3 mb-4">
                                  <div>
                                      <label className="text-xs text-gray-500 block">שם מלא (מהפרופיל)</label>
                                      <div className="text-gray-300 bg-gray-800 p-2 rounded text-sm border border-gray-700">{currentUser.fullName}</div>
                                  </div>
                                  <div>
                                      <label className="text-xs text-gray-500 block">טלפון (מהפרופיל)</label>
                                      <div className="text-gray-300 bg-gray-800 p-2 rounded text-sm border border-gray-700">{currentUser.phone}</div>
                                  </div>
                                  <div>
                                      <label className="text-xs text-gray-500 block mb-1">מספר תעודת זהות</label>
                                      <input 
                                          type="tel" 
                                          className="w-full bg-gray-800 text-white p-2 rounded border border-gray-600 focus:border-brand-primary outline-none"
                                          placeholder="הזן ת.ז"
                                          value={signId}
                                          onChange={e => setSignId(e.target.value)}
                                          disabled={!!currentUser.healthDeclarationDate} // Disable if already signed? Optional. Currently editable.
                                      />
                                  </div>
                              </div>
                              
                              {currentUser.healthDeclarationDate ? (
                                   <div className="bg-green-900/30 border border-green-500 p-3 rounded text-center mb-4">
                                       <div className="text-green-400 font-bold mb-1">✓ המסמך נחתם</div>
                                       <div className="text-xs text-gray-400">בתאריך: {new Date(currentUser.healthDeclarationDate).toLocaleString('he-IL')}</div>
                                       <div className="text-xs text-gray-400">ת.ז: {currentUser.healthDeclarationId}</div>
                                       <button onClick={() => { setSignCheck(false); }} className="text-[10px] text-gray-500 underline mt-2">ערוך חתימה מחדש</button>
                                   </div>
                              ) : null}

                              {(!currentUser.healthDeclarationDate || !signCheck && currentUser.healthDeclarationDate) && (
                                  <>
                                      <label className="flex items-start gap-2 mb-4 cursor-pointer">
                                          <input type="checkbox" className="mt-1 w-4 h-4 accent-brand-primary" checked={signCheck} onChange={e => setSignCheck(e.target.checked)}/>
                                          <span className="text-xs text-gray-400">אני מאשר/ת שקראתי את הצהרת הבריאות, שהפרטים שמסרתי נכונים ושאיני סובל/ת ממגבלות רפואיות המונעות ממני להתאמן.</span>
                                      </label>
                                      <Button onClick={handleDigitalSign} disabled={!signCheck || !signId} className="w-full">אשר וחתום דיגיטלית ✍️</Button>
                                  </>
                              )}
                          </div>
                      )}
                  </div>
                  <div className="mt-4">
                      <Button onClick={()=>setShowLegalModal(false)} variant="secondary" className="w-full">סגור</Button>
                  </div>
              </div>
          </div>
      )}

      {showInstallPrompt && <InstallPrompt onClose={()=>setShowInstallPrompt(false)} onInstall={handleInstallClick} canInstall={!!deferredPrompt} isIos={isIos}/>}
      
      <footer className="fixed bottom-0 w-full bg-black/90 p-3 flex flex-col items-center border-t border-gray-800 z-50 backdrop-blur-md">
          <div className="w-full flex justify-between items-center mb-1">
            <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isCloudConnected?'bg-green-500':'bg-red-500 animate-pulse'}`}/>
                <span className="text-xs text-gray-500">{isCloudConnected?'מחובר':'מקומי'}</span>
            </div>
            <div className="flex items-center gap-3">
                <a href={`https://wa.me/${normalizePhoneForWhatsapp(appConfig.coachPhone)}`} target="_blank" rel="noreferrer" className="bg-[#25D366] hover:bg-[#20bd5a] text-white px-3 py-1.5 rounded-full flex items-center gap-2 transition-all shadow-lg" title="צור קשר בוואטסאפ">
                    <WhatsAppIcon />
                    <span className="font-bold text-xs">שלח הודעה</span>
                </a>
                <button onClick={handleInstallClick} className="text-brand-primary hover:text-white p-2 text-xl" title="התקן אפליקציה">📲</button>
            </div>
          </div>
          <div className="text-[10px] text-center text-gray-500 w-full border-t border-gray-800/50 pt-2 flex justify-center gap-4">
               <span>© {new Date().getFullYear()} כל הזכויות שמורות</span>
               <span className="text-gray-600">|</span>
               <button onClick={() => openLegal('privacy')} className="hover:text-brand-primary underline">מדיניות פרטיות</button>
               <span className="text-gray-600">|</span>
               <button onClick={() => openLegal('terms')} className="hover:text-brand-primary underline">תנאי שימוש</button>
          </div>
      </footer>
    </div>
  );
};

export default App;