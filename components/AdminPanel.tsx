
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

  // Helper to calculate stats for a specific user
  const getUserStats = (user: User) => {
    const phone = normalizePhone(user.phone);
    const now = new Date();
    const attended = props.sessions.filter(s => s.attendedPhoneNumbers?.includes(phone));
    
    const monthlyCount = attended.filter(s => {
        const d = new Date(s.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;

    const weekMap: Record<string, number> = {};
    attended.forEach(s => {
        const d = new Date(s.date);
        const sun = new Date(d); sun.setDate(d.getDate() - d.getDay());
        const key = sun.toISOString().split('T')[0];
        weekMap[key] = (weekMap[key] || 0) + 1;
    });
    
    let streak = 0;
    let check = new Date(); check.setDate(check.getDate() - check.getDay());
    while(true) {
        if ((weekMap[check.toISOString().split('T')[0]] || 0) >= 3) { streak++; check.setDate(check.getDate() - 7); }
        else break;
        if (check.getFullYear() < 2024) break;
    }

    return { monthly: monthlyCount, peak: Math.max(user.monthlyRecord || 0, monthlyCount), streak };
  };

  const filteredUsers = useMemo(() => {
      const filtered = props.users.filter(u => u.fullName.includes(searchTerm) || u.phone.includes(searchTerm));
      return filtered.sort((a,b) => {
          if (sortBy === 'name') return a.fullName.localeCompare(b.fullName);
          if (sortBy === 'workouts') return (b.monthlyRecord || 0) - (a.monthlyRecord || 0);
          return a.paymentStatus.localeCompare(b.paymentStatus);
      });
  }, [props.users, searchTerm, sortBy]);

  return (
    <div className="bg-brand-black min-h-screen">
      {/* Fixed Header Tabs */}
      <div className="sticky top-0 z-50 bg-brand-black/90 backdrop-blur-md border-b border-white/5 pt-4">
        <div className="flex gap-2 p-4 max-w-4xl mx-auto no-scrollbar overflow-x-auto">
          {[ 
            {id:'attendance',label:'לו"ז ונוכחות'}, 
            {id:'users',label:'מתאמנים'}, 
            {id:'settings',label:'הגדרות'} 
          ].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id as any)} className={`flex-1 min-w-[120px] px-6 py-4 rounded-2xl text-xs font-black transition-all uppercase tracking-widest ${activeTab === t.id ? 'bg-red-600 text-white shadow-xl shadow-red-600/20 scale-105' : 'bg-gray-800/50 text-gray-500'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 max-w-4xl mx-auto space-y-6 pb-24">
        {activeTab === 'attendance' && (
          <div className="space-y-6">
             <div className="flex justify-between items-center bg-gray-800/40 p-5 rounded-3xl border border-white/5">
                <button onClick={()=>setWeekOffset(p=>p-1)} className="text-white text-xl p-2">←</button>
                <span className="text-red-500 font-black text-xs uppercase tracking-widest bg-red-500/10 px-4 py-1 rounded-full">{weekOffset === 0 ? 'השבוע' : `שבוע ${weekOffset}`}</span>
                <button onClick={()=>setWeekOffset(p=>p+1)} className="text-white text-xl p-2">→</button>
             </div>
             <Button onClick={() => setAttendanceSession({ id: Date.now().toString(), type: props.workoutTypes[0], date: new Date().toISOString().split('T')[0], time: '18:00', location: props.locations[0]?.name || '', maxCapacity: 15, registeredPhoneNumbers: [], attendedPhoneNumbers: [], description: '' })} className="w-full py-6 rounded-[40px] bg-red-600 shadow-2xl text-lg font-black italic">+ יצירת אימון חדש</Button>
             
             <div className="space-y-6">
              {weekDates.map(date => {
                  const daySessions = props.sessions.filter(s => s.date === date).sort((a,b)=>a.time.localeCompare(b.time));
                  return (
                      <div key={date} className={`rounded-[40px] p-6 border transition-all ${date === new Date().toISOString().split('T')[0] ? 'bg-red-500/5 border-red-500/20' : 'bg-gray-900/30 border-white/5'}`}>
                          <div className="text-white font-black text-[12px] mb-6 border-b border-white/5 pb-2 flex justify-between items-center uppercase tracking-widest">
                              <span className={date === new Date().toISOString().split('T')[0] ? 'text-red-500' : ''}>
                                {new Date(date).toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'numeric' })}
                              </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {daySessions.map(s => <SessionCard key={s.id} session={s} allUsers={props.users} isRegistered={false} onRegisterClick={()=>{}} onViewDetails={()=>setAttendanceSession(s)} onDuplicate={handleDuplicate} isAdmin={true} locations={props.locations} />)}
                          </div>
                      </div>
                  );
              })}
             </div>
          </div>
        )}

        {activeTab === 'users' && (
            <div className="space-y-4">
                <div className="flex gap-2 sticky top-[100px] z-40 bg-brand-black/95 py-2">
                    <input type="text" placeholder="חיפוש לפי שם או טלפון..." className="flex-1 bg-gray-800 border border-white/10 p-5 rounded-2xl text-white outline-none focus:border-red-500 font-bold" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
                    <select className="bg-gray-800 border border-white/10 p-5 rounded-2xl text-white text-[10px] uppercase font-black" value={sortBy} onChange={e=>setSortBy(e.target.value as any)}>
                        <option value="name">שם</option>
                        <option value="workouts">שיא</option>
                        <option value="payment">תשלום</option>
                    </select>
                </div>
                <div className="grid gap-4">
                    {filteredUsers.map(u => {
                       const uStats = getUserStats(u);
                       const hasHealth = !!u.healthDeclarationDate;
                       return (
                          <div key={u.id} className="bg-gray-800/40 p-6 rounded-[35px] border border-white/5 hover:border-red-500/40 transition-all cursor-pointer group" onClick={()=>setEditingUser(u)}>
                             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <div className="flex gap-4 items-center">
                                   <div className="w-14 h-14 rounded-full flex items-center justify-center font-black bg-gray-900 border border-white/5 text-red-500 text-xl" style={{ color: u.userColor || '#EF4444' }}>{u.fullName.charAt(0)}</div>
                                   <div>
                                      <div className="text-white font-black text-lg group-hover:text-red-500 transition-colors" style={{ color: u.userColor }}>{u.fullName}</div>
                                      <div className="text-[11px] text-gray-500 font-mono">{u.phone}</div>
                                   </div>
                                </div>
                                
                                <div className="flex flex-wrap items-center gap-4">
                                   {/* Metrics */}
                                   <div className="flex gap-3 bg-black/30 p-3 rounded-2xl border border-white/5">
                                      <div className="text-center px-2">
                                         <p className="text-[8px] text-gray-600 uppercase font-bold">החודש</p>
                                         <p className="text-brand-primary font-black text-lg leading-none">{uStats.monthly}</p>
                                      </div>
                                      <div className="text-center px-2 border-x border-white/5">
                                         <p className="text-[8px] text-gray-600 uppercase font-bold">שיא</p>
                                         <p className="text-white font-black text-lg leading-none">{uStats.peak}</p>
                                      </div>
                                      <div className="text-center px-2">
                                         <p className="text-[8px] text-orange-500/70 uppercase font-bold">רצף</p>
                                         <p className="text-orange-400 font-black text-lg leading-none">{uStats.streak}</p>
                                      </div>
                                   </div>

                                   {/* Status Badges */}
                                   <div className="flex gap-2">
                                      <span className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider shadow-lg ${u.paymentStatus === PaymentStatus.PAID ? 'bg-green-500/20 text-green-500 border border-green-500/30' : 'bg-red-500/20 text-red-500 border border-red-500/30'}`}>
                                         {u.paymentStatus === PaymentStatus.PAID ? 'שולם' : (u.paymentStatus === PaymentStatus.OVERDUE ? 'חוב' : 'ממתין')}
                                      </span>
                                      <span className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider shadow-lg ${hasHealth ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-gray-700/50 text-gray-500 border border-white/5'}`}>
                                         {hasHealth ? 'הצהרה ✓' : 'אין הצהרה'}
                                      </span>
                                   </div>
                                </div>
                             </div>
                          </div>
                       );
                    })}
                    {filteredUsers.length === 0 && <p className="text-center text-gray-600 py-10 font-bold italic">לא נמצאו מתאמנים</p>}
                </div>
            </div>
        )}

        {activeTab === 'settings' && (
            <div className="space-y-8 bg-gray-800/40 p-8 rounded-[40px] border border-white/5">
                <h3 className="text-white font-black uppercase italic tracking-widest border-b border-white/5 pb-2">הגדרות מערכת</h3>
                <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] text-gray-500 uppercase font-black mb-2 block">שם המאמן (עברית)</label>
                          <input className="w-full bg-gray-900/50 border border-white/5 p-5 rounded-2xl text-white font-bold" value={props.appConfig.coachNameHeb} onChange={e=>props.onUpdateAppConfig({...props.appConfig, coachNameHeb: e.target.value})} />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-500 uppercase font-black mb-2 block">Coach Name (Eng)</label>
                          <input className="w-full bg-gray-900/50 border border-white/5 p-5 rounded-2xl text-white font-bold" value={props.appConfig.coachNameEng} onChange={e=>props.onUpdateAppConfig({...props.appConfig, coachNameEng: e.target.value})} />
                        </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 uppercase font-black mb-2 block">סיסמת ניהול</label>
                      <input className="w-full bg-gray-900/50 border border-white/5 p-5 rounded-2xl text-white font-mono" value={props.appConfig.coachAdditionalPhone} onChange={e=>props.onUpdateAppConfig({...props.appConfig, coachAdditionalPhone: e.target.value})} />
                    </div>
                </div>
                <div className="pt-8 flex gap-3">
                    <Button onClick={props.onExitAdmin} variant="outline" className="flex-1 py-5 rounded-3xl">יציאה מהניהול</Button>
                </div>
            </div>
        )}
      </div>

      {/* Attendance & User Edit Modals remain but updated for consistent sizing */}
      {attendanceSession && (
        <div className="fixed inset-0 bg-black/95 z-[60] flex items-center justify-center p-4 backdrop-blur-xl">
           <div className="bg-gray-900 p-8 rounded-[50px] w-full max-w-md border border-white/10 flex flex-col max-h-[90vh] shadow-3xl text-right" dir="rtl">
              <div className="flex justify-between items-start mb-6 border-b border-white/5 pb-4">
                 <div>
                    <h3 className="text-2xl font-black text-white italic uppercase">{attendanceSession.type}</h3>
                    <p className="text-red-500 font-mono text-sm uppercase tracking-widest">{attendanceSession.time} | {attendanceSession.date}</p>
                 </div>
                 <button onClick={()=>setAttendanceSession(null)} className="text-gray-500 text-3xl">✕</button>
              </div>

              <div className="space-y-4 mb-6">
                  <div>
                      <label className="text-[10px] text-gray-500 font-black uppercase block mb-2">דגשי המאמן לשעה זו</label>
                      <textarea className="w-full bg-gray-800 border border-white/5 p-5 rounded-2xl text-white text-sm h-28 outline-none focus:border-red-500" value={attendanceSession.description || ''} onChange={e=>setAttendanceSession({...attendanceSession, description: e.target.value})} placeholder="למשל: אימון חוץ, להביא גומיות..." />
                  </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-6 py-4 no-scrollbar">
                 <div className="grid grid-cols-2 gap-2">
                     <button onClick={()=>props.onUpdateSession({...attendanceSession, isCancelled: !attendanceSession.isCancelled})} className={`py-4 rounded-2xl text-[10px] font-black uppercase border-2 transition-all ${attendanceSession.isCancelled ? 'bg-red-500 border-red-500 text-black' : 'border-white/5 text-red-500'}`}>ביטול אימון</button>
                     <button onClick={()=>props.onUpdateSession({...attendanceSession, isZoomSession: !attendanceSession.isZoomSession})} className={`py-4 rounded-2xl text-[10px] font-black uppercase border-2 transition-all ${attendanceSession.isZoomSession ? 'bg-blue-500 border-blue-500 text-black' : 'border-white/5 text-blue-500'}`}>אימון זום</button>
                     <button onClick={()=>props.onUpdateSession({...attendanceSession, manualHasStarted: !attendanceSession.manualHasStarted})} className={`py-4 rounded-2xl text-[10px] font-black uppercase border-2 col-span-2 transition-all ${attendanceSession.manualHasStarted ? 'bg-brand-primary border-brand-primary text-black' : 'border-white/5 text-brand-primary'}`}>סמן כמתקיים</button>
                 </div>
                 
                 <h4 className="text-gray-600 text-[10px] font-black uppercase tracking-widest border-b border-white/5 pb-2 flex justify-between">
                    <span>נוכחות ({attendanceSession.registeredPhoneNumbers.length})</span>
                    <button onClick={()=>{if(confirm('מחיקת אימון?')){props.onDeleteSession(attendanceSession.id); setAttendanceSession(null);}}} className="text-red-500 opacity-50 hover:opacity-100">מחק אימון</button>
                 </h4>
                 <div className="space-y-2">
                    {attendanceSession.registeredPhoneNumbers.map(p => {
                        const u = props.users.find(x => normalizePhone(x.phone) === normalizePhone(p));
                        const isAttended = (attendanceSession.attendedPhoneNumbers || attendanceSession.registeredPhoneNumbers).includes(p);
                        return (
                           <div key={p} className="flex gap-2">
                               <div onClick={() => {
                                   const current = attendanceSession.attendedPhoneNumbers || attendanceSession.registeredPhoneNumbers;
                                   const next = current.includes(p) ? current.filter(x=>x!==p) : [...current, p];
                                   props.onUpdateSession({...attendanceSession, attendedPhoneNumbers: next});
                               }} className={`flex-1 p-5 rounded-2xl border flex justify-between items-center cursor-pointer transition-all ${isAttended ? 'bg-red-600/10 border-red-500/40' : 'bg-gray-800/30 border-white/5 opacity-40'}`}>
                                  <span className="font-black text-white text-sm" style={{color: u?.userColor}}>{u?.displayName || u?.fullName || p}</span>
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black transition-all ${isAttended ? 'bg-red-500 text-white' : 'border border-white/10'}`}>{isAttended ? '✓' : ''}</div>
                               </div>
                           </div>
                        );
                    })}
                 </div>
              </div>
              <Button onClick={()=>{props.onUpdateSession(attendanceSession); setAttendanceSession(null);}} className="w-full py-5 mt-4 rounded-[30px] bg-red-600 shadow-xl text-lg font-black italic">שמור שינויים</Button>
           </div>
        </div>
      )}

      {editingUser && (
        <div className="fixed inset-0 bg-black/95 z-[60] flex items-center justify-center p-4 backdrop-blur-xl">
           <div className="bg-gray-900 p-8 rounded-[40px] w-full max-w-md border border-white/10 flex flex-col shadow-3xl text-right" dir="rtl">
              <div className="flex justify-between mb-8 border-b border-white/5 pb-4"><h3 className="text-white font-black uppercase italic text-2xl">פרטי מתאמן</h3><button onClick={()=>setEditingUser(null)} className="text-gray-500 text-3xl">✕</button></div>
              <div className="space-y-6 overflow-y-auto pr-2 no-scrollbar max-h-[70vh]">
                  <div>
                    <label className="text-[10px] text-gray-500 uppercase font-black block mb-2">שם מלא</label>
                    <input className="w-full bg-gray-900 border border-white/5 p-4 rounded-2xl text-white font-bold" value={editingUser.fullName} onChange={e=>setEditingUser({...editingUser, fullName: e.target.value})} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] text-gray-500 uppercase font-black block mb-2">תשלום</label>
                        <select className="w-full bg-gray-900 border border-white/5 p-4 rounded-2xl text-white font-bold" value={editingUser.paymentStatus} onChange={e=>setEditingUser({...editingUser, paymentStatus: e.target.value as any})}>
                            <option value={PaymentStatus.PAID}>שולם</option><option value={PaymentStatus.PENDING}>ממתין</option><option value={PaymentStatus.OVERDUE}>חוב</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 uppercase font-black block mb-2">שיא אישי</label>
                        <input type="number" className="w-full bg-gray-900 border border-white/5 p-4 rounded-2xl text-white font-black text-xl" value={editingUser.monthlyRecord || 0} onChange={e=>setEditingUser({...editingUser, monthlyRecord: parseInt(e.target.value)})} />
                      </div>
                  </div>
                  <div className="p-4 bg-blue-500/5 rounded-2xl border border-blue-500/10">
                    <p className="text-blue-400 text-[10px] font-black uppercase mb-1">הצהרת בריאות</p>
                    <p className="text-white text-sm font-bold">{editingUser.healthDeclarationDate ? `נחתמה ב- ${new Date(editingUser.healthDeclarationDate).toLocaleDateString('he-IL')}` : 'טרם נחתמה'}</p>
                    {editingUser.healthDeclarationId && <p className="text-gray-500 text-[10px] mt-1 font-mono">ת.ז: {editingUser.healthDeclarationId}</p>}
                  </div>
              </div>
              <div className="mt-8 flex gap-3">
                  <Button onClick={()=>{props.onUpdateUser(editingUser); setEditingUser(null);}} className="flex-1 bg-red-600 py-5 rounded-3xl text-lg font-black italic">עדכן מתאמן</Button>
                  <Button onClick={()=>{if(confirm('מחיקת מתאמן?')){props.onDeleteUser(editingUser.id); setEditingUser(null);}}} variant="danger" className="px-6 rounded-3xl">🗑️</Button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
