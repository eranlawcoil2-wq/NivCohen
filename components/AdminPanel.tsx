
import React, { useState, useMemo } from 'react';
import { User, TrainingSession, WeatherLocation, PaymentLink, LocationDef, AppConfig, Quote, WeatherInfo, PaymentStatus } from '../types';
import { Button } from './Button';
import { SessionCard } from './SessionCard';
import { getWeatherIcon } from '../services/weatherService';

interface AdminPanelProps {
  users: User[]; sessions: TrainingSession[]; primaryColor: string; workoutTypes: string[]; locations: LocationDef[];
  weatherLocation: WeatherLocation; weatherData?: Record<string, WeatherInfo>; paymentLinks: PaymentLink[];
  streakGoal: number; appConfig: AppConfig; quotes: Quote[];
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
  const [sortBy, setSortBy] = useState<'name' | 'monthly' | 'peak' | 'streak' | 'payment'>('name');

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
      const filtered = [...props.users].filter(u => u.fullName.includes(searchTerm) || u.phone.includes(searchTerm));
      return filtered.sort((a,b) => {
          if (sortBy === 'name') return a.fullName.localeCompare(b.fullName);
          if (sortBy === 'monthly') return getUserStats(b).monthly - getUserStats(a).monthly;
          if (sortBy === 'peak') return getUserStats(b).peak - getUserStats(a).peak;
          if (sortBy === 'streak') return getUserStats(b).streak - getUserStats(a).streak;
          if (sortBy === 'payment') return a.paymentStatus.localeCompare(b.paymentStatus);
          return 0;
      });
  }, [props.users, searchTerm, sortBy, props.sessions]);

  return (
    <div className="bg-brand-black min-h-screen">
      <div className="sticky top-0 z-50 bg-brand-black/90 backdrop-blur-md border-b border-white/5 pt-4">
        <div className="flex gap-2 p-4 max-w-4xl mx-auto no-scrollbar overflow-x-auto">
          {[ 
            {id:'attendance',label:'לו"ז ונוכחות'}, 
            {id:'users',label:'מתאמנים'}, 
            {id:'settings',label:'הגדרות האתר'} 
          ].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id as any)} className={`flex-1 min-w-[120px] px-6 py-4 rounded-2xl text-[11px] font-black transition-all uppercase tracking-widest ${activeTab === t.id ? 'bg-red-600 text-white shadow-xl shadow-red-600/20 scale-105' : 'bg-gray-800/50 text-gray-500'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 max-w-4xl mx-auto space-y-6 pb-24">
        {activeTab === 'attendance' && (
          <div className="space-y-6">
             <div className="flex justify-between items-center bg-gray-800/40 p-5 rounded-3xl border border-white/5 shadow-xl">
                <button onClick={()=>setWeekOffset(p=>p-1)} className="text-white text-2xl p-2">←</button>
                <span className="text-red-500 font-black text-[11px] uppercase tracking-[0.3em] bg-red-500/10 px-6 py-2 rounded-full">{weekOffset === 0 ? 'השבוע' : `שבוע ${weekOffset}`}</span>
                <button onClick={()=>setWeekOffset(p=>p+1)} className="text-white text-2xl p-2">→</button>
             </div>
             <Button onClick={() => setAttendanceSession({ id: Date.now().toString(), type: props.workoutTypes[0] || 'פונקציונלי', date: new Date().toISOString().split('T')[0], time: '18:00', location: props.locations[0]?.name || '', maxCapacity: 15, registeredPhoneNumbers: [], attendedPhoneNumbers: [], description: '' })} className="w-full py-7 rounded-[45px] bg-red-600 shadow-2xl text-xl font-black italic uppercase">+ יצירת אימון חדש</Button>
             
             <div className="space-y-12">
              {weekDates.map(date => {
                  const daySessions = props.sessions.filter(s => s.date === date).sort((a,b)=>a.time.localeCompare(b.time));
                  return (
                      <div key={date} className="relative">
                          <div className="bg-gray-900/50 rounded-[45px] p-6 border border-white/5">
                            <div className="text-white font-black text-[11px] mb-6 border-b border-white/5 pb-3 flex justify-between items-center uppercase tracking-widest">
                                <span className={date === new Date().toISOString().split('T')[0] ? 'text-red-500' : ''}>
                                  {new Date(date).toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'numeric' })}
                                </span>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              {daySessions.map(s => <SessionCard key={s.id} session={s} allUsers={props.users} isRegistered={false} onRegisterClick={()=>{}} onViewDetails={()=>setAttendanceSession(s)} onDuplicate={handleDuplicate} isAdmin={true} locations={props.locations} />)}
                            </div>
                          </div>
                      </div>
                  );
              })}
             </div>
          </div>
        )}

        {activeTab === 'users' && (
            <div className="space-y-6">
                <div className="sticky top-[100px] z-40 bg-brand-black/95 py-4 space-y-3">
                    <input type="text" placeholder="חיפוש לפי שם או טלפון..." className="w-full bg-gray-800 border border-white/10 p-6 rounded-[30px] text-white outline-none focus:border-red-500 font-bold text-lg shadow-xl" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                        <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest flex items-center shrink-0">מיין לפי:</span>
                        {[
                            {id:'name', label:'שם'},
                            {id:'monthly', label:'אימונים'},
                            {id:'peak', label:'שיא'},
                            {id:'streak', label:'רצף'},
                            {id:'payment', label:'תשלום'}
                        ].map(opt => (
                            <button key={opt.id} onClick={() => setSortBy(opt.id as any)} className={`shrink-0 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${sortBy === opt.id ? 'bg-red-500 text-white' : 'bg-gray-800 text-gray-500 border border-white/5'}`}>
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>
                
                <div className="grid gap-4">
                    {filteredUsers.map(u => {
                       const uStats = getUserStats(u);
                       const hasHealth = !!u.healthDeclarationDate;
                       return (
                          <div key={u.id} className="bg-gray-800/40 p-6 rounded-[40px] border border-white/5 hover:border-red-500/40 transition-all cursor-pointer group shadow-xl" onClick={()=>setEditingUser(u)}>
                             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                                <div className="flex gap-5 items-center">
                                   <div className="w-16 h-16 rounded-full flex items-center justify-center font-black bg-gray-900 border border-white/10 text-red-500 text-2xl shadow-inner" style={{ color: u.userColor || '#EF4444' }}>{u.fullName.charAt(0)}</div>
                                   <div>
                                      <div className="text-white font-black text-xl italic group-hover:text-red-500 transition-colors" style={{ color: u.userColor }}>{u.fullName}</div>
                                      <div className="text-[12px] text-gray-600 font-mono tracking-wider">{u.phone}</div>
                                   </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-5 w-full sm:w-auto">
                                   <div className="flex gap-4 bg-black/40 p-4 rounded-[25px] border border-white/5 flex-1 sm:flex-none justify-around">
                                      <div className="text-center">
                                         <p className="text-[8px] text-gray-600 uppercase font-black tracking-widest mb-1">החודש</p>
                                         <p className="text-brand-primary font-black text-2xl leading-none">{uStats.monthly}</p>
                                      </div>
                                      <div className="text-center border-x border-white/10 px-4">
                                         <p className="text-[8px] text-gray-600 uppercase font-black tracking-widest mb-1">שיא</p>
                                         <p className="text-white font-black text-2xl leading-none">{uStats.peak}</p>
                                      </div>
                                      <div className="text-center">
                                         <p className="text-[8px] text-orange-500 uppercase font-black tracking-widest mb-1">רצף</p>
                                         <p className="text-orange-400 font-black text-2xl leading-none">{uStats.streak}</p>
                                      </div>
                                   </div>
                                   <div className="flex gap-2">
                                      <span className={`px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg ${u.paymentStatus === PaymentStatus.PAID ? 'bg-green-500/20 text-green-500 border border-green-500/30' : 'bg-red-500/20 text-red-500 border border-red-500/30'}`}>
                                         {u.paymentStatus === PaymentStatus.PAID ? 'שולם ✓' : 'חוב ⚠'}
                                      </span>
                                      <span className={`px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg ${hasHealth ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-gray-800 text-gray-600 border border-white/5'}`}>
                                         {hasHealth ? 'הצהרה ✓' : 'אין הצהרה'}
                                      </span>
                                   </div>
                                </div>
                             </div>
                          </div>
                       );
                    })}
                </div>
            </div>
        )}

        {activeTab === 'settings' && (
            <div className="space-y-10 pb-20">
                <div className="bg-gray-800/40 p-8 rounded-[50px] border border-white/5 shadow-2xl space-y-8">
                    <h3 className="text-white font-black uppercase italic tracking-[0.2em] border-b border-white/10 pb-4">ניהול אתר והודעות ⚙️</h3>
                    
                    {/* URGENT MESSAGE */}
                    <div className="space-y-3">
                        <label className="text-[10px] text-red-500 font-black uppercase tracking-widest flex items-center gap-2">🚨 הודעה דחופה באתר (שורת פוש)</label>
                        <input className="w-full bg-red-900/10 border border-red-500/30 p-6 rounded-[30px] text-white font-black italic shadow-inner outline-none focus:border-red-500" value={props.appConfig.urgentMessage || ''} onChange={e=>props.onUpdateAppConfig({...props.appConfig, urgentMessage: e.target.value})} placeholder="למשל: האימון היום הועבר לזום עקב הגשם..." />
                    </div>

                    {/* LOCATIONS */}
                    <div className="space-y-4 pt-6">
                        <div className="flex justify-between items-center border-r-4 border-brand-primary pr-4">
                            <h4 className="text-white font-black text-sm uppercase tracking-widest">ניהול מיקומים</h4>
                            <Button onClick={()=>{
                                const name = prompt('שם המיקום:');
                                const addr = prompt('כתובת מלאה לוויז:');
                                if(name && addr) props.onUpdateLocations([...props.locations, {id: Date.now().toString(), name, address: addr}]);
                            }} variant="outline" className="px-5 py-2 text-[10px] rounded-2xl">+ הוסף</Button>
                        </div>
                        <div className="grid gap-3">
                            {props.locations.map(loc => (
                                <div key={loc.id} className="flex gap-3 bg-gray-900/60 p-5 rounded-[30px] border border-white/5 items-center">
                                    <div className="w-12 h-12 rounded-2xl bg-brand-primary/10 flex items-center justify-center text-xl">📍</div>
                                    <div className="flex-1">
                                        <p className="text-white font-black italic">{loc.name}</p>
                                        <p className="text-gray-500 text-[10px] font-bold">{loc.address}</p>
                                    </div>
                                    <button onClick={()=>{if(confirm('למחוק את המיקום?')) props.onUpdateLocations(props.locations.filter(l=>l.id!==loc.id))}} className="text-red-500 p-3 hover:bg-red-500/10 rounded-xl transition-all">🗑️</button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* WORKOUT TYPES */}
                    <div className="space-y-4 pt-6">
                        <div className="flex justify-between items-center border-r-4 border-brand-primary pr-4">
                            <h4 className="text-white font-black text-sm uppercase tracking-widest">סוגי אימונים</h4>
                            <Button onClick={()=>{const t=prompt('שם סוג האימון:'); if(t) props.onUpdateWorkoutTypes([...props.workoutTypes, t])}} variant="outline" className="px-5 py-2 text-[10px] rounded-2xl">+ הוסף</Button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {props.workoutTypes.map(type => (
                                <span key={type} className="bg-gray-900 px-6 py-3 rounded-2xl border border-white/5 text-xs font-black text-white italic flex items-center gap-3">
                                    {type}
                                    <button onClick={()=>props.onUpdateWorkoutTypes(props.workoutTypes.filter(t=>t!==type))} className="text-red-500 text-lg">×</button>
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* MOTIVATION QUOTES */}
                    <div className="space-y-4 pt-6">
                        <div className="flex justify-between items-center border-r-4 border-brand-primary pr-4">
                            <h4 className="text-white font-black text-sm uppercase tracking-widest">משפטי מוטיבציה</h4>
                            <Button onClick={async ()=>{
                                const t=prompt('הכנס משפט מוטיבציה:'); 
                                if(t) {
                                    const { dataService } = await import('../services/dataService');
                                    await dataService.addQuote({id: Date.now().toString(), text: t});
                                    window.location.reload();
                                }
                            }} variant="outline" className="px-5 py-2 text-[10px] rounded-2xl">+ הוסף</Button>
                        </div>
                        <div className="grid gap-3">
                            {props.quotes.map(q => (
                                <div key={q.id} className="bg-gray-900/40 p-5 rounded-[30px] border border-white/5 flex items-center justify-between">
                                    <p className="text-white font-bold italic text-sm">"{q.text}"</p>
                                    <button onClick={async ()=>{
                                        if(confirm('למחוק את המשפט?')){
                                            const { dataService } = await import('../services/dataService');
                                            await dataService.deleteQuote(q.id);
                                            window.location.reload();
                                        }
                                    }} className="text-red-500/50 hover:text-red-500 transition-colors">🗑️</button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-8 border-t border-white/5">
                        <div className="space-y-2">
                            <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest block">שם המאמן (עברית)</label>
                            <input className="w-full bg-gray-900/50 border border-white/5 p-6 rounded-3xl text-white font-black italic shadow-inner outline-none focus:border-brand-primary" value={props.appConfig.coachNameHeb} onChange={e=>props.onUpdateAppConfig({...props.appConfig, coachNameHeb: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest block">Coach Name (Eng)</label>
                            <input className="w-full bg-gray-900/50 border border-white/5 p-6 rounded-3xl text-white font-black italic shadow-inner outline-none focus:border-brand-primary" value={props.appConfig.coachNameEng} onChange={e=>props.onUpdateAppConfig({...props.appConfig, coachNameEng: e.target.value})} />
                        </div>
                    </div>
                    
                    <div className="pt-10 flex gap-4">
                        <Button onClick={props.onExitAdmin} variant="outline" className="flex-1 py-6 rounded-[40px] font-black italic uppercase tracking-widest">יציאה מהניהול</Button>
                    </div>
                </div>
            </div>
        )}
      </div>

      {/* MODALS remain mostly same but sizing adjusted for consistency */}
      {attendanceSession && (
        <div className="fixed inset-0 bg-black/95 z-[60] flex items-center justify-center p-6 backdrop-blur-xl">
           <div className="bg-gray-900 p-8 rounded-[55px] w-full max-w-md border border-white/10 flex flex-col max-h-[90vh] shadow-3xl text-right" dir="rtl">
              <div className="flex justify-between items-start mb-8 border-b border-white/5 pb-5">
                 <div className="flex-1">
                    <select className="w-full bg-transparent text-3xl font-black text-white italic uppercase outline-none mb-2" value={attendanceSession.type} onChange={e=>setAttendanceSession({...attendanceSession, type: e.target.value})}>
                       {props.workoutTypes.map(t=><option key={t} value={t} className="bg-gray-900">{t}</option>)}
                    </select>
                    <div className="flex gap-3">
                        <input type="time" className="bg-transparent text-red-500 font-black font-mono text-lg outline-none" value={attendanceSession.time} onChange={e=>setAttendanceSession({...attendanceSession, time: e.target.value})} />
                        <span className="text-gray-700">|</span>
                        <input type="date" className="bg-transparent text-red-500 font-black font-mono text-lg outline-none" value={attendanceSession.date} onChange={e=>setAttendanceSession({...attendanceSession, date: e.target.value})} />
                    </div>
                 </div>
                 <button onClick={()=>setAttendanceSession(null)} className="text-gray-500 text-4xl">✕</button>
              </div>

              <div className="space-y-5 mb-8">
                  <div>
                      <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest block mb-2">מיקום האימון</label>
                      <select className="w-full bg-gray-800 border border-white/10 p-5 rounded-[30px] text-white font-black italic text-lg outline-none focus:border-red-500 shadow-inner" value={attendanceSession.location} onChange={e=>setAttendanceSession({...attendanceSession, location: e.target.value})}>
                          {props.locations.map(l=><option key={l.id} value={l.name} className="bg-gray-900">{l.name}</option>)}
                      </select>
                  </div>
                  <div>
                      <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest block mb-2">דגשי המאמן לשעה זו 📣</label>
                      <textarea className="w-full bg-gray-800 border border-white/10 p-6 rounded-[35px] text-white text-lg h-32 outline-none focus:border-red-500 shadow-inner leading-relaxed" value={attendanceSession.description || ''} onChange={e=>setAttendanceSession({...attendanceSession, description: e.target.value})} placeholder="למשל: אימון חוץ, להביא גומיות..." />
                  </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-6 py-4 no-scrollbar border-t border-white/5 mt-2">
                 <div className="grid grid-cols-2 gap-3">
                     <button onClick={()=>setAttendanceSession({...attendanceSession, isCancelled: !attendanceSession.isCancelled})} className={`py-5 rounded-[30px] text-[11px] font-black uppercase border-2 transition-all italic tracking-widest ${attendanceSession.isCancelled ? 'bg-red-500 border-red-500 text-black' : 'border-white/10 text-red-500 hover:border-red-500'}`}>ביטול אימון</button>
                     <button onClick={()=>setAttendanceSession({...attendanceSession, isZoomSession: !attendanceSession.isZoomSession})} className={`py-5 rounded-[30px] text-[11px] font-black uppercase border-2 transition-all italic tracking-widest ${attendanceSession.isZoomSession ? 'bg-blue-600 border-blue-600 text-black' : 'border-white/10 text-blue-500 hover:border-blue-500'}`}>אימון זום</button>
                     <button onClick={()=>setAttendanceSession({...attendanceSession, manualHasStarted: !attendanceSession.manualHasStarted})} className={`py-5 rounded-[30px] text-[11px] font-black uppercase border-2 col-span-2 transition-all italic tracking-widest ${attendanceSession.manualHasStarted ? 'bg-brand-primary border-brand-primary text-black' : 'border-white/10 text-brand-primary hover:border-brand-primary'}`}>סמן כמתקיים עכשיו</button>
                 </div>
                 
                 <div className="space-y-2">
                    <p className="text-gray-600 text-[10px] font-black uppercase tracking-[0.3em] mb-4">רשימת נוכחות ({attendanceSession.registeredPhoneNumbers.length})</p>
                    {attendanceSession.registeredPhoneNumbers.map(p => {
                        const u = props.users.find(x => normalizePhone(x.phone) === normalizePhone(p));
                        const isAttended = (attendanceSession.attendedPhoneNumbers || attendanceSession.registeredPhoneNumbers).includes(p);
                        return (
                           <div key={p} className="flex gap-2">
                               <div onClick={() => {
                                   const current = attendanceSession.attendedPhoneNumbers || attendanceSession.registeredPhoneNumbers;
                                   const next = current.includes(p) ? current.filter(x=>x!==p) : [...current, p];
                                   setAttendanceSession({...attendanceSession, attendedPhoneNumbers: next});
                               }} className={`flex-1 p-5 rounded-[30px] border flex justify-between items-center cursor-pointer transition-all shadow-lg ${isAttended ? 'bg-red-600/10 border-red-500/40' : 'bg-gray-800/30 border-white/5 opacity-40'}`}>
                                  <span className="font-black text-white text-lg italic" style={{color: u?.userColor}}>{u?.fullName || p}</span>
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black transition-all ${isAttended ? 'bg-red-500 text-white shadow-xl' : 'border border-white/10'}`}>{isAttended ? '✓' : ''}</div>
                               </div>
                           </div>
                        );
                    })}
                 </div>
              </div>
              <div className="pt-6 flex gap-3">
                  <Button onClick={()=>{props.onUpdateSession(attendanceSession); setAttendanceSession(null);}} className="flex-1 py-6 rounded-[40px] bg-red-600 shadow-2xl text-xl font-black italic uppercase">שמור שינויים ✓</Button>
                  <Button onClick={()=>{if(confirm('למחוק את האימון לצמיתות?')){props.onDeleteSession(attendanceSession.id); setAttendanceSession(null);}}} variant="danger" className="px-8 rounded-[40px] bg-gray-800">🗑️</Button>
              </div>
           </div>
        </div>
      )}

      {/* User Editing Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/95 z-[60] flex items-center justify-center p-6 backdrop-blur-xl overflow-y-auto no-scrollbar">
           <div className="bg-gray-900 p-10 rounded-[60px] w-full max-w-md border border-white/10 flex flex-col shadow-3xl text-right my-auto" dir="rtl">
              <div className="flex justify-between mb-10 border-b border-white/5 pb-5"><h3 className="text-3xl font-black text-white italic uppercase">ניהול מתאמן 👤</h3><button onClick={()=>setEditingUser(null)} className="text-gray-500 text-4xl">✕</button></div>
              <div className="space-y-8 overflow-y-auto pr-2 no-scrollbar max-h-[70vh]">
                  <div className="space-y-2">
                    <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest block">שם מלא</label>
                    <input className="w-full bg-gray-900 border border-white/10 p-6 rounded-[30px] text-white font-black italic text-xl shadow-inner outline-none focus:border-red-500" value={editingUser.fullName} onChange={e=>setEditingUser({...editingUser, fullName: e.target.value})} />
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest block">סטטוס תשלום</label>
                        <select className="w-full bg-gray-900 border border-white/10 p-6 rounded-[30px] text-white font-black italic outline-none focus:border-red-500" value={editingUser.paymentStatus} onChange={e=>setEditingUser({...editingUser, paymentStatus: e.target.value as any})}>
                            <option value={PaymentStatus.PAID}>שולם ✓</option>
                            <option value={PaymentStatus.PENDING}>ממתין ⏳</option>
                            <option value={PaymentStatus.OVERDUE}>חוב ⚠</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest block">שיא אימונים (חודש)</label>
                        <input type="number" className="w-full bg-gray-900 border border-white/10 p-6 rounded-[30px] text-white font-black text-3xl italic shadow-inner outline-none focus:border-red-500 text-center" value={editingUser.monthlyRecord || 0} onChange={e=>setEditingUser({...editingUser, monthlyRecord: parseInt(e.target.value)})} />
                      </div>
                  </div>
                  <div className="p-8 bg-blue-600/5 rounded-[40px] border border-blue-600/20 space-y-4 shadow-xl">
                    <p className="text-blue-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">📜 הצהרת בריאות</p>
                    <div className="space-y-2">
                        <p className="text-white text-lg font-black italic">{editingUser.healthDeclarationDate ? `נחתמה ב- ${new Date(editingUser.healthDeclarationDate).toLocaleDateString('he-IL')}` : 'טרם נחתמה במערכת'}</p>
                        {editingUser.healthDeclarationId && <p className="text-gray-500 text-[11px] font-mono tracking-widest">ת.ז: {editingUser.healthDeclarationId}</p>}
                    </div>
                  </div>
              </div>
              <div className="mt-12 flex gap-4">
                  <Button onClick={()=>{props.onUpdateUser(editingUser); setEditingUser(null);}} className="flex-1 bg-red-600 py-7 rounded-[45px] text-xl font-black italic uppercase shadow-2xl shadow-red-600/20">עדכן פרטים ✓</Button>
                  <Button onClick={()=>{if(confirm('למחוק את המתאמן לצמיתות?')){props.onDeleteUser(editingUser.id); setEditingUser(null);}}} variant="danger" className="px-8 rounded-[45px] bg-gray-800">🗑️</Button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
