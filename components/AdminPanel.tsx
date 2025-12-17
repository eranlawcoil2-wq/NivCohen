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
-- סקריפט SQL מעודכן עבור Supabase
-- הרץ את זה ב-SQL Editor של Supabase

-- 1. טבלת משתתפים
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    "fullName" TEXT NOT NULL,
    "displayName" TEXT,
    phone TEXT UNIQUE NOT NULL,
    email TEXT,
    "startDate" TEXT,
    "paymentStatus" TEXT DEFAULT 'PAID',
    "isNew" BOOLEAN DEFAULT false,
    "userColor" TEXT DEFAULT '#A3E635',
    "monthlyRecord" INTEGER DEFAULT 0,
    "isRestricted" BOOLEAN DEFAULT false,
    "healthDeclarationFile" TEXT,
    "healthDeclarationDate" TEXT,
    "healthDeclarationId" TEXT
);

-- 2. טבלת אימונים (כולל waitingList ו-attendedPhoneNumbers)
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    location TEXT NOT NULL,
    "maxCapacity" INTEGER NOT NULL,
    description TEXT,
    "registeredPhoneNumbers" TEXT[] DEFAULT '{}',
    "waitingList" TEXT[] DEFAULT '{}',
    "attendedPhoneNumbers" TEXT[],
    color TEXT,
    "isTrial" BOOLEAN DEFAULT false,
    "zoomLink" TEXT,
    "isZoomSession" BOOLEAN DEFAULT false,
    "isHidden" BOOLEAN DEFAULT false,
    "isCancelled" BOOLEAN DEFAULT false,
    "manualHasStarted" BOOLEAN DEFAULT false
);

-- 3. טבלאות קונפיגורציה
CREATE TABLE IF NOT EXISTS config_locations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT,
    color TEXT
);

CREATE TABLE IF NOT EXISTS config_workout_types (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS config_general (
    id TEXT PRIMARY KEY DEFAULT 'main',
    "coachNameHeb" TEXT,
    "coachNameEng" TEXT,
    "coachPhone" TEXT,
    "coachAdditionalPhone" TEXT,
    "coachEmail" TEXT,
    "defaultCity" TEXT,
    "urgentMessage" TEXT
);

CREATE TABLE IF NOT EXISTS config_quotes (
    id TEXT PRIMARY KEY,
    text TEXT NOT NULL
);

-- אפשור גישה ציבורית (לצרכי הפרויקט הנוכחי)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Access User" ON users FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Access Session" ON sessions FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE config_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Access Loc" ON config_locations FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE config_workout_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Access Type" ON config_workout_types FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE config_general ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Access Gen" ON config_general FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE config_quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Access Quote" ON config_quotes FOR ALL USING (true) WITH CHECK (true);
`;

const getSunday = (d: Date) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day; 
  return new Date(date.setDate(diff));
};

const getCurrentWeekDates = (weekOffset: number) => {
  const sunday = getSunday(new Date());
  sunday.setDate(sunday.getDate() + (weekOffset * 7));
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
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

export const AdminPanel: React.FC<AdminPanelProps> = ({ 
    users, sessions, primaryColor, workoutTypes, locations, weatherLocation, weatherData,
    paymentLinks, streakGoal, appConfig, quotes = [], onAddUser, onUpdateUser, onDeleteUser, 
    onAddSession, onUpdateSession, onDeleteSession, onColorChange,
    onUpdateWorkoutTypes, onUpdateLocations, onUpdateWeatherLocation,
    onAddPaymentLink, onDeletePaymentLink, onUpdateStreakGoal, onUpdateAppConfig, 
    onAddQuote, onDeleteQuote, onExitAdmin
}) => {
  const [activeTab, setActiveTab] = useState<'attendance' | 'users' | 'settings' | 'new_users' | 'connections'>('attendance');
  const [filterText, setFilterText] = useState('');
  const [sortKey, setSortKey] = useState<'fullName' | 'streak' | 'monthCount' | 'record' | 'payment' | 'health'>('fullName');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [messageText, setMessageText] = useState('');
  const [isSavingAttendance, setIsSavingAttendance] = useState(false);
  const [attendanceSavedSuccess, setAttendanceSavedSuccess] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [attendanceSession, setAttendanceSession] = useState<TrainingSession | null>(null);
  const [markedAttendees, setMarkedAttendees] = useState<Set<string>>(new Set());

  const existingUsers = users.filter(u => !u.isNew);

  const weekDates = getCurrentWeekDates(weekOffset);
  const groupedSessions = sessions.reduce((acc, session) => {
      if (!acc[session.date]) acc[session.date] = [];
      acc[session.date].push(session);
      return acc;
  }, {} as Record<string, TrainingSession[]>);

  const openAttendanceModal = (session: TrainingSession) => {
      setAttendanceSession(session);
      setMessageText(`היי! תזכורת לאימון ${session.type} היום ב-${session.time} ב${session.location}. מחכה לכם! 💪`);
      
      let initialSet: Set<string>;
      // If attendance list is undefined or null, it means it hasn't been taken yet.
      // Default to ALL registered users being present.
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
      setIsSavingAttendance(true);
      const updatedSession: TrainingSession = { ...attendanceSession, attendedPhoneNumbers: Array.from(markedAttendees) };
      try {
          await onUpdateSession(updatedSession);
          setAttendanceSavedSuccess(true);
          setTimeout(() => { setAttendanceSavedSuccess(false); setAttendanceSession(null); }, 1500);
      } catch (error) { alert('שגיאה בשמירה'); } 
      finally { setIsSavingAttendance(false); }
  };

  const handleSendSingleMessage = (phone: string) => {
      if (!messageText) return;
      window.open(`https://wa.me/${normalizePhoneForWhatsapp(phone)}?text=${encodeURIComponent(messageText)}`, '_blank');
  };

  const handleCopyNumbers = () => {
      if (!attendanceSession || attendanceSession.registeredPhoneNumbers.length === 0) return;
      const numbers = attendanceSession.registeredPhoneNumbers.map(normalizePhoneForWhatsapp).join(',');
      navigator.clipboard.writeText(numbers).then(() => alert('הועתק ללוח! 📋'));
  };

  const handleCopySql = () => { navigator.clipboard.writeText(SQL_SCRIPT).then(() => alert('הועתק ללוח')); };

  return (
    <div className="p-4 bg-gray-900 rounded-lg pb-24">
      <div className="flex justify-between items-center mb-4 sticky top-0 bg-gray-900 z-10 py-2 border-b border-gray-800">
        <h2 className="text-2xl font-bold text-white font-sans uppercase italic tracking-tighter">NIV <span className="text-brand-primary">COHEN</span></h2>
        <button onClick={onExitAdmin} className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg transition-all">חזרה לאתר 🏠</button>
      </div>
      
      <div className="flex gap-2 mb-6 overflow-x-auto no-scrollbar">
         {['attendance', 'users', 'connections'].map(tab => (
             <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${activeTab === tab ? 'bg-brand-primary text-brand-black' : 'bg-gray-800 text-gray-400'}`}>
                 {tab === 'attendance' ? 'יומן ונוכחות' : tab === 'users' ? 'מתאמנים' : 'חיבורים'}
             </button>
         ))}
      </div>

      {activeTab === 'attendance' && (
          <div className="space-y-4">
              <div className="flex gap-2 justify-center mb-4">
                  <button onClick={() => setWeekOffset(prev => prev - 1)} className="px-3 py-1 bg-gray-800 text-white rounded-full text-xs">← שבוע קודם</button>
                  <span className="text-white text-sm font-bold pt-1">{weekOffset === 0 ? 'השבוע' : `שבוע ${weekOffset}`}</span>
                  <button onClick={() => setWeekOffset(prev => prev + 1)} className="px-3 py-1 bg-gray-800 text-white rounded-full text-xs">שבוע הבא →</button>
              </div>

              <div className="grid gap-3">
                  {weekDates.map((date) => (
                      <div key={date} className="bg-gray-800/40 rounded-xl border border-gray-700 p-3">
                          <div className="flex justify-between items-center mb-3">
                              <span className="text-white font-bold text-sm">{new Date(date).toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'numeric' })}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                              {(groupedSessions[date] || []).sort((a,b)=>a.time.localeCompare(b.time)).map(session => (
                                  <div key={session.id} onClick={() => openAttendanceModal(session)}>
                                      <SessionCard session={session} allUsers={users} isRegistered={false} onRegisterClick={() => {}} onViewDetails={() => {}} isAdmin={true} locations={locations} weather={weatherData ? weatherData[date] : undefined}/>
                                  </div>
                              ))}
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {attendanceSession && (
         <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setAttendanceSession(null)}>
            <div className="bg-gray-900 p-6 rounded-2xl w-full max-w-lg border border-gray-700 flex flex-col max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                 <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="text-xl font-black text-white">{attendanceSession.type}</h3>
                        <p className="text-brand-primary font-mono text-sm">{attendanceSession.time} | {attendanceSession.location}</p>
                    </div>
                    <button onClick={() => setAttendanceSession(null)} className="text-gray-500 hover:text-white text-2xl">✕</button>
                 </div>

                 <div className="mb-6 bg-brand-dark/50 p-4 rounded-xl border border-gray-800">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-white">💬 שליחת הודעה מהירה</span>
                        <button onClick={handleCopyNumbers} className="text-[10px] text-gray-500 underline">העתק מספרים</button>
                    </div>
                    <textarea className="w-full bg-gray-800 text-white text-xs p-2 rounded border border-gray-700 mb-3 h-16" value={messageText} onChange={e=>setMessageText(e.target.value)} placeholder="כתוב הודעה..."/>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                        {attendanceSession.registeredPhoneNumbers.map(p => (
                            <div key={p} className="flex justify-between items-center bg-gray-800/50 p-2 rounded text-xs">
                                <span className="text-white truncate">{users.find(x => normalizePhone(x.phone) === normalizePhone(p))?.fullName || p}</span>
                                <button onClick={()=>handleSendSingleMessage(p)} className="bg-green-600 text-white px-2 py-1 rounded text-[10px]">שלח 📤</button>
                            </div>
                        ))}
                    </div>
                 </div>

                 <div className="flex-1 space-y-2">
                    {attendanceSession.attendedPhoneNumbers !== undefined && attendanceSession.attendedPhoneNumbers !== null ? (
                        <div className="bg-green-900/20 border border-green-500/30 p-2 rounded text-center mb-2">
                            <span className="text-green-400 font-bold text-[10px]">✅ נוכחות שמורה</span>
                        </div>
                    ) : (
                        <div className="bg-yellow-900/20 border border-yellow-500/30 p-2 rounded text-center mb-2">
                            <span className="text-yellow-400 font-bold text-[10px]">⚠️ טרם דווחה נוכחות - ברירת מחדל</span>
                        </div>
                    )}
                    
                    {attendanceSession.registeredPhoneNumbers.map(p => {
                        const isMarked = markedAttendees.has(p);
                        return (
                            <div key={p} onClick={() => toggleAttendance(p)} className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer ${isMarked ? 'bg-green-900/10 border-green-500/50' : 'bg-gray-800 border-gray-700'}`}>
                                <span className="text-white font-bold text-sm">{users.find(x => normalizePhone(x.phone) === normalizePhone(p))?.fullName || p}</span>
                                <div className={`w-6 h-6 rounded-full border flex items-center justify-center ${isMarked ? 'bg-green-500 border-green-500 text-black' : 'border-gray-600'}`}>
                                    {isMarked && '✓'}
                                </div>
                            </div>
                        );
                    })}
                 </div>

                 <Button 
                    onClick={saveAttendance} 
                    className={`mt-6 py-4 text-lg transition-all ${attendanceSavedSuccess ? 'bg-green-600' : ''}`}
                    isLoading={isSavingAttendance}
                 >
                    {attendanceSavedSuccess ? 'נשמר בהצלחה! ✅' : 'אישור נוכחות'}
                 </Button>
            </div>
         </div>
      )}

      {activeTab === 'connections' && (
          <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700 space-y-6">
              <h3 className="text-white font-bold">חיבור למסד נתונים</h3>
              <div className="p-4 bg-red-900/10 border border-red-500/20 rounded-xl">
                  <p className="text-red-400 text-xs font-bold mb-2">עדכון סכימה נדרש!</p>
                  <p className="text-gray-400 text-[10px] mb-4">מכיוון שהוספנו רשימת המתנה ודיווח נוכחות, עליך להריץ את סקריפט ה-SQL המעודכן ב-Supabase.</p>
                  <Button size="sm" variant="secondary" onClick={handleCopySql} className="w-full text-xs">העתק סקריפט SQL מעודכן 📋</Button>
              </div>
          </div>
      )}
    </div>
  );
};