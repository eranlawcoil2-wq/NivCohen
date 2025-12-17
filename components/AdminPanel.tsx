import React, { useState, useMemo } from 'react';
import { User, TrainingSession, PaymentStatus, WeatherLocation, LocationDef, AppConfig, Quote } from '../types';
import { Button } from './Button';
import { generateWorkoutDescription } from '../services/geminiService';
import { SessionCard } from './SessionCard';
import { dataService } from '../services/dataService';

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

const normalizePhoneForWhatsapp = (phone: string): string => {
    let p = normalizePhone(phone);
    if (p.startsWith('0')) p = '972' + p.substring(1);
    return p;
};

export const AdminPanel: React.FC<AdminPanelProps> = ({ 
    users, sessions, workoutTypes, locations, weatherLocation,
    appConfig, onAddUser, onUpdateUser, onDeleteUser, 
    onAddSession, onUpdateSession, onDeleteSession,
    onUpdateWorkoutTypes, onUpdateLocations, onUpdateWeatherLocation, onUpdateAppConfig, onExitAdmin
}) => {
  const [activeTab, setActiveTab] = useState<'attendance' | 'users' | 'settings' | 'cloud'>('attendance');
  const [weekOffset, setWeekOffset] = useState(0);
  const [attendanceSession, setAttendanceSession] = useState<TrainingSession | null>(null);
  const [editSession, setEditSession] = useState<TrainingSession | null>(null);
  const [markedAttendees, setMarkedAttendees] = useState<Set<string>>(new Set());
  const [messageText, setMessageText] = useState('היי! מחכה לך באימון היום 💪');
  const [userSearch, setUserSearch] = useState('');
  const [userSort, setUserSort] = useState<'name' | 'workouts'>('name');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  // Week Dates calculation
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

  // Filter and Sort Users
  const filteredUsers = useMemo(() => {
      return [...users]
        .filter(u => u.fullName.includes(userSearch) || u.phone.includes(userSearch))
        .sort((a, b) => {
            if (userSort === 'name') return a.fullName.localeCompare(b.fullName);
            return (b.monthlyRecord || 0) - (a.monthlyRecord || 0);
        });
  }, [users, userSearch, userSort]);

  const newUsers = filteredUsers.filter(u => u.isNew);
  const regularUsers = filteredUsers.filter(u => !u.isNew);

  const handleOpenAttendance = (session: TrainingSession) => {
      setAttendanceSession(session);
      // Auto-check everyone who is registered
      setMarkedAttendees(new Set(session.attendedPhoneNumbers?.length ? session.attendedPhoneNumbers : session.registeredPhoneNumbers));
  };

  return (
    <div className="bg-gray-900 min-h-screen pb-20 text-right">
      {/* Navigation Tabs */}
      <div className="flex gap-2 p-4 bg-gray-800 sticky top-0 z-30 overflow-x-auto no-scrollbar shadow-xl border-b border-gray-700">
         {[
             {id:'attendance', label:'יומן ונוכחות', icon:'📅'},
             {id:'users', label:'מתאמנים', icon:'👥'},
             {id:'settings', label:'הגדרות אימון', icon:'⚙️'},
             {id:'cloud', label:'חיבורים', icon:'☁️'}
         ].map(tab => (
             <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`px-4 py-2 rounded-xl whitespace-nowrap font-bold transition-all flex items-center gap-2 ${activeTab === tab.id ? 'bg-brand-primary text-black shadow-lg shadow-brand-primary/20' : 'bg-gray-700 text-gray-300'}`}>
                 <span>{tab.icon}</span>
                 <span>{tab.label}</span>
             </button>
         ))}
      </div>

      <div className="p-4">
        {/* TAB: ATTENDANCE */}
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
                        <div className="flex justify-between items-end mb-4">
                            <h4 className="text-brand-primary font-black text-lg">{new Date(date).toLocaleDateString('he-IL',{weekday:'long'})} <span className="text-xs opacity-50">{date.split('-').reverse().join('/')}</span></h4>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {(groupedSessions[date] || []).map(s => (
                                <div key={s.id} className="relative group">
                                    <div onClick={() => handleOpenAttendance(s)} className="h-full">
                                        <SessionCard session={s} allUsers={users} isRegistered={false} onRegisterClick={()=>{}} onViewDetails={()=>{}} isAdmin={true} locations={locations}/>
                                    </div>
                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1">
                                        <button onClick={(e)=>{e.stopPropagation(); setEditSession(s);}} className="bg-white text-black p-1.5 rounded-full text-[10px] font-bold">ערוך ✏️</button>
                                        <button onClick={(e)=>{e.stopPropagation(); onAddSession({...s, id: Date.now().toString(), registeredPhoneNumbers:[], attendedPhoneNumbers:[], date: new Date(new Date(s.date).setDate(new Date(s.date).getDate()+7)).toISOString().split('T')[0]}); alert('שוכפל לשבוע הבא');}} className="bg-brand-primary text-black p-1.5 rounded-full text-[10px] font-bold">שכפל 📑</button>
                                    </div>
                                </div>
                            ))}
                            <button onClick={() => setEditSession({ id: Date.now().toString(), type: workoutTypes[0], date, time: '18:00', location: locations[0]?.name || '', maxCapacity: 15, registeredPhoneNumbers: [], description: '' })} className="border-2 border-dashed border-gray-700 rounded-2xl flex items-center justify-center text-gray-500 hover:border-brand-primary hover:text-brand-primary transition-all p-4">
                                + הוסף אימון
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        )}

        {/* TAB: USERS */}
        {activeTab === 'users' && (
            <div className="space-y-4">
                <div className="flex gap-2">
                    <input type="text" placeholder="חפש לפי שם או טלפון..." className="flex-1 p-3 bg-gray-800 text-white rounded-2xl border border-gray-700 focus:border-brand-primary outline-none" value={userSearch} onChange={e=>setUserSearch(e.target.value)}/>
                    <select className="bg-gray-800 text-white p-3 rounded-2xl border border-gray-700" value={userSort} onChange={e=>setUserSort(e.target.value as any)}>
                        <option value="name">לפי שם</option>
                        <option value="workouts">לפי אימונים</option>
                    </select>
                </div>

                {newUsers.length > 0 && (
                    <div className="bg-yellow-900/20 border border-yellow-700/50 p-4 rounded-3xl space-y-3">
                        <h4 className="text-yellow-500 font-black">מתאמנים חדשים (ממתינים לאישור) 🆕</h4>
                        {newUsers.map(u => (
                            <div key={u.id} className="bg-gray-800 p-4 rounded-2xl flex justify-between items-center border border-gray-700">
                                <div>
                                    <p className="text-white font-bold">{u.fullName}</p>
                                    <p className="text-xs text-gray-500">{u.phone}</p>
                                </div>
                                <Button size="sm" onClick={() => onUpdateUser({...u, isNew: false})}>אשר מתאמן ✅</Button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="bg-gray-800 rounded-3xl overflow-hidden border border-gray-700">
                    <table className="w-full text-right">
                        <thead className="bg-gray-900 text-gray-400 text-xs">
                            <tr>
                                <th className="p-4">מתאמן</th>
                                <th className="p-4">הצהרת בריאות</th>
                                <th className="p-4">סטטוס</th>
                                <th className="p-4">פעולות</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {regularUsers.map(u => (
                                <tr key={u.id} className="hover:bg-gray-700/30 transition-colors">
                                    <td className="p-4">
                                        <p className="text-white font-bold">{u.fullName}</p>
                                        <p className="text-[10px] text-gray-500">{u.phone} | {u.email || 'ללא מייל'}</p>
                                    </td>
                                    <td className="p-4">
                                        {u.healthDeclarationDate ? (
                                            <div className="flex flex-col gap-1">
                                                <span className="text-green-500 text-xs font-bold">✓ חתום</span>
                                                {u.healthDeclarationFile && <button onClick={()=>window.open(u.healthDeclarationFile)} className="text-[10px] text-brand-primary underline">צפה בקובץ</button>}
                                            </div>
                                        ) : <span className="text-red-500 text-xs font-bold">✕ לא חתום</span>}
                                    </td>
                                    <td className="p-4">
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${u.isRestricted ? 'bg-red-500/20 text-red-500' : 'bg-green-500/20 text-green-500'}`}>
                                            {u.isRestricted ? 'חסום' : 'פעיל'}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex gap-2">
                                            <button onClick={()=>onUpdateUser({...u, isRestricted: !u.isRestricted})} className="text-gray-400 hover:text-white">🚫</button>
                                            <button onClick={()=>{if(confirm('למחוק מתאמן?')) onDeleteUser(u.id);}} className="text-gray-400 hover:text-red-500">🗑️</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {/* TAB: SETTINGS (WORKOUTS, LOCATIONS, QUOTES) */}
        {activeTab === 'settings' && (
            <div className="space-y-8">
                <section>
                    <h4 className="text-white font-black mb-4">ניהול מיקומים 📍</h4>
                    <div className="grid gap-2">
                        {locations.map(loc => (
                            <div key={loc.id} className="bg-gray-800 p-3 rounded-2xl flex justify-between items-center border border-gray-700">
                                <div className="flex items-center gap-3">
                                    <div className="w-3 h-3 rounded-full" style={{backgroundColor: loc.color}}/>
                                    <div>
                                        <p className="text-white text-sm font-bold">{loc.name}</p>
                                        <p className="text-[10px] text-gray-500">{loc.address}</p>
                                    </div>
                                </div>
                                <button onClick={() => dataService.deleteLocation(loc.id).then(()=>onUpdateLocations(locations.filter(l=>l.id!==loc.id)))} className="text-red-500">✕</button>
                            </div>
                        ))}
                        <Button variant="secondary" size="sm" onClick={()=>{
                            const name = prompt('שם המיקום:');
                            const address = prompt('כתובת לוויז:');
                            if(name && address) {
                                const newLoc = { id: Date.now().toString(), name, address, color: '#'+Math.floor(Math.random()*16777215).toString(16) };
                                onUpdateLocations([...locations, newLoc]);
                                dataService.saveLocations([...locations, newLoc]);
                            }
                        }}>+ הוסף מיקום</Button>
                    </div>
                </section>

                <section>
                    <h4 className="text-white font-black mb-4">סוגי אימונים 🏋️</h4>
                    <div className="flex flex-wrap gap-2">
                        {workoutTypes.map(type => (
                            <div key={type} className="bg-gray-800 px-3 py-1 rounded-full border border-gray-700 flex items-center gap-2">
                                <span className="text-sm text-white">{type}</span>
                                <button onClick={() => {
                                    const next = workoutTypes.filter(t=>t!==type);
                                    onUpdateWorkoutTypes(next);
                                    dataService.saveWorkoutTypes(next);
                                }} className="text-red-500">✕</button>
                            </div>
                        ))}
                        <button onClick={()=>{
                            const t = prompt('סוג אימון חדש:');
                            if(t) {
                                const next = [...workoutTypes, t];
                                onUpdateWorkoutTypes(next);
                                dataService.saveWorkoutTypes(next);
                            }
                        }} className="bg-brand-primary text-black px-3 py-1 rounded-full text-sm font-bold">+ הוסף</button>
                    </div>
                </section>
            </div>
        )}

        {/* TAB: CLOUD / CONNECTIONS */}
        {activeTab === 'cloud' && (
            <div className="space-y-6 max-w-md">
                <div className="bg-gray-800 p-6 rounded-3xl border border-gray-700">
                    <h4 className="text-white font-black mb-4">הגדרות חיבור ענן ☁️</h4>
                    <p className="text-xs text-gray-500 mb-4">כאן מגדירים את החיבור למסד הנתונים Supabase כדי שהמידע יישמר בענן ולא רק במכשיר.</p>
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs text-gray-400 mr-1">Project URL</label>
                            <input type="text" className="w-full p-3 bg-gray-900 text-white rounded-xl border border-gray-700" placeholder="https://xyz.supabase.co" onChange={e=>localStorage.setItem('niv_app_supabase_url', e.target.value)} defaultValue={localStorage.getItem('niv_app_supabase_url') || ''}/>
                        </div>
                        <div>
                            <label className="text-xs text-gray-400 mr-1">Anon Key</label>
                            <input type="password" className="w-full p-3 bg-gray-900 text-white rounded-xl border border-gray-700" placeholder="eyJhbG..." onChange={e=>localStorage.setItem('niv_app_supabase_key', e.target.value)} defaultValue={localStorage.getItem('niv_app_supabase_key') || ''}/>
                        </div>
                        <Button className="w-full" onClick={()=>window.location.reload()}>שמור ורענן חיבור</Button>
                    </div>
                </div>

                <div className="bg-gray-800 p-6 rounded-3xl border border-gray-700">
                    <h4 className="text-white font-black mb-4">הגדרות מאמן 👤</h4>
                    <div className="space-y-3">
                        <input type="text" className="w-full p-3 bg-gray-900 text-white rounded-xl border border-gray-700" placeholder="שם המאמן" defaultValue={appConfig.coachNameHeb} onBlur={e=>onUpdateAppConfig({...appConfig, coachNameHeb: e.target.value})}/>
                        <input type="password" className="w-full p-3 bg-gray-900 text-white rounded-xl border border-gray-700" placeholder="סיסמת ניהול" defaultValue={appConfig.coachAdditionalPhone} onBlur={e=>onUpdateAppConfig({...appConfig, coachAdditionalPhone: e.target.value})}/>
                    </div>
                </div>
            </div>
        )}
      </div>

      {/* MODAL: EDIT SESSION */}
      {editSession && (
          <div className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center p-4 overflow-y-auto">
              <div className="bg-gray-800 p-6 rounded-3xl w-full max-w-lg border border-gray-700 shadow-2xl my-auto">
                  <h3 className="text-2xl font-black text-white mb-6">עריכת אימון ✏️</h3>
                  <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                              <label className="text-[10px] text-gray-500 mr-1">סוג</label>
                              <select className="w-full p-3 bg-gray-900 text-white rounded-xl border border-gray-700" value={editSession.type} onChange={e=>setEditSession({...editSession, type: e.target.value})}>{workoutTypes.map(t=><option key={t} value={t}>{t}</option>)}</select>
                          </div>
                          <div className="space-y-1">
                              <label className="text-[10px] text-gray-500 mr-1">מיקום</label>
                              <select className="w-full p-3 bg-gray-900 text-white rounded-xl border border-gray-700" value={editSession.location} onChange={e=>setEditSession({...editSession, location: e.target.value})}>{locations.map(l=><option key={l.id} value={l.name}>{l.name}</option>)}</select>
                          </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                          <input type="date" className="p-3 bg-gray-900 text-white rounded-xl border border-gray-700" value={editSession.date} onChange={e=>setEditSession({...editSession, date: e.target.value})}/>
                          <input type="time" className="p-3 bg-gray-900 text-white rounded-xl border border-gray-700" value={editSession.time} onChange={e=>setEditSession({...editSession, time: e.target.value})}/>
                      </div>

                      <div className="bg-gray-900 p-4 rounded-2xl border border-gray-700">
                          <p className="text-[10px] text-gray-500 mb-2">פורמט:</p>
                          <div className="flex gap-2">
                              <button onClick={()=>setEditSession({...editSession, isZoomSession: false, isHybrid: false})} className={`flex-1 p-2 rounded-lg text-xs font-bold ${!editSession.isZoomSession && !editSession.isHybrid ? 'bg-brand-primary text-black' : 'bg-gray-800 text-gray-400'}`}>🌲 שטח</button>
                              <button onClick={()=>setEditSession({...editSession, isZoomSession: true, isHybrid: false})} className={`flex-1 p-2 rounded-lg text-xs font-bold ${editSession.isZoomSession && !editSession.isHybrid ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}>🎥 זום</button>
                              <button onClick={()=>setEditSession({...editSession, isZoomSession: true, isHybrid: true})} className={`flex-1 p-2 rounded-lg text-xs font-bold ${editSession.isHybrid ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400'}`}>🏠+🎥 היברידי</button>
                          </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                          <div className="flex items-center gap-2 bg-gray-900 p-3 rounded-xl border border-gray-700">
                              <input type="checkbox" id="hidden" className="w-4 h-4 accent-purple-600" checked={editSession.isHidden} onChange={e=>setEditSession({...editSession, isHidden: e.target.checked})}/>
                              <label htmlFor="hidden" className="text-xs text-white">נסתר 👻</label>
                          </div>
                          <div className="flex items-center gap-2 bg-red-900/10 p-3 rounded-xl border border-red-900/30">
                              <input type="checkbox" id="cancel" className="w-4 h-4 accent-red-600" checked={editSession.isCancelled} onChange={e=>setEditSession({...editSession, isCancelled: e.target.checked})}/>
                              <label htmlFor="cancel" className="text-xs text-red-500 font-bold">מבוטל 🚫</label>
                          </div>
                      </div>

                      <div className="relative">
                          <textarea placeholder="תיאור..." className="w-full p-3 bg-gray-900 text-white rounded-xl border border-gray-700 h-24 text-sm" value={editSession.description} onChange={e=>setEditSession({...editSession, description: e.target.value})}/>
                          <button onClick={async ()=>{setIsGeneratingAi(true); const d=await generateWorkoutDescription(editSession.type as any, editSession.location); setEditSession({...editSession, description: d}); setIsGeneratingAi(false);}} className="absolute bottom-3 left-3 bg-brand-primary text-black px-2 py-1 rounded text-[10px] font-black">{isGeneratingAi?'מייצר...':'AI ✨'}</button>
                      </div>

                      <div className="flex gap-2">
                          <Button onClick={()=>{ if(sessions.find(s=>s.id===editSession.id)) onUpdateSession(editSession); else onAddSession(editSession); setEditSession(null); }} className="flex-1">שמור</Button>
                          <Button onClick={()=>onDeleteSession(editSession.id)} variant="danger">מחק</Button>
                          <Button onClick={()=>setEditSession(null)} variant="secondary">ביטול</Button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* MODAL: ATTENDANCE & PUSH */}
      {attendanceSession && (
          <div className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center p-4">
              <div className="bg-gray-800 p-6 rounded-3xl w-full max-w-lg border border-gray-700 max-h-[90vh] overflow-y-auto">
                  <h3 className="text-xl font-black text-white mb-4">ניהול נוכחות והודעות 📱</h3>
                  
                  <div className="bg-gray-900 p-4 rounded-2xl border border-gray-700 mb-6">
                      <label className="text-[10px] text-gray-500 block mb-1">טקסט להודעת וואטסאפ ("הפוש"):</label>
                      <textarea className="w-full p-3 bg-gray-800 text-white rounded-xl border border-gray-700 text-sm h-20 outline-none focus:border-brand-primary" value={messageText} onChange={e=>setMessageText(e.target.value)}/>
                  </div>

                  <div className="space-y-2 mb-6">
                      {attendanceSession.registeredPhoneNumbers.map(phone => {
                          const user = users.find(u => normalizePhone(u.phone) === phone);
                          const isMarked = markedAttendees.has(phone);
                          return (
                              <div key={phone} className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${isMarked ? 'bg-green-900/20 border-green-500/50' : 'bg-gray-900 border-gray-800 opacity-60'}`}>
                                  <div className="flex items-center gap-3">
                                      <button onClick={() => {
                                          const next = new Set(markedAttendees);
                                          if (next.has(phone)) next.delete(phone);
                                          else next.add(phone);
                                          setMarkedAttendees(next);
                                      }} className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${isMarked ? 'bg-green-500 border-green-500 text-white shadow-lg' : 'border-gray-600'}`}>
                                          {isMarked ? '✓' : ''}
                                      </button>
                                      <div>
                                          <p className="text-white font-bold text-sm">{user?.fullName || phone}</p>
                                          <p className="text-[10px] text-gray-500">{phone}</p>
                                      </div>
                                  </div>
                                  <button onClick={() => window.open(`https://wa.me/${normalizePhoneForWhatsapp(phone)}?text=${encodeURIComponent(messageText)}`, '_blank')} className="bg-[#25D366] text-white p-2 rounded-xl px-4 text-[10px] font-black shadow-lg active:scale-95 transition-transform">WhatsApp 💬</button>
                              </div>
                          );
                      })}
                  </div>

                  <div className="flex gap-2 sticky bottom-0 bg-gray-800 pt-3 border-t border-gray-700">
                      <Button onClick={async ()=>{ await onUpdateSession({...attendanceSession, attendedPhoneNumbers: Array.from(markedAttendees)}); setAttendanceSession(null); }} className="flex-1">שמור נוכחות</Button>
                      <Button onClick={() => setAttendanceSession(null)} variant="secondary" className="flex-1">סגור</Button>
                  </div>
              </div>
          </div>
      )}

      {/* FOOTER ACTION */}
      <footer className="fixed bottom-0 left-0 right-0 p-4 flex justify-center z-40 bg-gradient-to-t from-black to-transparent pointer-events-none">
          <Button onClick={onExitAdmin} variant="secondary" className="pointer-events-auto rounded-full shadow-2xl border border-gray-600">יציאה מהניהול 🔓</Button>
      </footer>
    </div>
  );
};