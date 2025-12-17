
import React, { useState, useMemo } from 'react';
import { User, TrainingSession, LocationDef, AppConfig, WeatherLocation } from '../types';
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
    users, sessions, workoutTypes, locations, weatherLocation,
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
      const duplicated = { ...s, id: Date.now().toString(), time: nextTime, registeredPhoneNumbers: [], attendedPhoneNumbers: [], waitingList: [] };
      onAddSession(duplicated);
  };

  const handleWeatherCityUpdate = async () => {
      const coords = await getCityCoordinates(weatherCityInput);
      if (coords) {
          onUpdateWeatherLocation(coords);
          onUpdateAppConfig({ ...appConfig, defaultCity: weatherCityInput });
          alert(`מזג האוויר עודכן ל-${coords.name}`);
      } else alert('לא נמצאה העיר');
  };

  const sqlCode = `
-- 1. טבלת מתאמנים
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  fullName TEXT NOT NULL,
  displayName TEXT,
  phone TEXT UNIQUE NOT NULL,
  email TEXT,
  startDate TEXT,
  paymentStatus TEXT,
  isNew BOOLEAN DEFAULT true,
  userColor TEXT,
  monthlyRecord INTEGER DEFAULT 0,
  monthlyCount INTEGER DEFAULT 0,
  currentStreak INTEGER DEFAULT 0,
  isRestricted BOOLEAN DEFAULT false,
  healthDeclarationFile TEXT,
  healthDeclarationDate TEXT,
  healthDeclarationId TEXT
);

-- 2. טבלת אימונים
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
  isCancelled BOOLEAN DEFAULT false
);

-- 3. טבלת הגדרות כלליות
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
  `;

  return (
    <div className="bg-gray-900 min-h-screen pb-24 text-right">
      <div className="flex gap-2 p-4 bg-gray-800 sticky top-0 z-30 overflow-x-auto no-scrollbar shadow-xl border-b border-gray-700">
         {[
             {id:'attendance', label:'יומן', icon:'📅'},
             {id:'users', label:'מתאמנים', icon:'👥'},
             {id:'settings', label:'הגדרות', icon:'⚙️'},
             {id:'cloud', label:'חיבורים', icon:'☁️'},
             {id:'sql', label:'מדריך SQL', icon:'📜'}
         ].map(tab => (
             <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`px-4 py-2 rounded-xl whitespace-nowrap font-bold transition-all flex items-center gap-2 ${activeTab === tab.id ? 'bg-brand-primary text-black' : 'bg-gray-700 text-gray-300'}`}>
                 <span>{tab.icon}</span>
                 <span>{tab.label}</span>
             </button>
         ))}
      </div>

      <div className="p-4">
        {activeTab === 'attendance' && (
            <div className="space-y-6">
                <div className="flex justify-between items-center bg-gray-800 p-4 rounded-2xl border border-gray-700">
                    <h3 className="text-xl font-black text-white">לוח שבועי</h3>
                    <div className="flex gap-2">
                        <Button size="sm" onClick={() => setEditSession({ id: Date.now().toString(), type: workoutTypes[0], date: new Date().toISOString().split('T')[0], time: '18:00', location: locations[0]?.name || '', maxCapacity: 15, registeredPhoneNumbers: [], description: '' })}>+ אימון</Button>
                        <button onClick={()=>setWeekOffset(p=>p-1)} className="bg-gray-700 p-2 rounded-lg">←</button>
                        <button onClick={()=>setWeekOffset(p=>p+1)} className="bg-gray-700 p-2 rounded-lg">→</button>
                    </div>
                </div>

                {weekDates.map(date => (
                    <div key={date} className="bg-gray-800/40 p-4 rounded-3xl border border-gray-800">
                        <h4 className="text-brand-primary font-black mb-4">{new Date(date).toLocaleDateString('he-IL',{weekday:'long'})} <span className="text-xs opacity-50">{date.split('-').reverse().join('/')}</span></h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {(groupedSessions[date] || []).map(s => (
                                <div key={s.id} className="relative group">
                                    <div onClick={() => setAttendanceSession(s)} className="h-full"><SessionCard session={s} allUsers={users} isRegistered={false} onRegisterClick={()=>{}} onViewDetails={()=>{}} isAdmin={true} locations={locations}/></div>
                                    <div className="absolute bottom-2 left-2 flex gap-1 z-10">
                                        <button onClick={(e)=>{e.stopPropagation(); setEditSession(s);}} className="bg-white text-black w-8 h-8 rounded-full flex items-center justify-center shadow-xl">✏️</button>
                                        <button onClick={(e)=>{e.stopPropagation(); handleDuplicateSession(s);}} className="bg-brand-primary text-black w-8 h-8 rounded-full flex items-center justify-center shadow-xl">📑</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        )}

        {activeTab === 'users' && (
            <div className="space-y-4">
                <input type="text" placeholder="חפש מתאמן..." className="w-full p-3 bg-gray-800 text-white rounded-2xl border border-gray-700" value={userSearch} onChange={e=>setUserSearch(e.target.value)}/>
                <div className="bg-gray-800 rounded-3xl overflow-hidden border border-gray-700 overflow-x-auto">
                    <table className="w-full text-right text-xs">
                        <thead className="bg-gray-900 text-gray-400">
                            <tr>
                                <th className="p-4">מתאמן</th>
                                <th className="p-4">אימונים החודש</th>
                                <th className="p-4">רצף</th>
                                <th className="p-4">סטטוס</th>
                                <th className="p-4">פעולות</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {filteredUsers.map(u => (
                                <tr key={u.id} className="hover:bg-gray-700/30 cursor-pointer" onClick={() => setEditUser(u)}>
                                    <td className="p-4">
                                        <p className="text-white font-bold">{u.fullName} {u.isNew && <span className="text-yellow-500">🆕</span>}</p>
                                        <p className="text-[9px] text-gray-500">{u.phone}</p>
                                    </td>
                                    <td className="p-4 text-white">{u.monthlyCount || 0}</td>
                                    <td className="p-4 text-orange-500">🔥 {u.currentStreak || 0}</td>
                                    <td className="p-4">
                                        <span className={`px-2 py-0.5 rounded-full ${u.isRestricted ? 'bg-red-500/20 text-red-500' : 'bg-green-500/20 text-green-500'}`}>{u.isRestricted ? 'חסום' : 'פעיל'}</span>
                                    </td>
                                    <td className="p-4">
                                        <button onClick={(e)=>{e.stopPropagation(); if(confirm('למחוק?')) onDeleteUser(u.id);}} className="text-gray-500 hover:text-red-500">🗑️</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {activeTab === 'settings' && (
            <div className="space-y-8">
                <section>
                    <h4 className="text-white font-black mb-4">ניהול מיקומים 📍</h4>
                    <div className="grid gap-2">
                        {locations.map(loc => (
                            <div key={loc.id} className="bg-gray-800 p-3 rounded-2xl flex justify-between items-center border border-gray-700">
                                <div><p className="text-white text-sm font-bold">{loc.name}</p><p className="text-[10px] text-gray-500">{loc.address}</p></div>
                                <button onClick={() => { if(confirm('למחוק מיקום?')) { onUpdateLocations(locations.filter(l=>l.id!==loc.id)); dataService.deleteLocation(loc.id); }}} className="text-red-500">✕</button>
                            </div>
                        ))}
                        <Button variant="secondary" size="sm" onClick={()=>{
                            const name = prompt('שם:'); const address = prompt('כתובת:');
                            if(name && address) onUpdateLocations([...locations, { id: Date.now().toString(), name, address, color: '#A3E635' }]);
                        }}>+ הוסף מיקום</Button>
                    </div>
                </section>

                <section>
                    <h4 className="text-white font-black mb-4">הצהרת בריאות 📜</h4>
                    <p className="text-[10px] text-gray-500 mb-2">ערוך את הטקסט עליו יחתום המתאמן:</p>
                    <textarea className="w-full p-4 bg-gray-800 text-white rounded-2xl border border-gray-700 h-32 text-sm" value={appConfig.healthDeclarationTemplate || ''} onChange={e=>onUpdateAppConfig({...appConfig, healthDeclarationTemplate: e.target.value})}/>
                </section>
            </div>
        )}

        {activeTab === 'cloud' && (
            <div className="space-y-6 max-w-md">
                <div className="bg-gray-800 p-6 rounded-3xl border border-gray-700">
                    <h4 className="text-white font-black mb-4">פרטי מאמן 👤</h4>
                    <div className="space-y-4">
                        <input type="text" placeholder="שם בעברית" className="w-full p-3 bg-gray-900 text-white rounded-xl border border-gray-700" defaultValue={appConfig.coachNameHeb} onBlur={e=>onUpdateAppConfig({...appConfig, coachNameHeb: e.target.value})}/>
                        <input type="text" placeholder="שם באנגלית" className="w-full p-3 bg-gray-900 text-white rounded-xl border border-gray-700" defaultValue={appConfig.coachNameEng} onBlur={e=>onUpdateAppConfig({...appConfig, coachNameEng: e.target.value})}/>
                        <input type="tel" placeholder="וואטסאפ" className="w-full p-3 bg-gray-900 text-white rounded-xl border border-gray-700" defaultValue={appConfig.coachPhone} onBlur={e=>onUpdateAppConfig({...appConfig, coachPhone: e.target.value})}/>
                        <input type="text" placeholder="סיסמת ניהול" className="w-full p-3 bg-gray-900 text-white rounded-xl border border-gray-700" defaultValue={appConfig.coachAdditionalPhone} onBlur={e=>onUpdateAppConfig({...appConfig, coachAdditionalPhone: e.target.value})}/>
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'sql' && (
            <div className="bg-gray-800 p-6 rounded-3xl border border-gray-700">
                <h4 className="text-white font-black mb-4">הוראות Supabase ☁️</h4>
                <p className="text-xs text-gray-400 mb-4">העתק את הקוד הבא והדבק אותו ב-SQL Editor בלוח הבקרה של Supabase:</p>
                <pre className="bg-black p-4 rounded-xl text-[10px] text-brand-primary overflow-x-auto" dir="ltr">{sqlCode}</pre>
            </div>
        )}
      </div>

      {/* Trainee Edit Modal */}
      {editUser && (
          <div className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center p-4 overflow-y-auto">
              <div className="bg-gray-800 p-6 rounded-3xl w-full max-w-sm border border-gray-700 shadow-2xl">
                  <h3 className="text-xl font-black text-white mb-6">עריכת מתאמן 👤</h3>
                  <div className="space-y-4">
                      <input type="text" className="w-full p-3 bg-gray-900 text-white rounded-xl" defaultValue={editUser.fullName} onBlur={e=>setEditUser({...editUser, fullName: e.target.value})}/>
                      <input type="tel" className="w-full p-3 bg-gray-900 text-white rounded-xl" defaultValue={editUser.phone} onBlur={e=>setEditUser({...editUser, phone: e.target.value})}/>
                      <div className="flex items-center justify-between bg-gray-900 p-3 rounded-xl">
                          <span className="text-xs text-white">חסום?</span>
                          <input type="checkbox" checked={editUser.isRestricted} onChange={e=>setEditUser({...editUser, isRestricted: e.target.checked})}/>
                      </div>
                      <div className="flex gap-2">
                          <Button className="flex-1" onClick={()=>{ onUpdateUser(editUser); setEditUser(null); }}>שמור</Button>
                          <Button variant="secondary" onClick={()=>setEditUser(null)}>סגור</Button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Edit Session Modal */}
      {editSession && (
          <div className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center p-4">
              <div className="bg-gray-800 p-6 rounded-3xl w-full max-w-lg border border-gray-700 shadow-2xl overflow-y-auto max-h-[90vh]">
                  <h3 className="text-2xl font-black text-white mb-6">פרטי אימון 🏋️</h3>
                  <div className="space-y-4">
                      <select className="w-full p-3 bg-gray-900 text-white rounded-xl" value={editSession.type} onChange={e=>setEditSession({...editSession, type: e.target.value})}>{workoutTypes.map(t=><option key={t} value={t}>{t}</option>)}</select>
                      <select className="w-full p-3 bg-gray-900 text-white rounded-xl" value={editSession.location} onChange={e=>setEditSession({...editSession, location: e.target.value})}>{locations.map(l=><option key={l.id} value={l.name}>{l.name}</option>)}</select>
                      <div className="grid grid-cols-2 gap-2">
                        <input type="date" className="p-3 bg-gray-900 text-white rounded-xl" value={editSession.date} onChange={e=>setEditSession({...editSession, date: e.target.value})}/>
                        <input type="time" className="p-3 bg-gray-900 text-white rounded-xl" value={editSession.time} onChange={e=>setEditSession({...editSession, time: e.target.value})}/>
                      </div>
                      <textarea className="w-full p-3 bg-gray-900 text-white rounded-xl h-24" placeholder="תיאור..." value={editSession.description} onChange={e=>setEditSession({...editSession, description: e.target.value})}/>
                      <div className="flex gap-2">
                          <Button onClick={()=>{ if(sessions.find(s=>s.id===editSession.id)) onUpdateSession(editSession); else onAddSession(editSession); setEditSession(null); }} className="flex-1">שמור</Button>
                          <Button onClick={()=>{ if(confirm('למחוק אימון?')) { onDeleteSession(editSession.id); setEditSession(null); } }} variant="danger">מחק</Button>
                          <Button onClick={()=>setEditSession(null)} variant="secondary">ביטול</Button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Attendance Modal */}
      {attendanceSession && (
          <div className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center p-4">
              <div className="bg-gray-800 p-6 rounded-3xl w-full max-w-lg border border-gray-700 max-h-[90vh] overflow-y-auto">
                  <h3 className="text-xl font-black text-white mb-4">נוכחות והודעות 📱</h3>
                  <textarea className="w-full p-3 bg-gray-900 text-white rounded-xl mb-4 text-sm" placeholder="טקסט פוש..." value={messageText} onChange={e=>setMessageText(e.target.value)}/>
                  <div className="space-y-2 mb-6">
                      {attendanceSession.registeredPhoneNumbers.map(phone => (
                          <div key={phone} className="flex items-center justify-between p-3 bg-gray-900 rounded-2xl border border-gray-800">
                              <span className="text-white text-sm">{users.find(u=>normalizePhone(u.phone)===phone)?.fullName || phone}</span>
                              <button onClick={()=>window.open(`https://wa.me/${phone}?text=${encodeURIComponent(messageText)}`)} className="bg-green-600 text-white px-3 py-1 rounded-full text-xs">WhatsApp</button>
                          </div>
                      ))}
                  </div>
                  <Button onClick={()=>setAttendanceSession(null)} className="w-full">סגור</Button>
              </div>
          </div>
      )}

      <footer className="fixed bottom-0 left-0 right-0 p-4 flex justify-center z-40">
          <Button onClick={onExitAdmin} variant="secondary" className="rounded-full shadow-2xl">יציאה מהניהול 🔓</Button>
      </footer>
    </div>
  );
};
