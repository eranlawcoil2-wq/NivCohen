import React, { useState, useMemo, useEffect } from 'react';
import { User, TrainingSession, PaymentStatus, WeatherLocation, PaymentLink, LocationDef, AppConfig, Quote, WeatherInfo } from '../types';
import { Button } from './Button';
import { generateWorkoutDescription } from '../services/geminiService';
import { getCityCoordinates } from '../services/weatherService';
import { supabase } from '../services/supabaseClient';
import { SessionCard } from './SessionCard';

interface AdminPanelProps {
  users: User[];
  sessions: TrainingSession[];
  primaryColor: string;
  workoutTypes: string[];
  locations: LocationDef[];
  weatherLocation: WeatherLocation;
  weatherData?: Record<string, WeatherInfo>;
  paymentLinks: PaymentLink[];
  streakGoal: number; 
  appConfig: AppConfig;
  quotes?: Quote[];
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
  onUpdateStreakGoal: (goal: number) => void;
  onUpdateAppConfig: (config: AppConfig) => void;
  onAddQuote?: (text: string) => void;
  onDeleteQuote?: (id: string) => void;
  onExitAdmin: () => void;
}

const SESSION_COLORS = [
    '#A3E635', '#3B82F6', '#EF4444', '#F59E0B', 
    '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'
];

const SQL_SCRIPT = `
-- (SQL Script Content Omitted for brevity, assuming database is set up or user copies from previous context if needed)
-- Standard tables creation for users, sessions, config_locations, config_general, etc.
`;

const getSunday = (d: Date) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day; 
  return new Date(date.setDate(diff));
};

const formatDateForInput = (date: Date) => date.toISOString().split('T')[0];

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

const getPaymentStatusText = (status: PaymentStatus) => {
    switch (status) {
        case PaymentStatus.PAID: return 'שולם';
        case PaymentStatus.PENDING: return 'בהמתנה';
        case PaymentStatus.OVERDUE: return 'חוב';
        default: return status;
    }
};

const getPaymentStatusColor = (status: PaymentStatus) => {
    switch (status) {
        case PaymentStatus.PAID: return 'bg-green-500/20 text-green-400';
        case PaymentStatus.PENDING: return 'bg-yellow-500/20 text-yellow-400';
        case PaymentStatus.OVERDUE: return 'bg-red-500/20 text-red-400';
        default: return 'text-gray-400';
    }
};

const downloadIcsFile = (session: TrainingSession, coachName: string) => {
    const startTime = new Date(`${session.date}T${session.time}`);
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); 

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

export const AdminPanel: React.FC<AdminPanelProps> = ({ 
    users, sessions, primaryColor, workoutTypes, locations, weatherLocation, weatherData,
    paymentLinks, streakGoal, appConfig, quotes = [], onAddUser, onUpdateUser, onDeleteUser, 
    onAddSession, onUpdateSession, onDeleteSession, onColorChange,
    onUpdateWorkoutTypes, onUpdateLocations, onUpdateWeatherLocation,
    onAddPaymentLink, onDeletePaymentLink, onUpdateStreakGoal, onUpdateAppConfig, 
    onAddQuote, onDeleteQuote, onExitAdmin
}) => {
  const [activeTab, setActiveTab] = useState<'attendance' | 'users' | 'settings' | 'new_users' | 'connections'>('attendance');
  
  // User Form State
  const [formUser, setFormUser] = useState<Partial<User>>({
    fullName: '', displayName: '', phone: '', email: '',
    startDate: new Date().toISOString().split('T')[0],
    paymentStatus: PaymentStatus.PAID, userColor: '#A3E635', monthlyRecord: 0,
    isRestricted: false,
    healthDeclarationId: '',
    healthDeclarationDate: ''
  });
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  // User Filter & Sort State
  const [filterText, setFilterText] = useState('');
  const [sortKey, setSortKey] = useState<'fullName' | 'streak' | 'monthCount' | 'record' | 'payment' | 'health'>('fullName');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  // Template & Settings State
  const [copySourceDate, setCopySourceDate] = useState(formatDateForInput(new Date()));
  const [copyTargetDate, setCopyTargetDate] = useState(formatDateForInput(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)));
  const [citySearch, setCitySearch] = useState('');
  const [isSearchingCity, setIsSearchingCity] = useState(false);
  const [newQuoteText, setNewQuoteText] = useState('');

  // --- Settings Editing State ---
  const [newTypeName, setNewTypeName] = useState('');
  const [editingTypeOriginalName, setEditingTypeOriginalName] = useState<string | null>(null);

  const [newLocationName, setNewLocationName] = useState('');
  const [newLocationAddress, setNewLocationAddress] = useState('');
  const [newLocationColor, setNewLocationColor] = useState('#3B82F6');
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);

  const [newPaymentTitle, setNewPaymentTitle] = useState('');
  const [newPaymentUrl, setNewPaymentUrl] = useState('');
  
  // App Config Form
  const [tempConfig, setTempConfig] = useState<AppConfig>(appConfig);
  
  // --- SYNC CONFIG WHEN LOADED ---
  // This useEffect ensures that when the appConfig is fetched from the server/localstorage asynchronously,
  // the form updates to reflect the saved values instead of sticking to the initial defaults.
  useEffect(() => {
      setTempConfig(appConfig);
  }, [appConfig]);

  // Cloud Config State
  const [sbUrl, setSbUrl] = useState(localStorage.getItem('niv_app_supabase_url') || '');
  const [sbKey, setSbKey] = useState(localStorage.getItem('niv_app_supabase_key') || '');

  // Attendance & Session Edit State
  const [weekOffset, setWeekOffset] = useState(0);
  const [attendanceSession, setAttendanceSession] = useState<TrainingSession | null>(null);
  const [markedAttendees, setMarkedAttendees] = useState<Set<string>>(new Set());
  const [isEditingInModal, setIsEditingInModal] = useState(false);
  const [editSessionForm, setEditSessionForm] = useState<Partial<TrainingSession>>({});

  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [isProcessingCopy, setIsProcessingCopy] = useState(false);

  const newUsers = users.filter(u => u.isNew);
  const existingUsers = users.filter(u => !u.isNew);

  const getMonthlyWorkoutsCount = (userPhone: string) => {
    if (!userPhone) return 0;
    const normalizedPhone = normalizePhone(userPhone);
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    return sessions.filter(session => {
        const sessionDate = new Date(session.date);
        
        // Correct logic: If attended list exists, check it. If not, use registered.
        const hasAttendedList = session.attendedPhoneNumbers !== undefined && session.attendedPhoneNumbers !== null;
        let didAttend = false;
        
        if (hasAttendedList) {
            didAttend = session.attendedPhoneNumbers!.includes(normalizedPhone);
        } else {
            didAttend = session.registeredPhoneNumbers.includes(normalizedPhone);
        }

        return (
            sessionDate.getMonth() === currentMonth &&
            sessionDate.getFullYear() === currentYear &&
            didAttend
        );
    }).length;
  };

  const calculateStreak = (phone: string) => {
      if (!sessions || sessions.length === 0 || !phone) return 0;
      const normalized = normalizePhone(phone);
      
      const userSessions = sessions.filter(s => {
         const hasAttendedList = s.attendedPhoneNumbers !== undefined && s.attendedPhoneNumbers !== null;
         if (hasAttendedList) {
             return s.attendedPhoneNumbers!.includes(normalized);
         } else {
             return s.registeredPhoneNumbers?.includes(normalized);
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
      const day = today.getDay();
      const diff = today.getDate() - day;
      let checkDate = new Date(today.setDate(diff));
      checkDate.setHours(0,0,0,0);

      while(true) {
          const key = checkDate.toISOString().split('T')[0];
          const count = weeks[key] || 0;
          if (count >= 3) { currentStreak++; } 
          else {
              if (checkDate.getTime() < new Date().setHours(0,0,0,0) - 7 * 24 * 60 * 60 * 1000) { 
                 if (count < 3 && currentStreak > 0) break;
              }
          }
          checkDate.setDate(checkDate.getDate() - 7);
          if (checkDate.getFullYear() < 2023) break;
      }
      return currentStreak;
  };

  const sortedAndFilteredUsers = useMemo(() => {
      let result = existingUsers.filter(u => 
          u.fullName.includes(filterText) || u.phone.includes(filterText)
      );

      return result.sort((a, b) => {
          let valA: any = a.fullName;
          let valB: any = b.fullName;

          if (sortKey === 'streak') {
              valA = calculateStreak(a.phone);
              valB = calculateStreak(b.phone);
          } else if (sortKey === 'monthCount') {
              valA = getMonthlyWorkoutsCount(a.phone);
              valB = getMonthlyWorkoutsCount(b.phone);
          } else if (sortKey === 'record') {
              valA = Math.max(a.monthlyRecord || 0, getMonthlyWorkoutsCount(a.phone));
              valB = Math.max(b.monthlyRecord || 0, getMonthlyWorkoutsCount(b.phone));
          } else if (sortKey === 'payment') {
              valA = a.paymentStatus;
              valB = b.paymentStatus;
          } else if (sortKey === 'health') {
              valA = a.healthDeclarationDate ? 2 : (a.healthDeclarationFile ? 1 : 0);
              valB = b.healthDeclarationDate ? 2 : (b.healthDeclarationFile ? 1 : 0);
          }

          if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
          if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
          return 0;
      });
  }, [existingUsers, filterText, sortKey, sortDirection, sessions]);

  const handleSort = (key: 'fullName' | 'streak' | 'monthCount' | 'record' | 'payment' | 'health') => {
      if (sortKey === key) {
          setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
      } else {
          setSortKey(key);
          setSortDirection('desc');
      }
  };

  const getDayName = (dateStr: string) => new Date(dateStr).toLocaleDateString('he-IL', { weekday: 'long' });
  
  const handleAddOrUpdateType = () => { 
      if (!newTypeName.trim()) return;
      if (editingTypeOriginalName) {
           const updatedTypes = workoutTypes.map(t => t === editingTypeOriginalName ? newTypeName.trim() : t);
           onUpdateWorkoutTypes(updatedTypes);
           setEditingTypeOriginalName(null);
      } else {
          if (!workoutTypes.includes(newTypeName.trim())) { 
            onUpdateWorkoutTypes([...workoutTypes, newTypeName.trim()]); 
          }
      }
      setNewTypeName(''); 
  };

  const handleEditType = (type: string) => {
      setNewTypeName(type);
      setEditingTypeOriginalName(type);
  };

  const handleDeleteType = (type: string) => { 
      if (confirm(`למחוק את סוג האימון "${type}"?`)) { onUpdateWorkoutTypes(workoutTypes.filter(t => t !== type)); } 
  };

  const handleAddOrUpdateLocation = () => {
      if (newLocationName.trim()) {
          const locData: LocationDef = {
              id: editingLocationId || Date.now().toString(),
              name: newLocationName.trim(),
              address: newLocationAddress.trim() || newLocationName.trim(),
              color: newLocationColor
          };
          if (editingLocationId) {
               const updated = locations.map(l => l.id === editingLocationId ? locData : l);
               onUpdateLocations(updated);
               setEditingLocationId(null);
          } else {
               onUpdateLocations([...locations, locData]);
          }
          setNewLocationName(''); setNewLocationAddress(''); setNewLocationColor('#3B82F6');
      }
  };

  const handleEditLocation = (loc: LocationDef) => {
      setNewLocationName(loc.name);
      setNewLocationAddress(loc.address);
      setNewLocationColor(loc.color || '#3B82F6');
      setEditingLocationId(loc.id);
  };

  const handleDeleteLocation = (id: string) => { if (confirm('למחוק מיקום זה?')) { onUpdateLocations(locations.filter(l => l.id !== id)); } };

  const handleSaveAppConfig = () => {
      onUpdateAppConfig(tempConfig);
      alert('פרטי מאמן נשמרו בהצלחה!');
  };

  const handleAddQuoteClick = () => {
      if (!newQuoteText.trim()) return;
      if (onAddQuote) {
          onAddQuote(newQuoteText.trim());
          setNewQuoteText('');
      }
  };
  
  const handleResetCache = () => {
      if(confirm('פעולה זו תנקה את זכרון המטמון של הדפדפן בלבד, כדי לפתור בעיות תצוגה. הנתונים בשרת יישמרו. האם להמשיך?')) {
          // Only clear local storage cache, do not call save back to server logic here.
          localStorage.removeItem('niv_app_locations');
          localStorage.removeItem('niv_app_types');
          // Reload page to re-fetch from server
          window.location.reload();
      }
  };

  const getCurrentWeekDates = (offset: number) => {
    const curr = new Date();
    const day = curr.getDay();
    const diff = curr.getDate() - day + (offset * 7);
    const startOfWeek = new Date(curr.setDate(diff));
    const arr = [];
    for(let i=0; i<7; i++) {
        const d = new Date(startOfWeek);
        d.setDate(d.getDate() + i);
        arr.push(d.toISOString().split('T')[0]);
    }
    return arr;
  };

  const weekDates = getCurrentWeekDates(weekOffset);
  const groupedSessions = sessions.reduce((acc, session) => {
      const date = session.date;
      if (!acc[date]) acc[date] = [];
      acc[date].push(session);
      return acc;
  }, {} as Record<string, TrainingSession[]>);

  const openAttendanceModal = (session: TrainingSession) => {
      setAttendanceSession(session);
      setIsEditingInModal(false); 
      let initialSet: Set<string>;
      // If attendance list doesn't exist yet, assume all registered are attending (auto V)
      if (session.attendedPhoneNumbers === undefined || session.attendedPhoneNumbers === null) {
          initialSet = new Set(session.registeredPhoneNumbers);
      } else {
          initialSet = new Set(session.attendedPhoneNumbers);
      }
      setMarkedAttendees(initialSet);
  };

  const toggleAttendance = (phone: string) => {
      const newSet = new Set(markedAttendees);
      if (newSet.has(phone)) newSet.delete(phone);
      else newSet.add(phone);
      setMarkedAttendees(newSet);
  };

  const saveAttendance = async () => {
      if (!attendanceSession) return;
      const updatedSession: TrainingSession = {
          ...attendanceSession,
          attendedPhoneNumbers: Array.from(markedAttendees)
      };
      await onUpdateSession(updatedSession);
      alert('נוכחות אושרה ועודכנה! ✅');
      setAttendanceSession(null);
  };
  
  const handleAddToCalendar = () => {
      if (!attendanceSession) return;
      downloadIcsFile(attendanceSession, appConfig.coachNameHeb);
  };

  const handleEditFromAttendance = () => {
      if(!attendanceSession) return;
      setEditSessionForm({ ...attendanceSession });
      setIsEditingInModal(true);
  };

  const handleSaveEditedSession = async () => {
      if (!editSessionForm.id || !editSessionForm.type || !editSessionForm.date) return;
      
      const sessionToSave = { 
          ...attendanceSession, 
          ...editSessionForm,
          registeredPhoneNumbers: attendanceSession?.registeredPhoneNumbers || [],
          attendedPhoneNumbers: attendanceSession?.attendedPhoneNumbers || [],
      } as TrainingSession;

      if (!sessionToSave.id) {
           sessionToSave.id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
      }

      const isExistingSession = sessions.some(s => s.id === sessionToSave.id);

      try {
          if (isExistingSession) {
              await onUpdateSession(sessionToSave);
              alert('האימון עודכן בהצלחה! ✅');
          } else {
              await onAddSession(sessionToSave);
              alert('אימון חדש נשמר בשרת בהצלחה! 🎉');
          }
          setAttendanceSession(null);
          setIsEditingInModal(false);
      } catch (error: any) {
          alert('שגיאה בשמירה: ' + (error.message || ''));
      }
  };

  const handleDuplicateFromAttendance = async () => {
      if(!attendanceSession) return;
      const [h, m] = attendanceSession.time.split(':').map(Number);
      const dateObj = new Date();
      dateObj.setHours(h, m);
      dateObj.setHours(dateObj.getHours() + 1);
      const newTime = dateObj.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      
      const uniqueId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
      
      const newSession: TrainingSession = { 
          ...attendanceSession, 
          id: uniqueId, 
          date: attendanceSession.date, 
          time: newTime,
          registeredPhoneNumbers: [], 
          attendedPhoneNumbers: [],
          isHidden: attendanceSession.isHidden,
          isCancelled: false 
      };
      
      try {
        await onAddSession(newSession);
        alert(`האימון שוכפל לשעה ${newTime}`);
        setAttendanceSession(null);
      } catch (error: any) {
         alert('שגיאה בשכפול: ' + (error.message || ''));
      }
  };

  const handleDeleteFromAttendance = async () => {
      if(!attendanceSession) return;
      if(confirm('האם אתה בטוח שברצונך למחוק אימון זה?')) {
          await onDeleteSession(attendanceSession.id);
          setAttendanceSession(null);
      }
  };
  
  const handleGenerateDescription = async () => {
      if (!editSessionForm.type || !editSessionForm.location) {
          alert('נא למלא סוג אימון ומיקום');
          return;
      }
      setIsGeneratingAi(true);
      try {
        const desc = await generateWorkoutDescription(editSessionForm.type as any, editSessionForm.location);
        setEditSessionForm(prev => ({ ...prev, description: desc }));
      } catch (error) { console.error(error); } finally { setIsGeneratingAi(false); }
  };

  const handleSaveCloudConfig = () => {
      if (!sbUrl || !sbKey) { alert('נא להזין URL ו-Key'); return; }
      localStorage.setItem('niv_app_supabase_url', sbUrl);
      localStorage.setItem('niv_app_supabase_key', sbKey);
      alert('הגדרות נשמרו. הטעינה תתבצע מחדש.');
      window.location.reload();
  };
  
  const handleClearCloudConfig = () => {
      if(confirm('האם למחוק את חיבור הענן ולחזור למצב מקומי?')) {
          localStorage.removeItem('niv_app_supabase_url');
          localStorage.removeItem('niv_app_supabase_key');
          setSbUrl(''); setSbKey(''); window.location.reload();
      }
  };

  const handleUserSubmit = () => {
      if (!formUser.fullName || !formUser.phone) { alert('נא למלא שם וטלפון'); return; }
      const userData = {
          id: editingUserId || Date.now().toString(),
          fullName: formUser.fullName!,
          displayName: formUser.displayName || formUser.fullName!,
          phone: formUser.phone!,
          email: formUser.email || '',
          startDate: formUser.startDate!,
          paymentStatus: formUser.paymentStatus!,
          userColor: formUser.userColor || '#A3E635',
          monthlyRecord: formUser.monthlyRecord || 0,
          isNew: false,
          isRestricted: formUser.isRestricted || false,
          healthDeclarationFile: formUser.healthDeclarationFile,
          healthDeclarationDate: formUser.healthDeclarationDate,
          healthDeclarationId: formUser.healthDeclarationId
      } as User;

      if (editingUserId) { onUpdateUser(userData); alert('פרטי משתמש עודכנו'); setEditingUserId(null); } 
      else { onAddUser(userData); alert('משתמש נוסף בהצלחה'); }
      setFormUser({ fullName: '', displayName: '', phone: '', email: '', startDate: new Date().toISOString().split('T')[0], paymentStatus: PaymentStatus.PAID, userColor: '#A3E635', monthlyRecord: 0, isRestricted: false, healthDeclarationFile: undefined, healthDeclarationId: '', healthDeclarationDate: '' });
  };

  const handleEditUserClick = (user: User) => {
      setFormUser({ ...user }); setEditingUserId(user.id); setActiveTab('users'); window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  const handleDeleteUserClick = (userId: string) => { if(window.confirm('למחוק מתאמן זה?')) onDeleteUser(userId); };
  const handleApproveUser = (user: User) => onUpdateUser({ ...user, isNew: false });

  const handleCopyWeek = async () => {
      if (!confirm(`האם אתה בטוח שברצונך להעתיק את כל האימונים מהשבוע של ${copySourceDate} לשבוע של ${copyTargetDate}?`)) return;
      
      setIsProcessingCopy(true);
      try {
          const sourceStart = getSunday(new Date(copySourceDate));
          const sourceEnd = new Date(sourceStart);
          sourceEnd.setDate(sourceEnd.getDate() + 6);
          sourceEnd.setHours(23, 59, 59, 999);

          const targetStart = getSunday(new Date(copyTargetDate));

          const sessionsToCopy = sessions.filter(s => {
              const d = new Date(s.date);
              return d >= sourceStart && d <= sourceEnd;
          });

          if (sessionsToCopy.length === 0) {
              alert('לא נמצאו אימונים להעתיק בשבוע המקור.');
              setIsProcessingCopy(false);
              return;
          }

          let count = 0;
          for (const s of sessionsToCopy) {
              const sDate = new Date(s.date);
              const dayDiff = sDate.getDay();
              
              const newDate = new Date(targetStart);
              newDate.setDate(newDate.getDate() + dayDiff);
              const newDateStr = newDate.toISOString().split('T')[0];
              
              const uniqueId = Date.now().toString() + Math.random().toString(36).substr(2, 9) + count;

              const exists = sessions.some(existing => 
                  existing.date === newDateStr && 
                  existing.time === s.time && 
                  existing.location === s.location
              );

              if (!exists) {
                  await onAddSession({
                      ...s,
                      id: uniqueId,
                      date: newDateStr,
                      registeredPhoneNumbers: [],
                      attendedPhoneNumbers: [],
                      isHidden: s.isHidden,
                      isCancelled: false
                  });
                  count++;
              }
          }
          alert(`הועתקו בהצלחה ${count} אימונים לשבוע של ${targetStart.toLocaleDateString()}`);
          window.location.reload();
      } catch (e) {
          console.error(e);
          alert('שגיאה בהעתקת השבוע');
      } finally {
          setIsProcessingCopy(false);
      }
  };

  const handleSearchCity = async () => {
      if (!citySearch.trim()) return;
      setIsSearchingCity(true);
      const result = await getCityCoordinates(citySearch);
      setIsSearchingCity(false);
      if (result) { onUpdateWeatherLocation(result); setCitySearch(''); alert('מיקום עודכן'); } 
      else alert('עיר לא נמצאה');
  };

  const handleAddPaymentLink = () => { if(newPaymentTitle && newPaymentUrl) { onAddPaymentLink({ id: Date.now().toString(), title: newPaymentTitle, url: newPaymentUrl }); setNewPaymentTitle(''); setNewPaymentUrl(''); } };
  const handleCopySql = () => { navigator.clipboard.writeText(SQL_SCRIPT).then(() => alert('הועתק ללוח')); };

  const handleQuickAddSession = () => {
      const today = new Date().toISOString().split('T')[0];
      const newSession: TrainingSession = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 5), 
          type: workoutTypes[0] || 'אימון',
          date: today,
          time: '18:00',
          location: locations[0]?.name || '',
          maxCapacity: 15,
          registeredPhoneNumbers: [],
          attendedPhoneNumbers: [],
          description: '',
          color: SESSION_COLORS[0],
          isHidden: false,
          isCancelled: false
      };
      setAttendanceSession(newSession); 
      setEditSessionForm(newSession);   
      setIsEditingInModal(true);        
  };

  return (
    <div className="p-4 bg-gray-900 rounded-lg pb-24">
      <div className="flex justify-between items-center mb-4 sticky top-0 bg-gray-900 z-10 py-2 border-b border-gray-800">
        <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-white">פאנל ניהול</h2>
        </div>
        <div className="flex gap-2">
            <button onClick={onExitAdmin} className={`bg-green-500 hover:bg-green-600 text-white border border-green-600 px-6 py-2 rounded-lg transition-all text-sm font-bold flex items-center gap-2 shadow-lg`}>
               חזרה לאתר 🏠
            </button>
        </div>
      </div>
      
      <div className="flex gap-4 mb-6 overflow-x-auto no-scrollbar pb-2">
         {['attendance', 'users', 'settings', 'connections'].map(tab => (
             <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-4 py-2 rounded whitespace-nowrap ${activeTab === tab ? 'bg-brand-primary text-brand-black' : 'bg-gray-700 text-gray-300'}`}>
                 {tab === 'attendance' ? 'יומן ונוכחות' : tab === 'users' ? 'מתאמנים' : tab === 'settings' ? 'הגדרות' : 'חיבורים'}
             </button>
         ))}
         {newUsers.length > 0 && <button onClick={() => setActiveTab('new_users')} className="px-4 py-2 rounded whitespace-nowrap bg-red-500 text-white relative">חדשים ({newUsers.length})</button>}
      </div>

      {activeTab === 'attendance' && (
          <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 relative">
              <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold text-white">יומן אימונים</h3>
                  <Button size="sm" onClick={handleQuickAddSession} className="text-xs">+ אימון חדש</Button>
              </div>
              <div className="flex gap-2 mb-4 justify-center">
                  <button onClick={() => setWeekOffset(prev => prev - 1)} className="px-3 py-1 bg-gray-700 rounded text-white text-xs">שבוע קודם</button>
                  <span className="text-white text-sm font-bold pt-1">{weekOffset === 0 ? 'השבוע' : weekOffset}</span>
                  <button onClick={() => setWeekOffset(prev => prev + 1)} className="px-3 py-1 bg-gray-700 rounded text-white text-xs">שבוע הבא</button>
              </div>

              <div className="grid gap-4">
                  {weekDates.map((date) => {
                      const daySessions = groupedSessions[date] || [];
                      const isToday = new Date().toISOString().split('T')[0] === date;
                      return (
                          <div key={date} className={`rounded-xl overflow-hidden border ${isToday ? 'border-brand-primary/50 bg-gray-800/50' : 'border-gray-700 bg-gray-900/30'}`}>
                              <div className="flex flex-col md:flex-row h-full">
                                  <div className={`p-4 md:w-32 text-center border-b md:border-b-0 md:border-l border-gray-700 ${isToday ? 'bg-brand-primary/10 text-brand-primary' : 'bg-gray-800 text-gray-400'}`}>
                                      <p className="text-lg font-black">{getDayName(date)}</p>
                                      <p className="text-sm opacity-70">{new Date(date).getDate()}/{new Date(date).getMonth()+1}</p>
                                  </div>
                                  <div className="flex-1 p-3">
                                      {daySessions.length > 0 ? (
                                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                              {daySessions.sort((a,b) => a.time.localeCompare(b.time)).map(session => (
                                                  <div key={session.id} onClick={() => openAttendanceModal(session)}>
                                                      <SessionCard 
                                                        session={session} 
                                                        allUsers={users} 
                                                        isRegistered={false} 
                                                        onRegisterClick={() => openAttendanceModal(session)} 
                                                        onViewDetails={() => openAttendanceModal(session)} 
                                                        locations={locations}
                                                        weather={weatherData ? weatherData[session.date] : undefined} // Pass weather
                                                        isAdmin={true} // Enable admin styling
                                                      />
                                                  </div>
                                              ))}
                                          </div>
                                      ) : <div className="text-center text-gray-600 text-sm py-4">אין אימונים</div>}
                                  </div>
                              </div>
                          </div>
                      );
                  })}
              </div>
          </div>
      )}
      
      {/* Attendance Modal */}
      {attendanceSession && (
         <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setAttendanceSession(null)}>
            <div className="bg-gray-800 p-6 rounded-2xl w-full max-w-lg border border-gray-700 flex flex-col max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                 {isEditingInModal ? (
                      <div className="space-y-4">
                          <h3 className="text-xl font-bold text-white mb-2">עריכת אימון</h3>
                          <div className="grid grid-cols-2 gap-2">
                              <select className="bg-gray-900 text-white p-3 rounded border border-gray-700" value={editSessionForm.type} onChange={e=>setEditSessionForm({...editSessionForm, type: e.target.value})}>
                                  {workoutTypes.map(t=><option key={t} value={t}>{t}</option>)}
                              </select>
                              <select className="bg-gray-900 text-white p-3 rounded border border-gray-700" value={editSessionForm.location} onChange={e=>setEditSessionForm({...editSessionForm, location: e.target.value})}>
                                  {locations.map(l=><option key={l.id} value={l.name}>{l.name}</option>)}
                              </select>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                              <input type="date" className="bg-gray-900 text-white p-3 rounded border border-gray-700" value={editSessionForm.date} onChange={e=>setEditSessionForm({...editSessionForm, date: e.target.value})}/>
                              <input type="time" className="bg-gray-900 text-white p-3 rounded border border-gray-700" value={editSessionForm.time} onChange={e=>setEditSessionForm({...editSessionForm, time: e.target.value})}/>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                              <div className="flex flex-col gap-2">
                                  <div className="flex items-center bg-gray-900 p-2 rounded border border-gray-700">
                                      <input type="checkbox" checked={editSessionForm.isZoomSession || false} onChange={e=>setEditSessionForm({...editSessionForm, isZoomSession: e.target.checked})} className="w-5 h-5 mr-2"/>
                                      <span className="text-white text-sm">אימון זום</span>
                                  </div>
                                  <div className="flex items-center bg-gray-900 p-2 rounded border border-gray-700">
                                      <input type="checkbox" checked={editSessionForm.isHidden || false} onChange={e=>setEditSessionForm({...editSessionForm, isHidden: e.target.checked})} className="w-5 h-5 mr-2 accent-purple-500"/>
                                      <span className="text-white text-sm font-bold text-purple-400">אימון נסתר (רואה רק מאמן)</span>
                                  </div>
                              </div>
                              
                              <div className="flex flex-col gap-2 h-full justify-between">
                                  <input type="number" placeholder="מקסימום משתתפים" className="bg-gray-900 text-white p-3 rounded border border-gray-700" value={editSessionForm.maxCapacity} onChange={e=>setEditSessionForm({...editSessionForm, maxCapacity: parseInt(e.target.value)})}/>
                                  <div className="flex items-center bg-red-900/30 p-2 rounded border border-red-800">
                                      <input type="checkbox" checked={editSessionForm.isCancelled || false} onChange={e=>setEditSessionForm({...editSessionForm, isCancelled: e.target.checked})} className="w-5 h-5 mr-2 accent-red-500"/>
                                      <span className="text-red-300 text-sm font-bold">אימון מבוטל</span>
                                  </div>
                              </div>
                          </div>
                          
                          <div className="flex items-center bg-green-900/30 p-2 rounded border border-green-800">
                              <input type="checkbox" checked={editSessionForm.manualHasStarted || false} onChange={e=>setEditSessionForm({...editSessionForm, manualHasStarted: e.target.checked})} className="w-5 h-5 mr-2 accent-green-500"/>
                              <span className="text-green-300 text-sm font-bold">סמן כמתקיים כעת (ידני)</span>
                          </div>

                          {editSessionForm.isZoomSession && (
                             <input type="text" placeholder="לינק לזום" className="w-full bg-gray-900 text-white p-3 rounded border border-gray-700 dir-ltr" value={editSessionForm.zoomLink || ''} onChange={e=>setEditSessionForm({...editSessionForm, zoomLink: e.target.value})}/>
                          )}
                          <div className="flex gap-2">
                              <textarea placeholder="תיאור האימון..." className="w-full bg-gray-900 text-white p-3 rounded border border-gray-700 h-24" value={editSessionForm.description || ''} onChange={e=>setEditSessionForm({...editSessionForm, description: e.target.value})}/>
                              <Button variant="secondary" onClick={handleGenerateDescription} isLoading={isGeneratingAi} className="h-24 px-2">AI ✨</Button>
                          </div>
                          
                          <div className="flex gap-2 pt-2 border-t border-gray-700 mt-4">
                              <Button onClick={handleSaveEditedSession} className="flex-1 py-3 text-lg">עדכן פרטים ושמור 💾</Button>
                              <Button variant="secondary" onClick={()=>setIsEditingInModal(false)} className="px-4">ביטול</Button>
                          </div>
                      </div>
                  ) : (
                      <>
                          <div className="flex justify-between items-start mb-4 border-b border-gray-700 pb-2">
                             <div>
                                <h3 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
                                    {attendanceSession.type}
                                    {attendanceSession.isHidden && <span className="text-xs bg-purple-600 text-white px-2 py-0.5 rounded-full">👻 נסתר</span>}
                                    {attendanceSession.isCancelled && <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded-full">🚫 מבוטל</span>}
                                    {attendanceSession.manualHasStarted && <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded-full">🟢 מתקיים (ידני)</span>}
                                </h3>
                                <p className="text-brand-primary font-mono">{attendanceSession.time} | {attendanceSession.location}</p>
                                <p className="text-xs text-gray-500 mt-1">{attendanceSession.date}</p>
                             </div>
                             <button onClick={() => setAttendanceSession(null)} className="text-gray-400 hover:text-white text-xl">✕</button>
                          </div>
                          
                          <div className="flex gap-2 mb-4 bg-gray-900 p-2 rounded-lg">
                              <button onClick={handleEditFromAttendance} className="bg-red-600 hover:bg-red-700 text-white text-xs py-2 px-3 rounded flex-1 border border-red-800 transition-colors font-bold shadow-md">✏️ ערוך פרטים</button>
                              <button onClick={handleDuplicateFromAttendance} className="bg-red-600 hover:bg-red-700 text-white text-xs py-2 px-3 rounded flex-1 border border-red-800 transition-colors font-bold shadow-md">📄 שכפל (+1 שעה)</button>
                              <button onClick={handleDeleteFromAttendance} className="bg-red-600 hover:bg-red-700 text-white text-xs py-2 px-3 rounded flex-1 border border-red-800 transition-colors font-bold shadow-md">🗑️ מחק</button>
                          </div>
                          
                          <div className="mb-4">
                              <Button size="sm" variant="secondary" onClick={handleAddToCalendar} className="w-full text-xs gap-2">📅 הוסף ליומן (קובץ) {appConfig.coachNameHeb}</Button>
                          </div>

                          <div className="flex-1 overflow-y-auto space-y-2 mb-4 bg-gray-900/50 p-2 rounded max-h-52">
                              <div className="text-xs text-gray-400 mb-2 sticky top-0 bg-gray-900 p-1">סימון נוכחות ({markedAttendees.size}/{attendanceSession.registeredPhoneNumbers.length}):</div>
                              {attendanceSession.registeredPhoneNumbers.length === 0 ? <p className="text-center text-gray-500 py-4">אין נרשמים</p> :
                                  attendanceSession.registeredPhoneNumbers.map(phone => {
                                      const user = users.find(u => u.phone.replace(/\D/g,'') === phone.replace(/\D/g,''));
                                      const isMarked = markedAttendees.has(phone);
                                      return (
                                          <div key={phone} className={`flex items-center justify-between p-3 rounded border transition-colors ${isMarked ? 'bg-green-900/30 border-green-500' : 'bg-gray-800 border-gray-700'}`}>
                                              <div onClick={() => toggleAttendance(phone)} className="text-white font-bold cursor-pointer flex-1">{user?.fullName || phone}</div>
                                              
                                              <div className="flex items-center gap-3">
                                                  <button onClick={() => toggleAttendance(phone)} className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors ${isMarked ? 'bg-green-500 border-green-500 text-white' : 'border-gray-500 hover:bg-gray-700'}`}>
                                                      {isMarked ? '✓' : ''}
                                                  </button>
                                              </div>
                                          </div>
                                      );
                                  })
                              }
                          </div>
                          <div className="flex gap-2">
                              <Button onClick={saveAttendance} className="flex-1">אישור נוכחות</Button>
                          </div>
                      </>
                  )}
            </div>
         </div>
      )}

      {activeTab === 'users' && (
         <div className="space-y-6">
            <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                 <h3 className="text-lg font-bold text-white mb-2">{editingUserId ? 'עריכת מתאמן' : 'הוספת מתאמן'}</h3>
                {editingUserId && formUser.phone && (
                   <div className="bg-gray-900/50 p-3 rounded mb-3 flex justify-between text-sm border border-gray-700">
                       <div>💪 אימונים החודש: <span className="text-brand-primary font-bold">{getMonthlyWorkoutsCount(formUser.phone)}</span></div>
                       <div>🏆 רצף נוכחי: <span className="text-yellow-500 font-bold">{calculateStreak(formUser.phone)}</span></div>
                   </div>
                )}
                <div className="grid grid-cols-2 gap-2 mb-2">
                    <input type="text" placeholder="שם מלא" className="w-full p-2 bg-gray-900 border border-gray-600 text-white rounded" value={formUser.fullName} onChange={e => setFormUser({...formUser, fullName: e.target.value})}/>
                    <input type="text" placeholder="כינוי" className="w-full p-2 bg-gray-900 border border-gray-600 text-white rounded" value={formUser.displayName || ''} onChange={e => setFormUser({...formUser, displayName: e.target.value})}/>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                    <input type="tel" placeholder="050..." className="w-full p-2 bg-gray-900 border border-gray-600 text-white rounded" value={formUser.phone} onChange={e => setFormUser({...formUser, phone: e.target.value})}/>
                    <input type="email" placeholder="email" className="w-full p-2 bg-gray-900 border border-gray-600 text-white rounded" value={formUser.email || ''} onChange={e => setFormUser({...formUser, email: e.target.value})}/>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                   <div className="flex flex-col">
                       <label className="text-xs text-gray-400 mb-1">שיא חודשי</label>
                       <input type="number" className="p-2 bg-gray-900 border border-gray-600 text-white rounded" value={formUser.monthlyRecord || 0} onChange={e => setFormUser({...formUser, monthlyRecord: parseInt(e.target.value) || 0})}/>
                   </div>
                   <div className="flex flex-col">
                       <label className="text-xs text-gray-400 mb-1 cursor-pointer hover:text-white" onClick={() => handleSort('payment')}>תשלום (מיון)</label>
                       <select className="p-2 bg-gray-900 border border-gray-600 text-white rounded" value={formUser.paymentStatus} onChange={e => setFormUser({...formUser, paymentStatus: e.target.value as PaymentStatus})}>
                           <option value={PaymentStatus.PAID}>שולם</option>
                           <option value={PaymentStatus.PENDING}>בהמתנה</option>
                           <option value={PaymentStatus.OVERDUE}>חוב</option>
                       </select>
                   </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                    <div className="flex flex-col">
                        <label className="text-xs text-gray-400 mb-1">ת.ז (הצהרת בריאות)</label>
                        <input type="text" className="p-2 bg-gray-900 border border-gray-600 text-white rounded" value={formUser.healthDeclarationId || ''} onChange={e => setFormUser({...formUser, healthDeclarationId: e.target.value})}/>
                    </div>
                    <div className="flex flex-col">
                        <label className="text-xs text-gray-400 mb-1">תאריך חתימה (ISO)</label>
                        <input type="text" className="p-2 bg-gray-900 border border-gray-600 text-white rounded" placeholder="2023-10-25T14:00..." value={formUser.healthDeclarationDate || ''} onChange={e => setFormUser({...formUser, healthDeclarationDate: e.target.value})}/>
                    </div>
                </div>
                <div className="mb-2">
                   <div className="flex flex-col">
                       <label className="text-xs text-gray-400 mb-1">צבע</label>
                       <input type="color" className="w-full h-10 rounded cursor-pointer bg-transparent border-none p-0" value={formUser.userColor || '#A3E635'} onChange={e => setFormUser({...formUser, userColor: e.target.value})}/>
                   </div>
                </div>
                <div className="mb-4">
                    <label className="flex items-center bg-gray-900 p-3 rounded border border-gray-600 cursor-pointer hover:bg-gray-800">
                        <input type="checkbox" className="w-5 h-5 ml-3 accent-red-500" checked={formUser.isRestricted || false} onChange={e => setFormUser({...formUser, isRestricted: e.target.checked})}/>
                        <span className={`font-bold ${formUser.isRestricted ? 'text-red-400' : 'text-gray-300'}`}>
                            {formUser.isRestricted ? '🚫 מתאמן מוגבל (חסום להרשמה)' : 'מתאמן פעיל (רשאי להירשם)'}
                        </span>
                    </label>
                </div>
                <div className="flex gap-2 mt-4">
                    <Button onClick={handleUserSubmit} className="flex-1">{editingUserId ? 'עדכן פרטים' : 'הוסף משתמש'}</Button>
                    {editingUserId && <Button variant="secondary" onClick={() => {setEditingUserId(null); setFormUser({ fullName: '', displayName: '', phone: '', email: '', startDate: new Date().toISOString().split('T')[0], paymentStatus: PaymentStatus.PAID, userColor: '#A3E635', monthlyRecord: 0, isRestricted: false, healthDeclarationFile: undefined, healthDeclarationId: '', healthDeclarationDate: '' });}}>ביטול</Button>}
                </div>
            </div>
            
            <div className="bg-gray-800 rounded-xl border border-gray-700 flex flex-col h-[500px]">
                <div className="p-3 border-b border-gray-700 flex gap-2 bg-gray-900">
                    <input 
                      type="text" 
                      placeholder="🔍 חיפוש מתאמן..." 
                      className="bg-gray-800 text-white p-2 rounded border border-gray-600 flex-1 text-sm"
                      value={filterText}
                      onChange={e => setFilterText(e.target.value)}
                    />
                </div>
                <div className="grid grid-cols-12 bg-gray-900 p-3 border-b border-gray-700 text-xs text-gray-400 font-bold sticky top-0 z-10 text-right">
                    <div className="col-span-3 cursor-pointer hover:text-white" onClick={() => handleSort('fullName')}>שם {sortKey==='fullName' && (sortDirection==='asc'?'↑':'↓')}</div>
                    <div className="col-span-2 text-center cursor-pointer hover:text-white" onClick={() => handleSort('payment')}>תשלום {sortKey==='payment' && (sortDirection==='asc'?'↑':'↓')}</div>
                    <div className="col-span-1 text-center cursor-pointer hover:text-white" onClick={() => handleSort('health')}>הצהרה</div>
                    <div className="col-span-1 text-center cursor-pointer hover:text-white" onClick={() => handleSort('streak')}>רצף</div>
                    <div className="col-span-1 text-center cursor-pointer hover:text-white" onClick={() => handleSort('monthCount')}>חודש</div>
                    <div className="col-span-1 text-center cursor-pointer hover:text-white" onClick={() => handleSort('record')}>שיא</div>
                    <div className="col-span-3 text-center">פעולות</div>
                </div>
                <div className="overflow-y-auto flex-1">
                    {sortedAndFilteredUsers.map(user => {
                        const monthCount = getMonthlyWorkoutsCount(user.phone);
                        const streak = calculateStreak(user.phone);
                        const record = Math.max(user.monthlyRecord || 0, monthCount);
                        
                        return (
                            <div key={user.id} className={`grid grid-cols-12 p-3 border-b border-gray-700 items-center hover:bg-gray-700/30 transition-colors ${user.isRestricted ? 'bg-red-900/10' : ''}`}>
                                <div className="col-span-3 flex flex-col">
                                    <div className="font-bold text-white flex items-center gap-1 truncate">
                                        <span style={{color: user.userColor}}>{user.fullName}</span>
                                        {user.isRestricted && <span className="text-[9px] bg-red-600 text-white px-1 rounded">חסום</span>}
                                    </div>
                                    <div className="text-[10px] text-gray-500">{user.phone}</div>
                                </div>
                                <div className="col-span-2 text-center flex justify-center">
                                     <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${getPaymentStatusColor(user.paymentStatus)}`}>
                                         {getPaymentStatusText(user.paymentStatus)}
                                     </span>
                                </div>
                                <div className="col-span-1 text-center flex justify-center">
                                    {user.healthDeclarationDate ? (
                                        <span className="text-green-500 text-lg" title={`נחתם ב-${new Date(user.healthDeclarationDate).toLocaleDateString()}`}>✍️✓</span>
                                    ) : user.healthDeclarationFile ? (
                                        <a href={user.healthDeclarationFile} download={`health_decl_${user.fullName}.pdf`} className="text-blue-500 hover:text-blue-400 text-lg" title="הורד קובץ">📎✓</a>
                                    ) : (
                                        <span className="text-gray-600 text-lg" title="אין הצהרה">−</span>
                                    )}
                                </div>
                                <div className="col-span-1 text-center">
                                    <span className="bg-yellow-500/10 text-yellow-500 px-1 py-0.5 rounded text-xs font-bold">{streak}</span>
                                </div>
                                <div className="col-span-1 text-center">
                                    <span className="text-white text-sm font-bold">{monthCount}</span>
                                </div>
                                <div className="col-span-1 text-center">
                                    <span className="text-brand-primary text-sm font-bold">{record}</span>
                                </div>
                                <div className="col-span-3 flex justify-center gap-1">
                                    <a href={`https://wa.me/${normalizePhoneForWhatsapp(user.phone)}`} target="_blank" rel="noreferrer" className="bg-green-600/20 text-green-400 p-1.5 rounded hover:bg-green-600 hover:text-white transition-colors flex items-center justify-center">
                                        <span className="text-xs">📞</span>
                                    </a>
                                    <button onClick={() => handleEditUserClick(user)} className="bg-blue-600/20 text-blue-400 p-1.5 rounded hover:bg-blue-600 hover:text-white transition-colors">✏️</button>
                                    <button onClick={() => handleDeleteUserClick(user.id)} className="bg-red-600/20 text-red-400 p-1.5 rounded hover:bg-red-600 hover:text-white transition-colors">🗑️</button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
      )}
      
      {activeTab === 'new_users' && (
           <div className="space-y-2">
               {newUsers.map(user => (
                   <div key={user.id} className="bg-gray-800 p-3 rounded flex justify-between items-center">
                       <div className="text-white">
                           {user.fullName} ({user.phone})
                           {user.isRestricted && <span className="mr-2 text-xs text-red-400 font-bold">(חסום)</span>}
                       </div>
                       <div className="flex gap-2">
                           <Button size="sm" variant="secondary" onClick={() => handleEditUserClick(user)}>ערוך</Button>
                           <Button size="sm" onClick={() => handleApproveUser(user)}>אשר</Button>
                           <Button size="sm" variant="danger" onClick={() => handleDeleteUserClick(user.id)}>דחה</Button>
                        </div>
                   </div>
               ))}
           </div>
      )}
      
      {activeTab === 'connections' && (
          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 text-white space-y-4">
              <h3 className="text-xl font-bold mb-4">חיבור ל-Supabase (ענן)</h3>
              <div className="space-y-2">
                  <label className="text-xs text-gray-400">Project URL</label>
                  <input type="text" className="w-full bg-gray-900 border border-gray-600 p-2 rounded text-white text-sm" value={sbUrl} onChange={e => setSbUrl(e.target.value)} placeholder="https://example.supabase.co" />
              </div>
              <div className="space-y-2">
                  <label className="text-xs text-gray-400">Project API Key (Anon)</label>
                  <input type="password" className="w-full bg-gray-900 border border-gray-600 p-2 rounded text-white text-sm" value={sbKey} onChange={e => setSbKey(e.target.value)} placeholder="eyJhbG..." />
              </div>
              
              <div className="flex gap-2 pt-2">
                  <Button onClick={handleSaveCloudConfig} className="flex-1">שמור והתחבר</Button>
                  {supabase && <Button variant="danger" onClick={handleClearCloudConfig}>התנתק</Button>}
              </div>

              <div className="mt-6 pt-6 border-t border-gray-700">
                 <h4 className="text-sm font-bold mb-2">הוראות התקנה (חובה לעדכון):</h4>
                 <p className="text-xs text-gray-400 mb-2">הוספנו טבלת הגדרות כלליות (שם מאמן, טלפון, וכו'). העתק את הסקריפט והרץ מחדש.</p>
                 <Button size="sm" variant="secondary" onClick={handleCopySql} className="w-full text-xs">העתק סקריפט SQL</Button>
              </div>
          </div>
      )}
      
      {activeTab === 'settings' && (
          <div className="space-y-6">
               <div className="bg-gray-800 p-4 rounded border border-gray-700">
                  <h3 className="text-white mb-3 font-bold">פרטי מאמן והגדרות כלליות</h3>
                  
                  <div className="bg-red-900/20 border border-red-500/50 p-3 rounded mb-4">
                      <label className="text-xs text-red-300 font-bold mb-1 block">הודעה דחופה למסך הבית (מחליף את המוטיבציה)</label>
                      <input 
                        type="text" 
                        placeholder="הקלד הודעה דחופה..." 
                        className="w-full bg-gray-900 text-white p-2 rounded border border-red-500/50 focus:border-red-500 outline-none"
                        value={tempConfig.urgentMessage || ''} 
                        onChange={e=>setTempConfig({...tempConfig, urgentMessage: e.target.value})}
                      />
                      <p className="text-[10px] text-gray-400 mt-1">השאר ריק כדי להציג את משפט המוטיבציה הרגיל.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                          <label className="text-xs text-gray-400">שם בעברית</label>
                          <input type="text" className="w-full bg-gray-900 text-white p-2 rounded border border-gray-600" value={tempConfig.coachNameHeb} onChange={e=>setTempConfig({...tempConfig, coachNameHeb: e.target.value})}/>
                      </div>
                      <div>
                          <label className="text-xs text-gray-400">שם באנגלית (לכותרת)</label>
                          <input type="text" className="w-full bg-gray-900 text-white p-2 rounded border border-gray-600" value={tempConfig.coachNameEng} onChange={e=>setTempConfig({...tempConfig, coachNameEng: e.target.value})}/>
                      </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                          <label className="text-xs text-gray-400">טלפון מאמן (וואטסאפ ראשי)</label>
                          <input type="tel" className="w-full bg-gray-900 text-white p-2 rounded border border-gray-600" value={tempConfig.coachPhone} onChange={e=>setTempConfig({...tempConfig, coachPhone: e.target.value})}/>
                      </div>
                      <div>
                          <label className="text-xs text-gray-400">אימייל מאמן</label>
                          <input type="email" className="w-full bg-gray-900 text-white p-2 rounded border border-gray-600" value={tempConfig.coachEmail} onChange={e=>setTempConfig({...tempConfig, coachEmail: e.target.value})}/>
                      </div>
                  </div>
                  <div className="mb-3">
                      <label className="text-xs text-gray-400">מספר נוסף (סיסמא)</label>
                      <input type="tel" className="w-full bg-gray-900 text-white p-2 rounded border border-gray-600" value={tempConfig.coachAdditionalPhone || ''} onChange={e=>setTempConfig({...tempConfig, coachAdditionalPhone: e.target.value})}/>
                  </div>
                  <div className="mb-3">
                      <label className="text-xs text-gray-400">עיר ברירת מחדל (מזג אוויר)</label>
                      <input type="text" className="w-full bg-gray-900 text-white p-2 rounded border border-gray-600" value={tempConfig.defaultCity} onChange={e=>setTempConfig({...tempConfig, defaultCity: e.target.value})}/>
                  </div>
                  <Button onClick={handleSaveAppConfig} className="w-full">שמור פרטים</Button>
              </div>

              <div className="bg-gray-800 p-4 rounded border border-gray-700">
                  <h3 className="text-white mb-2 font-bold">צבע ראשי לאפליקציה</h3>
                  <div className="flex gap-2">{SESSION_COLORS.map(c => <button key={c} onClick={() => onColorChange(c)} className={`w-8 h-8 rounded-full ${primaryColor===c?'border-2 border-white':''}`} style={{backgroundColor:c}}/>)}</div>
              </div>

              <div className="bg-gray-800 p-4 rounded border border-gray-700">
                  <h3 className="text-white mb-3 font-bold">משפטי מוטיבציה</h3>
                  <p className="text-gray-400 text-xs mb-3">
                      אם תוסיף משפטים משלך, המערכת תבחר אחד מהם באופן אקראי למתאמנים. אם לא יהיו משפטים, המערכת תשתמש בבינה מלאכותית (AI).
                  </p>
                  <div className="flex gap-2 mb-4">
                      <input 
                        type="text" 
                        placeholder="כתוב משפט מוטיבציה..." 
                        className="bg-gray-900 text-white p-2 rounded flex-1 border border-gray-600"
                        value={newQuoteText}
                        onChange={e => setNewQuoteText(e.target.value)}
                      />
                      <Button onClick={handleAddQuoteClick}>הוסף</Button>
                  </div>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                      {quotes.length > 0 ? (
                          quotes.map((quote) => (
                              <div key={quote.id} className="flex justify-between items-center bg-gray-900/50 p-2 rounded border border-gray-700">
                                  <span className="text-white text-sm italic">"{quote.text}"</span>
                                  <button onClick={() => onDeleteQuote && onDeleteQuote(quote.id)} className="text-xs text-red-400 hover:text-white px-2">
                                      🗑️
                                  </button>
                              </div>
                          ))
                      ) : (
                          <div className="text-gray-500 text-xs italic text-center py-2">משתמש ב-AI בלבד</div>
                      )}
                  </div>
              </div>
              
              <div className="bg-gray-800 p-4 rounded border border-gray-700">
                  <h3 className="text-white mb-3 font-bold">סוגי אימונים</h3>
                  <div className="flex gap-2 mb-4">
                      <input type="text" placeholder="הוסף סוג חדש" className="bg-gray-900 text-white p-2 rounded flex-1 border border-gray-600" value={newTypeName} onChange={e=>setNewTypeName(e.target.value)}/>
                      <Button onClick={handleAddOrUpdateType}>{editingTypeOriginalName ? 'עדכן' : 'הוסף'}</Button>
                  </div>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                      {workoutTypes.map((type, idx) => (
                          <div key={idx} className="flex justify-between items-center bg-gray-900/50 p-2 rounded border border-gray-700">
                              <span className="text-white text-sm">{type}</span>
                              <div className="flex gap-2">
                                  <button onClick={()=>handleEditType(type)} className="text-xs text-blue-400 hover:text-white">✏️</button>
                                  <button onClick={()=>handleDeleteType(type)} className="text-xs text-red-400 hover:text-white">🗑️</button>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>

              <div className="bg-gray-800 p-4 rounded border border-gray-700">
                  <h3 className="text-white mb-3 font-bold">מיקומים</h3>
                  <div className="flex flex-col gap-2 mb-4">
                      <div className="flex gap-2">
                         <input type="text" placeholder="שם המקום" className="bg-gray-900 text-white p-2 rounded flex-1 border border-gray-600" value={newLocationName} onChange={e=>setNewLocationName(e.target.value)}/>
                         <input type="text" placeholder="כתובת" className="bg-gray-900 text-white p-2 rounded flex-1 border border-gray-600" value={newLocationAddress} onChange={e=>setNewLocationAddress(e.target.value)}/>
                      </div>
                      <div className="flex gap-2 items-center">
                          <input type="color" className="w-10 h-10 rounded cursor-pointer bg-transparent border-none p-0" value={newLocationColor} onChange={e=>setNewLocationColor(e.target.value)} />
                          <Button onClick={handleAddOrUpdateLocation} className="flex-1 mr-auto">{editingLocationId ? 'עדכן' : 'הוסף מיקום'}</Button>
                      </div>
                  </div>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                      {locations.map((loc) => (
                          <div key={loc.id} className="flex justify-between items-center bg-gray-900/50 p-2 rounded border border-gray-700" style={{borderRight: `4px solid ${loc.color || '#3B82F6'}`}}>
                              <div><div className="text-white text-sm font-bold">{loc.name}</div><div className="text-gray-500 text-xs">{loc.address}</div></div>
                              <div className="flex gap-2">
                                  <button onClick={()=>handleEditLocation(loc)} className="text-xs text-blue-400 hover:text-white">✏️</button>
                                  <button onClick={()=>handleDeleteLocation(loc.id)} className="text-xs text-red-400 hover:text-white">🗑️</button>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>

              <div className="bg-gray-800 p-4 rounded border border-gray-700 space-y-2">
                  <h3 className="text-white mb-2 font-bold">העתקת שבוע (תבניות)</h3>
                  <p className="text-gray-400 text-xs mb-2">בחר תאריך משבוע המקור ותאריך משבוע היעד. כל האימונים יועתקו ללא הנרשמים.</p>
                  <div className="flex flex-col gap-3 bg-gray-900 p-3 rounded">
                      <div className="flex gap-2 items-center">
                          <label className="text-xs text-gray-400 w-20">שבוע מקור:</label>
                          <input type="date" className="bg-gray-800 text-white p-2 rounded flex-1 border border-gray-700" value={copySourceDate} onChange={e=>setCopySourceDate(e.target.value)}/>
                      </div>
                      <div className="flex gap-2 items-center">
                          <label className="text-xs text-gray-400 w-20">שבוע יעד:</label>
                          <input type="date" className="bg-gray-800 text-white p-2 rounded flex-1 border border-gray-700" value={copyTargetDate} onChange={e=>setCopyTargetDate(e.target.value)}/>
                      </div>
                      <Button onClick={handleCopyWeek} isLoading={isProcessingCopy} className="mt-2">העתק שבוע 📋</Button>
                  </div>
              </div>
              
              <div className="bg-red-900/20 p-4 rounded border border-red-900/50 mt-8">
                  <h3 className="text-red-400 mb-2 font-bold text-sm">אזור סכנה / טיפול בבעיות</h3>
                  <p className="text-gray-400 text-xs mb-3">אם המיקומים מופיעים בטעות בנייד ואינם מסתנכרנים, לחץ כאן לניקוי זכרון הדפדפן בלבד (לא מוחק מידע מהשרת).</p>
                  <Button variant="danger" size="sm" onClick={handleResetCache} className="w-full">נקה זכרון מטמון (Cache) בלבד</Button>
              </div>
          </div>
      )}
    </div>
  );
};