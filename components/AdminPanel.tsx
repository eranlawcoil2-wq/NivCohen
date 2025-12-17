
import React, { useState, useMemo } from 'react';
import { User, TrainingSession, WeatherLocation, PaymentLink, LocationDef, AppConfig, Quote, WeatherInfo, PaymentStatus } from '../types';
import { Button } from './Button';
import { SessionCard } from './SessionCard';

interface AdminPanelProps {
  users: User[]; sessions: TrainingSession[]; primaryColor: string; workoutTypes: string[]; locations: LocationDef[];
  weatherLocation: WeatherLocation; weatherData?: Record<string, WeatherInfo>; paymentLinks: PaymentLink[];
  streakGoal: number; appConfig: AppConfig; quotes: Quote[]; deferredPrompt?: any; onInstall?: () => void;
  onAddUser: (user: User) => void; onUpdateUser: (user: User) => void; onDeleteUser: (userId: string) => void; 
  onAddSession: (session: TrainingSession) => void; onUpdateSession: (session: TrainingSession) => void; onDeleteSession: (id: string) => void;
  onColorChange: (color: string) => void; onUpdateWorkoutTypes: (types: string[]) => void; 
  onUpdateLocations: (locations: LocationDef[]) => void; onUpdateWeatherLocation: (location: WeatherLocation) => void;
  onAddPaymentLink: (link: PaymentLink) => void; onDeletePaymentLink: (id: string) => void; onUpdateStreakGoal: (goal: number) => void;
  onUpdateAppConfig: (config: AppConfig) => void; onExitAdmin: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = (props) => {
  const [activeTab, setActiveTab] = useState<'attendance' | 'users' | 'settings'>('attendance');
  const [attendanceSession, setAttendanceSession] = useState<TrainingSession | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'monthly'>('name');

  const normalizePhone = (p: string) => p.replace(/\D/g, '').replace(/^972/, '0');
  
  const weekDates = useMemo(() => {
    const sun = new Date();
    // Sunday is 0. This correctly sets the start of the week to the most recent Sunday.
    sun.setDate(sun.getDate() - sun.getDay() + (weekOffset * 7));
    return Array.from({length:7}, (_, i) => { 
        const d = new Date(sun); 
        d.setDate(sun.getDate() + i); 
        return d.toISOString().split('T')[0]; 
    });
  }, [weekOffset]);

  const filteredUsers = useMemo(() => {
      const filtered = [...props.users].filter(u => u.fullName.includes(searchTerm) || u.phone.includes(searchTerm));
      return filtered.sort((a,b) => sortBy === 'name' ? a.fullName.localeCompare(b.fullName) : 0);
  }, [props.users, searchTerm, sortBy]);

  return (
    <div className="bg-brand-black min-h-screen">
      <div className="sticky top-[140px] z-50 bg-brand-black/90 pt-4 border-b border-white/5 pb-2">
        <div className="flex gap-2 p-2 max-w-4xl mx-auto">
          {['attendance', 'users', 'settings'].map(t => (
            <button key={t} onClick={() => setActiveTab(t as any)} className={`flex-1 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === t ? 'bg-red-600 text-white shadow-xl shadow-red-600/20' : 'bg-gray-800/50 text-gray-500'}`}>
              {t === 'attendance' ? 'נוכחות' : t === 'users' ? 'מתאמנים' : 'הגדרות'}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 max-w-4xl mx-auto space-y-6 pb-24">
        {activeTab === 'attendance' && (
          <div className="space-y-6">
             <div className="flex justify-between items-center bg-gray-800/40 p-5 rounded-3xl border border-white/5 shadow-xl">
                <button onClick={()=>setWeekOffset(p=>p-1)} className="text-white text-2xl p-2 hover:text-red-500 transition-colors">←</button>
                <span className="text-red-500 font-black uppercase tracking-[0.3em] bg-red-500/10 px-4 py-1 rounded-full">{weekOffset === 0 ? 'השבוע' : `שבוע ${weekOffset}`}</span>
                <button onClick={()=>setWeekOffset(p=>p+1)} className="text-white text-2xl p-2 hover:text-red-500 transition-colors">→</button>
             </div>
             <Button onClick={() => setAttendanceSession({ id: Date.now().toString(), type: props.workoutTypes[0] || 'פונקציונלי', date: new Date().toISOString().split('T')[0], time: '18:00', location: props.locations[0]?.name || '', maxCapacity: 15, registeredPhoneNumbers: [], attendedPhoneNumbers: [], description: '' })} className="w-full py-7 rounded-[45px] bg-red-600 text-xl font-black italic uppercase shadow-2xl">+ יצירת אימון חדש</Button>
             <div className="space-y-12">
              {weekDates.map(date => {
                  const daySessions = props.sessions.filter(s => s.date === date).sort((a,b)=>a.time.localeCompare(b.time));
                  return (
                      <div key={date}>
                          <h4 className="text-gray-500 font-black text-[11px] mb-4 uppercase tracking-widest border-b border-white/5 pb-2">{new Date(date).toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'numeric' })}</h4>
                          <div className="grid grid-cols-2 gap-4">
                            {daySessions.map(s => (
                              <SessionCard 
                                key={s.id} 
                                session={s} 
                                allUsers={props.users} 
                                isRegistered={false} 
                                onRegisterClick={()=>{}} 
                                onViewDetails={(sid) => setAttendanceSession(props.sessions.find(x => x.id === sid) || null)} 
                                isAdmin={true} 
                                locations={props.locations} 
                                weather={props.weatherData?.[s.date]} 
                              />
                            ))}
                            {daySessions.length === 0 && <p className="text-gray-800 text-[8px] uppercase font-black col-span-full py-4 italic">אין אימונים מתוכננים</p>}
                          </div>
                      </div>
                  );
              })}
             </div>
          </div>
        )}

        {activeTab === 'users' && (
            <div className="space-y-6">
                <input type="text" placeholder="חיפוש מתאמן (שם או טלפון)..." className="w-full bg-gray-800 border border-white/10 p-6 rounded-[30px] text-white outline-none focus:border-red-500 shadow-xl" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
                <div className="grid gap-4">
                    {filteredUsers.map(u => (
                       <div key={u.id} className="bg-gray-800/40 p-6 rounded-[40px] border border-white/5 flex justify-between items-center hover:border-red-500/30 transition-colors cursor-pointer shadow-xl" onClick={()=>setEditingUser(u)}>
                          <div className="flex items-center gap-4">
                             <div className="w-12 h-12 rounded-full bg-gray-900 border border-white/10 flex items-center justify-center font-black text-red-500" style={{ color: u.userColor }}>{u.fullName.charAt(0)}</div>
                             <div><p className="text-white font-black italic" style={{ color: u.userColor }}>{u.fullName}</p><p className="text-[10px] text-gray-500 font-mono">{u.phone}</p></div>
                          </div>
                          <span className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${u.paymentStatus === PaymentStatus.PAID ? 'bg-green-500/20 text-green-500 border border-green-500/20' : 'bg-red-500/20 text-red-500 border border-red-500/20'}`}>{u.paymentStatus === PaymentStatus.PAID ? 'שולם' : 'חוב'}</span>
                       </div>
                    ))}
                </div>
            </div>
        )}

        {activeTab === 'settings' && (
            <div className="space-y-10">
                <div className="bg-gray-800/40 p-8 rounded-[50px] border border-white/5 space-y-8 shadow-2xl">
                    <h3 className="text-white font-black uppercase italic tracking-widest border-b border-white/10 pb-4">הודעות מערכת ⚙️</h3>
                    <div className="space-y-3">
                        <label className="text-[10px] text-red-500 font-black uppercase block">הודעה דחופה באתר</label>
                        <input className="w-full bg-red-900/10 border border-red-500/30 p-6 rounded-[30px] text-white font-black italic shadow-inner outline-none focus:border-red-500" value={props.appConfig.urgentMessage || ''} onChange={e=>props.onUpdateAppConfig({...props.appConfig, urgentMessage: e.target.value})} placeholder="הודעה דחופה באתר..." />
                    </div>
                </div>
                <Button onClick={props.onExitAdmin} variant="outline" className="w-full py-6 rounded-[40px] font-black italic uppercase">חזרה ללו"ז מתאמנים</Button>
            </div>
        )}
      </div>

      {attendanceSession && (
          <div className="fixed inset-0 bg-black/95 z-[200] flex items-center justify-center p-6 backdrop-blur-xl overflow-y-auto no-scrollbar">
              <div className="bg-gray-900 p-8 sm:p-12 rounded-[60px] w-full max-w-3xl border border-white/10 text-right shadow-3xl my-auto" dir="rtl">
                  <div className="flex justify-between mb-8 border-b border-white/5 pb-5">
                      <h3 className="text-3xl font-black text-white italic uppercase">ניהול אימון ⚙️</h3>
                      <button onClick={()=>setAttendanceSession(null)} className="text-gray-500 text-4xl hover:text-white transition-colors">✕</button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                      <div className="space-y-5">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] text-gray-500 font-black uppercase mb-1 block">סוג</label>
                                <select className="w-full bg-gray-800 border border-white/10 p-5 rounded-3xl text-white font-bold" value={attendanceSession.type} onChange={e=>setAttendanceSession({...attendanceSession, type: e.target.value})}>
                                    {props.workoutTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-500 font-black uppercase mb-1 block">מיקום</label>
                                <select className="w-full bg-gray-800 border border-white/10 p-5 rounded-3xl text-white font-bold" value={attendanceSession.location} onChange={e=>setAttendanceSession({...attendanceSession, location: e.target.value})}>
                                    {props.locations.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] text-gray-500 font-black uppercase mb-1 block">תאריך</label>
                                <input type="date" className="w-full bg-gray-800 border border-white/10 p-5 rounded-3xl text-white font-bold" value={attendanceSession.date} onChange={e=>setAttendanceSession({...attendanceSession, date: e.target.value})} />
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-500 font-black uppercase mb-1 block">שעה</label>
                                <input type="time" className="w-full bg-gray-800 border border-white/10 p-5 rounded-3xl text-white font-bold" value={attendanceSession.time} onChange={e=>setAttendanceSession({...attendanceSession, time: e.target.value})} />
                            </div>
                        </div>
                        <div>
                             <label className="text-[10px] text-gray-500 font-black uppercase mb-1 block">דגשים/הערות למתאמנים</label>
                             <textarea className="w-full bg-gray-800 border border-white/10 p-5 rounded-3xl text-white font-bold h-24" value={attendanceSession.description || ''} onChange={e=>setAttendanceSession({...attendanceSession, description: e.target.value})} placeholder="מה ללבוש? מה להביא?"></textarea>
                        </div>
                        <div className="space-y-4">
                             <div className="flex items-center gap-3">
                                <input type="checkbox" id="isZoom" className="w-5 h-5 accent-blue-500" checked={attendanceSession.isZoomSession} onChange={e=>setAttendanceSession({...attendanceSession, isZoomSession: e.target.checked})} />
                                <label htmlFor="isZoom" className="text-white text-sm font-bold">אימון זום</label>
                             </div>
                             {attendanceSession.isZoomSession && (
                                <input type="text" className="w-full bg-gray-800 border border-white/10 p-4 rounded-2xl text-blue-400 text-xs font-mono" value={attendanceSession.zoomLink || ''} onChange={e=>setAttendanceSession({...attendanceSession, zoomLink: e.target.value})} placeholder="קישור זום..." />
                             )}
                        </div>
                        <div className="flex gap-3">
                            <button onClick={()=>setAttendanceSession({...attendanceSession, isCancelled: !attendanceSession.isCancelled})} className={`flex-1 py-4 rounded-3xl font-black text-xs uppercase transition-all ${attendanceSession.isCancelled ? 'bg-red-500 text-white shadow-lg' : 'bg-transparent text-red-500 border border-red-500/30'}`}>{attendanceSession.isCancelled ? 'מבוטל ✗' : 'בטל אימון'}</button>
                            <button onClick={()=>setAttendanceSession({...attendanceSession, isHidden: !attendanceSession.isHidden})} className={`flex-1 py-4 rounded-3xl font-black text-xs uppercase transition-all ${attendanceSession.isHidden ? 'bg-gray-700 text-white shadow-lg' : 'bg-transparent text-gray-500 border border-white/10'}`}>{attendanceSession.isHidden ? 'מוסתר 👁️‍🗨️' : 'הסתר'}</button>
                        </div>
                      </div>
                      <div className="bg-gray-800/40 p-6 rounded-[35px] max-h-[500px] overflow-y-auto no-scrollbar border border-white/5 space-y-3">
                        <p className="text-gray-500 text-[10px] font-black mb-4 tracking-widest uppercase border-b border-white/5 pb-2 flex justify-between">
                            <span>נוכחות נרשמים</span>
                            <span>{attendanceSession.registeredPhoneNumbers.length}/{attendanceSession.maxCapacity}</span>
                        </p>
                        <div className="space-y-2">
                            {attendanceSession.registeredPhoneNumbers.map(phone => {
                                const u = props.users.find(user => normalizePhone(user.phone) === normalizePhone(phone));
                                const isAttended = (attendanceSession.attendedPhoneNumbers || []).includes(phone);
                                return (
                                    <div key={phone} className="flex justify-between items-center p-3 bg-gray-900/50 rounded-2xl border border-white/5">
                                        <div className="flex flex-col">
                                            <span className="text-white text-sm font-bold truncate max-w-[120px]">{u ? (u.displayName || u.fullName) : phone}</span>
                                        </div>
                                        <button onClick={() => {
                                            const curr = attendanceSession.attendedPhoneNumbers || [];
                                            const up = isAttended ? curr.filter(p => p !== phone) : [...curr, phone];
                                            setAttendanceSession({...attendanceSession, attendedPhoneNumbers: up});
                                        }} className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${isAttended ? 'bg-red-600 text-white shadow-lg' : 'bg-gray-800 text-gray-500 border border-white/5'}`}>{isAttended ? 'נכח ✓' : 'לא נכח'}</button>
                                    </div>
                                );
                            })}
                            {attendanceSession.registeredPhoneNumbers.length === 0 && <p className="text-center text-gray-700 text-xs italic py-10">אין נרשמים עדיין</p>}
                        </div>
                      </div>
                  </div>
                  <div className="mt-8 flex gap-4">
                      <Button onClick={()=>{ if (attendanceSession.id.length > 15) props.onAddSession(attendanceSession); else props.onUpdateSession(attendanceSession); setAttendanceSession(null); }} className="flex-1 bg-red-600 py-7 rounded-[45px] text-xl font-black italic uppercase shadow-2xl">שמור שינויים ✓</Button>
                      <Button onClick={()=>{if(confirm('למחוק אימון?')){props.onDeleteSession(attendanceSession.id); setAttendanceSession(null);}}} variant="danger" className="px-10 rounded-[45px]">🗑️</Button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
