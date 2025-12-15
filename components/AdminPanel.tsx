import React, { useState } from 'react';
import { User, TrainingSession, PaymentStatus, WeatherLocation, PaymentLink } from '../types';
import { Button } from './Button';
import { generateWorkoutDescription } from '../services/geminiService';
import { getCityCoordinates } from '../services/weatherService';

interface AdminPanelProps {
  users: User[];
  sessions: TrainingSession[];
  primaryColor: string;
  workoutTypes: string[];
  locations: string[];
  weatherLocation: WeatherLocation;
  paymentLinks: PaymentLink[];
  onAddUser: (user: User) => void;
  onUpdateUser: (user: User) => void;
  onDeleteUser: (userId: string) => void; // Added Delete User Prop
  onAddSession: (session: TrainingSession) => void;
  onUpdateSession: (session: TrainingSession) => void;
  onDeleteSession: (id: string) => void;
  onColorChange: (color: string) => void;
  onUpdateWorkoutTypes: (types: string[]) => void;
  onUpdateLocations: (locations: string[]) => void;
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
    onDeleteUser, // Destructure
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
    phone: '',
    email: '',
    startDate: new Date().toISOString().split('T')[0],
    paymentStatus: PaymentStatus.PAID
  });
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  // Session Form State
  const [newSession, setNewSession] = useState<Partial<TrainingSession>>({
    type: workoutTypes[0] || '',
    date: new Date().toISOString().split('T')[0],
    time: '18:00',
    location: locations[0] || '',
    maxCapacity: 15,
    description: '',
    color: SESSION_COLORS[0],
    isTrial: false
  });
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  
  // Settings State
  const [citySearch, setCitySearch] = useState('');
  const [isSearchingCity, setIsSearchingCity] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [newLocationName, setNewLocationName] = useState('');
  
  // Payment Link State
  const [newPaymentTitle, setNewPaymentTitle] = useState('');
  const [newPaymentUrl, setNewPaymentUrl] = useState('');

  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  const newUsers = users.filter(u => u.isNew);
  const existingUsers = users.filter(u => !u.isNew);

  // Helper to generate upcoming days for the select dropdown
  const getUpcomingDaysOptions = () => {
    const options = [];
    const today = new Date();
    // Generate options for the next 21 days (3 weeks)
    for (let i = 0; i < 21; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        const dayName = date.toLocaleDateString('he-IL', { weekday: 'long' });
        const formattedDate = date.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });
        
        // Add "Today" and "Tomorrow" labels
        let labelPrefix = '';
        if (i === 0) labelPrefix = 'היום - ';
        else if (i === 1) labelPrefix = 'מחר - ';

        options.push({ 
            value: dateStr, 
            label: `${labelPrefix}${dayName} (${formattedDate})` 
        });
    }
    return options;
  };

  const dateOptions = getUpcomingDaysOptions();

  // Helper to count workouts for a user in the current month
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

  const handleUserSubmit = () => {
      if (!formUser.fullName || !formUser.phone) {
          alert('נא למלא שם וטלפון');
          return;
      }

      if (editingUserId) {
          // Update existing user
          onUpdateUser({
              ...formUser,
              id: editingUserId,
              fullName: formUser.fullName!,
              displayName: formUser.displayName || formUser.fullName!,
              phone: formUser.phone!,
              email: formUser.email || '',
              startDate: formUser.startDate!,
              paymentStatus: formUser.paymentStatus!,
              isNew: false // Explicitly remove new flag if editing
          } as User);
          alert('פרטי משתמש עודכנו');
          setEditingUserId(null);
      } else {
          // Add new user
          onAddUser({
              id: Date.now().toString(),
              fullName: formUser.fullName!,
              displayName: formUser.fullName!,
              phone: formUser.phone!,
              email: formUser.email || '',
              startDate: formUser.startDate!,
              paymentStatus: formUser.paymentStatus!,
              isNew: false
          } as User);
          alert('משתמש נוסף בהצלחה');
      }
      
      // Reset form
      setFormUser({ 
          fullName: '', 
          phone: '', 
          email: '', 
          startDate: new Date().toISOString().split('T')[0], 
          paymentStatus: PaymentStatus.PAID 
      });
  };

  const handleEditUserClick = (user: User) => {
      setFormUser({ ...user });
      setEditingUserId(user.id);
      setActiveTab('users'); // Switch to main user tab to edit
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

  const handleGenerateDescription = async () => {
    if (!newSession.type || !newSession.location) {
        alert('נא למלא סוג אימון ומיקום לפני שימוש ב-AI');
        return;
    }
    setIsGeneratingAi(true);
    // Cast to string as workoutTypes is now string[] but generateWorkoutDescription expects specific type or string
    const desc = await generateWorkoutDescription(newSession.type as any, newSession.location);
    setNewSession(prev => ({ ...prev, description: desc }));
    setIsGeneratingAi(false);
  };

  const handleSessionSubmit = () => {
      if (newSession.type && newSession.date && newSession.location) {
          if (editingSessionId) {
              // Update Session
               onUpdateSession({
                  ...newSession,
                  id: editingSessionId,
                  type: newSession.type!,
                  date: newSession.date!,
                  time: newSession.time!,
                  location: newSession.location!,
                  maxCapacity: newSession.maxCapacity || 15,
                  description: newSession.description || '',
                  // Preserve existing registered users if updating
                  registeredPhoneNumbers: sessions.find(s => s.id === editingSessionId)?.registeredPhoneNumbers || [],
                  color: newSession.color || SESSION_COLORS[0],
                  isTrial: newSession.isTrial || false
              } as TrainingSession);
              alert('האימון עודכן בהצלחה');
              setEditingSessionId(null);
          } else {
              // Create Session
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
                  isTrial: newSession.isTrial || false
              } as TrainingSession);
              alert('אימון נוסף בהצלחה');
          }
          
          // Reset form (keep date partially useful or reset to today)
          setNewSession({ 
              type: workoutTypes[0] || '', 
              date: newSession.date, 
              time: '18:00', 
              location: locations[0] || '', 
              maxCapacity: 15, 
              description: '',
              color: SESSION_COLORS[0],
              isTrial: false
          });
      } else {
          alert('נא למלא את כל שדות החובה');
      }
  };

  const handleEditSessionClick = (session: TrainingSession) => {
      setNewSession({ ...session });
      setEditingSessionId(session.id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEditSession = () => {
      setEditingSessionId(null);
      setNewSession({ 
          type: workoutTypes[0] || '', 
          date: new Date().toISOString().split('T')[0],
          time: '18:00', 
          location: locations[0] || '', 
          maxCapacity: 15, 
          description: '',
          color: SESSION_COLORS[0],
          isTrial: false
      });
  };

  const handleDuplicateSession = (session: TrainingSession) => {
      const originalDate = new Date(session.date);
      const nextWeekDate = new Date(originalDate);
      nextWeekDate.setDate(originalDate.getDate() + 7);
      
      const duplicatedSession = {
          ...session,
          id: Date.now().toString(),
          date: nextWeekDate.toISOString().split('T')[0], // Set automatically to next week
          registeredPhoneNumbers: [] // Start with empty list
      };
      onAddSession(duplicatedSession);
      alert(`האימון שוכפל בהצלחה לתאריך ${duplicatedSession.date}`);
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
      e.stopPropagation(); // Stop click from bubbling up
      e.preventDefault(); // Prevent form submission
      if (confirm(`למחוק את סוג האימון "${type}"?`)) {
          onUpdateWorkoutTypes(workoutTypes.filter(t => t !== type));
      }
  };

  const handleAddLocation = () => {
      if (newLocationName.trim() && !locations.includes(newLocationName.trim())) {
          onUpdateLocations([...locations, newLocationName.trim()]);
          setNewLocationName('');
      }
  };

  const handleDeleteLocation = (e: React.MouseEvent, loc: string) => {
       e.stopPropagation(); // Stop click from bubbling up
       e.preventDefault(); // Prevent form submission
       if (confirm(`למחוק את המיקום "${loc}"?`)) {
          onUpdateLocations(locations.filter(l => l !== loc));
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

  // Sort existing users based on monthly workout count descending
  const sortedExistingUsers = [...existingUsers].sort((a, b) => {
      const countA = getMonthlyWorkoutsCount(a.phone);
      const countB = getMonthlyWorkoutsCount(b.phone);
      return countB - countA;
  });

  return (
    <div className="p-4 bg-gray-900 rounded-lg">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-white">פאנל ניהול (מאמן)</h2>
        <button 
          onClick={onExitAdmin}
          className="bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500 px-4 py-2 rounded-lg transition-all text-sm font-bold flex items-center gap-2"
        >
          <span>יציאה</span>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
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
                        type="tel" placeholder="טלפון"
                        className="p-3 rounded bg-gray-900 border border-gray-600 text-white"
                        value={formUser.phone} onChange={e => setFormUser({...formUser, phone: e.target.value})}
                    />
                     <input 
                        type="email" placeholder="אימייל (אופציונלי)"
                        className="p-3 rounded bg-gray-900 border border-gray-600 text-white"
                        value={formUser.email} onChange={e => setFormUser({...formUser, email: e.target.value})}
                    />
                    <select 
                        className="p-3 rounded bg-gray-900 border border-gray-600 text-white"
                        value={formUser.paymentStatus} onChange={e => setFormUser({...formUser, paymentStatus: e.target.value as PaymentStatus})}
                    >
                        <option value={PaymentStatus.PAID}>שולם</option>
                        <option value={PaymentStatus.PENDING}>ממתין לתשלום</option>
                        <option value={PaymentStatus.OVERDUE}>חוב</option>
                    </select>
                </div>
                <div className="flex gap-2">
                    <Button onClick={handleUserSubmit} className="flex-1">
                        {editingUserId ? 'עדכן פרטים' : 'הוסף מתאמן'}
                    </Button>
                    {editingUserId && (
                        <Button variant="secondary" onClick={() => { setEditingUserId(null); setFormUser({ fullName: '', phone: '', email: '', startDate: new Date().toISOString().split('T')[0], paymentStatus: PaymentStatus.PAID }); }}>
                            ביטול
                        </Button>
                    )}
                </div>
            </div>

            <div className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700">
                <div className="p-3 bg-gray-700 font-bold text-white flex justify-between">
                    <span>רשימת מתאמנים ({sortedExistingUsers.length})</span>
                </div>
                <div className="max-h-96 overflow-y-auto custom-scrollbar">
                    {sortedExistingUsers.map((user, idx) => (
                        <div key={user.id} className="p-3 border-b border-gray-700 hover:bg-gray-700/50 flex justify-between items-center group">
                            <div className="flex items-center gap-3">
                                <span className="text-gray-500 text-xs w-4">{idx + 1}</span>
                                <div>
                                    <div className="font-bold text-white">{user.fullName}</div>
                                    <div className="text-xs text-gray-400">{user.phone}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
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
                    ))}
                </div>
            </div>
        </div>
      )}
      
      {/* (Other tabs 'new_users', 'settings', 'sessions' are rendered below...) */}
      
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
                  <h3 className="text-xl text-brand-primary mb-3">ניהול מיקומים</h3>
                  <div className="flex gap-2 mb-4">
                      <input 
                        type="text" 
                        placeholder="מיקום חדש"
                        className="flex-1 p-3 rounded bg-gray-900 border border-gray-600 text-white"
                        value={newLocationName}
                        onChange={(e) => setNewLocationName(e.target.value)}
                      />
                      <Button onClick={handleAddLocation} size="sm">הוסף</Button>
                  </div>
                  <div className="flex flex-col gap-2 max-h-48 overflow-y-auto custom-scrollbar">
                      {locations.map(loc => (
                          <div key={loc} className="flex items-center justify-between bg-gray-700 px-4 py-3 rounded text-white text-sm">
                              <span>{loc}</span>
                              <button 
                                type="button" 
                                onClick={(e) => handleDeleteLocation(e, loc)} 
                                className="bg-red-500/20 text-red-300 p-1.5 rounded hover:bg-red-500 hover:text-white transition-colors"
                                title="מחק מיקום"
                              >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                              </button>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {activeTab === 'sessions' && (
        <div className="space-y-4">
            <h3 className="text-xl text-brand-primary">{editingSessionId ? 'עריכת אימון' : 'יצירת אימון חדש'}</h3>
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
                     <select 
                        className="p-3 rounded bg-gray-800 border border-gray-700 text-white"
                        value={newSession.date} 
                        onChange={e => setNewSession({...newSession, date: e.target.value})}
                     >
                         {dateOptions.map(opt => (
                             <option key={opt.value} value={opt.value}>{opt.label}</option>
                         ))}
                     </select>
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
                    {locations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
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
                    
                    {/* Trial Session Toggle */}
                    <label className="flex items-center gap-3 bg-gray-800 p-3 rounded cursor-pointer border border-gray-700 hover:border-gray-500 transition-colors">
                        <div className="relative inline-block w-10 h-6 align-middle select-none transition duration-200 ease-in">
                            <input 
                                type="checkbox" 
                                name="isTrial" 
                                id="isTrial" 
                                className="absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer peer checked:right-0 right-4"
                                style={{ right: newSession.isTrial ? '0' : 'auto', left: newSession.isTrial ? 'auto' : '0' }}
                                checked={newSession.isTrial || false}
                                onChange={e => setNewSession({...newSession, isTrial: e.target.checked})}
                            />
                            <label htmlFor="isTrial" className={`block overflow-hidden h-6 rounded-full cursor-pointer ${newSession.isTrial ? 'bg-brand-primary' : 'bg-gray-600'}`}></label>
                        </div>
                        <span className="text-white font-bold select-none">הגדר כאימון ניסיון</span>
                    </label>
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

            <h3 className="text-xl text-brand-primary mt-8">אימונים קרובים</h3>
            <div className="bg-gray-800 rounded p-2 max-h-96 overflow-y-auto no-scrollbar space-y-2">
                {sessions.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(s => (
                    <div 
                        key={s.id} 
                        className="flex justify-between items-center border border-gray-700 p-2 rounded relative overflow-hidden" 
                    >
                        {/* Background color tint for session color visibility */}
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
                            </div>
                            <div className="text-xs text-gray-400">{s.date} | {s.time}</div>
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
            </div>
        </div>
      )}
    </div>
  );
};