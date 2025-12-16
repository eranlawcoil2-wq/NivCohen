import React, { useState } from 'react';
import { User, TrainingSession, PaymentStatus, WeatherLocation, PaymentLink, LocationDef } from '../types';
import { Button } from './Button';
import { generateWorkoutDescription } from '../services/geminiService';
import { getCityCoordinates } from '../services/weatherService';

interface AdminPanelProps {
  users: User[];
  sessions: TrainingSession[];
  primaryColor: string;
  workoutTypes: string[];
  locations: LocationDef[];
  weatherLocation: WeatherLocation;
  paymentLinks: PaymentLink[];
  onAddUser: (user: User) => void;
  onUpdateUser: (user: User) => void;
  onDeleteUser: (userId: string) => void; 
  onAddSession: (session: TrainingSession) => void;
  onUpdateSession: (session: TrainingSession) => void;
  onDeleteSession: (id: string) => void;
  onColorChange: (color: string) => void;
  onUpdateWorkoutTypes: (types: string[]) => void;
  onUpdateLocations: (locations: LocationDef[]) => void;
  onUpdateWeatherLocation: (location: WeatherLocation) => void;
  onAddPaymentLink: (link: PaymentLink) => void;
  onDeletePaymentLink: (id: string) => void;
  onExitAdmin: () => void;
}

const SESSION_COLORS = [
    '#A3E635', // Lime (Default)
    '#3B82F6', // Blue
    '#EF4444', // Red
    '#F59E0B', // Amber
    '#8B5CF6', // Violet
    '#EC4899', // Pink
    '#06B6D4', // Cyan
    '#F97316'  // Orange
];

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

const getSunday = (d: Date) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day; 
  return new Date(date.setDate(diff));
};

const formatDateForInput = (date: Date) => date.toISOString().split('T')[0];

export const AdminPanel: React.FC<AdminPanelProps> = ({ 
    users, 
    sessions, 
    primaryColor,
    workoutTypes,
    locations,
    weatherLocation,
    paymentLinks,
    onAddUser, 
    onUpdateUser,
    onDeleteUser, 
    onAddSession, 
    onUpdateSession,
    onDeleteSession,
    onColorChange,
    onUpdateWorkoutTypes,
    onUpdateLocations,
    onUpdateWeatherLocation,
    onAddPaymentLink,
    onDeletePaymentLink,
    onExitAdmin
}) => {
  const [activeTab, setActiveTab] = useState<'users' | 'sessions' | 'settings' | 'new_users'>('users');
  
  // User Form State
  const [formUser, setFormUser] = useState<Partial<User>>({
    fullName: '',
    displayName: '', 
    phone: '',
    email: '',
    startDate: new Date().toISOString().split('T')[0],
    paymentStatus: PaymentStatus.PAID,
    userColor: ''
  });
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  // User Filter State
  const [filterText, setFilterText] = useState('');
  const [filterStatus, setFilterStatus] = useState<PaymentStatus | 'ALL'>('ALL');
  const [sortByWorkouts, setSortByWorkouts] = useState(false);

  // Session Form State
  const [newSession, setNewSession] = useState<Partial<TrainingSession>>({
    type: workoutTypes[0] || '',
    date: new Date().toISOString().split('T')[0],
    time: '18:00',
    location: locations.length > 0 ? locations[0].name : '',
    maxCapacity: 15,
    description: '',
    color: SESSION_COLORS[0],
    isTrial: false,
    zoomLink: ''
  });
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  
  // Template Management State
  const [templateSourceDate, setTemplateSourceDate] = useState(formatDateForInput(new Date()));
  const [templateTargetDate, setTemplateTargetDate] = useState(formatDateForInput(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)));

  // Settings State
  const [citySearch, setCitySearch] = useState('');
  const [isSearchingCity, setIsSearchingCity] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  
  // Location Management State
  const [newLocationName, setNewLocationName] = useState('');
  const [newLocationAddress, setNewLocationAddress] = useState('');
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  
  // Payment Link State
  const [newPaymentTitle, setNewPaymentTitle] = useState('');
  const [newPaymentUrl, setNewPaymentUrl] = useState('');

  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [isZoomSession, setIsZoomSession] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const newUsers = users.filter(u => u.isNew);
  const existingUsers = users.filter(u => !u.isNew);

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

  const getDayName = (dateStr: string) => {
      return new Date(dateStr).toLocaleDateString('he-IL', { weekday: 'long' });
  };
  
  const handleExitClick = () => {
      setIsExiting(true);
      setTimeout(() => {
          onExitAdmin();
          setIsExiting(false);
      }, 800);
  };

  const handleUserSubmit = () => {
      if (!formUser.fullName || !formUser.phone) {
          alert('נא למלא שם וטלפון');
          return;
      }

      if (editingUserId) {
          onUpdateUser({
              ...formUser,
              id: editingUserId,
              fullName: formUser.fullName!,
              displayName: formUser.displayName || formUser.fullName!,
              phone: formUser.phone!,
              email: formUser.email || '',
              startDate: formUser.startDate!,
              paymentStatus: formUser.paymentStatus!,
              userColor: formUser.userColor,
              isNew: false 
          } as User);
          alert('פרטי משתמש עודכנו');
          setEditingUserId(null);
      } else {
          onAddUser({
              id: Date.now().toString(),
              fullName: formUser.fullName!,
              displayName: formUser.displayName || formUser.fullName!,
              phone: formUser.phone!,
              email: formUser.email || '',
              startDate: formUser.startDate!,
              paymentStatus: formUser.paymentStatus!,
              userColor: formUser.userColor,
              isNew: false
          } as User);
          alert('משתמש נוסף בהצלחה');
      }
      
      setFormUser({ 
          fullName: '', 
          displayName: '',
          phone: '', 
          email: '', 
          startDate: new Date().toISOString().split('T')[0], 
          paymentStatus: PaymentStatus.PAID,
          userColor: ''
      });
  };

  const handleEditUserClick = (user: User) => {
      setFormUser({ ...user });
      setEditingUserId(user.id);
      setActiveTab('users');
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  const handleDeleteUserClick = (userId: string) => {
      if(window.confirm('האם אתה בטוח שברצונך למחוק מתאמן זה? פעולה זו לא ניתנת לביטול.')) {
          onDeleteUser(userId);
      }
  };

  const handleApproveUser = (user: User) => {
      onUpdateUser({ ...user, isNew: false });
  };
  
  const handlePaymentStatusChange = (user: User, newStatus: PaymentStatus) => {
      onUpdateUser({ ...user, paymentStatus: newStatus });
  };

  const handleGenerateDescription = async () => {
    if (!newSession.type || !newSession.location) {
        alert('נא למלא סוג אימון ומיקום לפני שימוש ב-AI');
        return;
    }
    setIsGeneratingAi(true);
    const desc = await generateWorkoutDescription(newSession.type as any, newSession.location);
    setNewSession(prev => ({ ...prev, description: desc }));
    setIsGeneratingAi(false);
  };

  const handleSessionSubmit = () => {
      if (newSession.type && newSession.date && newSession.location) {
          if (editingSessionId) {
               onUpdateSession({
                  ...newSession,
                  id: editingSessionId,
                  type: newSession.type!,
                  date: newSession.date!,
                  time: newSession.time!,
                  location: newSession.location!,
                  maxCapacity: newSession.maxCapacity || 15,
                  description: newSession.description || '',
                  registeredPhoneNumbers: sessions.find(s => s.id === editingSessionId)?.registeredPhoneNumbers || [],
                  color: newSession.color || SESSION_COLORS[0],
                  isTrial: newSession.isTrial || false,
                  zoomLink: isZoomSession ? newSession.zoomLink : undefined
              } as TrainingSession);
              alert('האימון עודכן בהצלחה');
              setEditingSessionId(null);
          } else {
              onAddSession({
                  id: Date.now().toString(),
                  type: newSession.type!,
                  date: newSession.date!,
                  time: newSession.time!,
                  location: newSession.location!,
                  maxCapacity: newSession.maxCapacity || 15,
                  description: newSession.description || '',
                  registeredPhoneNumbers: [],
                  color: newSession.color || SESSION_COLORS[0],
                  isTrial: newSession.isTrial || false,
                  zoomLink: isZoomSession ? newSession.zoomLink : undefined
              } as TrainingSession);
              alert('אימון נוסף בהצלחה');
          }
          
          setNewSession({ 
              type: workoutTypes[0] || '', 
              date: newSession.date, 
              time: '18:00', 
              location: locations.length > 0 ? locations[0].name : '', 
              maxCapacity: 15, 
              description: '',
              color: SESSION_COLORS[0],
              isTrial: false,
              zoomLink: ''
          });
          setIsZoomSession(false);
      } else {
          alert('נא למלא את כל שדות החובה');
      }
  };

  const handleEditSessionClick = (session: TrainingSession) => {
      setNewSession({ ...session });
      setEditingSessionId(session.id);
      setIsZoomSession(!!session.zoomLink);
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEditSession = () => {
      setEditingSessionId(null);
      setNewSession({ 
          type: workoutTypes[0] || '', 
          date: new Date().toISOString().split('T')[0],
          time: '18:00', 
          location: locations.length > 0 ? locations[0].name : '', 
          maxCapacity: 15, 
          description: '',
          color: SESSION_COLORS[0],
          isTrial: false,
          zoomLink: ''
      });
      setIsZoomSession(false);
  };

  const handleDuplicateSession = (session: TrainingSession) => {
      const originalDate = new Date(session.date);
      const nextWeekDate = new Date(originalDate);
      nextWeekDate.setDate(originalDate.getDate() + 7);
      
      const duplicatedSession = {
          ...session,
          id: Date.now().toString(),
          date: nextWeekDate.toISOString().split('T')[0],
          registeredPhoneNumbers: [] 
      };
      onAddSession(duplicatedSession);
      alert(`האימון שוכפל בהצלחה לתאריך ${duplicatedSession.date}`);
  };

  const handleSaveTemplate = () => {
      const sourceDate = new Date(templateSourceDate);
      const startOfWeek = getSunday(sourceDate);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 6);

      const sessionsToSave = sessions.filter(s => {
          const sDate = new Date(s.date);
          return sDate >= startOfWeek && sDate <= endOfWeek;
      });

      if (sessionsToSave.length === 0) {
          alert('לא נמצאו אימונים בשבוע שנבחר לשמירה.');
          return;
      }

      const template = sessionsToSave.map(s => {
          const sDate = new Date(s.date);
          const dayIndex = sDate.getDay(); 
          return {
              ...s,
              dayIndex 
          };
      });

      localStorage.setItem('niv_app_week_template', JSON.stringify(template));
      alert(`נשמרה תבנית עם ${template.length} אימונים מהשבוע של ה-${startOfWeek.toLocaleDateString('he-IL')}`);
  };

  const handleLoadTemplate = () => {
      const templateStr = localStorage.getItem('niv_app_week_template');
      if (!templateStr) {
          alert('לא קיימת תבנית שמורה. אנא שמור שבוע לדוגמה קודם.');
          return;
      }

      if (!confirm('האם אתה בטוח שברצונך לייצר אימונים לשבוע שנבחר על בסיס התבנית?')) return;

      const template = JSON.parse(templateStr);
      const targetDate = new Date(templateTargetDate);
      const targetStartOfWeek = getSunday(targetDate);

      let addedCount = 0;
      template.forEach((t: any) => {
          const newDate = new Date(targetStartOfWeek);
          newDate.setDate(newDate.getDate() + t.dayIndex);
          const dateStr = newDate.toISOString().split('T')[0];

          const exists = sessions.some(s => s.date === dateStr && s.time === t.time && s.location === t.location);
          if (!exists) {
              const newSession: TrainingSession = {
                  id: Date.now().toString() + Math.random().toString().slice(2, 5),
                  type: t.type,
                  date: dateStr,
                  time: t.time,
                  location: t.location,
                  maxCapacity: t.maxCapacity,
                  description: t.description,
                  registeredPhoneNumbers: [],
                  color: t.color,
                  isTrial: t.isTrial,
                  zoomLink: t.zoomLink
              };
              onAddSession(newSession);
              addedCount++;
          }
      });

      alert(`נוספו ${addedCount} אימונים לשבוע של ה-${targetStartOfWeek.toLocaleDateString('he-IL')}`);
  };

  const handleSearchCity = async () => {
      if (!citySearch.trim()) return;
      setIsSearchingCity(true);
      const result = await getCityCoordinates(citySearch);
      setIsSearchingCity(false);
      
      if (result) {
          onUpdateWeatherLocation(result);
          setCitySearch('');
          alert(`המיקום עודכן בהצלחה ל-${result.name}`);
      } else {
          alert('עיר לא נמצאה, נסה שם אחר או שם באנגלית');
      }
  };

  const handleAddType = () => {
      if (newTypeName.trim() && !workoutTypes.includes(newTypeName.trim())) {
          onUpdateWorkoutTypes([...workoutTypes, newTypeName.trim()]);
          setNewTypeName('');
      }
  };

  const handleDeleteType = (e: React.MouseEvent, type: string) => {
      e.stopPropagation(); 
      e.preventDefault(); 
      if (confirm(`למחוק את סוג אימון "${type}"?`)) {
          onUpdateWorkoutTypes(workoutTypes.filter(t => t !== type));
      }
  };

  const handleLocationSubmit = () => {
      if (!newLocationName.trim() || !newLocationAddress.trim()) {
          alert('יש להזין שם מיקום וכתובת מלאה');
          return;
      }

      if (editingLocationId) {
          // Update existing location
          const updatedLocations = locations.map(loc => 
              loc.id === editingLocationId 
                  ? { ...loc, name: newLocationName.trim(), address: newLocationAddress.trim() }
                  : loc
          );
          onUpdateLocations(updatedLocations);
          setEditingLocationId(null);
          alert('המיקום עודכן בהצלחה');
      } else {
          // Add new location
          onUpdateLocations([...locations, { 
              id: Date.now().toString(), 
              name: newLocationName.trim(), 
              address: newLocationAddress.trim() 
          }]);
          alert('המיקום נוסף בהצלחה');
      }
      setNewLocationName('');
      setNewLocationAddress('');
  };

  const handleEditLocation = (loc: LocationDef) => {
      setNewLocationName(loc.name);
      setNewLocationAddress(loc.address);
      setEditingLocationId(loc.id);
  };

  const handleCancelLocationEdit = () => {
      setNewLocationName('');
      setNewLocationAddress('');
      setEditingLocationId(null);
  };

  const handleDeleteLocation = (e: React.MouseEvent, id: string) => {
       e.stopPropagation(); 
       e.preventDefault();
       if (confirm(`למחוק את המיקום הזה?`)) {
          onUpdateLocations(locations.filter(l => l.id !== id));
          if (editingLocationId === id) handleCancelLocationEdit();
      }
  };

  const handleAddPaymentLink = () => {
      if (newPaymentTitle.trim() && newPaymentUrl.trim()) {
          onAddPaymentLink({
              id: Date.now().toString(),
              title: newPaymentTitle.trim(),
              url: newPaymentUrl.trim()
          });
          setNewPaymentTitle('');
          setNewPaymentUrl('');
      } else {
          alert('יש להזין כותרת וקישור');
      }
  };

  const handleExportData = () => {
      const data = {
          users,
          sessions,
          workoutTypes,
          locations,
          weatherLocation,
          paymentLinks,
          exportDate: new Date().toISOString()
      };
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `niv_fitness_backup_${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };

  const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
          try {
              const content = e.target?.result as string;
              const data = JSON.parse(content);
              
              if (confirm('זהירות: טעינת נתונים תדרוס את המידע הקיים במכשיר זה. האם להמשיך?')) {
                  if (data.users) { 
                      data.users.forEach((u: User) => onUpdateUser(u)); 
                      localStorage.setItem('niv_app_users', JSON.stringify(data.users));
                  }
                  if (data.sessions) localStorage.setItem('niv_app_sessions', JSON.stringify(data.sessions));
                  if (data.workoutTypes) localStorage.setItem('niv_app_types', JSON.stringify(data.workoutTypes));
                  if (data.locations) localStorage.setItem('niv_app_locations', JSON.stringify(data.locations));
                  if (data.paymentLinks) localStorage.setItem('niv_app_payments', JSON.stringify(data.paymentLinks));
                  
                  alert('הנתונים נטענו בהצלחה! הדף יתרענן כעת.');
                  window.location.reload();
              }
          } catch (err) {
              console.error(err);
              alert('שגיאה בטעינת הקובץ. וודא שזהו קובץ גיבוי תקין.');
          }
      };
      reader.readAsText(file);
  };

  const filteredUsers = existingUsers.filter(user => {
      const matchesText = 
        user.fullName.includes(filterText) || 
        user.phone.includes(filterText) ||
        (user.email && user.email.includes(filterText));
      
      const matchesStatus = filterStatus === 'ALL' || user.paymentStatus === filterStatus;
      
      return matchesText && matchesStatus;
  }).sort((a, b) => {
      if (sortByWorkouts) {
          return getMonthlyWorkoutsCount(b.phone) - getMonthlyWorkoutsCount(a.phone);
      }
      if (a.paymentStatus === PaymentStatus.PENDING && b.paymentStatus !== PaymentStatus.PENDING) return -1;
      if (a.paymentStatus !== PaymentStatus.PENDING && b.paymentStatus === PaymentStatus.PENDING) return 1;
      return a.fullName.localeCompare(b.fullName);
  });

  const todayStr = new Date().toISOString().split('T')[0];
  const sortedSessions = sessions.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  const pastSessions = sortedSessions.filter(s => s.date < todayStr);
  const futureSessions = sortedSessions.filter(s => s.date >= todayStr);
  
  const recentPastSessions = pastSessions.filter(s => {
      const d = new Date(s.date);
      const limit = new Date();
      limit.setDate(limit.getDate() - 30);
      return d > limit;
  });

  return (
    <div className="p-4 bg-gray-900 rounded-lg">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-white">פאנל ניהול (מאמן)</h2>
        <button 
          onClick={handleExitClick}
          disabled={isExiting}
          className={`bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500 px-4 py-2 rounded-lg transition-all text-sm font-bold flex items-center gap-2 ${isExiting ? 'opacity-50 cursor-wait' : ''}`}
        >
          <span>{isExiting ? 'שומר ויוצא...' : 'יציאה ושמירה'}</span>
          {!isExiting && (
             <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
             </svg>
          )}
        </button>
      </div>
      
      <div className="flex gap-4 mb-6 overflow-x-auto no-scrollbar pb-2">
         {newUsers.length > 0 && (
            <button 
                onClick={() => setActiveTab('new_users')}
                className={`px-4 py-2 rounded whitespace-nowrap relative ${activeTab === 'new_users' ? 'bg-red-500 text-white' : 'bg-gray-700 text-gray-300'}`}
            >
                נרשמים חדשים
                <span className="absolute -top-2 -right-2 bg-white text-red-600 text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                    {newUsers.length}
                </span>
            </button>
        )}
        <button 
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded whitespace-nowrap ${activeTab === 'users' ? 'bg-brand-primary text-brand-black' : 'bg-gray-700 text-gray-300'}`}
        >
            מתאמנים
        </button>
        <button 
            onClick={() => setActiveTab('sessions')}
            className={`px-4 py-2 rounded whitespace-nowrap ${activeTab === 'sessions' ? 'bg-brand-primary text-brand-black' : 'bg-gray-700 text-gray-300'}`}
        >
            אימונים
        </button>
        <button 
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 rounded whitespace-nowrap ${activeTab === 'settings' ? 'bg-brand-primary text-brand-black' : 'bg-gray-700 text-gray-300'}`}
        >
            הגדרות ומוצרים
        </button>
      </div>

      {/* User Tab */}
      {activeTab === 'users' && (
         <div className="space-y-6">
            <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                <h3 className="text-lg font-bold text-white mb-4">
                    {editingUserId ? 'עריכת מתאמן' : 'הוספת מתאמן ידנית'}
                </h3>
                <div className="grid grid-cols-2 gap-3 mb-3">
                    <input 
                        type="text" placeholder="שם מלא"
                        className="p-3 rounded bg-gray-900 border border-gray-600 text-white"
                        value={formUser.fullName} onChange={e => setFormUser({...formUser, fullName: e.target.value})}
                    />
                    <input 
                        type="text" placeholder="כינוי (שם תצוגה)"
                        className="p-3 rounded bg-gray-900 border border-gray-600 text-white"
                        value={formUser.displayName || ''} 
                        onChange={e => setFormUser({...formUser, displayName: e.target.value})}
                    />
                    <input 
                        type="tel" placeholder="טלפון"
                        className="p-3 rounded bg-gray-900 border border-gray-600 text-white"
                        value={formUser.phone} onChange={e => setFormUser({...formUser, phone: e.target.value})}
                    />
                     <input 
                        type="email" placeholder="אימייל (אופציונלי)"
                        className="p-3 rounded bg-gray-900 border border-gray-600 text-white"
                        value={formUser.email} onChange={e => setFormUser({...formUser, email: e.target.value})}
                    />
                    <div className="col-span-2">
                        <label className="text-gray-400 text-sm block mb-1">צבע מתאמן</label>
                         <div className="flex gap-2 flex-wrap">
                            {USER_COLORS.map(color => (
                                <button
                                    key={color}
                                    type="button"
                                    onClick={() => setFormUser({...formUser, userColor: color})}
                                    className={`w-8 h-8 rounded-full border-2 transition-all ${formUser.userColor === color ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-50'}`}
                                    style={{ backgroundColor: color }}
                                />
                            ))}
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button onClick={handleUserSubmit} className="flex-1">
                        {editingUserId ? 'עדכן פרטים' : 'הוסף מתאמן'}
                    </Button>
                    {editingUserId && (
                        <Button variant="secondary" onClick={() => { setEditingUserId(null); setFormUser({ fullName: '', displayName: '', phone: '', email: '', startDate: new Date().toISOString().split('T')[0], paymentStatus: PaymentStatus.PAID, userColor: '' }); }}>
                            ביטול
                        </Button>
                    )}
                </div>
            </div>

            <div className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700">
                <div className="p-3 bg-gray-700 font-bold text-white flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                        <span>רשימת מתאמנים ({filteredUsers.length})</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
                        <input 
                            type="text" 
                            placeholder="חפש לפי שם או טלפון..." 
                            className="p-2 rounded bg-gray-900 border border-gray-600 text-white text-sm"
                            value={filterText}
                            onChange={e => setFilterText(e.target.value)}
                        />
                        <select 
                            className="p-2 rounded bg-gray-900 border border-gray-600 text-white text-sm"
                            value={filterStatus}
                            onChange={e => setFilterStatus(e.target.value as any)}
                        >
                            <option value="ALL">כל הסטטוסים</option>
                            <option value={PaymentStatus.PAID}>מנוי פעיל</option>
                            <option value={PaymentStatus.PENDING}>ממתין לתשלום</option>
                            <option value={PaymentStatus.OVERDUE}>חוב</option>
                        </select>
                        <button 
                            onClick={() => setSortByWorkouts(!sortByWorkouts)}
                            className={`p-2 rounded border text-sm transition-colors ${sortByWorkouts ? 'bg-brand-primary text-black border-brand-primary' : 'bg-gray-900 text-white border-gray-600'}`}
                        >
                            {sortByWorkouts ? 'ממוין לפי אימונים (גבוה לנמוך)' : 'מיין לפי אימונים'}
                        </button>
                    </div>
                </div>
                
                <div className="max-h-96 overflow-y-auto custom-scrollbar">
                    {filteredUsers.length === 0 ? (
                        <p className="p-4 text-center text-gray-500">לא נמצאו מתאמנים בסינון זה.</p>
                    ) : (
                        filteredUsers.map((user, idx) => (
                            <div 
                                key={user.id} 
                                className={`p-3 border-b border-gray-700 flex flex-col md:flex-row justify-between items-start md:items-center group ${user.paymentStatus === PaymentStatus.PENDING ? 'bg-yellow-500/10' : 'hover:bg-gray-700/50'}`}
                            >
                                <div className="flex items-center gap-3 mb-2 md:mb-0 w-full md:w-auto">
                                    <span className="text-gray-500 text-xs w-4">{idx + 1}</span>
                                    <div 
                                        className="w-8 h-8 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: user.userColor || '#374151' }}
                                    />
                                    <div className="flex-1">
                                        <div className="font-bold text-white flex items-center gap-2">
                                            {user.fullName}
                                            {user.displayName && <span className="text-xs text-gray-400">({user.displayName})</span>}
                                            {user.paymentStatus === PaymentStatus.PENDING && (
                                                <span className="text-[10px] bg-yellow-500 text-black px-1.5 rounded font-bold animate-pulse">ממתין לאישור תשלום</span>
                                            )}
                                        </div>
                                        <div className="text-xs text-gray-400">{user.phone}</div>
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
                                    <select 
                                        className={`text-xs p-1.5 rounded border ${
                                            user.paymentStatus === PaymentStatus.PAID ? 'bg-green-500/20 border-green-500/30 text-green-400' :
                                            user.paymentStatus === PaymentStatus.PENDING ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400' :
                                            'bg-red-500/20 border-red-500/30 text-red-400'
                                        }`}
                                        value={user.paymentStatus}
                                        onChange={(e) => handlePaymentStatusChange(user, e.target.value as PaymentStatus)}
                                    >
                                        <option value={PaymentStatus.PAID}>שולם / מנוי פעיל</option>
                                        <option value={PaymentStatus.PENDING}>דיווח תשלום (לא מאושר)</option>
                                        <option value={PaymentStatus.OVERDUE}>חוב / לא שולם</option>
                                    </select>

                                    <div className="text-center px-2">
                                        <span className="block text-xs text-gray-400">אימונים החודש</span>
                                        <span className="font-bold text-brand-primary">{getMonthlyWorkoutsCount(user.phone)}</span>
                                    </div>
                                    <button 
                                        onClick={() => handleEditUserClick(user)}
                                        className="bg-gray-600 hover:bg-gray-500 text-white p-2 rounded text-xs transition-colors"
                                    >
                                        ערוך
                                    </button>
                                    <button 
                                        onClick={() => handleDeleteUserClick(user.id)}
                                        className="bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white p-2 rounded text-xs transition-colors"
                                        title="מחק מתאמן"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
      )}
      
      {activeTab === 'new_users' && (
           <div className="space-y-4">
               <h3 className="text-xl text-white">בקשות הצטרפות חדשות</h3>
               {newUsers.length === 0 ? (
                   <p className="text-gray-500">אין בקשות חדשות</p>
               ) : (
                   newUsers.map(user => (
                       <div key={user.id} className="bg-gray-800 p-4 rounded-xl border border-gray-700 flex justify-between items-center">
                           <div>
                               <p className="font-bold text-white text-lg">{user.fullName}</p>
                               <p className="text-gray-400">{user.phone}</p>
                               <p className="text-gray-500 text-sm">{user.email}</p>
                           </div>
                           <div className="flex gap-2">
                               <Button size="sm" onClick={() => handleApproveUser(user)}>אשר</Button>
                               <Button size="sm" variant="danger" onClick={() => handleDeleteUserClick(user.id)}>דחה</Button>
                           </div>
                       </div>
                   ))
               )}
           </div>
      )}

      {activeTab === 'settings' && (
          <div className="space-y-8">
              
              {/* Payment Links Settings */}
              <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                  <h3 className="text-xl text-brand-primary mb-3">ניהול תשלומים (לינקים)</h3>
                  <div className="flex flex-col gap-2 mb-4">
                      <input 
                        type="text" 
                        placeholder="שם המוצר (לדוגמה: כרטיסייה 10 כניסות)"
                        className="p-3 rounded bg-gray-900 border border-gray-600 text-white"
                        value={newPaymentTitle}
                        onChange={(e) => setNewPaymentTitle(e.target.value)}
                      />
                      <input 
                        type="url" 
                        placeholder="קישור לתשלום (Bit/Paybox/אשראי)"
                        className="p-3 rounded bg-gray-900 border border-gray-600 text-white text-left"
                        style={{ direction: 'ltr' }}
                        value={newPaymentUrl}
                        onChange={(e) => setNewPaymentUrl(e.target.value)}
                      />
                      <Button onClick={handleAddPaymentLink} size="sm">הוסף מוצר</Button>
                  </div>
                  <div className="flex flex-col gap-2 max-h-48 overflow-y-auto custom-scrollbar">
                      {paymentLinks.map(link => (
                          <div key={link.id} className="flex items-center justify-between bg-gray-700 px-4 py-3 rounded text-white text-sm">
                              <div>
                                  <div className="font-bold">{link.title}</div>
                                  <div className="text-xs text-gray-400 truncate max-w-[200px]">{link.url}</div>
                              </div>
                              <button 
                                type="button" 
                                onClick={() => onDeletePaymentLink(link.id)} 
                                className="bg-red-500/20 text-red-300 p-1.5 rounded hover:bg-red-500 hover:text-white transition-colors"
                              >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                              </button>
                          </div>
                      ))}
                      {paymentLinks.length === 0 && <p className="text-gray-500 text-sm italic">אין מוצרים לתשלום</p>}
                  </div>
              </div>

              {/* Color Settings */}
              <div>
                  <h3 className="text-xl text-brand-primary mb-3">צבע ראשי לאפליקציה</h3>
                  <div className="grid grid-cols-4 gap-4">
                      {SESSION_COLORS.map(color => (
                          <button
                            key={color}
                            onClick={() => onColorChange(color)}
                            className={`h-12 w-full rounded-lg border-2 transition-transform hover:scale-105 ${primaryColor === color ? 'border-white' : 'border-transparent'}`}
                            style={{ backgroundColor: color }}
                          />
                      ))}
                      <div className="col-span-4 mt-2">
                          <label className="text-gray-400 text-sm mb-1 block">בחירה מותאמת אישית</label>
                          <input 
                            type="color" 
                            value={primaryColor}
                            onChange={(e) => onColorChange(e.target.value)}
                            className="w-full h-10 rounded cursor-pointer"
                          />
                      </div>
                  </div>
              </div>

              {/* Weather Location Settings */}
              <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                  <h3 className="text-xl text-brand-primary mb-3">איזור אימונים (מזג אוויר)</h3>
                  <p className="text-gray-400 text-sm mb-2">מיקום נוכחי: <strong>{weatherLocation.name}</strong></p>
                  <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="חפש עיר (לדוגמה: תל אביב)"
                        className="flex-1 p-3 rounded bg-gray-900 border border-gray-600 text-white"
                        value={citySearch}
                        onChange={(e) => setCitySearch(e.target.value)}
                      />
                      <Button onClick={handleSearchCity} isLoading={isSearchingCity} variant="secondary">
                          עדכן
                      </Button>
                  </div>
              </div>

              {/* Manage Workout Types */}
              <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                  <h3 className="text-xl text-brand-primary mb-3">ניהול סוגי אימון</h3>
                  <div className="flex gap-2 mb-4">
                      <input 
                        type="text" 
                        placeholder="סוג אימון חדש"
                        className="flex-1 p-3 rounded bg-gray-900 border border-gray-600 text-white"
                        value={newTypeName}
                        onChange={(e) => setNewTypeName(e.target.value)}
                      />
                      <Button onClick={handleAddType} size="sm">הוסף</Button>
                  </div>
                  <div className="flex flex-col gap-2 max-h-48 overflow-y-auto custom-scrollbar">
                      {workoutTypes.map(type => (
                          <div key={type} className="flex items-center justify-between bg-gray-700 px-4 py-3 rounded text-white text-sm">
                              <span>{type}</span>
                              <button 
                                type="button" 
                                onClick={(e) => handleDeleteType(e, type)} 
                                className="bg-red-500/20 text-red-300 p-1.5 rounded hover:bg-red-500 hover:text-white transition-colors"
                                title="מחק סוג אימון"
                              >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                              </button>
                          </div>
                      ))}
                  </div>
              </div>

               {/* Manage Locations */}
              <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                  <h3 className="text-xl text-brand-primary mb-3">ניהול מיקומים וכתובות</h3>
                  <div className="flex flex-col gap-2 mb-4">
                      <input 
                        type="text" 
                        placeholder="שם המיקום (מה שרואה המתאמן)"
                        className="p-3 rounded bg-gray-900 border border-gray-600 text-white"
                        value={newLocationName}
                        onChange={(e) => setNewLocationName(e.target.value)}
                      />
                      <input 
                        type="text" 
                        placeholder="כתובת פיזית (עבור Waze)"
                        className="p-3 rounded bg-gray-900 border border-gray-600 text-white"
                        value={newLocationAddress}
                        onChange={(e) => setNewLocationAddress(e.target.value)}
                      />
                      <div className="flex gap-2">
                          <Button onClick={handleLocationSubmit} size="sm" className="flex-1">
                              {editingLocationId ? 'עדכן מיקום' : 'הוסף מיקום'}
                          </Button>
                          {editingLocationId && (
                              <Button onClick={handleCancelLocationEdit} size="sm" variant="secondary">
                                  ביטול
                              </Button>
                          )}
                      </div>
                  </div>
                  <div className="flex flex-col gap-2 max-h-48 overflow-y-auto custom-scrollbar">
                      {locations.map(loc => (
                          <div key={loc.id} className="flex items-center justify-between bg-gray-700 px-4 py-3 rounded text-white text-sm">
                              <div>
                                  <span className="font-bold block">{loc.name}</span>
                                  <span className="text-xs text-gray-400 block">{loc.address}</span>
                              </div>
                              <div className="flex gap-2">
                                  <button 
                                    type="button" 
                                    onClick={() => handleEditLocation(loc)} 
                                    className="bg-blue-500/20 text-blue-300 p-1.5 rounded hover:bg-blue-500 hover:text-white transition-colors"
                                    title="ערוך מיקום"
                                  >
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                      </svg>
                                  </button>
                                  <button 
                                    type="button" 
                                    onClick={(e) => handleDeleteLocation(e, loc.id)} 
                                    className="bg-red-500/20 text-red-300 p-1.5 rounded hover:bg-red-500 hover:text-white transition-colors"
                                    title="מחק מיקום"
                                  >
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                  </button>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {activeTab === 'sessions' && (
        <div className="space-y-8">
            {/* Template Management */}
            <div className="bg-gray-800 p-5 rounded-xl border border-gray-700 shadow-lg">
                <h3 className="text-xl font-bold text-white mb-4 border-b border-gray-700 pb-2">ניהול תבנית שבועית</h3>
                <div className="grid md:grid-cols-2 gap-6">
                    {/* Save Template Section */}
                    <div className="bg-gray-900/50 p-4 rounded-lg">
                        <label className="text-gray-400 text-sm block mb-2">1. בחר שבוע מקור לשמירה כתבנית</label>
                        <div className="flex gap-2 items-center">
                            <input 
                                type="date" 
                                className="p-2 rounded bg-gray-800 border border-gray-600 text-white text-sm"
                                value={templateSourceDate}
                                onChange={(e) => setTemplateSourceDate(e.target.value)}
                            />
                            <Button size="sm" onClick={handleSaveTemplate} variant="secondary">
                                שמור תבנית
                            </Button>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                            זה ישמור את מבנה האימונים (ימים, שעות, סוגים) של השבוע שנבחר כתבנית קבועה.
                        </p>
                    </div>

                    {/* Load Template Section */}
                    <div className="bg-gray-900/50 p-4 rounded-lg">
                        <label className="text-gray-400 text-sm block mb-2">2. החל תבנית על שבוע יעד</label>
                        <div className="flex gap-2 items-center">
                            <input 
                                type="date" 
                                className="p-2 rounded bg-gray-800 border border-gray-600 text-white text-sm"
                                value={templateTargetDate}
                                onChange={(e) => setTemplateTargetDate(e.target.value)}
                            />
                            <Button size="sm" onClick={handleLoadTemplate}>
                                טען תבנית
                            </Button>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                            זה ייצר אימונים חדשים בשבוע שנבחר על בסיס התבנית השמורה האחרונה.
                        </p>
                    </div>
                </div>
            </div>

            {/* Edit / Create Session Form */}
            <div className="bg-gray-800 p-5 rounded-xl border border-gray-700">
                <h3 className="text-xl text-brand-primary mb-4">{editingSessionId ? 'עריכת אימון' : 'יצירת אימון חדש'}</h3>
                <div className="grid gap-3">
                    <div className="grid grid-cols-2 gap-2">
                        <select 
                            className="p-3 rounded bg-gray-800 border border-gray-700 text-white"
                            value={newSession.type} onChange={e => setNewSession({...newSession, type: e.target.value})}
                        >
                             <option value="" disabled>בחר סוג אימון</option>
                            {workoutTypes.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <input 
                            type="number" placeholder="מקסימום מתאמנים" className="p-3 rounded bg-gray-800 border border-gray-700 text-white"
                            value={newSession.maxCapacity} onChange={e => setNewSession({...newSession, maxCapacity: parseInt(e.target.value)})}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <input 
                          type="date"
                          className="p-3 rounded bg-gray-800 border border-gray-700 text-white"
                          value={newSession.date} 
                          onChange={e => setNewSession({...newSession, date: e.target.value})}
                        />
                        <input 
                            type="time" className="p-3 rounded bg-gray-800 border border-gray-700 text-white"
                            value={newSession.time} onChange={e => setNewSession({...newSession, time: e.target.value})}
                        />
                    </div>
                    
                    {/* Location Selection */}
                    <select 
                        className="p-3 rounded bg-gray-800 border border-gray-700 text-white"
                        value={newSession.location} onChange={e => setNewSession({...newSession, location: e.target.value})}
                    >
                        <option value="" disabled>בחר מיקום</option>
                        {locations.map(loc => <option key={loc.id} value={loc.name}>{loc.name}</option>)}
                    </select>

                    {/* Session Color Picker */}
                    <div>
                        <label className="text-gray-400 text-sm mb-2 block">צבע האימון (משפיע על עיצוב הכרטיס)</label>
                        <div className="flex gap-2 flex-wrap mb-4">
                            {SESSION_COLORS.map(color => (
                                <button
                                    key={color}
                                    type="button"
                                    onClick={() => setNewSession({...newSession, color})}
                                    className={`w-8 h-8 rounded-full border-2 transition-all ${newSession.color === color ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-70'}`}
                                    style={{ backgroundColor: color }}
                                />
                            ))}
                        </div>
                        
                        <div className="flex gap-4">
                             {/* Zoom Toggle */}
                             <label className="flex items-center gap-3 bg-gray-800 p-3 rounded cursor-pointer border border-gray-700 hover:border-gray-500 transition-colors flex-1">
                                <div className="relative inline-block w-10 h-6 align-middle select-none transition duration-200 ease-in">
                                    <input 
                                        type="checkbox" 
                                        name="isZoom" 
                                        id="isZoom" 
                                        className="absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer peer checked:right-0 right-4"
                                        style={{ right: isZoomSession ? '0' : 'auto', left: isZoomSession ? 'auto' : '0' }}
                                        checked={isZoomSession}
                                        onChange={e => {
                                            setIsZoomSession(e.target.checked);
                                            if (!e.target.checked) setNewSession({ ...newSession, zoomLink: '' });
                                        }}
                                    />
                                    <label htmlFor="isZoom" className={`block overflow-hidden h-6 rounded-full cursor-pointer ${isZoomSession ? 'bg-blue-600' : 'bg-gray-600'}`}></label>
                                </div>
                                <span className="text-white font-bold select-none text-sm">אימון ZOOM</span>
                            </label>
                        </div>

                        {/* Zoom Link Input (Conditional) */}
                        {isZoomSession && (
                            <div className="mt-2 animate-in fade-in slide-in-from-top-2">
                                 <input 
                                    type="url" 
                                    placeholder="הדבק כאן את הקישור ל-Zoom" 
                                    className="w-full p-3 rounded bg-blue-900/20 border border-blue-500/50 text-white placeholder-blue-300/50"
                                    value={newSession.zoomLink} 
                                    onChange={e => setNewSession({...newSession, zoomLink: e.target.value})}
                                />
                            </div>
                        )}
                    </div>
                    
                    <div className="flex gap-2 mt-2">
                        <input 
                            type="text" placeholder="תיאור (אופציונלי)" className="p-3 rounded bg-gray-800 border border-gray-700 text-white flex-grow"
                            value={newSession.description} onChange={e => setNewSession({...newSession, description: e.target.value})}
                        />
                        <Button variant="secondary" onClick={handleGenerateDescription} isLoading={isGeneratingAi} type="button">
                            ✨ נסח בעזרת AI
                        </Button>
                    </div>
                    
                    <div className="flex gap-2">
                        <Button onClick={handleSessionSubmit} className="flex-1">{editingSessionId ? 'עדכן אימון' : 'צור אימון'}</Button>
                        {editingSessionId && (
                            <Button variant="secondary" onClick={handleCancelEditSession} className="flex-1">ביטול עריכה</Button>
                        )}
                    </div>
                </div>
            </div>

            <h3 className="text-xl text-brand-primary">רשימת אימונים</h3>
            <div className="bg-gray-800 rounded p-2 max-h-[600px] overflow-y-auto no-scrollbar space-y-4">
                
                {/* Past Sessions Group */}
                {/* Past Sessions Group */}
                {/* Simplified logic for rendering - ensuring we access session.id correctly */}
                {sessions
                    .filter(s => s.date < new Date().toISOString().split('T')[0])
                    .filter(s => {
                         const d = new Date(s.date);
                         const limit = new Date();
                         limit.setDate(limit.getDate() - 30);
                         return d > limit;
                    })
                    .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .length > 0 && (
                    <div className="opacity-70 border-b border-gray-700 pb-4">
                        <h4 className="text-gray-500 text-sm font-bold mb-2 sticky top-0 bg-gray-800 z-10 p-1">אימונים שהיו (30 ימים אחרונים)</h4>
                        <div className="space-y-2">
                            {sessions
                                .filter(s => s.date < new Date().toISOString().split('T')[0])
                                .filter(s => {
                                     const d = new Date(s.date);
                                     const limit = new Date();
                                     limit.setDate(limit.getDate() - 30);
                                     return d > limit;
                                })
                                .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                .map(s => (
                                <div key={s.id} className="flex justify-between items-center border border-gray-700 bg-gray-800/50 p-2 rounded relative grayscale-[50%] hover:grayscale-0 transition-all">
                                    <div className="pl-2 pr-3 relative z-10">
                                        <div className="font-bold text-gray-300 flex items-center gap-2">
                                            {s.type}
                                            <span className="text-xs bg-gray-700 px-1 rounded">הסתיים</span>
                                        </div>
                                        <div className="text-xs text-gray-400 font-mono">
                                            {getDayName(s.date)} | {s.date} | {s.time}
                                        </div>
                                        <div className="text-xs text-gray-500">{s.location}</div>
                                    </div>
                                    <div className="flex gap-2 relative z-10">
                                        <button 
                                            onClick={() => handleEditSessionClick(s)}
                                            className="bg-gray-700 text-gray-300 px-3 py-1 rounded text-sm hover:bg-gray-600 transition-colors"
                                        >
                                            ערוך
                                        </button>
                                        <Button variant="danger" size="sm" onClick={() => onDeleteSession(s.id)}>מחק</Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Future Sessions Group */}
                <div>
                     <h4 className="text-brand-primary text-sm font-bold mb-2 sticky top-0 bg-gray-800 z-10 p-1">אימונים עתידיים</h4>
                     <div className="space-y-2">
                        {sessions
                            .filter(s => s.date >= new Date().toISOString().split('T')[0])
                            .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                            .map(s => (
                            <div key={s.id} className="flex justify-between items-center border border-gray-700 p-2 rounded relative overflow-hidden hover:border-brand-primary/50 transition-colors">
                                <div 
                                    className="absolute inset-0 opacity-10 pointer-events-none" 
                                    style={{ backgroundColor: s.color || 'transparent' }}
                                ></div>
                                <div 
                                    className="absolute right-0 top-0 bottom-0 w-1.5" 
                                    style={{ backgroundColor: s.color || 'transparent' }}
                                ></div>

                                <div className="pl-2 pr-3 relative z-10">
                                    <div className="font-bold text-white flex items-center gap-2">
                                        {s.type}
                                        {s.isTrial && <span className="text-[10px] bg-purple-600 text-white px-1.5 rounded-full">ניסיון</span>}
                                        {s.zoomLink && <span className="text-[10px] bg-blue-600 text-white px-1.5 rounded-full">ZOOM</span>}
                                    </div>
                                    <div className="text-xs text-brand-primary font-bold font-mono mt-0.5">
                                        {getDayName(s.date)} | {s.date} | {s.time}
                                    </div>
                                    <div className="text-xs text-gray-500">{s.location}</div>
                                </div>
                                <div className="flex gap-2 relative z-10">
                                    <button 
                                        onClick={() => handleEditSessionClick(s)}
                                        className="bg-gray-600 text-white px-3 py-1 rounded text-sm hover:bg-gray-500 transition-colors"
                                    >
                                        ערוך
                                    </button>
                                    <button 
                                        onClick={() => handleDuplicateSession(s)}
                                        className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-500 transition-colors"
                                        title="שכפל לשבוע הבא"
                                    >
                                        שכפל
                                    </button>
                                    <Button variant="danger" size="sm" onClick={() => onDeleteSession(s.id)}>מחק</Button>
                                </div>
                            </div>
                        ))}
                         {sessions.filter(s => s.date >= new Date().toISOString().split('T')[0]).length === 0 && <p className="text-gray-500 text-sm italic">אין אימונים עתידיים</p>}
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};