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

// Helper: Normalize Phone Numbers (Remove dashes, spaces, +972, etc.)
const normalizePhone = (phone: string): string => {
    if (!phone) return '';
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('972')) {
        cleaned = '0' + cleaned.substring(3);
    }
    return cleaned;
};

// Safe LocalStorage Parser
function safeJsonParse<T>(key: string, fallback: T): T {
    try {
        const item = localStorage.getItem(key);
        if (!item) return fallback;
        const parsed = JSON.parse(item);
        if (parsed === null || parsed === undefined) return fallback;
        return parsed;
    } catch (error) {
        console.error(`Error parsing localStorage key "${key}":`, error);
        return fallback;
    }
}

// Install Prompt Component
const InstallPrompt: React.FC<{ onClose: () => void, onInstall: () => void, canInstall: boolean }> = ({ onClose, onInstall, canInstall }) => {
    return (
        <div className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-brand-primary p-4 z-50 md:hidden animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-start mb-2">
                <h3 className="text-white font-bold text-lg">שמור כאפליקציה!</h3>
                <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
            </div>
            <p className="text-gray-300 text-sm mb-3">
                לגישה מהירה ללו"ז האימונים, הוסף את האפליקציה למסך הבית שלך.
            </p>
            
            {canInstall ? (
                <Button onClick={onInstall} className="w-full py-2 mb-2">
                    התקן אפליקציה 📲
                </Button>
            ) : (
                <div className="flex items-center gap-2 text-sm text-brand-primary font-bold bg-gray-900/50 p-2 rounded">
                    <span>לחץ על</span>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    <span>ובחר "הוסף למסך הבית"</span>
                    <span className="text-xl leading-none">+</span>
                </div>
            )}
        </div>
    );
};

// Floating Action Button for Install
const FloatingInstallButton: React.FC<{ onClick: () => void }> = ({ onClick }) => {
    return (
        <button 
            onClick={onClick}
            className="fixed bottom-20 left-4 z-40 bg-brand-primary text-brand-black p-3 rounded-full shadow-2xl border-2 border-white md:hidden hover:scale-110 transition-transform"
            title="התקן אפליקציה"
        >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
        </button>
    );
};

// WhatsApp Floating Button
const WhatsAppButton: React.FC = () => {
    return (
        <a 
            href={`https://wa.me/${COACH_PHONE_NUMBER}`}
            target="_blank"
            rel="noopener noreferrer"
            className="fixed bottom-20 right-4 z-40 bg-[#25D366] text-white p-3 rounded-full shadow-2xl border-2 border-white hover:scale-110 transition-transform"
            title="צור קשר בוואטסאפ"
        >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
            </svg>
        </a>
    );
};

const USER_COLORS = [
    '#ffffff', // Default White
    '#EF4444', // Red
    '#F59E0B', // Amber
    '#10B981', // Emerald
    '#3B82F6', // Blue
    '#8B5CF6', // Violet
    '#EC4899', // Pink
    '#A3E635'  // Brand Lime
];

const App: React.FC = () => {
  // State from Data Service (Supabase or LocalStorage)
  const [users, setUsers] = useState<User[]>([]);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isCloudConnected, setIsCloudConnected] = useState(false);

  // Dynamic Lists State
  const [workoutTypes, setWorkoutTypes] = useState<string[]>(() => {
      const defaultTypes = Object.values(WorkoutType);
      return safeJsonParse<string[]>('niv_app_types', defaultTypes);
  });

  const [locations, setLocations] = useState<LocationDef[]>(() => {
      const stored = localStorage.getItem('niv_app_locations');
      if (stored) {
          try {
              const parsed = JSON.parse(stored);
              if (Array.isArray(parsed)) {
                   if (parsed.length > 0 && typeof parsed[0] === 'string') {
                       return parsed.map(locName => ({ id: locName, name: locName, address: locName }));
                   }
                   return parsed as LocationDef[];
              }
          } catch(e) { console.error('Migration error', e); }
      }
      return [
        { id: '1', name: 'פארק הירקון, תל אביב', address: 'שדרות רוקח, תל אביב יפו' },
        { id: '2', name: 'סטודיו פיטנס, רמת גן', address: 'ביאליק 10, רמת גן' },
        { id: '3', name: 'חוף הים, הרצליה', address: 'חוף אכדיה, הרצליה' },
        { id: '4', name: 'גן המייסדים, נס ציונה', address: 'ויצמן 1, נס ציונה' }
      ];
  });

  // Payment Links State
  const [paymentLinks, setPaymentLinks] = useState<PaymentLink[]>(() => safeJsonParse<PaymentLink[]>('niv_app_payments', []));

  // Weather Settings
  const [weatherLocation, setWeatherLocation] = useState<WeatherLocation>(() => {
      return safeJsonParse<WeatherLocation>('niv_app_weather_loc', { name: 'נס ציונה', lat: 31.93, lon: 34.80 });
  });

  const [currentUserPhone, setCurrentUserPhone] = useState<string | null>(() => {
      return localStorage.getItem('niv_app_current_phone');
  });

  const [primaryColor, setPrimaryColor] = useState<string>(() => {
      return localStorage.getItem('niv_app_color') || '#A3E635';
  });

  const [weekOffset, setWeekOffset] = useState(0); 

  const [isAdminMode, setIsAdminMode] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false); 
  const [showPaymentsModal, setShowPaymentsModal] = useState(false); 
  const [showInstallPrompt, setShowInstallPrompt] = useState(false); 
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null); 

  // Registration Form State
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');

  const [loginSearch, setLoginSearch] = useState('');
  const [targetSessionId, setTargetSessionId] = useState<string | null>(null); 
  const [quote, setQuote] = useState<string>('טוען משפט מוטיבציה...');
  const [viewingSession, setViewingSession] = useState<TrainingSession | null>(null);
  const [weatherData, setWeatherData] = useState<Record<string, { maxTemp: number; weatherCode: number }>>({});
  
  // Profile Edit State
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editUserColor, setEditUserColor] = useState('');

  const refreshData = useCallback(async () => {
      setIsLoadingData(true);
      
      // Check cloud connection
      const hasCloud = !!supabase;
      setIsCloudConnected(hasCloud);
      if (!hasCloud) {
          console.warn("App running in local mode (LocalStorage).");
      }

      try {
          const loadedUsers = await dataService.getUsers();
          const loadedSessions = await dataService.getSessions();
          setUsers(loadedUsers);
          setSessions(loadedSessions);
      } catch (error) {
          console.error("Failed to load data", error);
      } finally {
          setIsLoadingData(false);
      }
  }, []);

  // Initial Data Load & Visibility Listener
  useEffect(() => {
    refreshData();
    
    // Auto-refresh when app comes to foreground (fixes mobile sync issues)
    const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
            refreshData();
        }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [refreshData]);

  // PWA Install Event Listener
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = () => {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult: any) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('User accepted the install prompt');
            }
            setDeferredPrompt(null);
            setShowInstallPrompt(false);
        });
    } else {
        alert('כדי להתקין: לחץ על כפתור השיתוף בדפדפן ובחר "הוסף למסך הבית"');
    }
  };

  // Statistics Calculation Helpers
  const getMonthlyWorkoutsCount = (userPhone: string) => {
    if (!Array.isArray(sessions)) return 0;

    const normalizedUserPhone = normalizePhone(userPhone);
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return sessions.filter(session => {
        if (!session || !session.date) return false;
        const sessionDate = new Date(session.date);
        return (
            sessionDate.getMonth() === currentMonth &&
            sessionDate.getFullYear() === currentYear &&
            session.registeredPhoneNumbers && 
            session.registeredPhoneNumbers.some(p => normalizePhone(p) === normalizedUserPhone)
        );
    }).length;
  };

  const getChampionOfTheMonth = () => {
      if (!Array.isArray(users)) return null;

      let maxWorkouts = 0;
      let champion: User | null = null;

      users.forEach(user => {
          const count = getMonthlyWorkoutsCount(user.phone);
          if (count > maxWorkouts) {
              maxWorkouts = count;
              champion = user;
          }
      });

      return maxWorkouts > 0 ? { user: champion, count: maxWorkouts } : null;
  };

  const championData = getChampionOfTheMonth();
  const currentUserMonthlyCount = currentUserPhone ? getMonthlyWorkoutsCount(currentUserPhone) : 0;
  // Find current user with normalized phone check
  const currentUser = Array.isArray(users) ? users.find(u => normalizePhone(u.phone) === normalizePhone(currentUserPhone || '')) : undefined;
  
  const pendingUsersCount = users.filter(u => u.paymentStatus === PaymentStatus.PENDING).length;

  const getCurrentWeekDates = (offset: number) => {
    const curr = new Date();
    const day = curr.getDay();
    const diff = curr.getDate() - day + (offset * 7);
    const days = [];
    const startOfWeek = new Date(curr.setDate(diff));
    
    for (let i = 0; i < 7; i++) {
        const next = new Date(startOfWeek.getTime());
        next.setDate(startOfWeek.getDate() + i);
        days.push(next.toISOString().split('T')[0]);
    }
    return days;
  };

  const weekDates = getCurrentWeekDates(weekOffset);

  // Persistence Effects for local settings
  useEffect(() => {
    localStorage.setItem('niv_app_types', JSON.stringify(workoutTypes));
  }, [workoutTypes]);

  useEffect(() => {
    localStorage.setItem('niv_app_locations', JSON.stringify(locations));
  }, [locations]);
  
  useEffect(() => {
    localStorage.setItem('niv_app_payments', JSON.stringify(paymentLinks));
  }, [paymentLinks]);

  useEffect(() => {
    localStorage.setItem('niv_app_weather_loc', JSON.stringify(weatherLocation));
    getWeatherForDates(weekDates, weatherLocation.lat, weatherLocation.lon).then(setWeatherData);
  }, [weatherLocation]);
  
  useEffect(() => {
      getWeatherForDates(weekDates, weatherLocation.lat, weatherLocation.lon).then(setWeatherData);
  }, [weekOffset]);

  useEffect(() => {
      if (currentUserPhone) {
          localStorage.setItem('niv_app_current_phone', currentUserPhone);
      } else {
          localStorage.removeItem('niv_app_current_phone');
      }
  }, [currentUserPhone]);

  useEffect(() => {
      localStorage.setItem('niv_app_color', primaryColor);
      document.documentElement.style.setProperty('--brand-primary', primaryColor);
  }, [primaryColor]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('register') === 'true') {
        setIsRegisterMode(true);
    }
    getMotivationQuote().then(setQuote);
    getWeatherForDates(weekDates, weatherLocation.lat, weatherLocation.lon).then(setWeatherData);
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    if (isMobile && !isStandalone) {
        setTimeout(() => setShowInstallPrompt(true), 3000);
    }
  }, []); 

  // Handlers using dataService
  const handleRegisterClick = async (sessionId: string) => {
    if (!currentUserPhone) {
      setTargetSessionId(sessionId);
      setShowLoginModal(true);
      return;
    }
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;
    
    // Normalize logic
    const normalizedCurrent = normalizePhone(currentUserPhone);
    const isAlreadyRegistered = session.registeredPhoneNumbers.some(p => normalizePhone(p) === normalizedCurrent);

    if (!isAlreadyRegistered) {
        // Validation for new registration only
        if (currentUser?.isNew && !session.isTrial) {
            alert('מתאמנים חדשים יכולים להירשם לאימוני ניסיון בלבד.');
            return;
        }
        if (currentUser?.paymentStatus === PaymentStatus.OVERDUE) {
             alert('לא ניתן להירשם לאימון עקב חוב פתוח. אנא הסדר תשלום מול המאמן.');
             return;
        }
        if (session.registeredPhoneNumbers.length >= session.maxCapacity) {
            alert('האימון מלא!');
            return;
        }
    }

    let updatedSession: TrainingSession;
    if (isAlreadyRegistered) {
        updatedSession = { 
            ...session, 
            registeredPhoneNumbers: session.registeredPhoneNumbers.filter(p => normalizePhone(p) !== normalizedCurrent) 
        };
    } else {
        // Save using the normalized phone number for consistency
        updatedSession = { 
            ...session, 
            registeredPhoneNumbers: [...session.registeredPhoneNumbers, normalizedCurrent] 
        };
    }
    
    // Update Optimistically
    setSessions(prev => prev.map(s => s.id === sessionId ? updatedSession : s));
    if (viewingSession && viewingSession.id === sessionId) {
        setViewingSession(updatedSession);
    }
    
    // Persist
    await dataService.updateSession(updatedSession);
  };

  const handleUserSelect = async (user: User) => {
      const normalizedPhone = normalizePhone(user.phone);
      setCurrentUserPhone(normalizedPhone);
      setShowLoginModal(false);
      setLoginSearch('');
      
      // Auto-register if came from a click
      if (targetSessionId) {
        const session = sessions.find(s => s.id === targetSessionId);
        if (session) {
             if (user.isNew && !session.isTrial) {
                 alert('נרשמת בהצלחה למערכת! שים לב: כמתאמן חדש, באפשרותך להירשם רק לאימוני ניסיון.');
                 setTargetSessionId(null);
                 return;
             }
             if (user.paymentStatus === PaymentStatus.OVERDUE) {
                 alert('התחברת בהצלחה, אך לא ניתן להירשם לאימון עקב חוב.');
                 setTargetSessionId(null);
                 return;
             }
             
             const isRegistered = session.registeredPhoneNumbers.some(p => normalizePhone(p) === normalizedPhone);
             
             if (!isRegistered && session.registeredPhoneNumbers.length < session.maxCapacity) {
                 const updatedSession = { ...session, registeredPhoneNumbers: [...session.registeredPhoneNumbers, normalizedPhone] };
                 setSessions(prev => prev.map(s => s.id === targetSessionId ? updatedSession : s));
                 await dataService.updateSession(updatedSession);
             }
        }
        setTargetSessionId(null);
      }
  };

  const handleRegistrationSubmit = async () => {
      if (!regName.trim() || !regPhone.trim()) {
          alert('נא למלא שם וטלפון');
          return;
      }
      const normalizedReg = normalizePhone(regPhone.trim());
      const existing = users.find(u => normalizePhone(u.phone) === normalizedReg);
      if (existing) {
          alert('מספר הטלפון כבר קיים במערכת');
          return;
      }
      const newUser: User = {
          id: Date.now().toString(),
          fullName: regName.trim(),
          displayName: regName.trim(),
          phone: normalizedReg,
          email: regEmail.trim(),
          startDate: new Date().toISOString().split('T')[0],
          paymentStatus: PaymentStatus.PAID,
          isNew: true
      };
      setUsers(prev => [...prev, newUser]);
      await dataService.addUser(newUser);
      
      alert('פרטייך נשלחו בהצלחה למאמן לאישור! תוכל להתחבר כעת.');
      setIsRegisterMode(false);
      setRegName('');
      setRegPhone('');
      setRegEmail('');
      handleUserSelect(newUser); // Auto login after register
  };

  // CRUD Wrappers (same as before)
  const handleAddUser = async (u: User) => {
      const uNormalized = { ...u, phone: normalizePhone(u.phone) };
      setUsers(prev => [...prev, uNormalized]);
      await dataService.addUser(uNormalized);
  }

  const handleUpdateUser = async (updatedUser: User) => {
    const uNormalized = { ...updatedUser, phone: normalizePhone(updatedUser.phone) };
    setUsers(prevUsers => prevUsers.map(u => u.id === uNormalized.id ? uNormalized : u));
    await dataService.updateUser(uNormalized);
  };
  
  const handleDeleteUser = async (userId: string) => {
      setUsers(prevUsers => prevUsers.filter(u => u.id !== userId));
      await dataService.deleteUser(userId);
      
      // Update sessions to remove user
      const user = users.find(u => u.id === userId);
      if (user) {
          const userPhoneNorm = normalizePhone(user.phone);
          const sessionsToUpdate = sessions.filter(s => s.registeredPhoneNumbers.some(p => normalizePhone(p) === userPhoneNorm));
          for (const session of sessionsToUpdate) {
              const updatedSession = { 
                  ...session, 
                  registeredPhoneNumbers: session.registeredPhoneNumbers.filter(p => normalizePhone(p) !== userPhoneNorm) 
              };
              setSessions(prev => prev.map(s => s.id === session.id ? updatedSession : s));
              await dataService.updateSession(updatedSession);
          }
      }
  };

  const handleAddSession = async (s: TrainingSession) => {
      setSessions(prev => [...prev, s]);
      await dataService.addSession(s);
  }
  
  const handleUpdateSession = async (updatedSession: TrainingSession) => {
      setSessions(prevSessions => prevSessions.map(s => s.id === updatedSession.id ? updatedSession : s));
      await dataService.updateSession(updatedSession);
  };

  const handleDeleteSession = async (id: string) => {
      setSessions(prev => prev.filter(s => s.id !== id));
      await dataService.deleteSession(id);
  }

  const handleLogout = () => {
      if(confirm('האם אתה בטוח שברצונך להתנתק?')) {
        setCurrentUserPhone(null);
      }
  };

  const handleProfileUpdate = () => {
    if (currentUser) {
        handleUpdateUser({
            ...currentUser,
            displayName: editDisplayName.trim() || currentUser.fullName,
            userColor: editUserColor
        });
        setShowProfileModal(false);
    }
  };

  const openProfileModal = () => {
      if (currentUser) {
          setEditDisplayName(currentUser.displayName || currentUser.fullName);
          setEditUserColor(currentUser.userColor || '');
          setShowProfileModal(true);
      }
  };
  
  const handlePaymentClick = (link: PaymentLink) => {
      if (!currentUserPhone) return;
      const cleanPhone = currentUserPhone.startsWith('0') 
        ? '972' + currentUserPhone.substring(1) 
        : currentUserPhone;
      const message = `היי, הנה הלינק לתשלום עבור ${link.title}: ${link.url}`;
      const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');
  };
  
  const handleReportPayment = () => {
      if (!currentUser) return;
      if (confirm('האם אתה בטוח שביצעת את התשלום? הסטטוס שלך יעודכן ל"ממתין לאישור" והמאמן יקבל התראה.')) {
          handleUpdateUser({
              ...currentUser,
              paymentStatus: PaymentStatus.PENDING
          });
          alert('הדיווח נשלח למאמן בהצלחה!');
      }
  };

  const handleViewDetails = (sessionId: string) => {
      const session = sessions.find(s => s.id === sessionId);
      if (session) setViewingSession(session);
  };

  const handleWazeClick = () => {
      if (!viewingSession) return;
      const locationDef = locations.find(l => l.name === viewingSession.location);
      const query = locationDef ? locationDef.address : viewingSession.location;
      const wazeUrl = `https://waze.com/ul?q=${encodeURIComponent(query)}&navigate=yes`;
      window.open(wazeUrl, '_blank');
  };

  const handleZoomClick = () => {
      if (viewingSession?.zoomLink) {
          window.open(viewingSession.zoomLink, '_blank');
      }
  };
  
  const handleAdminExit = () => {
      refreshData();
      setIsAdminMode(false);
  };

  const getSessionAttendees = (session: TrainingSession) => {
      return session.registeredPhoneNumbers.map(phone => {
          const phoneNorm = normalizePhone(phone);
          const u = users.find(user => normalizePhone(user.phone) === phoneNorm);
          return u ? { name: u.displayName || u.fullName, color: u.userColor } : { name: `אורח (${phone})`, color: undefined };
      });
  };

  const safeSessions = Array.isArray(sessions) ? sessions : [];
  const groupedSessions = safeSessions.reduce((acc, session) => {
      const date = session.date;
      if (!acc[date]) acc[date] = [];
      acc[date].push(session);
      return acc;
  }, {} as Record<string, TrainingSession[]>);

  const modalColor = viewingSession?.color || primaryColor;

  const filteredLoginUsers = users.filter(u => 
      u.fullName.includes(loginSearch) || 
      (u.displayName && u.displayName.includes(loginSearch)) ||
      u.phone.includes(loginSearch)
  ).sort((a,b) => a.fullName.localeCompare(b.fullName));

  if (isRegisterMode) {
      return (
          <div className="min-h-screen bg-brand-black font-sans flex items-center justify-center p-4">
              <div className="bg-gray-800 p-8 rounded-2xl w-full max-w-md border border-gray-700 shadow-2xl">
                  {/* Registration form content kept same as previous */}
                  <div className="text-center mb-8">
                      <h1 className="text-3xl font-black text-white italic tracking-tighter mb-2">
                        NIV <span className="text-brand-primary">COHEN</span>
                      </h1>
                      <h2 className="text-xl font-bold text-white">טופס הרשמה ראשוני</h2>
                      <p className="text-gray-400 text-sm mt-2">מלא את פרטיך והמאמן יאשר את הרשמתך בהקדם.</p>
                  </div>
                  <div className="space-y-4">
                      <div>
                          <label className="block text-gray-300 text-sm font-bold mb-2">שם מלא</label>
                          <input type="text" value={regName} onChange={e => setRegName(e.target.value)} className="w-full p-3 rounded bg-gray-900 border border-gray-600 text-white focus:border-brand-primary focus:outline-none" placeholder="ישראל ישראלי" />
                      </div>
                      <div>
                          <label className="block text-gray-300 text-sm font-bold mb-2">טלפון</label>
                          <input type="tel" value={regPhone} onChange={e => setRegPhone(e.target.value)} className="w-full p-3 rounded bg-gray-900 border border-gray-600 text-white focus:border-brand-primary focus:outline-none" placeholder="0500000000" />
                      </div>
                      <div>
                          <label className="block text-gray-300 text-sm font-bold mb-2">אימייל (אופציונלי)</label>
                          <input type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} className="w-full p-3 rounded bg-gray-900 border border-gray-600 text-white focus:border-brand-primary focus:outline-none" placeholder="email@example.com" />
                      </div>
                      <Button onClick={handleRegistrationSubmit} className="w-full py-4 text-lg mt-4">שלח פרטים והתחבר</Button>
                      <div className="text-center mt-4"><button onClick={() => setIsRegisterMode(false)} className="text-gray-400 hover:text-white underline text-sm">חזרה לדף הראשי</button></div>
                  </div>
              </div>
          </div>
      );
  }

  if (isLoadingData) {
      return <div className="min-h-screen bg-brand-black flex items-center justify-center text-white">טוען נתונים...</div>;
  }

  return (
    <div className="min-h-screen bg-brand-black pb-20 font-sans">
      <header className="bg-gradient-to-r from-brand-dark to-black p-6 sticky top-0 z-20 border-b border-gray-800 shadow-2xl">
        <div className="flex justify-between items-center max-w-2xl mx-auto">
          <div>
            <h1 className="text-3xl font-black text-white italic tracking-tighter">
              NIV <span className="text-brand-primary">COHEN</span>
            </h1>
            <p className="text-xs text-gray-400 tracking-widest uppercase">Elite Fitness Training</p>
          </div>
          {currentUser && (
              <div className="text-right flex flex-col items-end">
                  <div className="flex items-center gap-3">
                       <button onClick={() => setShowPaymentsModal(true)} className="bg-brand-primary/10 text-brand-primary px-3 py-1 rounded-full text-xs font-bold border border-brand-primary/20 hover:bg-brand-primary/20 transition-colors">
                          תשלומים
                       </button>
                      <div className="flex items-center gap-2">
                          <p className="text-white text-sm font-bold" style={{ color: currentUser.userColor }}>
                              היי, {currentUser.displayName || currentUser.fullName.split(' ')[0]}
                          </p>
                          <button onClick={openProfileModal} className="text-gray-400 hover:text-white transition-colors" title="ערוך פרופיל">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                            </svg>
                          </button>
                      </div>
                  </div>
                  <button onClick={handleLogout} className="text-xs text-gray-500 underline mt-1">התנתק (אינני {currentUser.displayName || currentUser.fullName.split(' ')[0]})</button>
              </div>
          )}
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto p-4">
        <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
            <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-800 text-center flex flex-col justify-center">
                <p className="text-brand-primary text-sm font-medium">✨ מוטיבציה יומית</p>
                <p className="text-gray-300 italic">"{quote}"</p>
            </div>
            <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-800 flex flex-col gap-2">
                 {currentUser && (
                    <div className="flex justify-between items-center border-b border-gray-700/50 pb-2">
                        <span className="text-gray-400 text-sm">האימונים שלך החודש:</span>
                        <span className="text-2xl font-bold text-white">{currentUserMonthlyCount}</span>
                    </div>
                 )}
                 {championData && championData.user && (
                    <div className="flex items-center gap-3 mt-1">
                        <div className="bg-yellow-500/20 p-2 rounded-full">
                            <span className="text-xl">🏆</span>
                        </div>
                        <div>
                            <p className="text-xs text-yellow-500 font-bold uppercase tracking-wider">שיאן החודש</p>
                            <p className="font-bold text-sm" style={{ color: championData.user.userColor || 'white' }}>
                                {championData.user.displayName || championData.user.fullName} <span className="text-gray-500 text-xs">({championData.count} אימונים)</span>
                            </p>
                        </div>
                    </div>
                 )}
            </div>
        </div>

        {isAdminMode ? (
             <div className="max-w-2xl mx-auto pb-16">
                <AdminPanel 
                    users={users} 
                    sessions={sessions} 
                    primaryColor={primaryColor}
                    workoutTypes={workoutTypes}
                    locations={locations}
                    weatherLocation={weatherLocation}
                    paymentLinks={paymentLinks}
                    onAddUser={handleAddUser}
                    onUpdateUser={handleUpdateUser}
                    onDeleteUser={handleDeleteUser} 
                    onAddSession={handleAddSession}
                    onUpdateSession={handleUpdateSession}
                    onDeleteSession={handleDeleteSession}
                    onColorChange={setPrimaryColor}
                    onUpdateWorkoutTypes={setWorkoutTypes}
                    onUpdateLocations={setLocations}
                    onUpdateWeatherLocation={setWeatherLocation}
                    onAddPaymentLink={(link) => setPaymentLinks([...paymentLinks, link])}
                    onDeletePaymentLink={(id) => setPaymentLinks(paymentLinks.filter(p => p.id !== id))}
                    onExitAdmin={handleAdminExit}
                />
            </div>
        ) : (
            <div className="pb-4">
                <div className="flex justify-between items-center mb-4 min-w-[300px] max-w-sm mx-auto bg-gray-800 rounded-full p-1">
                    <button onClick={() => setWeekOffset(prev => prev - 1)} className="px-4 py-2 rounded-full hover:bg-gray-700 text-white transition-colors">← השבוע שלפני</button>
                    <span className="text-sm font-bold text-brand-primary">{weekOffset === 0 ? 'השבוע הנוכחי' : (weekOffset === 1 ? 'שבוע הבא' : `עוד ${weekOffset} שבועות`)}</span>
                    <button onClick={() => setWeekOffset(prev => prev + 1)} className="px-4 py-2 rounded-full hover:bg-gray-700 text-white transition-colors">השבוע שאחרי →</button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
                    {weekDates.map((date, index) => {
                        const dateObj = new Date(date);
                        const dayName = dateObj.toLocaleDateString('he-IL', { weekday: 'long' });
                        const dayDate = dateObj.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });
                        const isToday = new Date().toISOString().split('T')[0] === date;
                        const daySessions = groupedSessions[date] || [];

                        return (
                            <div key={date} className={`flex flex-col rounded-xl overflow-hidden ${isToday ? 'bg-gray-800/30 ring-1 ring-brand-primary/30' : ''}`}>
                                <div className={`p-3 text-center border-b border-gray-800 ${isToday ? 'bg-brand-primary/10' : 'bg-brand-dark'}`}>
                                    <p className={`text-sm font-bold ${isToday ? 'text-brand-primary' : 'text-gray-400'}`}>{dayName}</p>
                                    <p className="text-xs text-gray-500 mb-1">{dayDate}</p>
                                    {weatherData[date] && (
                                        <div className="flex justify-center items-center gap-1 text-xs text-gray-300">
                                            <span>{getWeatherIcon(weatherData[date].weatherCode)}</span>
                                            <span>{Math.round(weatherData[date].maxTemp)}°</span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 p-2 bg-gray-900/50 min-h-[150px] md:min-h-[300px]">
                                    {daySessions.length > 0 ? (
                                        daySessions
                                            .sort((a,b) => a.time.localeCompare(b.time))
                                            .map(session => (
                                            <SessionCard 
                                                key={session.id} 
                                                session={session} 
                                                allUsers={users}
                                                isRegistered={!!currentUserPhone && session.registeredPhoneNumbers.some(p => normalizePhone(p) === normalizePhone(currentUserPhone))}
                                                weather={weatherData[date]}
                                                onRegisterClick={handleRegisterClick}
                                                onViewDetails={handleViewDetails}
                                            />
                                        ))
                                    ) : (
                                        <div className="h-full flex items-center justify-center">
                                            <p className="text-gray-700 text-xs italic">אין אימונים</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        )}
      </main>

      {/* Select User Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowLoginModal(false)}>
            <div className="bg-gray-800 p-6 rounded-2xl w-full max-w-sm border border-gray-700 shadow-2xl flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
                <h3 className="text-2xl font-bold text-white mb-2">מי מתאמן היום?</h3>
                <p className="text-gray-400 mb-4 text-sm">בחר את השם שלך מהרשימה כדי להתחבר.</p>
                
                <input 
                    type="text" 
                    placeholder="חפש את השם שלך..." 
                    value={loginSearch}
                    onChange={(e) => setLoginSearch(e.target.value)}
                    className="w-full p-3 bg-gray-900 border border-gray-600 rounded-lg text-white mb-4 focus:border-brand-primary focus:outline-none sticky top-0"
                    autoFocus
                />

                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 mb-4">
                    {filteredLoginUsers.length === 0 ? (
                        <p className="text-gray-500 text-center py-4">לא נמצא מתאמן בשם זה</p>
                    ) : (
                        filteredLoginUsers.map(user => (
                            <button 
                                key={user.id}
                                onClick={() => handleUserSelect(user)}
                                className="w-full text-right p-3 rounded-lg hover:bg-brand-primary/10 hover:border-brand-primary border border-transparent transition-all flex items-center gap-3 group"
                            >
                                <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs" style={{ backgroundColor: user.userColor || '#374151', color: user.userColor ? 'black' : 'white' }}>
                                    {user.fullName.charAt(0)}
                                </div>
                                <span className="text-white font-bold group-hover:text-brand-primary transition-colors">
                                    {user.displayName || user.fullName}
                                </span>
                            </button>
                        ))
                    )}
                </div>

                <div className="border-t border-gray-700 pt-4 mt-auto">
                    <button 
                        onClick={() => setShowLoginModal(false)}
                        className="w-full text-gray-500 text-xs mt-3 hover:text-white"
                    >
                        ביטול
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Session Details Modal */}
      {viewingSession && (
           <div className="fixed inset-0 bg-black/95 z-50 flex flex-col overflow-hidden animate-in fade-in duration-200">
              <div className="p-4 flex justify-between items-center border-b border-gray-800 bg-brand-black max-w-2xl mx-auto w-full">
                  <h3 className="text-xl font-bold text-white">פרטי אימון</h3>
                  <button onClick={() => setViewingSession(null)} className="bg-gray-800 p-2 rounded-full text-white hover:bg-gray-700">✕</button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 pb-24 max-w-2xl mx-auto w-full">
                  {weatherData[viewingSession.date] && (
                    <div className="flex justify-between items-center bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-2xl mb-6 shadow-xl border border-gray-700/50">
                        <div>
                            <p className="text-gray-400 text-sm mb-1">מזג אוויר ב{weatherLocation.name}</p>
                            <p className="text-3xl font-bold text-white">{Math.round(weatherData[viewingSession.date].maxTemp)}°</p>
                            <p style={{ color: modalColor }}>{getWeatherDescription(weatherData[viewingSession.date].weatherCode)}</p>
                        </div>
                        <div className="text-6xl filter drop-shadow-lg">{getWeatherIcon(weatherData[viewingSession.date].weatherCode)}</div>
                    </div>
                  )}
                  <div className="mb-8">
                      <div className="inline-block px-3 py-1 rounded-full text-sm font-bold mb-3 border" style={{ backgroundColor: `${modalColor}20`, color: modalColor, borderColor: `${modalColor}40` }}>{viewingSession.type}</div>
                      <h2 className="text-4xl font-black text-white mb-1">{viewingSession.time}</h2>
                      <p className="text-gray-400 text-lg mb-4">{new Date(viewingSession.date).toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                      
                      <div className="flex flex-col gap-3 mb-4">
                          <div className="flex items-center justify-between bg-gray-900 p-4 rounded-xl border border-gray-800">
                              <div className="flex items-start gap-3">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: modalColor }}>
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                <div><p className="font-bold text-white">מיקום</p><p className="text-gray-300">{viewingSession.location}</p></div>
                              </div>
                              <button onClick={handleWazeClick} className="flex items-center gap-2 bg-blue-500/10 text-blue-400 border border-blue-500/30 hover:bg-blue-500 hover:text-white px-3 py-2 rounded-lg transition-all text-sm font-bold">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.7 13.9c-.3.4-.8.5-1.2.3-.4-.2-.5-.8-.3-1.2.2-.3.7-.4 1.1-.2.4.2.5.7.4 1.1zM7 11.2c0 .4-.4.8-.8.8s-.8-.4-.8-.8c0-.5.4-.9.8-.9s.8.4.8.9zm8.9-2.3c-1.3-.9-3-.9-4.3 0-1 .7-2.3.8-3.4.3-1.4-.7-2.3-2.1-2.4-3.7-.1-1.6.7-3.1 2.1-3.9 1.4-.8 3-.8 4.5 0 1.4.8 2.3 2.3 2.1 3.9 0 1.6-1 3-2.4 3.7-1.1.5-2.4.4-3.4-.3 1.3-.9 3-.9 4.3 0 1.5.9 3.2.5 4.3-.9 1.1-1.4 1.1-3.4 0-4.8-.9-1.1-2.2-1.7-3.6-1.7-1.5 0-3 .7-3.9 1.9-.9-1.2-2.4-1.9-3.9-1.9-1.4 0-2.8.6-3.7 1.7-1.1 1.4-1.1 3.4 0 4.8 1.1 1.4 2.8 1.8 4.3.9zM12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2z"/></svg> נווט
                              </button>
                          </div>
                          {viewingSession.zoomLink && (
                              <button onClick={handleZoomClick} className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white p-4 rounded-xl font-bold shadow-lg transition-all animate-pulse">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.5 14.5L12 14l-4.5 2.5V8.5L12 11l4.5-2.5v8z"/></svg> הצטרף לאימון ZOOM
                              </button>
                          )}
                      </div>
                      {viewingSession.description && (
                          <div className="bg-gray-900 p-4 rounded-xl border-r-4 border-gray-700"><p className="text-gray-400 italic">"{viewingSession.description}"</p></div>
                      )}
                  </div>
                  <div>
                      <div className="flex justify-between items-end mb-4">
                        <h4 className="text-xl font-bold text-white border-b-2 pb-1 inline-block" style={{ borderColor: modalColor }}>רשימת משתתפים</h4>
                        <span className="text-sm text-gray-500 bg-gray-900 px-2 py-1 rounded">{viewingSession.registeredPhoneNumbers.length} / {viewingSession.maxCapacity}</span>
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                          {viewingSession.registeredPhoneNumbers.length === 0 ? (
                              <p className="text-gray-600 text-center py-4 bg-gray-900/50 rounded-xl border border-dashed border-gray-800">אין נרשמים עדיין. היה הראשון!</p>
                          ) : (
                              getSessionAttendees(viewingSession).map((attendee, idx) => (
                                  <div key={idx} className="flex items-center gap-4 p-3 bg-gray-800/50 rounded-xl border border-gray-800">
                                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-inner" style={{ backgroundColor: `${modalColor}20`, color: modalColor }}>{idx + 1}</div>
                                      <span className="text-gray-200 font-medium text-lg" style={{ color: attendee.color || '#E5E7EB' }}>{attendee.name}</span>
                                  </div>
                              ))
                          )}
                      </div>
                  </div>
              </div>
              <div className="p-4 bg-brand-black border-t border-gray-800 w-full">
                <div className="max-w-2xl mx-auto">
                 {!!currentUserPhone && viewingSession.registeredPhoneNumbers.some(p => normalizePhone(p) === normalizePhone(currentUserPhone)) ? (
                    <Button variant="danger" className="w-full py-4 text-lg" onClick={() => handleRegisterClick(viewingSession.id)}>ביטול הגעה לאימון</Button>
                 ) : (
                    <Button 
                        style={viewingSession.registeredPhoneNumbers.length < viewingSession.maxCapacity ? { backgroundColor: modalColor, color: 'black' } : {}}
                        className={`w-full py-4 text-lg shadow-xl ${viewingSession.registeredPhoneNumbers.length >= viewingSession.maxCapacity ? 'bg-gray-700 text-white opacity-50 cursor-not-allowed' : ''}`}
                        onClick={() => handleRegisterClick(viewingSession.id)}
                        disabled={viewingSession.registeredPhoneNumbers.length >= viewingSession.maxCapacity}
                    >
                        {viewingSession.registeredPhoneNumbers.length >= viewingSession.maxCapacity ? 'האימון מלא' : 'שריין מקום עכשיו!'}
                    </Button>
                 )}
                 </div>
              </div>
           </div>
      )}
      
      {showInstallPrompt && <InstallPrompt onClose={() => setShowInstallPrompt(false)} onInstall={handleInstallClick} canInstall={!!deferredPrompt} />}
      {!showInstallPrompt && <FloatingInstallButton onClick={() => setShowInstallPrompt(true)} />}
      {!showInstallPrompt && !isRegisterMode && <WhatsAppButton />}

      {/* Payments and Terms Modal render logic... */}
      {showPaymentsModal && (
          <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowPaymentsModal(false)}>
            <div className="bg-gray-800 p-6 rounded-2xl w-full max-w-sm border border-gray-700 shadow-2xl" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><span>💳</span>רכישה ותשלומים</h3>
                <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-600 mb-4">
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-gray-400 text-sm">סטטוס נוכחי:</span>
                        <span className={`text-sm font-bold px-2 py-0.5 rounded ${currentUser?.paymentStatus === PaymentStatus.PAID ? 'bg-green-500/20 text-green-400' : currentUser?.paymentStatus === PaymentStatus.PENDING ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
                            {currentUser?.paymentStatus === PaymentStatus.PAID ? 'מנוי פעיל' : currentUser?.paymentStatus === PaymentStatus.PENDING ? 'ממתין לאישור' : 'לא שולם / חוב'}
                        </span>
                    </div>
                     {currentUser?.paymentStatus !== PaymentStatus.PENDING && currentUser?.paymentStatus !== PaymentStatus.PAID && (
                         <Button onClick={handleReportPayment} size="sm" variant="secondary" className="w-full mt-2 text-xs">עדכן את המאמן שביצעתי תשלום</Button>
                     )}
                     {currentUser?.paymentStatus === PaymentStatus.PENDING && <p className="text-xs text-yellow-500 mt-1">המאמן קיבל את הדיווח ויאשר בקרוב.</p>}
                </div>
                <p className="text-gray-400 text-sm mb-4">בחר מוצר ולחץ לקבלת קישור לתשלום ישירות לוואטסאפ שלך.</p>
                <div className="space-y-3 max-h-[40vh] overflow-y-auto custom-scrollbar">
                    {paymentLinks.length === 0 ? <p className="text-gray-500 text-center py-4">לא הוגדרו מוצרים לתשלום</p> : paymentLinks.map(link => (
                        <button key={link.id} onClick={() => handlePaymentClick(link)} className="w-full bg-gray-700 hover:bg-gray-600 p-4 rounded-xl border border-gray-600 hover:border-brand-primary transition-all flex justify-between items-center group">
                            <span className="font-bold text-white">{link.title}</span><span className="text-brand-primary group-hover:translate-x-1 transition-transform">←</span>
                        </button>
                    ))}
                </div>
                <Button variant="secondary" className="w-full mt-6" onClick={() => setShowPaymentsModal(false)}>סגור</Button>
            </div>
          </div>
      )}
      {showTermsModal && (
          <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowTermsModal(false)}>
              <div className="bg-gray-800 p-6 rounded-2xl w-full max-w-lg border border-gray-700 shadow-2xl overflow-y-auto max-h-[80vh]" onClick={e => e.stopPropagation()}>
                  <h3 className="text-2xl font-bold text-white mb-4 border-b border-gray-700 pb-2">מדיניות השימוש</h3>
                  <div className="text-gray-300 space-y-4 text-sm leading-relaxed">
                      <p>ברוכים הבאים לאפליקציית האימונים של ניב כהן.</p>
                      <p>1. <strong>הרשמה לאימונים:</strong> ההרשמה לאימון מחייבת הגעה. ביטול אימון יתאפשר עד 3 שעות לפני מועד האימון.</p>
                      <p>2. <strong>בריאות:</strong> המתאמן מצהיר כי הוא בריא וכשיר לפעילות גופנית עצימה. באחריות המתאמן לדווח על כל שינוי במצבו הבריאותי.</p>
                      <p>3. <strong>תשלומים:</strong> התשלום עבור האימונים מתבצע מראש או בתיאום מול המאמן. פיגור בתשלום עלול לגרור חסימה מהרשמה לאימונים עתידיים.</p>
                      <p>4. <strong>פרטיות:</strong> מספרי הטלפון והשמות נשמרים במערכת לצורך ניהול האימונים בלבד ולא יועברו לצד שלישי.</p>
                  </div>
                  <Button className="mt-6 w-full" onClick={() => setShowTermsModal(false)}>סגור</Button>
              </div>
          </div>
      )}
      <footer className="fixed bottom-0 w-full bg-brand-black/90 backdrop-blur-md border-t border-gray-800 h-16 flex justify-between items-center px-6 z-40">
          <div className="flex gap-4 items-center">
            <button onClick={() => setShowTermsModal(true)} className="text-gray-500 text-xs hover:text-white transition-colors">מדיניות השימוש</button>
            <div className="flex items-center gap-1.5" title={isCloudConnected ? "מחובר לענן (מסונכרן)" : "מצב מקומי (לא מסונכרן)"}>
                <span className={`w-2 h-2 rounded-full ${isCloudConnected ? 'bg-green-500 shadow-[0_0_5px_#22c55e]' : 'bg-orange-500 animate-pulse'}`}></span>
                {!isCloudConnected && <span className="text-[10px] text-orange-500 font-bold hidden md:inline">לא מסונכרן (מצב מקומי)</span>}
            </div>
            {/* Manual Refresh Button */}
            <button 
                onClick={refreshData} 
                disabled={isLoadingData}
                className="text-xs text-gray-400 hover:text-white flex items-center gap-1 bg-gray-800/50 px-2 py-1 rounded border border-gray-700 transition-colors"
                title="רענן נתונים"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-3 w-3 ${isLoadingData ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {isLoadingData ? 'טוען...' : 'רענן'}
            </button>
          </div>
          <div className="relative">
              {pendingUsersCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500"></span>
                  </span>
              )}
              <button onClick={() => setIsAdminMode(!isAdminMode)} className={`p-2 rounded-full transition-all ${isAdminMode ? 'bg-brand-primary text-brand-black rotate-90' : 'text-gray-500 hover:text-white hover:bg-gray-800'}`} title="ניהול תוכן">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </button>
          </div>
      </footer>
    </div>
  );
};

export default App;