
import React, { useState, useMemo } from 'react';
import { User, TrainingSession, WeatherLocation, PaymentLink, LocationDef, AppConfig, Quote, WeatherInfo, PaymentStatus } from '../types';
import { Button } from './Button';
import { SessionCard } from './SessionCard';
import { getWeatherIcon } from '../services/weatherService';

interface AdminPanelProps {
  users: User[]; sessions: TrainingSession[]; primaryColor: string; workoutTypes: string[]; locations: LocationDef[];
  weatherLocation: WeatherLocation; weatherData?: Record<string, WeatherInfo>; paymentLinks: PaymentLink[];
  streakGoal: number; appConfig: AppConfig; quotes?: Quote[];
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
  const [sortBy, setSortBy] = useState<'name' | 'workouts' | 'payment'>('name');
  const [whatsappTemplate, setWhatsappTemplate] = useState('היי! מזכיר שקבענו לאימון {type} ב-{time} ב-{location}. מחכה לכם! 🚀');

  const normalizePhone = (p: string) => p.replace(/\D/g, '').replace(/^972/, '0');
  
  const weekDates = useMemo(() => {
    const sun = new Date(); sun.setDate(sun.getDate() - sun.getDay() + (weekOffset * 7));
    return Array.from({length:7}, (_, i) => { const d = new Date(sun); d.setDate(sun.getDate() + i); return d.toISOString().split('T')[0]; });
  }, [weekOffset]);

  const handleDuplicate = (s: TrainingSession) => {
      const [h, m] = s.time.split(':').map(Number);
      const newTime = `${((h + 1) % 24).toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      props.onAddSession({ ...s, id: Date.now().toString() + Math.random().toString(36).substr(2, 5), time: newTime, registeredPhoneNumbers: [], attendedPhoneNumbers: undefined, manualHasStarted: false });
  };

  const filteredUsers = useMemo(() => {
      const filtered = props.users.filter(u => u.fullName.includes(searchTerm) || u.phone.includes(searchTerm));
      return filtered.sort((a,b) => {
          if (sortBy === 'name') return a.fullName.localeCompare(b.fullName);
          if (sortBy === 'workouts') return (b.monthlyRecord || 0) - (a.monthlyRecord || 0);
          return a.paymentStatus.localeCompare(b.paymentStatus);
      });
  }, [props.users, searchTerm, sortBy]);

  const sendWhatsApp = (p: string, session: TrainingSession) => {
      const u = props.users.find(x => normalizePhone(x.phone) === normalizePhone(p));
      let msg = whatsappTemplate
        .replace('{type}', session.type)
        .replace('{time}', session.time)
        .replace('{location}', session.location);
      
      const cleanPhone = p.startsWith('0') ? '972' + p.substring(1) : p;
      window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="bg-brand-black min-h-screen">
      <div className="flex gap-2 p-4 sticky top-[72px] bg-brand-black z-30 border-b border-gray-800 no-scrollbar overflow-x-auto">
        {[ {id:'attendance',label:'יומן'}, {id:'users',label:'מתאמנים'}, {id:'settings',label:'הגדרות'} ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id as any)} className={`px-8 py-3 rounded-full text-[10px] font-black transition-all uppercase tracking-widest ${activeTab === t.id ? 'bg-red-600 text-white shadow-xl shadow-red-600/20' : 'bg-gray-800 text-gray-500'}`}>{t.label}</button>
        ))}
      </div>

      <div className="p-4 space-y-6">
        {activeTab === 'attendance' && (
          <div className="space-y-6">
             <div className="flex justify-between items-center bg-gray-800 p-4 rounded-3xl border border-gray-700">
                <button onClick={()=>setWeekOffset(p=>p-1)} className="text-white">←</button>
                <span className="text-red-500 font-black text-[10px] uppercase tracking-widest">{weekOffset === 0 ? 'השבוע' : `שבוע ${weekOffset}`}</span>
                <button onClick={()=>setWeekOffset(p=>p+1)} className="text-white">→</button>
             </div>
             <Button onClick={() => setAttendanceSession({ id: Date.now().toString(), type: props.workoutTypes[0], date: new Date().toISOString().split('T')[0], time: '18:00', location: props.locations[0]?.name || '', maxCapacity: 15, registeredPhoneNumbers: [], attendedPhoneNumbers: [] })} className="w-full py-5 rounded-[40px] bg-red-600 shadow-2xl">+ אימון חדש</Button>
             {weekDates.map(date => {
                const daySessions = props.sessions.filter(s => s.date === date).sort((a,b)=>a.time.localeCompare(b.time));
                return (
                    <div key={date} className={`rounded-[50px] p-8 border-2 ${date === new Date().toISOString().split('T')[0] ? 'bg-red-500/10 border-red-500/40' : 'bg-gray-900/40 border-gray-800/30'} mb-6`}>
                        <div className="text-white font-black text-[10px] mb-8 border-b border-gray-800 pb-2 flex justify-between uppercase tracking-widest">
                            <span>{new Date(date).toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'numeric' })}</span>
                            {props.weatherData?.[date] && <span className="opacity-50">{getWeatherIcon(props.weatherData[date].weatherCode)} {Math.round(props.weatherData[date].maxTemp)}°</span>}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                          {daySessions.map(s => <SessionCard key={s.id} session={s} allUsers={props.users} isRegistered={false} onRegisterClick={()=>{}} onViewDetails={()=>setAttendanceSession(s)} onDuplicate={handleDuplicate} isAdmin={true} locations={props.locations} />)}
                        </div>
                    </div>
                );
             })}
          </div>
        )}

        {activeTab === 'users' && (
            <div className="space-y-4">
                <div className="flex gap-2">
                    <input type="text" placeholder="חיפוש מתאמן..." className="flex-1 bg-gray-800 border border-gray-700 p-4 rounded-2xl text-white outline-none focus:border-red-500" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
                    <select className="bg-gray-800 border border-gray-700 p-4 rounded-2xl text-white text-[10px] uppercase font-black" value={sortBy} onChange={e=>setSortBy(e.target.value as any)}>
                        <option value="name">שם</option>
                        <option value="workouts">אימונים</option>
                        <option value="payment">תשלום</option>
                    </select>
                </div>
                <div className="grid gap-3">
                    {filteredUsers.map(u => (
                       <div key={u.id} className="bg-gray-800/60 p-6 rounded-[30px] border border-gray-700 flex justify-between items-center cursor-pointer hover:border-red-500 transition-all" onClick={()=>setEditingUser(u)}>
                          <div className="flex gap-4 items-center">
                             <div className="w-12 h-12 rounded-full flex items-center justify-center font-black bg-gray-900 border border-gray-700 text-red-500">{u.fullName.charAt(0)}</div>
                             <div>
                                <div className="text-white font-black">{u.fullName}</div>
                                <div className="text-[10px] text-gray-500">{u.phone}</div>
                             </div>
                          </div>
                          <div className="text-right flex gap-4">
                             <div className="text-center"><p className="text-[8px] text-gray-600 uppercase">אימונים</p><p className="text-red-500 font-black">{u.monthlyRecord || 0}</p></div>
                             <div className={`w-3 h-3 rounded-full mt-2 ${u.paymentStatus === PaymentStatus.PAID ? 'bg-green-500' : 'bg-red-500'}`}></div>
                          </div>
                       </div>
                    ))}
                </div>
            </div>
        )}

        {activeTab === 'settings' && (
            <div className="space-y-8 bg-gray-800/50 p-8 rounded-[40px] border border-gray-700">
                <h3 className="text-white font-black uppercase italic tracking-widest border-b border-gray-700 pb-2">הגדרות מערכת</h3>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="text-[8px] text-gray-500 uppercase font-black">שם המאמן (עברית)</label>
                        <input className="w-full bg-gray-900 border border-gray-700 p-4 rounded-2xl text-white mt-1" value={props.appConfig.coachNameHeb} onChange={e=>props.onUpdateAppConfig({...props.appConfig, coachNameHeb: e.target.value})} /></div>
                        <div><label className="text-[8px] text-gray-500 uppercase font-black">Coach Name (Eng)</label>
                        <input className="w-full bg-gray-900 border border-gray-700 p-4 rounded-2xl text-white mt-1" value={props.appConfig.coachNameEng} onChange={e=>props.onUpdateAppConfig({...props.appConfig, coachNameEng: e.target.value})} /></div>
                    </div>
                    <div><label className="text-[8px] text-gray-500 uppercase font-black">סיסמת מאמן</label>
                    <input className="w-full bg-gray-900 border border-gray-700 p-4 rounded-2xl text-white mt-1" value={props.appConfig.coachAdditionalPhone} onChange={e=>props.onUpdateAppConfig({...props.appConfig, coachAdditionalPhone: e.target.value})} /></div>
                    <div><label className="text-[8px] text-gray-500 uppercase font-black">הודעה דחופה למתאמנים</label>
                    <textarea className="w-full bg-gray-900 border border-gray-700 p-4 rounded-2xl text-white mt-1" value={props.appConfig.urgentMessage || ''} onChange={e=>props.onUpdateAppConfig({...props.appConfig, urgentMessage: e.target.value})} /></div>
                </div>
                <div className="pt-4 flex gap-2">
                    <Button onClick={props.onExitAdmin} variant="outline" className="flex-1">יציאה מהניהול</Button>
                </div>
            </div>
        )}
      </div>

      {attendanceSession && (
        <div className="fixed inset-0 bg-black/95 z-[60] flex items-center justify-center p-4 backdrop-blur-xl">
           <div className="bg-gray-900 p-10 rounded-[50px] w-full max-w-md border border-gray-800 flex flex-col max-h-[90vh] shadow-3xl">
              <div className="flex justify-between items-start mb-6">
                 <div>
                    <h3 className="text-2xl font-black text-white italic uppercase">{attendanceSession.type}</h3>
                    <p className="text-red-500 font-mono text-xs uppercase tracking-widest">{attendanceSession.time} | {attendanceSession.date}</p>
                 </div>
                 <button onClick={()=>setAttendanceSession(null)} className="text-gray-500 text-3xl">✕</button>
              </div>

              <div className="mb-4">
                  <label className="text-[8px] text-gray-600 font-black uppercase tracking-widest mb-2 block">הודעה לשליחה (וואטסאפ)</label>
                  <textarea className="w-full bg-gray-800 border border-gray-700 p-4 rounded-2xl text-white text-xs" value={whatsappTemplate} onChange={e=>setWhatsappTemplate(e.target.value)} />
              </div>

              <div className="flex-1 overflow-y-auto space-y-6 py-4 no-scrollbar">
                 <div className="grid grid-cols-2 gap-2">
                     <button onClick={()=>props.onUpdateSession({...attendanceSession, isCancelled: !attendanceSession.isCancelled})} className={`py-4 rounded-3xl text-[10px] font-black uppercase border-2 transition-all ${attendanceSession.isCancelled ? 'bg-red-500 border-red-500 text-black' : 'border-gray-800 text-red-500'}`}>ביטול אימון</button>
                     <button onClick={()=>props.onUpdateSession({...attendanceSession, isZoomSession: !attendanceSession.isZoomSession})} className={`py-4 rounded-3xl text-[10px] font-black uppercase border-2 transition-all ${attendanceSession.isZoomSession ? 'bg-blue-500 border-blue-500 text-black' : 'border-gray-800 text-blue-500'}`}>אימון זום</button>
                     <button onClick={()=>props.onUpdateSession({...attendanceSession, manualHasStarted: !attendanceSession.manualHasStarted})} className={`py-4 rounded-3xl text-[10px] font-black uppercase border-2 col-span-2 transition-all ${attendanceSession.manualHasStarted ? 'bg-brand-primary border-brand-primary text-black' : 'border-gray-800 text-brand-primary'}`}>מתקיים</button>
                 </div>
                 <h4 className="text-gray-600 text-[8px] font-black uppercase tracking-widest border-b border-gray-800 pb-2 flex justify-between">
                    <span>נוכחות וניהול הודעות ({attendanceSession.registeredPhoneNumbers.length})</span>
                    <button onClick={()=>{if(confirm('למחוק את האימון לצמיתות?')){props.onDeleteSession(attendanceSession.id); setAttendanceSession(null);}}} className="text-red-500">מחק אימון 🗑️</button>
                 </h4>
                 <div className="space-y-2">
                    {attendanceSession.registeredPhoneNumbers.map(p => {
                        const u = props.users.find(x => normalizePhone(x.phone) === normalizePhone(p));
                        // Default to all registered users being attended if field is empty, otherwise check field
                        const isAttended = (attendanceSession.attendedPhoneNumbers || attendanceSession.registeredPhoneNumbers).includes(p);
                        return (
                           <div key={p} className="flex gap-2">
                               <div onClick={() => {
                                   const current = attendanceSession.attendedPhoneNumbers || attendanceSession.registeredPhoneNumbers;
                                   const next = current.includes(p) ? current.filter(x=>x!==p) : [...current, p];
                                   props.onUpdateSession({...attendanceSession, attendedPhoneNumbers: next});
                               }} className={`flex-1 p-6 rounded-3xl border flex justify-between items-center cursor-pointer transition-all ${isAttended ? 'bg-red-600/10 border-red-500/40' : 'bg-gray-800/30 border-gray-800 opacity-40'}`}>
                                  <span className="font-black text-white">{u?.fullName || p}</span>
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black transition-all ${isAttended ? 'bg-red-500 text-white' : 'border border-gray-700'}`}>{isAttended ? '✓' : ''}</div>
                               </div>
                               <button onClick={()=>sendWhatsApp(p, attendanceSession)} className="bg-green-600/20 text-green-500 border border-green-500/30 px-6 rounded-3xl text-[9px] font-black uppercase">שלח</button>
                           </div>
                        );
                    })}
                 </div>
              </div>
              <Button onClick={()=>setAttendanceSession(null)} className="w-full py-5 mt-4 rounded-3xl bg-red-600">סגור</Button>
           </div>
        </div>
      )}

      {editingUser && (
        <div className="fixed inset-0 bg-black/95 z-[60] flex items-center justify-center p-4 backdrop-blur-xl">
           <div className="bg-gray-900 p-10 rounded-[50px] w-full max-w-md border border-gray-800 flex flex-col shadow-3xl">
              <div className="flex justify-between mb-8"><h3 className="text-white font-black uppercase italic text-2xl">עריכת מתאמן</h3><button onClick={()=>setEditingUser(null)} className="text-gray-500 text-3xl">✕</button></div>
              <div className="space-y-4">
                  <div><label className="text-[8px] text-gray-500 uppercase font-black">שם מלא</label>
                  <input className="w-full bg-gray-900 border border-gray-700 p-4 rounded-2xl text-white mt-1" value={editingUser.fullName} onChange={e=>setEditingUser({...editingUser, fullName: e.target.value})} /></div>
                  <div className="grid grid-cols-2 gap-4">
                      <div><label className="text-[8px] text-gray-500 uppercase font-black">סטטוס תשלום</label>
                      <select className="w-full bg-gray-900 border border-gray-700 p-4 rounded-2xl text-white mt-1" value={editingUser.paymentStatus} onChange={e=>setEditingUser({...editingUser, paymentStatus: e.target.value as any})}>
                          <option value={PaymentStatus.PAID}>שולם</option><option value={PaymentStatus.PENDING}>ממתין</option><option value={PaymentStatus.OVERDUE}>חוב</option>
                      </select></div>
                      <div><label className="text-[8px] text-gray-500 uppercase font-black">שיא אימונים</label>
                      <input type="number" className="w-full bg-gray-900 border border-gray-700 p-4 rounded-2xl text-white mt-1" value={editingUser.monthlyRecord || 0} onChange={e=>setEditingUser({...editingUser, monthlyRecord: parseInt(e.target.value)})} /></div>
                  </div>
                  <div><label className="text-[8px] text-gray-500 uppercase font-black">תאריך הצהרת בריאות</label>
                  <input type="date" className="w-full bg-gray-900 border border-gray-700 p-4 rounded-2xl text-white mt-1" value={editingUser.healthDeclarationDate || ''} onChange={e=>setEditingUser({...editingUser, healthDeclarationDate: e.target.value})} /></div>
              </div>
              <div className="mt-8 flex gap-2">
                  <Button onClick={()=>{props.onUpdateUser(editingUser); setEditingUser(null);}} className="flex-1 bg-red-600">שמור שינויים</Button>
                  <Button onClick={()=>{if(confirm('למחוק מתאמן?')){props.onDeleteUser(editingUser.id); setEditingUser(null);}}} variant="danger" className="px-6">מחק</Button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
