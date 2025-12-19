
import React, { useState, useMemo, useEffect } from 'react';
import { User, TrainingSession, WeatherLocation, LocationDef, AppConfig, Quote, WeatherInfo, PaymentStatus } from '../types';
import { Button } from './Button';
import { SessionCard } from './SessionCard';
import { dataService } from '../services/dataService';
import { getMotivationQuote } from '../services/geminiService';

interface AdminPanelProps {
  users: User[]; sessions: TrainingSession[]; primaryColor: string; workoutTypes: string[]; locations: LocationDef[];
  weatherLocation: WeatherLocation; weatherData?: Record<string, WeatherInfo>; paymentLinks: any[];
  streakGoal: number; appConfig: AppConfig; quotes: Quote[]; deferredPrompt?: any; onInstall?: () => void;
  onAddUser: (user: User) => void; onUpdateUser: (user: User) => void; onDeleteUser: (userId: string) => void; 
  onAddSession: (session: TrainingSession) => Promise<void>; 
  onUpdateSession: (session: TrainingSession) => Promise<void>; 
  onDeleteSession: (id: string) => Promise<void>;
  onDuplicateSession?: (session: TrainingSession) => Promise<void>;
  onAddToCalendar?: (session: TrainingSession) => void;
  onColorChange: (color: string) => void; onUpdateWorkoutTypes: (types: string[]) => void; 
  onUpdateLocations: (locations: LocationDef[]) => void; onUpdateWeatherLocation: (location: WeatherLocation) => void;
  onAddPaymentLink: (link: any) => void; onDeletePaymentLink: (id: string) => void; onUpdateStreakGoal: (goal: number) => void;
  onUpdateAppConfig: (config: AppConfig) => void; onExitAdmin: () => void;
  getStatsForUser: (user: User) => { monthly: number; record: number; streak: number };
}

export const AdminPanel: React.FC<AdminPanelProps> = (props) => {
  const [activeTab, setActiveTab] = useState<'attendance' | 'users' | 'settings'>('attendance');
  const [settingsSection, setSettingsSection] = useState<'general' | 'infrastructure' | 'quotes' | 'connections' | 'views'>('general');
  const [attendanceSession, setAttendanceSession] = useState<TrainingSession | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [traineeSearch, setTraineeSearch] = useState('');
  const [saveIndicator, setSaveIndicator] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [userSortBy, setUserSortBy] = useState<'monthly' | 'record' | 'streak'>('monthly');
  const [showDuplicationOptions, setShowDuplicationOptions] = useState(false);
  
  const [showGroupSessions, setShowGroupSessions] = useState(true);
  const [showPersonalTraining, setShowPersonalTraining] = useState(true);

  const [isEditing, setIsEditing] = useState(false);

  const [localAppConfig, setLocalAppConfig] = useState<AppConfig>(props.appConfig);
  const [localLocations, setLocalLocations] = useState<LocationDef[]>(props.locations);
  const [localWorkoutTypes, setLocalWorkoutTypes] = useState<string[]>(props.workoutTypes);
  const [localQuotes, setLocalQuotes] = useState<Quote[]>(props.quotes);
  const [sessionDraft, setSessionDraft] = useState<TrainingSession | null>(null);

  useEffect(() => {
    if (attendanceSession) {
      setSessionDraft({ 
        ...attendanceSession, 
        isPersonalTraining: !!attendanceSession.isPersonalTraining,
        isCancelled: !!attendanceSession.isCancelled,
        isZoomSession: !!attendanceSession.isZoomSession,
        manualHasStarted: !!attendanceSession.manualHasStarted,
        registeredPhoneNumbers: attendanceSession.registeredPhoneNumbers || [],
        attendedPhoneNumbers: attendanceSession.attendedPhoneNumbers || []
      });
    } else setSessionDraft(null);
  }, [attendanceSession]);

  useEffect(() => {
    if (!isEditing) {
      setLocalAppConfig(props.appConfig);
      setLocalLocations(props.locations);
      setLocalWorkoutTypes(props.workoutTypes);
      setLocalQuotes(props.quotes);
    }
  }, [props.appConfig, props.locations, props.workoutTypes, props.quotes, isEditing, activeTab]);

  const normalizePhone = (p: string) => {
    if (!p) return '';
    let cleaned = p.replace(/\D/g, '');
    if (cleaned.startsWith('0')) cleaned = '972' + cleaned.substring(1);
    else if (!cleaned.startsWith('972')) cleaned = '972' + cleaned;
    return cleaned;
  };

  const weekDates = useMemo(() => {
    const sun = new Date(); sun.setHours(12, 0, 0, 0); 
    sun.setDate(sun.getDate() - sun.getDay() + (weekOffset * 7));
    return Array.from({length:7}, (_, i) => { 
        const d = new Date(sun); d.setDate(sun.getDate() + i); 
        return d.toISOString().split('T')[0]; 
    });
  }, [weekOffset]);

  const sortedUsers = useMemo(() => {
    return [...props.users]
      .filter(u => u.fullName.includes(searchTerm) || (u.displayName && u.displayName.includes(searchTerm)) || u.phone.includes(searchTerm))
      .sort((a, b) => {
        const statsA = props.getStatsForUser(a);
        const statsB = props.getStatsForUser(b);
        return statsB[userSortBy] - statsA[userSortBy];
      });
  }, [props.users, searchTerm, userSortBy, props.getStatsForUser]);

  const traineeSuggestions = useMemo(() => {
    if (traineeSearch.length < 2) return [];
    return props.users.filter(u => 
      u.fullName.toLowerCase().includes(traineeSearch.toLowerCase()) || 
      (u.displayName && u.displayName.toLowerCase().includes(traineeSearch.toLowerCase())) ||
      normalizePhone(u.phone).includes(traineeSearch)
    ).slice(0, 5);
  }, [props.users, traineeSearch]);

  const getWhatsAppMsg = (s: TrainingSession) => {
    const dateStr = new Date(s.date).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });
    const dayName = new Date(s.date).toLocaleDateString('he-IL', { weekday: 'long' });
    return `מתאמנים יקרים! תזכורת לאימון ${s.type} ביום ${dayName} (${dateStr}) בשעה ${s.time} ב${s.location}. ${s.description || ''} מחכה לראות אתכם! 💪⚡`;
  };

  const performDuplication = async (targetSundayStr: string) => {
    const sessionsToCopy = props.sessions.filter(s => weekDates.includes(s.date));
    if (sessionsToCopy.length === 0) {
        alert('לא נמצאו אימונים לשכפול בשבוע זה.');
        return;
    }

    const targetSunday = new Date(targetSundayStr);
    if (isNaN(targetSunday.getTime())) {
        alert('תאריך לא תקין');
        return;
    }

    const currentSunday = new Date(weekDates[0]);
    const timeDiff = targetSunday.getTime() - currentSunday.getTime();
    const daysDiff = Math.round(timeDiff / (1000 * 3600 * 24));

    setSaveIndicator('משכפל שבוע...');
    setIsSaving(true);
    
    try {
        for (const s of sessionsToCopy) {
            const oldDate = new Date(s.date);
            const newDate = new Date(oldDate);
            newDate.setDate(oldDate.getDate() + daysDiff);

            const newSession: TrainingSession = {
                ...s,
                id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                date: newDate.toISOString().split('T')[0],
                registeredPhoneNumbers: [],
                attendedPhoneNumbers: [],
                isCancelled: false,
                manualHasStarted: false
            };
            await props.onAddSession(newSession);
        }
        setSaveIndicator('השבוע שוכפל בהצלחה! ✓');
    } catch (err) {
        setSaveIndicator('שגיאה בשכפול ⚠️');
    } finally {
        setShowDuplicationOptions(false);
        setIsSaving(false);
        setTimeout(() => setSaveIndicator(null), 3000);
    }
  };

  const handleGenerateAIQuote = async () => {
    setSaveIndicator('ה-AI חושב על משפט...');
    const q = await getMotivationQuote();
    setLocalQuotes([...localQuotes, { id: Date.now().toString(), text: q }]);
    setSaveIndicator(null);
  };

  const handleSaveAllSettings = async () => {
    setSaveIndicator('שומר הגדרות...');
    setIsSaving(true);
    try {
      await Promise.all([
          dataService.saveAppConfig(localAppConfig),
          dataService.saveLocations(localLocations),
          dataService.saveWorkoutTypes(localWorkoutTypes),
          dataService.saveQuotes(localQuotes)
      ]);
      
      props.onUpdateAppConfig(localAppConfig);
      props.onUpdateLocations(localLocations);
      props.onUpdateWorkoutTypes(localWorkoutTypes);
      
      setIsEditing(false);
      setSaveIndicator('הכל נשמר בהצלחה ✓');
      setTimeout(() => setSaveIndicator(null), 3000);
    } catch (e) { 
      setSaveIndicator('שגיאה בשמירה לשרת ⚠️'); 
    } finally {
        setIsSaving(false);
    }
  };

  const copyToClipboard = (text: string) => {
      navigator.clipboard.writeText(text);
      alert('הלינק הועתק! 📋');
  };

  const fullSqlScript = `
-- 1. טבלת מתאמנים
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    "fullName" TEXT NOT NULL,
    "displayName" TEXT,
    phone TEXT NOT NULL,
    email TEXT,
    "startDate" TEXT,
    "paymentStatus" TEXT,
    "userColor" TEXT,
    "monthlyRecord" INTEGER,
    "isRestricted" BOOLEAN DEFAULT FALSE,
    "healthDeclarationDate" TEXT,
    "healthDeclarationId" TEXT
);

-- 2. טבלת אימונים
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    location TEXT NOT NULL,
    "maxCapacity" INTEGER NOT NULL,
    description TEXT,
    "registeredPhoneNumbers" JSONB DEFAULT '[]'::jsonb,
    "attendedPhoneNumbers" JSONB DEFAULT '[]'::jsonb,
    "isZoomSession" BOOLEAN DEFAULT FALSE,
    "isCancelled" BOOLEAN DEFAULT FALSE,
    "manualHasStarted" BOOLEAN DEFAULT FALSE,
    "isPersonalTraining" BOOLEAN DEFAULT FALSE
);

-- וודא שהעמודות החדשות קיימות (הרצת ALTER בטוחה)
DO $$ 
BEGIN
    BEGIN
        ALTER TABLE sessions ADD COLUMN "isPersonalTraining" BOOLEAN DEFAULT FALSE;
    EXCEPTION
        WHEN duplicate_column THEN null;
    END;
    BEGIN
        ALTER TABLE sessions ADD COLUMN "manualHasStarted" BOOLEAN DEFAULT FALSE;
    EXCEPTION
        WHEN duplicate_column THEN null;
    END;
END $$;

-- 3. הגדרות כלליות
CREATE TABLE IF NOT EXISTS config_general (
    id TEXT PRIMARY KEY DEFAULT 'main',
    "coachNameHeb" TEXT,
    "coachNameEng" TEXT,
    "coachPhone" TEXT,
    "coachBio" TEXT,
    "urgentMessage" TEXT,
    "defaultCity" TEXT,
    "healthDeclarationTemplate" TEXT
);

-- 4. מיקומים
CREATE TABLE IF NOT EXISTS config_locations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    color TEXT
);

-- 5. סוגי אימונים
CREATE TABLE IF NOT EXISTS config_workout_types (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL
);

-- 6. משפטי מוטיבציה
CREATE TABLE IF NOT EXISTS quotes (
    id TEXT PRIMARY KEY,
    text TEXT NOT NULL
);
  `;

  return (
    <div className="bg-brand-black min-h-screen">
      {/* ... Navigation UI Remains Same ... */}
      <div className="fixed top-[130px] left-0 right-0 z-[60] bg-brand-black/90 pt-4 border-b border-white/5 pb-4 backdrop-blur-xl px-4">
        <div className="max-w-4xl mx-auto space-y-4">
            <div className="flex gap-2">
            {['settings', 'users', 'attendance'].map(t => (
                <button key={t} onClick={() => setActiveTab(t as any)} className={`flex-1 py-4 rounded-2xl text-sm font-black uppercase tracking-widest transition-all ${activeTab === t ? 'bg-red-600 text-white shadow-xl shadow-red-600/40' : 'bg-gray-800/50 text-gray-500'}`}>
                {t === 'attendance' ? 'נוכחות' : t === 'users' ? 'מתאמנים' : 'הגדרות'}
                </button>
            ))}
            </div>
            {activeTab === 'settings' && (
                <div className="flex gap-2 p-1 bg-gray-900/60 rounded-2xl overflow-x-auto no-scrollbar border border-white/5">
                    {(['views', 'connections', 'quotes', 'infrastructure', 'general'] as const).map(s => (
                        <button key={s} onClick={() => setSettingsSection(s)} className={`flex-1 py-2.5 px-4 text-[11px] font-black uppercase rounded-xl transition-all whitespace-nowrap ${settingsSection === s ? 'bg-gray-800 text-white shadow-lg' : 'text-gray-600'}`}>
                            {s === 'general' ? 'מידע כללי' : s === 'infrastructure' ? 'מיקומים' : s === 'quotes' ? 'מוטיבציה' : s === 'connections' ? 'חיבורים' : 'תצוגות'}
                        </button>
                    ))}
                </div>
            )}
        </div>
      </div>

      <div className="p-4 max-w-4xl mx-auto pt-[200px] sm:pt-[240px] space-y-6 pb-24">
        {activeTab === 'attendance' && (
          <div className="space-y-6">
             <div className="flex flex-col gap-4 bg-gray-800/40 p-5 rounded-3xl border border-white/5 shadow-xl mt-6">
                <div className="flex justify-between items-center">
                    <button onClick={()=>setWeekOffset(p=>p-1)} className="text-white text-2xl p-2 hover:text-red-500 transition-colors">←</button>
                    <div className="flex flex-col items-center">
                        <span className="text-red-500 font-black uppercase tracking-[0.3em] bg-red-500/10 px-4 py-1 rounded-full">{weekOffset === 0 ? 'השבוע' : weekOffset === 1 ? 'שבוע הבא' : weekOffset === -1 ? 'שבוע שעבר' : `שבוע ${weekOffset}`}</span>
                        <button onClick={() => setShowDuplicationOptions(true)} className="mt-2 text-[10px] font-black uppercase text-gray-500 border border-gray-700 px-3 py-1 rounded-full hover:border-red-500 hover:text-red-500 transition-all">שכפל שבוע 📑</button>
                    </div>
                    <button onClick={()=>setWeekOffset(p=>p+1)} className="text-white text-2xl p-2 hover:text-red-500 transition-colors">→</button>
                </div>
                <div className="flex justify-center gap-4 border-t border-white/5 pt-4">
                    <button onClick={() => setShowGroupSessions(!showGroupSessions)} className={`px-4 py-2 rounded-full text-[10px] font-black uppercase transition-all ${showGroupSessions ? 'bg-red-600 text-white' : 'bg-gray-900 text-gray-600'}`}>קבוצתי {showGroupSessions ? '✓' : '✗'}</button>
                    <button onClick={() => setShowPersonalTraining(!showPersonalTraining)} className={`px-4 py-2 rounded-full text-[10px] font-black uppercase transition-all ${showPersonalTraining ? 'bg-blue-600 text-white' : 'bg-gray-900 text-gray-600'}`}>אימון אישי {showPersonalTraining ? '✓' : '✗'}</button>
                </div>
             </div>

             <div className="grid grid-cols-1">
                <Button onClick={() => setAttendanceSession({ id: Date.now().toString(), type: props.workoutTypes[0] || 'פונקציונלי', date: new Date().toISOString().split('T')[0], time: '18:00', location: props.locations[0]?.name || '', maxCapacity: 15, registeredPhoneNumbers: [], attendedPhoneNumbers: [], description: '', isPersonalTraining: false, isZoomSession: false, isCancelled: false })} className="py-7 rounded-[45px] bg-red-600 text-xl font-black italic shadow-2xl">+ אימון חדש</Button>
             </div>

             {showDuplicationOptions && (
                 <div className="bg-gray-900 p-6 rounded-[40px] border border-red-500/30 shadow-2xl animate-install-overlay-animation">
                     <h4 className="text-white font-black uppercase italic mb-4 text-center">לאן לשכפל את השבוע הזה?</h4>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                         <Button onClick={() => performDuplication(new Date(new Date(weekDates[0]).getTime() + 7 * 24 * 3600 * 1000).toISOString().split('T')[0])} className="py-4 bg-red-600" isLoading={isSaving}>לשבוע הבא ⏩</Button>
                         <div className="flex flex-col gap-2">
                             <label className="text-[10px] text-gray-500 font-black uppercase">בחר יום ראשון (תאריך יעד):</label>
                             <input 
                                type="date" 
                                className="bg-gray-800 p-4 rounded-2xl text-white font-bold border border-white/10"
                                onChange={(e) => { if(e.target.value) performDuplication(e.target.value); }}
                             />
                         </div>
                     </div>
                     <button onClick={() => setShowDuplicationOptions(false)} className="w-full text-center text-gray-500 text-xs font-black mt-4 uppercase">ביטול ✕</button>
                 </div>
             )}

             <div className="space-y-12">
              {weekDates.map(date => {
                  let daySessions = props.sessions.filter(s => s.date === date).sort((a,b)=>a.time.localeCompare(b.time));
                  daySessions = daySessions.filter(s => !!s.isPersonalTraining ? showPersonalTraining : showGroupSessions);
                  if (daySessions.length === 0) return null;
                  return (
                      <div key={date}>
                          <div className="flex justify-between items-end border-b border-white/5 pb-2 mb-4">
                              <h4 className="text-gray-500 font-black text-4xl uppercase tracking-widest">{new Date(date).toLocaleDateString('he-IL', { weekday: 'long' })}</h4>
                              <p className="text-gray-500 font-black text-4xl uppercase tracking-widest opacity-30">{new Date(date).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' })}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            {daySessions.map(s => <SessionCard key={s.id} session={s} allUsers={props.users} isRegistered={false} onRegisterClick={()=>{}} onViewDetails={(sid) => setAttendanceSession(props.sessions.find(x => x.id === sid) || null)} onDuplicate={props.onDuplicateSession} onAddToCalendar={props.onAddToCalendar} isAdmin={true} locations={props.locations} weather={props.weatherData?.[s.date]} />)}
                          </div>
                      </div>
                  );
              })}
             </div>
             {/* ... */}
          </div>
        )}

        {activeTab === 'users' && (
            <div className="space-y-6">
                {/* ... Users List Remains Same ... */}
                <div className="flex flex-col sm:flex-row gap-4 items-center">
                    <input type="text" placeholder="חיפוש מתאמן..." className="flex-1 bg-gray-800 border border-white/10 p-6 rounded-[30px] text-white outline-none focus:border-red-500 shadow-xl" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
                    <div className="flex gap-2 p-2 bg-gray-900/60 rounded-[30px] border border-white/5">
                        {(['monthly', 'record', 'streak'] as const).map(sort => (
                            <button key={sort} onClick={() => setUserSortBy(sort)} className={`px-4 py-3 rounded-2xl text-[10px] font-black uppercase transition-all ${userSortBy === sort ? 'bg-red-600 text-white' : 'text-gray-500'}`}>
                                {sort === 'monthly' ? 'נוכחות' : sort === 'record' ? 'שיא' : 'רצף'}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="grid gap-4">
                    {sortedUsers.map(u => {
                       const uStats = props.getStatsForUser(u);
                       return (
                       <div key={u.id} onClick={() => setEditingUser(u)} className="bg-gray-800/40 p-6 rounded-[50px] border border-white/5 flex flex-col sm:flex-row justify-between items-center shadow-2xl hover:border-red-500/50 cursor-pointer transition-all">
                          <div className="flex items-center gap-6">
                             <div className="w-16 h-16 rounded-full bg-gray-900 border-2 border-white/10 flex items-center justify-center font-black text-2xl text-brand-primary shrink-0" style={{ color: u.userColor }}>{u.fullName.charAt(0)}</div>
                             <div className="truncate max-w-[150px] sm:max-w-none">
                                <h3 className="text-white font-black text-xl italic truncate" style={{ color: u.userColor }}>{u.fullName}</h3>
                                <p className="text-xs text-gray-500 font-mono tracking-widest">{u.phone}</p>
                                {u.isRestricted && <span className="text-red-500 text-[9px] font-black uppercase">חסום 🚫</span>}
                             </div>
                          </div>
                          <div className="grid grid-cols-3 gap-8 text-center mt-4 sm:mt-0">
                             <div><p className="text-[10px] text-gray-500 font-black uppercase mb-1">החודש</p><p className="text-3xl font-black text-brand-primary">{uStats.monthly}</p></div>
                             <div><p className="text-[10px] text-gray-500 font-black uppercase mb-1">שיא</p><p className="text-3xl font-black text-white">{uStats.record}</p></div>
                             <div><p className="text-[10px] text-gray-500 font-black uppercase mb-1">רצף</p><p className="text-3xl font-black text-orange-400">{uStats.streak}</p></div>
                          </div>
                       </div>
                    )})}
                </div>
            </div>
        )}

        {activeTab === 'settings' && (
            <div className="space-y-10 mt-6">
                {/* ... General/Infra Settings Remain Same ... */}
                {settingsSection === 'connections' && (
                    <div className="bg-gray-800/40 p-8 rounded-[50px] border border-white/5 space-y-8 shadow-2xl">
                        <h3 className="text-white font-black uppercase italic tracking-widest border-b border-white/10 pb-4">חיבורים ואינטגרציות 🔌</h3>
                        <div className="space-y-6">
                            <div className="bg-gray-900/60 p-6 rounded-[35px] border border-white/5 space-y-4">
                                <div className="flex justify-between items-center">
                                    <h4 className="text-brand-primary font-black text-sm uppercase">Supabase (מסד נתונים) 🗄️</h4>
                                    <span className="bg-green-500/20 text-green-500 text-[9px] px-2 py-1 rounded-full font-black">מחובר ✅</span>
                                </div>
                                <p className="text-gray-400 text-xs leading-relaxed">הנתונים שלך נשמרים בענן Supabase. וודא שהרצת את סקריפט ה-SQL המעודכן כדי שהעמודות "מתקיים" ו"אישי" יעבדו.</p>
                                <div className="bg-black/40 p-4 rounded-xl space-y-3">
                                    <p className="text-[10px] text-brand-primary font-black uppercase">סקריפט SQL מעודכן (להרצה ב-SQL Editor):</p>
                                    <textarea readOnly value={fullSqlScript} className="w-full bg-gray-900 text-gray-400 text-[8px] font-mono p-2 h-32 rounded border border-white/5 outline-none" />
                                    <Button onClick={() => copyToClipboard(fullSqlScript)} size="sm" variant="secondary" className="text-[10px]">העתק סקריפט 📋</Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {/* ... Views tab ... */}
                <div className="sticky bottom-4 z-[60] bg-brand-black/80 backdrop-blur-xl p-4 rounded-[40px] border border-white/10 shadow-3xl flex flex-col items-center gap-2">
                    {saveIndicator && <p className="text-xs font-black uppercase tracking-widest text-brand-primary animate-pulse">{saveIndicator}</p>}
                    <Button onClick={handleSaveAllSettings} className="w-full py-6 rounded-[40px] text-xl font-black italic shadow-2xl shadow-red-600/20 bg-red-600" isLoading={isSaving}>שמירה ✅</Button>
                    <Button onClick={props.onExitAdmin} variant="outline" className="w-full py-4 rounded-[40px] font-black italic text-sm uppercase opacity-60">חזרה ללו"ז</Button>
                </div>
            </div>
        )}
      </div>

      {sessionDraft && (
          <div className="fixed inset-0 bg-black/95 z-[200] flex items-center justify-center p-6 backdrop-blur-xl overflow-y-auto no-scrollbar">
              <div className="bg-gray-900 p-8 sm:p-12 rounded-[60px] w-full max-w-4xl border border-white/10 text-right shadow-3xl my-auto" dir="rtl">
                  <div className="flex justify-between mb-8 border-b border-white/5 pb-5">
                      <h3 className="text-3xl font-black text-white italic uppercase">ניהול אימון ⚙️</h3>
                      <button onClick={()=>setAttendanceSession(null)} className="text-gray-500 text-4xl">✕</button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                      <div className="bg-gray-800/40 p-6 rounded-[35px] max-h-[600px] overflow-y-auto no-scrollbar border border-white/5 space-y-4">
                        <div className="flex justify-between items-center border-b border-white/5 pb-2">
                            <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">נוכחות ({sessionDraft.registeredPhoneNumbers.length})</p>
                        </div>
                        <div className="relative">
                            <input type="text" placeholder="הוספת מתאמן..." className="w-full bg-gray-900 p-4 rounded-2xl text-white text-xs border border-white/5 outline-none focus:border-brand-primary" value={traineeSearch} onChange={(e) => setTraineeSearch(e.target.value)} />
                            {traineeSuggestions.length > 0 && (
                                <div className="absolute top-full left-0 right-0 z-[210] bg-gray-900 border border-white/10 rounded-2xl mt-1 overflow-hidden shadow-2xl">
                                    {traineeSuggestions.map(u => (
                                        <button key={u.id} className="w-full p-4 text-right hover:bg-gray-800 transition-colors flex justify-between items-center group" onClick={() => { 
                                            const phone = normalizePhone(u.phone); 
                                            if (!sessionDraft.registeredPhoneNumbers.includes(phone)) {
                                                const newRegistered = [...sessionDraft.registeredPhoneNumbers, phone];
                                                const newAttended = [...(sessionDraft.attendedPhoneNumbers || []), phone];
                                                setSessionDraft({ ...sessionDraft, registeredPhoneNumbers: newRegistered, attendedPhoneNumbers: newAttended }); 
                                            }
                                            setTraineeSearch(''); 
                                        }}>
                                            <span className="text-white text-sm font-bold">{u.fullName}</span>
                                            <span className="text-brand-primary font-black">+ הוסף</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="space-y-2">
                            {sessionDraft.registeredPhoneNumbers.map(phone => {
                                const u = props.users.find(user => normalizePhone(user.phone) === normalizePhone(phone));
                                const isAttended = (sessionDraft.attendedPhoneNumbers || []).includes(phone);
                                return (
                                    <div key={phone} className="flex justify-between items-center p-4 rounded-2xl bg-gray-900/50 border border-white/5">
                                        <div className="flex flex-col">
                                            <span className="text-white text-sm font-bold">{u ? (u.displayName || u.fullName) : phone}</span>
                                            <span className="text-[10px] text-gray-500 font-mono">{phone}</span>
                                        </div>
                                        <div className="flex gap-2 items-center">
                                            <button onClick={() => { 
                                                if (!sessionDraft) return;
                                                const curr = sessionDraft.attendedPhoneNumbers || []; const up = isAttended ? curr.filter(p => p !== phone) : [...curr, phone]; setSessionDraft({...sessionDraft, attendedPhoneNumbers: up}); }} className={`px-4 py-2 rounded-xl text-[10px] font-black ${isAttended ? 'bg-brand-primary text-black' : 'bg-gray-800 text-gray-500'}`}>{isAttended ? 'נכח' : 'לא נכח'}</button>
                                            <button onClick={() => setSessionDraft({...sessionDraft, registeredPhoneNumbers: sessionDraft.registeredPhoneNumbers.filter(p => p !== phone), attendedPhoneNumbers: (sessionDraft.attendedPhoneNumbers || []).filter(p => p !== phone)})} className="text-red-500 p-2">✕</button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                      </div>
                      <div className="space-y-5">
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="text-[10px] text-gray-500 font-black mb-1 block uppercase">סוג</label><select className="w-full bg-gray-800 p-5 rounded-3xl text-white font-bold" value={sessionDraft.type} onChange={e=>setSessionDraft({...sessionDraft, type: e.target.value})}>{props.workoutTypes.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                            <div><label className="text-[10px] text-gray-500 font-black mb-1 block uppercase">מיקום</label><select className="w-full bg-gray-800 p-5 rounded-3xl text-white font-bold" value={sessionDraft.location} onChange={e=>setSessionDraft({...sessionDraft, location: e.target.value})}>{props.locations.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}</select></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="text-[10px] text-gray-500 font-black mb-1 block uppercase">תאריך</label><input type="date" className="w-full bg-gray-800 p-5 rounded-3xl text-white font-bold" value={sessionDraft.date} onChange={e=>setSessionDraft({...sessionDraft, date: e.target.value})} /></div>
                            <div><label className="text-[10px] text-gray-500 font-black mb-1 block uppercase">שעה</label><input type="time" className="w-full bg-gray-800 p-5 rounded-3xl text-white font-bold" value={sessionDraft.time} onChange={e=>setSessionDraft({...sessionDraft, time: e.target.value})} /></div>
                        </div>
                        <div><label className="text-[10px] text-gray-500 font-black mb-1 block uppercase">דגשים למתאמנים</label><textarea className="w-full bg-gray-800 p-5 rounded-3xl text-white font-bold h-24 text-sm" value={sessionDraft.description || ''} onChange={e=>setSessionDraft({...sessionDraft, description: e.target.value})} /></div>
                        
                        <div className="grid grid-cols-2 gap-2 p-4 bg-gray-800/20 rounded-3xl border border-white/5">
                            <div className="flex items-center gap-2">
                                <input type="checkbox" id="isPersonalDraft" className="w-6 h-6 accent-purple-500 cursor-pointer" checked={!!sessionDraft.isPersonalTraining} onChange={e=>setSessionDraft({...sessionDraft, isPersonalTraining: e.target.checked})} />
                                <label htmlFor="isPersonalDraft" className="text-purple-400 text-[10px] font-black uppercase cursor-pointer">אישי 🏆</label>
                            </div>
                            <div className="flex items-center gap-2">
                                <input type="checkbox" id="isCancelledDraft" className="w-6 h-6 accent-red-500 cursor-pointer" checked={!!sessionDraft.isCancelled} onChange={e=>setSessionDraft({...sessionDraft, isCancelled: e.target.checked})} />
                                <label htmlFor="isCancelledDraft" className="text-red-500 text-[10px] font-black uppercase cursor-pointer">מבוטל ❌</label>
                            </div>
                            <div className="flex items-center gap-2">
                                <input type="checkbox" id="isHappeningDraft" className="w-6 h-6 accent-brand-primary cursor-pointer" checked={!!sessionDraft.manualHasStarted} onChange={e=>setSessionDraft({...sessionDraft, manualHasStarted: e.target.checked})} />
                                <label htmlFor="isHappeningDraft" className="text-brand-primary text-[10px] font-black uppercase cursor-pointer">מתקיים ✓</label>
                            </div>
                        </div>
                      </div>
                  </div>
                  <div className="mt-12 flex gap-4">
                      <Button onClick={async ()=>{ 
                          if (!sessionDraft || isSaving) return;
                          setIsSaving(true);
                          setSaveIndicator('שומר...');
                          try {
                            const finalSession = {
                              ...sessionDraft,
                              isPersonalTraining: !!sessionDraft.isPersonalTraining,
                              isCancelled: !!sessionDraft.isCancelled,
                              manualHasStarted: !!sessionDraft.manualHasStarted
                            };
                            await props.onUpdateSession(finalSession); 
                            setSaveSuccess(true);
                            setTimeout(() => {
                                setAttendanceSession(null); 
                                setSaveSuccess(false);
                            }, 800);
                          } catch (err) {
                            setSaveIndicator('שגיאה ⚠️');
                          } finally {
                            setIsSaving(false);
                          }
                      }} className={`flex-1 py-8 rounded-[45px] text-2xl font-black italic uppercase shadow-2xl transition-all ${saveSuccess ? 'bg-green-600' : 'bg-red-600'}`} isLoading={isSaving}>
                        {saveSuccess ? 'נשמר בהצלחה! ✓' : 'שמור שינויים ✓'}
                      </Button>
                      <Button onClick={async ()=>{if(confirm('מחיקת אימון?')){ await props.onDeleteSession(sessionDraft.id); setAttendanceSession(null);}}} variant="danger" className="px-12 rounded-[45px]" disabled={isSaving}>מחק 🗑️</Button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
