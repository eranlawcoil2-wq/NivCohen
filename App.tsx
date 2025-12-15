import React, { useState, useEffect } from 'react';
import { User, TrainingSession, PaymentStatus, WorkoutType, WeatherLocation, PaymentLink } from './types';
import { INITIAL_USERS, INITIAL_SESSIONS } from './constants';
import { SessionCard } from './components/SessionCard';
import { AdminPanel } from './components/AdminPanel';
import { Button } from './components/Button';
import { getMotivationQuote } from './services/geminiService';
import { getWeatherForDates, getWeatherIcon, getWeatherDescription } from './services/weatherService';

// Install Prompt Component
const InstallPrompt: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    return (
        <div className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-brand-primary p-4 z-50 md:hidden animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-start mb-2">
                <h3 className="text-white font-bold text-lg">שמור כאפליקציה!</h3>
                <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
            </div>
            <p className="text-gray-300 text-sm mb-3">
                לגישה מהירה ללו"ז האימונים, הוסף את האפליקציה למסך הבית שלך.
            </p>
            <div className="flex items-center gap-2 text-sm text-brand-primary font-bold bg-gray-900/50 p-2 rounded">
                <span>לחץ על</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <span>ובחר "הוסף למסך הבית"</span>
                <span className="text-xl leading-none">+</span>
            </div>
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

const App: React.FC = () => {
  // State
  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem('niv_app_users');
    return saved ? JSON.parse(saved) : INITIAL_USERS;
  });

  const [sessions, setSessions] = useState<TrainingSession[]>(() => {
    const saved = localStorage.getItem('niv_app_sessions');
    return saved ? JSON.parse(saved) : INITIAL_SESSIONS;
  });

  // Dynamic Lists State
  const [workoutTypes, setWorkoutTypes] = useState<string[]>(() => {
      const saved = localStorage.getItem('niv_app_types');
      // Default to Enum values if not saved
      return saved ? JSON.parse(saved) : Object.values(WorkoutType);
  });

  const [locations, setLocations] = useState<string[]>(() => {
      const saved = localStorage.getItem('niv_app_locations');
      return saved ? JSON.parse(saved) : ['פארק הירקון, תל אביב', 'סטודיו פיטנס, רמת גן', 'חוף הים, הרצליה', 'גן המייסדים, נס ציונה'];
  });

  // Payment Links State
  const [paymentLinks, setPaymentLinks] = useState<PaymentLink[]>(() => {
      const saved = localStorage.getItem('niv_app_payments');
      return saved ? JSON.parse(saved) : [];
  });

  // Weather Settings
  const [weatherLocation, setWeatherLocation] = useState<WeatherLocation>(() => {
      const saved = localStorage.getItem('niv_app_weather_loc');
      return saved ? JSON.parse(saved) : { name: 'נס ציונה', lat: 31.93, lon: 34.80 };
  });

  const [currentUserPhone, setCurrentUserPhone] = useState<string | null>(() => {
      return localStorage.getItem('niv_app_current_phone');
  });

  const [primaryColor, setPrimaryColor] = useState<string>(() => {
      return localStorage.getItem('niv_app_color') || '#A3E635';
  });

  const [weekOffset, setWeekOffset] = useState(0); // 0 = current week, 1 = next week, etc.

  const [isAdminMode, setIsAdminMode] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false); // New Profile Modal
  const [showPaymentsModal, setShowPaymentsModal] = useState(false); // New Payments Modal
  const [showInstallPrompt, setShowInstallPrompt] = useState(false); // Mobile Install Prompt
  const [loginPhone, setLoginPhone] = useState('');
  const [loginName, setLoginName] = useState(''); // For new users
  const [loginEmail, setLoginEmail] = useState(''); // New Email Field
  const [isNewUser, setIsNewUser] = useState(false);
  const [targetSessionId, setTargetSessionId] = useState<string | null>(null); 
  const [quote, setQuote] = useState<string>('טוען משפט מוטיבציה...');
  const [viewingSession, setViewingSession] = useState<TrainingSession | null>(null);
  const [weatherData, setWeatherData] = useState<Record<string, { maxTemp: number; weatherCode: number }>>({});
  
  // Profile Edit State
  const [editDisplayName, setEditDisplayName] = useState('');

  // Statistics Calculation Helpers
  const getMonthlyWorkoutsCount = (userPhone: string) => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return sessions.filter(session => {
        const sessionDate = new Date(session.date);
        return (
            sessionDate.getMonth() === currentMonth &&
            sessionDate.getFullYear() === currentYear &&
            session.registeredPhoneNumbers.includes(userPhone)
        );
    }).length;
  };

  const getChampionOfTheMonth = () => {
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
  const currentUser = users.find(u => u.phone === currentUserPhone);

  // Helper to get current week dates (Sunday to Saturday) with offset
  const getCurrentWeekDates = (offset: number) => {
    const curr = new Date();
    // Calculate the Sunday of the current week (0 is Sunday)
    const day = curr.getDay();
    const diff = curr.getDate() - day + (offset * 7);
    
    const days = [];
    // Start from Sunday
    const startOfWeek = new Date(curr.setDate(diff));
    
    for (let i = 0; i < 7; i++) {
        const next = new Date(startOfWeek.getTime());
        next.setDate(startOfWeek.getDate() + i);
        days.push(next.toISOString().split('T')[0]);
    }
    return days;
  };

  const weekDates = getCurrentWeekDates(weekOffset);

  // Persistence Effects
  useEffect(() => {
    localStorage.setItem('niv_app_users', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem('niv_app_sessions', JSON.stringify(sessions));
  }, [sessions]);

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
    // Refetch weather when location changes
    getWeatherForDates(weekDates, weatherLocation.lat, weatherLocation.lon).then(setWeatherData);
  }, [weatherLocation]);
  
  // Refetch weather when week changes
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
    getMotivationQuote().then(setQuote);
    // Initial fetch
    getWeatherForDates(weekDates, weatherLocation.lat, weatherLocation.lon).then(setWeatherData);

    // Check if installed (basic check) and show prompt if mobile
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    if (isMobile && !isStandalone) {
        // Delay prompt slightly
        setTimeout(() => setShowInstallPrompt(true), 3000);
    }

  }, []); // Run once on mount

  // Handlers
  const handleRegisterClick = (sessionId: string) => {
    // 1. Check if user is logged in
    if (!currentUserPhone) {
      setTargetSessionId(sessionId);
      setShowLoginModal(true);
      return;
    }

    // 2. Find Session
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;

    // 3. Check Trial Restrictions for New Users
    if (currentUser?.isNew && !session.isTrial) {
        alert('מתאמנים חדשים יכולים להירשם לאימוני ניסיון בלבד.');
        return;
    }

    setSessions(prevSessions => prevSessions.map(s => {
      if (s.id === sessionId) {
        const isRegistered = s.registeredPhoneNumbers.includes(currentUserPhone);
        if (isRegistered) {
          return { ...s, registeredPhoneNumbers: s.registeredPhoneNumbers.filter(p => p !== currentUserPhone) };
        } else {
            if (s.registeredPhoneNumbers.length >= s.maxCapacity) {
                alert('האימון מלא!');
                return s;
            }
          return { ...s, registeredPhoneNumbers: [...s.registeredPhoneNumbers, currentUserPhone] };
        }
      }
      return s;
    }));
  };

  const handleLoginSubmit = () => {
      const normalizedPhone = loginPhone.trim();
      
      if (!normalizedPhone) return;

      const existingUser = users.find(u => u.phone === normalizedPhone);

      // Check if user exists. If not, ask for name (second step).
      if (!existingUser && !isNewUser) {
          setIsNewUser(true);
          return;
      }

      // If new user and name provided, create user
      if (isNewUser) {
          if (!loginName.trim()) {
              alert('אנא הזן שם מלא');
              return;
          }
           if (!loginEmail.trim()) {
              alert('אנא הזן כתובת אימייל');
              return;
          }
          const newUser: User = {
              id: Date.now().toString(),
              fullName: loginName,
              displayName: loginName, // Default display name
              phone: normalizedPhone,
              email: loginEmail,
              startDate: new Date().toISOString().split('T')[0],
              paymentStatus: PaymentStatus.PAID, // Default for auto-signup
              isNew: true // Mark as new for admin review
          };
          setUsers(prev => [...prev, newUser]);
      }

      // Login success
      setCurrentUserPhone(normalizedPhone);
      setShowLoginModal(false);
      setLoginPhone('');
      setLoginName('');
      setLoginEmail('');
      setIsNewUser(false);
      
      // Auto register if target session exists
      if (targetSessionId) {
        const session = sessions.find(s => s.id === targetSessionId);
        // Only attempt registration if restrictions are met (need to re-check for new user here effectively)
        const isUserActuallyNew = isNewUser; // Captured from local state before reset, or true if we just created them
        
        if (session) {
             // Logic check for new user restriction
             if (isUserActuallyNew && !session.isTrial) {
                 alert('נרשמת בהצלחה למערכת! שים לב: כמתאמן חדש, באפשרותך להירשם רק לאימוני ניסיון.');
                 setTargetSessionId(null);
                 return;
             }

             setSessions(prevSessions => prevSessions.map(s => {
                if (s.id === targetSessionId) {
                    if (s.registeredPhoneNumbers.includes(normalizedPhone) || s.registeredPhoneNumbers.length >= s.maxCapacity) {
                        return s;
                    }
                    return { ...s, registeredPhoneNumbers: [...s.registeredPhoneNumbers, normalizedPhone] };
                }
                return s;
            }));
        }
        setTargetSessionId(null);
      }
  };

  const handleUpdateUser = (updatedUser: User) => {
    setUsers(prevUsers => prevUsers.map(u => u.id === updatedUser.id ? updatedUser : u));
  };
  
  const handleDeleteUser = (userId: string) => {
      setUsers(prevUsers => prevUsers.filter(u => u.id !== userId));
      
      // Optional: Remove user from sessions (not strictly required if we just hide name, but cleaner)
      const user = users.find(u => u.id === userId);
      if (user) {
          setSessions(prev => prev.map(s => ({
              ...s,
              registeredPhoneNumbers: s.registeredPhoneNumbers.filter(p => p !== user.phone)
          })));
      }
  };
  
  const handleUpdateSession = (updatedSession: TrainingSession) => {
      setSessions(prevSessions => prevSessions.map(s => s.id === updatedSession.id ? updatedSession : s));
  };

  const handleLogout = () => {
      setCurrentUserPhone(null);
  };

  const handleProfileUpdate = () => {
    if (currentUser) {
        handleUpdateUser({
            ...currentUser,
            displayName: editDisplayName.trim() || currentUser.fullName
        });
        setShowProfileModal(false);
    }
  };

  const openProfileModal = () => {
      if (currentUser) {
          setEditDisplayName(currentUser.displayName || currentUser.fullName);
          setShowProfileModal(true);
      }
  };
  
  const handlePaymentClick = (link: PaymentLink) => {
      if (!currentUserPhone) return;
      
      // Clean phone number (remove leading 0, add 972)
      const cleanPhone = currentUserPhone.startsWith('0') 
        ? '972' + currentUserPhone.substring(1) 
        : currentUserPhone;
        
      const message = `היי, הנה הלינק לתשלום עבור ${link.title}: ${link.url}`;
      const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
      
      window.open(whatsappUrl, '_blank');
  };

  const handleViewDetails = (sessionId: string) => {
      const session = sessions.find(s => s.id === sessionId);
      if (session) setViewingSession(session);
  };

  const getSessionAttendees = (session: TrainingSession) => {
      return session.registeredPhoneNumbers.map(phone => {
          const u = users.find(user => user.phone === phone);
          return u ? (u.displayName || u.fullName) : `אורח (${phone})`;
      });
  };

  // Group sessions by date
  const groupedSessions = sessions.reduce((acc, session) => {
      const date = session.date;
      if (!acc[date]) acc[date] = [];
      acc[date].push(session);
      return acc;
  }, {} as Record<string, TrainingSession[]>);

  // Determine session specific color for modal
  const modalColor = viewingSession?.color || primaryColor;

  return (
    <div className="min-h-screen bg-brand-black pb-20 font-sans">
      {/* Header */}
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
                          <p className="text-white text-sm font-bold">
                              היי, {currentUser.displayName || currentUser.fullName.split(' ')[0]}
                          </p>
                          <button onClick={openProfileModal} className="text-gray-400 hover:text-white transition-colors" title="ערוך פרופיל">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                            </svg>
                          </button>
                      </div>
                  </div>
                  <button onClick={handleLogout} className="text-xs text-gray-500 underline mt-1">התנתק</button>
              </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1400px] mx-auto p-4">
        
        {/* Quote & Stats Section */}
        <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
            {/* Quote */}
            <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-800 text-center flex flex-col justify-center">
                <p className="text-brand-primary text-sm font-medium">✨ מוטיבציה יומית</p>
                <p className="text-gray-300 italic">"{quote}"</p>
            </div>

            {/* User Stats / Champion */}
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
                            <p className="text-white font-bold text-sm">
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
                    onAddUser={(u) => setUsers([...users, u])}
                    onUpdateUser={handleUpdateUser}
                    onDeleteUser={handleDeleteUser} // Pass delete handler
                    onAddSession={(s) => setSessions([...sessions, s])}
                    onUpdateSession={handleUpdateSession}
                    onDeleteSession={(id) => setSessions(sessions.filter(s => s.id !== id))}
                    onColorChange={setPrimaryColor}
                    onUpdateWorkoutTypes={setWorkoutTypes}
                    onUpdateLocations={setLocations}
                    onUpdateWeatherLocation={setWeatherLocation}
                    onAddPaymentLink={(link) => setPaymentLinks([...paymentLinks, link])}
                    onDeletePaymentLink={(id) => setPaymentLinks(paymentLinks.filter(p => p.id !== id))}
                    onExitAdmin={() => setIsAdminMode(false)}
                />
            </div>
        ) : (
            <div className="pb-4">
                
                {/* Week Navigation */}
                <div className="flex justify-between items-center mb-4 min-w-[300px] max-w-sm mx-auto bg-gray-800 rounded-full p-1">
                    <button 
                        onClick={() => setWeekOffset(prev => prev - 1)}
                        className="px-4 py-2 rounded-full hover:bg-gray-700 text-white transition-colors"
                    >
                        ← שבוע שעבר
                    </button>
                    <span className="text-sm font-bold text-brand-primary">
                        {weekOffset === 0 ? 'השבוע הנוכחי' : (weekOffset === 1 ? 'שבוע הבא' : `עוד ${weekOffset} שבועות`)}
                    </span>
                    <button 
                        onClick={() => setWeekOffset(prev => prev + 1)}
                        className="px-4 py-2 rounded-full hover:bg-gray-700 text-white transition-colors"
                    >
                        שבוע הבא →
                    </button>
                </div>

                {/* Mobile Grid (2 Columns) vs Desktop Grid (7 Columns) */}
                <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
                    {weekDates.map((date, index) => {
                        const dateObj = new Date(date);
                        const dayName = dateObj.toLocaleDateString('he-IL', { weekday: 'long' });
                        const dayDate = dateObj.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });
                        const isToday = new Date().toISOString().split('T')[0] === date;
                        const daySessions = groupedSessions[date] || [];

                        return (
                            <div key={date} className={`flex flex-col rounded-xl overflow-hidden ${isToday ? 'bg-gray-800/30 ring-1 ring-brand-primary/30' : ''}`}>
                                {/* Column Header */}
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

                                {/* Sessions Column */}
                                <div className="flex-1 p-2 bg-gray-900/50 min-h-[150px] md:min-h-[300px]">
                                    {daySessions.length > 0 ? (
                                        daySessions
                                            .sort((a,b) => a.time.localeCompare(b.time))
                                            .map(session => (
                                            <SessionCard 
                                                key={session.id} 
                                                session={session} 
                                                allUsers={users}
                                                isRegistered={!!currentUserPhone && session.registeredPhoneNumbers.includes(currentUserPhone)}
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

      {/* Full Detail Modal */}
      {viewingSession && (
           <div className="fixed inset-0 bg-black/95 z-50 flex flex-col overflow-hidden animate-in fade-in duration-200">
              {/* Modal Header */}
              <div className="p-4 flex justify-between items-center border-b border-gray-800 bg-brand-black max-w-2xl mx-auto w-full">
                  <h3 className="text-xl font-bold text-white">פרטי אימון</h3>
                  <button 
                    onClick={() => setViewingSession(null)} 
                    className="bg-gray-800 p-2 rounded-full text-white hover:bg-gray-700"
                  >
                      ✕
                  </button>
              </div>

              {/* Modal Content - Scrollable */}
              <div className="flex-1 overflow-y-auto p-4 pb-24 max-w-2xl mx-auto w-full">
                  
                  {/* Big Weather Header */}
                  {weatherData[viewingSession.date] && (
                    <div className="flex justify-between items-center bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-2xl mb-6 shadow-xl border border-gray-700/50">
                        <div>
                            <p className="text-gray-400 text-sm mb-1">מזג אוויר ב{weatherLocation.name}</p>
                            <p className="text-3xl font-bold text-white">
                                {Math.round(weatherData[viewingSession.date].maxTemp)}°
                            </p>
                            <p style={{ color: modalColor }}>
                                {getWeatherDescription(weatherData[viewingSession.date].weatherCode)}
                            </p>
                        </div>
                        <div className="text-6xl filter drop-shadow-lg">
                            {getWeatherIcon(weatherData[viewingSession.date].weatherCode)}
                        </div>
                    </div>
                  )}

                  {/* Main Info */}
                  <div className="mb-8">
                      <div 
                        className="inline-block px-3 py-1 rounded-full text-sm font-bold mb-3 border"
                        style={{ backgroundColor: `${modalColor}20`, color: modalColor, borderColor: `${modalColor}40` }}
                      >
                          {viewingSession.type}
                      </div>
                      <h2 className="text-4xl font-black text-white mb-1">{viewingSession.time}</h2>
                      <p className="text-gray-400 text-lg mb-4">
                        {new Date(viewingSession.date).toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })}
                      </p>
                      
                      <div className="flex items-start gap-3 text-gray-300 bg-gray-900 p-4 rounded-xl mb-4">
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: modalColor }}>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                           <div>
                               <p className="font-bold">מיקום</p>
                               <p>{viewingSession.location}</p>
                           </div>
                      </div>

                      {viewingSession.description && (
                          <div className="bg-gray-900 p-4 rounded-xl border-r-4 border-gray-700">
                              <p className="text-gray-400 italic">"{viewingSession.description}"</p>
                          </div>
                      )}
                  </div>

                  {/* Attendees List */}
                  <div>
                      <div className="flex justify-between items-end mb-4">
                        <h4 className="text-xl font-bold text-white border-b-2 pb-1 inline-block" style={{ borderColor: modalColor }}>רשימת משתתפים</h4>
                        <span className="text-sm text-gray-500 bg-gray-900 px-2 py-1 rounded">
                            {viewingSession.registeredPhoneNumbers.length} / {viewingSession.maxCapacity}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 gap-2">
                          {viewingSession.registeredPhoneNumbers.length === 0 ? (
                              <p className="text-gray-600 text-center py-4 bg-gray-900/50 rounded-xl border border-dashed border-gray-800">
                                  אין נרשמים עדיין. היה הראשון!
                              </p>
                          ) : (
                              getSessionAttendees(viewingSession).map((name, idx) => (
                                  <div key={idx} className="flex items-center gap-4 p-3 bg-gray-800/50 rounded-xl border border-gray-800">
                                      <div 
                                        className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-inner"
                                        style={{ backgroundColor: `${modalColor}20`, color: modalColor }}
                                      >
                                          {idx + 1}
                                      </div>
                                      <span className="text-gray-200 font-medium text-lg">{name}</span>
                                  </div>
                              ))
                          )}
                      </div>
                  </div>
              </div>

              {/* Sticky Action Button */}
              <div className="p-4 bg-brand-black border-t border-gray-800 w-full">
                <div className="max-w-2xl mx-auto">
                 {!!currentUserPhone && viewingSession.registeredPhoneNumbers.includes(currentUserPhone) ? (
                    <Button variant="danger" className="w-full py-4 text-lg" onClick={() => handleRegisterClick(viewingSession.id)}>
                        ביטול הגעה לאימון
                    </Button>
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
      
      {/* Install App Prompt (Mobile Only) */}
      {showInstallPrompt && <InstallPrompt onClose={() => setShowInstallPrompt(false)} />}
      
      {/* Floating Install Button - Shown if prompt is closed on mobile */}
      {!showInstallPrompt && (
          <FloatingInstallButton onClick={() => setShowInstallPrompt(true)} />
      )}

      {/* Profile Edit Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowProfileModal(false)}>
            <div className="bg-gray-800 p-6 rounded-2xl w-full max-w-sm border border-gray-700 shadow-2xl" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold text-white mb-4">עריכת פרופיל</h3>
                <div className="space-y-4">
                    <div>
                        <label className="text-sm text-gray-400 block mb-1">שם תצוגה (כינוי)</label>
                        <input 
                            type="text" 
                            value={editDisplayName}
                            onChange={(e) => setEditDisplayName(e.target.value)}
                            className="w-full p-3 bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-brand-primary focus:outline-none"
                            placeholder="איך נקרא לך?"
                        />
                         <p className="text-xs text-gray-500 mt-1">זה השם שיופיע ברשימות הנרשמים</p>
                    </div>
                    
                    <div className="flex gap-3 pt-2">
                        <Button onClick={handleProfileUpdate} className="flex-1">שמור שינויים</Button>
                        <Button variant="secondary" onClick={() => setShowProfileModal(false)} className="flex-1">ביטול</Button>
                    </div>
                </div>
            </div>
        </div>
      )}
      
      {/* Payments Modal (User Side) */}
      {showPaymentsModal && (
          <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowPaymentsModal(false)}>
            <div className="bg-gray-800 p-6 rounded-2xl w-full max-w-sm border border-gray-700 shadow-2xl" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <span>💳</span>
                    רכישה ותשלומים
                </h3>
                <p className="text-gray-400 text-sm mb-4">בחר מוצר ולחץ לקבלת קישור לתשלום ישירות לוואטסאפ שלך.</p>
                
                <div className="space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    {paymentLinks.length === 0 ? (
                        <p className="text-gray-500 text-center py-4">לא הוגדרו מוצרים לתשלום</p>
                    ) : (
                        paymentLinks.map(link => (
                            <button 
                                key={link.id}
                                onClick={() => handlePaymentClick(link)}
                                className="w-full bg-gray-700 hover:bg-gray-600 p-4 rounded-xl border border-gray-600 hover:border-brand-primary transition-all flex justify-between items-center group"
                            >
                                <span className="font-bold text-white">{link.title}</span>
                                <span className="text-brand-primary group-hover:translate-x-1 transition-transform">←</span>
                            </button>
                        ))
                    )}
                </div>
                
                <Button variant="secondary" className="w-full mt-6" onClick={() => setShowPaymentsModal(false)}>סגור</Button>
            </div>
          </div>
      )}

      {/* Login/Register Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-gray-800 p-6 rounded-2xl w-full max-w-sm border border-gray-700 shadow-2xl">
                <h3 className="text-2xl font-bold text-white mb-2">
                    {isNewUser ? 'ברוך הבא! הרשמה מהירה' : 'הזדהות מתאמן'}
                </h3>
                <p className="text-gray-400 mb-6 text-sm">
                    {isNewUser 
                        ? 'נראה שזו הפעם הראשונה שלך כאן. השלם פרטים להרשמה.' 
                        : 'הזן את מספר הטלפון שלך כדי להירשם לאימון.'}
                </p>
                
                {!isNewUser ? (
                     <input 
                        type="tel" 
                        value={loginPhone}
                        onChange={(e) => setLoginPhone(e.target.value)}
                        placeholder="050-0000000"
                        className="w-full p-4 bg-gray-900 border border-gray-600 rounded-lg text-white text-lg tracking-widest mb-4 focus:border-brand-primary focus:outline-none"
                        autoFocus
                    />
                ) : (
                    <div className="space-y-4 mb-4">
                         <div className="bg-gray-900 p-3 rounded border border-gray-700 text-gray-400 text-sm">
                            טלפון: {loginPhone}
                        </div>
                        <input 
                            type="text" 
                            value={loginName}
                            onChange={(e) => setLoginName(e.target.value)}
                            placeholder="שם מלא"
                            className="w-full p-4 bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-brand-primary focus:outline-none"
                            autoFocus
                        />
                        <input 
                            type="email" 
                            value={loginEmail}
                            onChange={(e) => setLoginEmail(e.target.value)}
                            placeholder="כתובת אימייל"
                            className="w-full p-4 bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-brand-primary focus:outline-none"
                        />
                    </div>
                )}
                
                <div className="flex gap-3">
                    <Button onClick={handleLoginSubmit} className="flex-1">
                        {isNewUser ? 'סיים הרשמה' : 'המשך'}
                    </Button>
                    <Button variant="secondary" onClick={() => { setShowLoginModal(false); setTargetSessionId(null); setIsNewUser(false); setLoginPhone(''); setLoginEmail(''); }} className="flex-1">ביטול</Button>
                </div>
            </div>
        </div>
      )}

      {/* Terms of Use Modal */}
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
                      <p>5. <strong>שינויים:</strong> הנהלת האפליקציה שומרת לעצמה את הזכות לשנות את מועדי האימונים בהתראה מראש.</p>
                  </div>
                  <Button className="mt-6 w-full" onClick={() => setShowTermsModal(false)}>סגור</Button>
              </div>
          </div>
      )}

      {/* Footer */}
      <footer className="fixed bottom-0 w-full bg-brand-black/90 backdrop-blur-md border-t border-gray-800 h-16 flex justify-between items-center px-6 z-40">
          <button 
             onClick={() => setShowTermsModal(true)}
             className="text-gray-500 text-xs hover:text-white transition-colors"
          >
              מדיניות השימוש
          </button>

          <button 
            onClick={() => setIsAdminMode(!isAdminMode)}
            className={`p-2 rounded-full transition-all ${isAdminMode ? 'bg-brand-primary text-brand-black rotate-90' : 'text-gray-500 hover:text-white hover:bg-gray-800'}`}
            title="ניהול תוכן"
          >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
          </button>
      </footer>
    </div>
  );
};

export default App;