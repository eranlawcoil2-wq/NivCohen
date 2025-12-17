
import React, { useState, useMemo } from 'react';
import { User, TrainingSession, LocationDef, AppConfig, WeatherLocation, WeatherInfo } from '../types';
import { Button } from './Button';
import { generateWorkoutDescription } from '../services/geminiService';
import { SessionCard } from './SessionCard';
import { dataService } from '../services/dataService';
import { getCityCoordinates } from '../services/weatherService';

interface AdminPanelProps {
  users: User[];
  sessions: TrainingSession[];
  primaryColor: string;
  workoutTypes: string[];
  locations: LocationDef[];
  weatherLocation: WeatherLocation;
  weatherData: Record<string, WeatherInfo>;
  appConfig: AppConfig;
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
  onUpdateAppConfig: (config: AppConfig) => void;
  onExitAdmin: () => void;
}

const normalizePhone = (phone: string): string => {
    if (!phone) return '';
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('972')) cleaned = '0' + cleaned.substring(3);
    return cleaned;
};

export const AdminPanel: React.FC<AdminPanelProps> = ({ 
    users, sessions, workoutTypes, locations, weatherLocation, weatherData,
    appConfig, onAddUser, onUpdateUser, onDeleteUser, 
    onAddSession, onUpdateSession, onDeleteSession,
    onUpdateWorkoutTypes, onUpdateLocations, onUpdateWeatherLocation, onUpdateAppConfig, onExitAdmin
}) => {
  const [activeTab, setActiveTab] = useState<'attendance' | 'users' | 'settings' | 'cloud' | 'sql'>('attendance');
  const [weekOffset, setWeekOffset] = useState(0);
  const [attendanceSession, setAttendanceSession] = useState<TrainingSession | null>(null);
  const [editSession, setEditSession] = useState<TrainingSession | null>(null);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [markedAttendees, setMarkedAttendees] = useState<Set<string>>(new Set());
  const [messageText, setMessageText] = useState('היי! מחכה לך באימון היום 💪');
  const [userSearch, setUserSearch] = useState('');
  const [userSort, setUserSort] = useState<'name' | 'workouts'>('name');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [weatherCityInput, setWeatherCityInput] = useState(appConfig.defaultCity);

  const weekDates = useMemo(() => {
    const curr = new Date();
    const diff = curr.getDate() - curr.getDay() + (weekOffset * 7);
    const start = new Date(curr.setDate(diff));
    return Array.from({length: 7}, (_, i) => {
        const d = new Date(start); d.setDate(start.getDate() + i);
        return d.toISOString().split('T')[0];
    });
  }, [weekOffset]);

  const groupedSessions = sessions.reduce((acc, s) => ({...acc, [s.date]: [...(acc[s.date]||[]), s]}), {} as Record<string, TrainingSession[]>);

  const filteredUsers = useMemo(() => {
      return [...users]
        .filter(u => u.fullName.includes(userSearch) || u.phone.includes(userSearch))
        .sort((a, b) => {
            if (userSort === 'name') return a.fullName.localeCompare(b.fullName);
            return (b.monthlyCount || 0) - (a.monthlyCount || 0);
        });
  }, [users, userSearch, userSort]);

  const handleDuplicateSession = (s: TrainingSession) => {
      const [hour, minute] = s.time.split(':');
      let newH = parseInt(hour) + 1;
      if (newH >= 24) newH = 0;
      const nextTime = `${newH.toString().padStart(2, '0')}:${minute}`;
      const duplicated = { 
          ...s, 
          id: Date.now().toString(), 
          time: nextTime, 
          registeredPhoneNumbers: [], 
          attendedPhoneNumbers: [], 
          waitingList: [] 
      };
      onAddSession(duplicated);
      alert(`אימון שוכפל לשעה ${nextTime}`);
  };

  const handleOpenAttendance = (s: TrainingSession) => {
      setAttendanceSession(s);
      // Auto-mark registered as attendees by default, or use existing attended list
      const attended = s.attendedPhoneNumbers?.length 
          ? new Set(s.attendedPhoneNumbers) 
          : new Set(s.registeredPhoneNumbers);
      setMarkedAttendees(attended);
  };

  // Fix: Added missing handleWeatherCityUpdate function
  const handleWeatherCityUpdate = async () => {
    const coords = await getCityCoordinates(weatherCityInput);
    if (coords) {
      onUpdateWeatherLocation(coords);
      onUpdateAppConfig({ ...appConfig, defaultCity: coords.name });
      alert(`מיקום עודכן ל-${coords.name}`);
    } else {
      alert('עיר לא נמצאה');
    }
  };

  const sqlSetupScript = `
-- Niv Fitness Database Setup
-- 1. Create Trainees Table
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  fullName TEXT NOT NULL,
  displayName TEXT,
  phone TEXT UNIQUE NOT NULL,
  email TEXT,
  startDate TEXT,
  paymentStatus TEXT,
  isNew BOOLEAN DEFAULT true,
  userColor TEXT DEFAULT '#A3E635',
  monthlyRecord INTEGER DEFAULT 0,
  monthlyCount INTEGER DEFAULT 0,
  currentStreak INTEGER DEFAULT 0,
  isRestricted BOOLEAN DEFAULT false,
  healthDeclarationFile TEXT,
  healthDeclarationDate TEXT,
  healthDeclarationId TEXT
);

-- 2. Create Training Sessions Table
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  location TEXT NOT NULL,
  maxCapacity INTEGER NOT NULL,
  description TEXT,
  registeredPhoneNumbers TEXT[],
  waitingList TEXT[],
  attendedPhoneNumbers TEXT[],
  isZoomSession BOOLEAN DEFAULT false,
  isHybrid BOOLEAN DEFAULT false,
  isHidden BOOLEAN DEFAULT false,
  isCancelled BOOLEAN DEFAULT false,
  color TEXT
);

-- 3. Create General Config Table
CREATE TABLE config_general (
  id TEXT PRIMARY KEY,
  coachNameHeb TEXT,
  coachNameEng TEXT,
  coachPhone TEXT,
  coachAdditionalPhone TEXT,
  coachEmail TEXT,
  defaultCity TEXT,
  urgentMessage TEXT,
  healthDeclarationTemplate TEXT
);

-- 4. Create Locations Table
CREATE TABLE config_locations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  color TEXT
);

-- 5. Create Workout Types Table
CREATE TABLE config_workout_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

-- 6. Insert Default Config
INSERT INTO config_general (id, coachNameHeb, coachNameEng, coachPhone, coachAdditionalPhone, defaultCity)
VALUES ('main', 'ניב כהן', 'NIV COHEN', '0500000000', 'admin', 'נס ציונה')
ON CONFLICT (id) DO NOTHING;
`;

  return (
    <div className="bg-gray-900 min-h-screen pb-24 text-right">
      <div className="flex gap-2 p-4 bg-gray-800 sticky top-0 z-30 overflow-x-auto no-scrollbar shadow-xl border-b border-gray-700">
         {[
             {id:'attendance', label:'ניהול יומן', icon:'📅'},
             {id:'users', label:'מתאמנים', icon:'👥'},
             {id:'settings', label:'הגדרות תוכן', icon:'⚙️'},
             {id:'cloud', label:'מערכת וענן', icon:'☁️'},
             {id:'sql', label:'SQL Setup', icon:'📜'}
         ].map(tab => (
             <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`px-4 py-2 rounded-xl whitespace-nowrap font-bold transition-all flex items-center gap-2 ${activeTab === tab.id ? 'bg-brand-primary text-black' : 'bg-gray-700 text-gray-300'}`}>
                 <span>{tab.icon}</span>
                 <span>{tab.label}</span>
             </button>
         ))}
      </div>

      <div className="p-4">
        {/* TAB: ATTENDANCE (CALENDAR) */}
        {activeTab === 'attendance' && (
            <div className="space-y-6">
                <div className="flex justify-between items-center bg-gray-800 p-4 rounded-2xl border border-gray-700 shadow-lg">
                    <h3 className="text-xl font-black text-white">לוח אימונים שבועי</h3>
                    <div className="flex gap-2">
                        <Button size="sm" onClick={() => setEditSession({ id: Date.now().toString(), type: workoutTypes[0] || 'כללי', date: new Date().toISOString().split('T')[0], time: '18:00', location: locations[0]?.name || 'סטודיו', maxCapacity: 15, registeredPhoneNumbers: [], description: '' })}>+ אימון חדש</Button>
                        <button onClick={()=>setWeekOffset(p=>p-1)} className="bg-gray-700 p-2 rounded-lg text-white">←</button>
                        <button onClick={()=>setWeekOffset(p=>p+1)} className="bg-gray-700 p-2 rounded-lg text-white">→</button>
                    </div>
                </div>

                {weekDates.map(date => (
                    <div key={date} className="bg-gray-800/40 p-4 rounded-3xl border border-gray-800 shadow-sm">
                        <h4 className="text-brand-primary font-black mb-4 flex justify-between items-center">
                            <span>{new Date(date).toLocaleDateString('he-IL',{weekday:'long'})} - {date.split('-').reverse().join('/')}</span>
                            {weatherData[date] && <span className="text-[10px] text-gray-400">{weatherData[date].maxTemp}° {weatherData[date].weatherCode > 0 ? '🌦️' : '☀️'}</span>}
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                            {(groupedSessions[date] || []).map(s => (
                                <div key={s.id} className="relative group">
                                    <div onClick={() => handleOpenAttendance(s)} className="h-full">
                                        <SessionCard session={s} allUsers={users} isRegistered={false} onRegisterClick={()=>{}} onViewDetails={()=>{}} isAdmin={true} locations={locations} weather={weatherData[date]}/>
                                    </div>
                                    <div className="absolute top-2 right-2 flex flex-col gap-1 z-10 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                        <button onClick={(e)=>{e.stopPropagation(); setEditSession(s);}} className="bg-white/90 text-black w-8 h-8 rounded-full flex items-center justify-center shadow-xl hover:bg-white">✏️</button>
                                        <button onClick={(e)=>{e.stopPropagation(); handleDuplicateSession(s);}} className="bg-brand-primary text-black w-8 h-8 rounded-full flex items-center justify-center shadow-xl hover:bg-lime-400">👯</button>
                                        <button onClick={(e)=>{e.stopPropagation(); if(confirm('למחוק אימון?')) onDeleteSession(s.id);}} className="bg-red-500 text-white w-8 h-8 rounded-full flex items-center justify-center shadow-xl hover:bg-red-600">🗑️</button>
                                    </div>
                                </div>
                            ))}
                            {!(groupedSessions[date]?.length) && <p className="text-gray-600 text-[10px] py-4">אין אימונים ביום זה</p>}
                        </div>
                    </div>
                ))}
            </div>
        )}

        {/* TAB: USERS LIST */}
        {activeTab === 'users' && (
            <div className="space-y-4">
                <div className="flex gap-2">
                    <input type="text" placeholder="חפש מתאמן לפי שם או טלפון..." className="flex-1 p-3 bg-gray-800 text-white rounded-2xl border border-gray-700 outline-none focus:border-brand-primary" value={userSearch} onChange={e=>setUserSearch(e.target.value)}/>
                    <Button variant="secondary" onClick={() => setEditUser({ id: Date.now().toString(), fullName: '', phone: '', email: '', startDate: new Date().toISOString(), paymentStatus: 'PAID' as any, isNew: true })}>+ חדש</Button>
                </div>

                <div className="bg-gray-800 rounded-3xl overflow-hidden border border-gray-700 overflow-x-auto shadow-xl">
                    <table className="w-full text-right text-xs">
                        <thead className="bg-gray-900 text-gray-400 uppercase tracking-wider">
                            <tr>
                                <th className="p-4">שם ופרטים</th>
                                <th className="p-4">אימונים החודש</th>
                                <th className="p-4">רצף נוכחי</th>
                                <th className="p-4">סטטוס מנוי</th>
                                <th className="p-4">פעולות</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {filteredUsers.map(u => (
                                <tr key={u.id} className="hover:bg-gray-700/30 transition-colors cursor-pointer" onClick={() => setEditUser(u)}>
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold" style={{backgroundColor: u.userColor || '#A3E635', color: '#121212'}}>{u.fullName.slice(0,1)}</div>
                                            <div>
                                                <p className="text-white font-bold">{u.fullName} {u.isNew && <span className="text-[8px] bg-yellow-500 text-black px-1 rounded">חדש</span>}</p>
                                                <p className="text-[9px] text-gray-500">{u.phone}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4 text-white font-mono">{u.monthlyCount || 0}</td>
                                    <td className="p-4 text-orange-500 font-bold">🔥 {u.currentStreak || 0}</td>
                                    <td className="p-4">
                                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${u.isRestricted ? 'bg-red-500/20 text-red-500' : 'bg-green-500/20 text-green-500'}`}>{u.isRestricted ? 'חסום' : 'פעיל'}</span>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex gap-2">
                                            <button onClick={(e)=>{e.stopPropagation(); if(confirm('למחוק מתאמן?')) onDeleteUser(u.id);}} className="text-gray-500 hover:text-red-500 transition-colors">🗑️</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {/* TAB: SETTINGS & CONTENT */}
        {activeTab === 'settings' && (
            <div className="space-y-8">
                <section className="bg-gray-800 p-6 rounded-3xl border border-gray-700 shadow-lg">
                    <h4 className="text-white font-black mb-4 flex items-center gap-2">נוסח הצהרת בריאות 📜</h4>
                    <p className="text-[10px] text-gray-500 mb-4">הטקסט שיופיע למתאמנים לפני החתימה האלקטרונית:</p>
                    <textarea 
                        className="w-full p-4 bg-gray-900 text-white rounded-2xl border border-gray-700 h-48 text-sm outline-none focus:border-brand-primary" 
                        value={appConfig.healthDeclarationTemplate || ''} 
                        placeholder="כתוב כאן את ההצהרה..."
                        onChange={e=>onUpdateAppConfig({...appConfig, healthDeclarationTemplate: e.target.value})}
                    />
                </section>

                <section className="bg-gray-800 p-6 rounded-3xl border border-gray-700 shadow-lg">
                    <h4 className="text-white font-black mb-4">ניהול מיקומים 📍</h4>
                    <div className="grid gap-3">
                        {locations.map(loc => (
                            <div key={loc.id} className="bg-gray-900 p-4 rounded-2xl flex justify-between items-center border border-gray-700">
                                <div>
                                    <p className="text-white text-sm font-bold">{loc.name}</p>
                                    <p className="text-[10px] text-gray-500">{loc.address}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => {
                                        const n = prompt('שם חדש:', loc.name);
                                        const a = prompt('כתובת חדשה:', loc.address);
                                        if(n && a) onUpdateLocations(locations.map(l => l.id === loc.id ? {...l, name: n, address: a} : l));
                                    }} className="text-blue-400 text-xs">ערוך</button>
                                    <button onClick={() => { if(confirm('למחוק מיקום?')) onUpdateLocations(locations.filter(l=>l.id!==loc.id)); }} className="text-red-500">✕</button>
                                </div>
                            </div>
                        ))}
                        <Button variant="secondary" className="w-full" onClick={()=>{
                            const name = prompt('שם המיקום:');
                            const address = prompt('כתובת לוויז:');
                            if(name && address) onUpdateLocations([...locations, { id: Date.now().toString(), name, address, color: '#A3E635' }]);
                        }}>+ הוסף מיקום</Button>
                    </div>
                </section>
            </div>
        )}

        {/* TAB: CLOUD & CONNECTION */}
        {activeTab === 'cloud' && (
            <div className="space-y-6 max-w-lg">
                <div className="bg-gray-800 p-6 rounded-3xl border border-gray-700 shadow-lg">
                    <h4 className="text-white font-black mb-4">פרטי מותג 👤</h4>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-2">
                            <input type="text" placeholder="שם בעברית" className="p-3 bg-gray-900 text-white rounded-xl border border-gray-700" defaultValue={appConfig.coachNameHeb} onBlur={e=>onUpdateAppConfig({...appConfig, coachNameHeb: e.target.value})}/>
                            <input type="text" placeholder="שם באנגלית" className="p-3 bg-gray-900 text-white rounded-xl border border-gray-700" defaultValue={appConfig.coachNameEng} onBlur={e=>onUpdateAppConfig({...appConfig, coachNameEng: e.target.value})}/>
                        </div>
                        <input type="tel" placeholder="טלפון וואטסאפ" className="w-full p-3 bg-gray-900 text-white rounded-xl border border-gray-700" defaultValue={appConfig.coachPhone} onBlur={e=>onUpdateAppConfig({...appConfig, coachPhone: e.target.value})}/>
                        <input type="text" placeholder="סיסמת ניהול (טלפון נוסף)" className="w-full p-3 bg-gray-900 text-white rounded-xl border border-gray-700" defaultValue={appConfig.coachAdditionalPhone} onBlur={e=>onUpdateAppConfig({...appConfig, coachAdditionalPhone: e.target.value})}/>
                    </div>
                </div>

                <div className="bg-gray-800 p-6 rounded-3xl border border-gray-700 shadow-lg">
                    <h4 className="text-white font-black mb-4">מזג אוויר 🌤️</h4>
                    <div className="flex gap-2">
                        <input type="text" className="flex-1 p-3 bg-gray-900 text-white rounded-xl border border-gray-700" value={weatherCityInput} onChange={e=>setWeatherCityInput(e.target.value)} placeholder="עיר ברירת מחדל..."/>
                        <Button size="sm" onClick={handleWeatherCityUpdate}>עדכן עיר</Button>
                    </div>
                </div>
            </div>
        )}

        {/* TAB: SQL GUIDE */}
        {activeTab === 'sql' && (
            <div className="bg-gray-800 p-6 rounded-3xl border border-gray-700 shadow-lg">
                <h4 className="text-white font-black mb-4">הקמת בסיס נתונים (SQL) ☁️</h4>
                <p className="text-xs text-gray-400 mb-4">העתק את הקוד הבא לתוך ה-SQL Editor ב-Supabase שלך כדי ליצור את הטבלאות המתאימות:</p>
                <div className="relative">
                    <pre className="bg-black p-4 rounded-xl text-[10px] text-brand-primary overflow-x-auto h-96 border border-gray-700 font-mono" dir="ltr">{sqlSetupScript}</pre>
                    <button onClick={() => { navigator.clipboard.writeText(sqlSetupScript); alert('הקוד הועתק!'); }} className="absolute top-2 right-2 bg-gray-800 text-white px-2 py-1 rounded text-[10px] hover:bg-gray-700 transition-colors">העתק הכל</button>
                </div>
                <div className="mt-4 p-4 bg-brand-primary/10 border border-brand-primary/30 rounded-xl">
                    <p className="text-[11px] text-brand-primary font-bold">חשוב: לאחר הרצת הסקריפט, יש להגדיר את כתובת ה-API Key וה-URL בלשונית החיבורים אם הן השתנו.</p>
                </div>
            </div>
        )}
      </div>

      {/* MODAL: EDIT USER (TRAINEE) */}
      {editUser && (
          <div className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center p-4 overflow-y-auto backdrop-blur-sm">
              <div className="bg-gray-800 p-6 rounded-3xl w-full max-w-sm border border-gray-700 shadow-2xl my-auto animate-in zoom-in-95 duration-200">
                  <h3 className="text-xl font-black text-white mb-6">ניהול מתאמן 👤</h3>
                  <div className="space-y-4">
                      <div>
                        <label className="text-[10px] text-gray-500 mr-1">שם מלא</label>
                        <input type="text" className="w-full p-3 bg-gray-900 text-white rounded-xl outline-none focus:border-brand-primary" value={editUser.fullName} onChange={e=>setEditUser({...editUser, fullName: e.target.value})}/>
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 mr-1">טלפון</label>
                        <input type="tel" className="w-full p-3 bg-gray-900 text-white rounded-xl outline-none focus:border-brand-primary" value={editUser.phone} onChange={e=>setEditUser({...editUser, phone: e.target.value})}/>
                      </div>
                      <div className="flex items-center justify-between bg-gray-900 p-3 rounded-xl border border-gray-800">
                          <span className="text-xs text-white">חסימת כניסה למערכת?</span>
                          <input type="checkbox" className="w-5 h-5 accent-red-500" checked={editUser.isRestricted} onChange={e=>setEditUser({...editUser, isRestricted: e.target.checked})}/>
                      </div>
                      <div className="flex items-center gap-3 bg-gray-900 p-3 rounded-xl">
                          <span className="text-xs text-white">צבע פרופיל:</span>
                          <input type="color" className="bg-transparent w-10 h-10 border-none cursor-pointer" value={editUser.userColor || '#A3E635'} onChange={e=>setEditUser({...editUser, userColor: e.target.value})}/>
                      </div>
                      <div className="flex gap-2 pt-2">
                          <Button className="flex-1" onClick={()=>{ if(users.find(u=>u.id===editUser.id)) onUpdateUser(editUser); else onAddUser(editUser); setEditUser(null); }}>שמור שינויים</Button>
                          <Button variant="secondary" onClick={()=>setEditUser(null)}>סגור</Button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* MODAL: ATTENDANCE & REPORTING */}
      {attendanceSession && (
          <div className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center p-4">
              <div className="bg-gray-800 p-6 rounded-3xl w-full max-w-lg border border-gray-700 max-h-[90vh] overflow-y-auto shadow-2xl">
                  <h3 className="text-xl font-black text-white mb-2">דיווח נוכחות 📱</h3>
                  <p className="text-[10px] text-gray-400 mb-6">{attendanceSession.type} - {attendanceSession.date} {attendanceSession.time}</p>
                  
                  <div className="bg-gray-900 p-4 rounded-2xl border border-gray-700 mb-6">
                      <label className="text-[10px] text-gray-500 block mb-1">הודעת וואטסאפ אישית לקבוצה:</label>
                      <textarea className="w-full p-3 bg-gray-800 text-white rounded-xl text-sm h-16 outline-none" value={messageText} onChange={e=>setMessageText(e.target.value)}/>
                  </div>

                  <div className="space-y-2 mb-6">
                      <p className="text-xs text-brand-primary font-bold">מתאמנים רשומים ({attendanceSession.registeredPhoneNumbers.length}):</p>
                      {attendanceSession.registeredPhoneNumbers.map(phone => {
                          const user = users.find(u => normalizePhone(u.phone) === normalizePhone(phone));
                          const isMarked = markedAttendees.has(phone);
                          return (
                              <div key={phone} className={`flex items-center justify-between p-3 rounded-2xl border transition-all duration-300 ${isMarked ? 'bg-brand-primary/10 border-brand-primary' : 'bg-gray-900 border-gray-800 opacity-60'}`}>
                                  <div className="flex items-center gap-3">
                                      <button 
                                        onClick={() => {
                                          const next = new Set(markedAttendees);
                                          if (next.has(phone)) next.delete(phone);
                                          else next.add(phone);
                                          setMarkedAttendees(next);
                                        }}
                                        className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center transition-all ${isMarked ? 'bg-brand-primary border-brand-primary text-black scale-105' : 'border-gray-600'}`}
                                      >
                                          {isMarked ? <span className="text-lg font-black">✓</span> : ''}
                                      </button>
                                      <div>
                                          <p className="text-white font-bold text-sm">{user?.fullName || phone}</p>
                                          <p className="text-[9px] text-gray-500">{isMarked ? 'הגיע/ה ודווח/ה' : 'טרם דווח/ה'}</p>
                                      </div>
                                  </div>
                                  <button onClick={() => window.open(`https://wa.me/${phone.startsWith('0') ? '972'+phone.substring(1) : phone}?text=${encodeURIComponent(messageText)}`)} className="bg-[#25D366] text-white p-2 rounded-xl text-[9px] font-black">WhatsApp 💬</button>
                              </div>
                          );
                      })}
                      {attendanceSession.registeredPhoneNumbers.length === 0 && <p className="text-gray-500 text-xs text-center py-4">אין מתאמנים רשומים לאימון זה</p>}
                  </div>

                  <div className="flex gap-2 sticky bottom-0 bg-gray-800 pt-3 border-t border-gray-700">
                      <Button onClick={async ()=>{ 
                          const updated = { ...attendanceSession, attendedPhoneNumbers: Array.from(markedAttendees) };
                          onUpdateSession(updated);
                          setAttendanceSession(null);
                          alert('נוכחות דווחה בהצלחה! המתאמנים המסומנים יחויבו באימון.');
                      }} className="flex-1">שמור ודווח נוכחות</Button>
                      <Button onClick={() => setAttendanceSession(null)} variant="secondary" className="flex-1">ביטול</Button>
                  </div>
              </div>
          </div>
      )}

      {/* MODAL: EDIT SESSION */}
      {editSession && (
          <div className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center p-4 overflow-y-auto">
              <div className="bg-gray-800 p-6 rounded-3xl w-full max-w-lg border border-gray-700 shadow-2xl my-auto animate-in fade-in duration-300">
                  <h3 className="text-2xl font-black text-white mb-6">פרטי אימון 🏋️</h3>
                  <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-2">
                          <div>
                              <label className="text-[10px] text-gray-500 mr-1">סוג אימון</label>
                              <select className="w-full p-3 bg-gray-900 text-white rounded-xl border border-gray-700" value={editSession.type} onChange={e=>setEditSession({...editSession, type: e.target.value})}>
                                  {workoutTypes.length > 0 ? workoutTypes.map(t=><option key={t} value={t}>{t}</option>) : <option>כללי</option>}
                              </select>
                          </div>
                          <div>
                              <label className="text-[10px] text-gray-500 mr-1">מיקום</label>
                              <select className="w-full p-3 bg-gray-900 text-white rounded-xl border border-gray-700" value={editSession.location} onChange={e=>setEditSession({...editSession, location: e.target.value})}>
                                  {locations.map(l=><option key={l.id} value={l.name}>{l.name}</option>)}
                              </select>
                          </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-[10px] text-gray-500 mr-1">תאריך</label>
                            <input type="date" className="w-full p-3 bg-gray-900 text-white rounded-xl border border-gray-700" value={editSession.date} onChange={e=>setEditSession({...editSession, date: e.target.value})}/>
                        </div>
                        <div>
                            <label className="text-[10px] text-gray-500 mr-1">שעה</label>
                            <input type="time" className="w-full p-3 bg-gray-900 text-white rounded-xl border border-gray-700" value={editSession.time} onChange={e=>setEditSession({...editSession, time: e.target.value})}/>
                        </div>
                      </div>
                      
                      <div className="relative">
                          <label className="text-[10px] text-gray-500 mr-1">תיאור (AI ימלא אם תשאירו ריק)</label>
                          <textarea className="w-full p-3 bg-gray-900 text-white rounded-xl h-24 text-sm border border-gray-700 outline-none" placeholder="אימון חזק ואיכותי..." value={editSession.description} onChange={e=>setEditSession({...editSession, description: e.target.value})}/>
                          <button onClick={async ()=>{ setIsGeneratingAi(true); const d=await generateWorkoutDescription(editSession.type as any, editSession.location); setEditSession({...editSession, description: d}); setIsGeneratingAi(false); }} className="absolute bottom-3 left-3 bg-brand-primary text-black px-2 py-1 rounded text-[10px] font-black">{isGeneratingAi ? 'מייצר...' : 'AI ✨'}</button>
                      </div>

                      <div className="flex gap-2">
                          <Button onClick={()=>{ if(sessions.find(s=>s.id===editSession.id)) onUpdateSession(editSession); else onAddSession(editSession); setEditSession(null); }} className="flex-1">שמור</Button>
                          <Button onClick={()=>setEditSession(null)} variant="secondary" className="flex-1">ביטול</Button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* ADMIN EXIT FOOTER */}
      <footer className="fixed bottom-0 left-0 right-0 p-4 flex justify-center z-40 bg-gradient-to-t from-black to-transparent pointer-events-none">
          <Button onClick={onExitAdmin} variant="secondary" className="pointer-events-auto rounded-full shadow-2xl border border-gray-600 backdrop-blur-md">חזרה לממשק מתאמנים 🔓</Button>
      </footer>
    </div>
  );
};
