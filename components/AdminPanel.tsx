
import React, { useState, useMemo, useEffect } from 'react';
import { User, TrainingSession, WeatherLocation, LocationDef, AppConfig, Quote, WeatherInfo } from '../types';
import { Button } from './Button';
import { SessionCard } from './SessionCard';
import { dataService } from '../services/dataService';

interface AdminPanelProps {
  users: User[]; sessions: TrainingSession[]; primaryColor: string; workoutTypes: string[]; locations: LocationDef[];
  weatherLocation: WeatherLocation; weatherData?: Record<string, WeatherInfo>; paymentLinks: any[];
  streakGoal: number; appConfig: AppConfig; quotes: Quote[]; deferredPrompt?: any; onInstall?: () => void;
  onAddUser: (user: User) => void; onUpdateUser: (user: User) => void; onDeleteUser: (userId: string) => void; 
  onAddSession: (session: TrainingSession) => void; onUpdateSession: (session: TrainingSession) => void; onDeleteSession: (id: string) => void;
  onDuplicateSession?: (session: TrainingSession) => void;
  onAddToCalendar?: (session: TrainingSession) => void;
  onColorChange: (color: string) => void; onUpdateWorkoutTypes: (types: string[]) => void; 
  onUpdateLocations: (locations: LocationDef[]) => void; onUpdateWeatherLocation: (location: WeatherLocation) => void;
  onAddPaymentLink: (link: any) => void; onDeletePaymentLink: (id: string) => void; onUpdateStreakGoal: (goal: number) => void;
  onUpdateAppConfig: (config: AppConfig) => void; onExitAdmin: () => void;
  getStatsForUser: (user: User) => { monthly: number; record: number; streak: number };
}

export const AdminPanel: React.FC<AdminPanelProps> = (props) => {
  const [activeTab, setActiveTab] = useState<'attendance' | 'users' | 'settings'>('attendance');
  const [attendanceSession, setAttendanceSession] = useState<TrainingSession | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [traineeSearch, setTraineeSearch] = useState('');
  const [saveIndicator, setSaveIndicator] = useState<string | null>(null);

  // Local state for modal to ensure typing is smooth
  const [sessionDraft, setSessionDraft] = useState<TrainingSession | null>(null);

  useEffect(() => {
    if (attendanceSession) setSessionDraft({ ...attendanceSession });
    else setSessionDraft(null);
  }, [attendanceSession]);

  const normalizePhone = (p: string) => {
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

  const traineeSuggestions = useMemo(() => {
      if (!traineeSearch || !sessionDraft) return [];
      const search = traineeSearch.toLowerCase();
      return props.users.filter(u => 
          (u.fullName.toLowerCase().includes(search) || u.phone.includes(search)) && 
          !sessionDraft.registeredPhoneNumbers.includes(normalizePhone(u.phone))
      ).slice(0, 5);
  }, [traineeSearch, props.users, sessionDraft]);

  const handleShareToWhatsApp = () => {
    if (!sessionDraft) return;
    const dateStr = new Date(sessionDraft.date).toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'numeric' });
    const text = `*עדכון אימון - ניב כהן* 🏋️\n\n🕒 שעה: ${sessionDraft.time}\n📅 תאריך: ${dateStr}\n📍 מיקום: ${sessionDraft.location}\n🔥 סוג: ${sessionDraft.type}\n\n*דגשים:* \n${sessionDraft.description || 'אין דגשים מיוחדים'}\n\nנתראה שם! 💪`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="bg-brand-black min-h-screen">
      <div className="fixed top-[130px] left-0 right-0 z-[60] bg-brand-black/90 pt-4 border-b border-white/5 pb-4 backdrop-blur-xl px-4">
        <div className="max-w-4xl mx-auto flex gap-2">
            {['settings', 'users', 'attendance'].map(t => (
                <button key={t} onClick={() => setActiveTab(t as any)} className={`flex-1 py-4 rounded-2xl text-sm font-black uppercase tracking-widest transition-all ${activeTab === t ? 'bg-red-600 text-white shadow-xl shadow-red-600/40' : 'bg-gray-800/50 text-gray-500'}`}>
                {t === 'attendance' ? 'נוכחות' : t === 'users' ? 'מתאמנים' : 'הגדרות'}
                </button>
            ))}
        </div>
      </div>

      <div className="p-4 max-w-4xl mx-auto pt-[200px] space-y-6 pb-24">
        {activeTab === 'attendance' && (
          <div className="space-y-6">
             <div className="flex flex-col gap-4 bg-gray-800/40 p-5 rounded-3xl border border-white/5 shadow-xl mt-6">
                <div className="flex justify-between items-center">
                    <button onClick={()=>setWeekOffset(p=>p-1)} className="text-white text-2xl p-2 hover:text-red-500 transition-colors">←</button>
                    <span className="text-red-500 font-black uppercase tracking-[0.3em] bg-red-500/10 px-4 py-1 rounded-full">{weekOffset === 0 ? 'השבוע' : `שבוע ${weekOffset}`}</span>
                    <button onClick={()=>setWeekOffset(p=>p+1)} className="text-white text-2xl p-2 hover:text-red-500 transition-colors">→</button>
                </div>
             </div>

             <Button onClick={() => setAttendanceSession({ id: Date.now().toString(), type: props.workoutTypes[0] || 'פונקציונלי', date: new Date().toISOString().split('T')[0], time: '18:00', location: props.locations[0]?.name || '', maxCapacity: 15, registeredPhoneNumbers: [], attendedPhoneNumbers: [], description: '', isPersonalTraining: false, isZoomSession: false, isCancelled: false })} className="w-full py-7 rounded-[45px] bg-red-600 text-xl font-black italic shadow-2xl">+ יצירת אימון חדש</Button>
             <div className="space-y-12">
              {weekDates.map(date => {
                  let daySessions = props.sessions.filter(s => s.date === date).sort((a,b)=>a.time.localeCompare(b.time));
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
          </div>
        )}

        {activeTab === 'users' && (
            <div className="space-y-6">
                <input type="text" placeholder="חיפוש מתאמן..." className="w-full bg-gray-800 border border-white/10 p-6 rounded-[30px] text-white outline-none focus:border-red-500 shadow-xl" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
                <div className="grid gap-4">
                    {props.users.filter(u => u.fullName.includes(searchTerm)).map(u => (
                       <div key={u.id} className="bg-gray-800/40 p-6 rounded-[50px] border border-white/5 flex flex-col sm:flex-row justify-between items-center shadow-2xl">
                          <div className="flex items-center gap-6">
                             <div className="w-16 h-16 rounded-full bg-gray-900 border-2 border-white/10 flex items-center justify-center font-black text-2xl text-red-500" style={{ color: u.userColor }}>{u.fullName.charAt(0)}</div>
                             <div><h3 className="text-white font-black text-xl italic" style={{ color: u.userColor }}>{u.fullName}</h3><p className="text-xs text-gray-500 font-mono tracking-widest">{u.phone}</p></div>
                          </div>
                          <div className="grid grid-cols-3 gap-8 text-center mt-4 sm:mt-0">
                             <div><p className="text-[10px] text-gray-500 font-black uppercase mb-1">החודש</p><p className="text-3xl font-black text-brand-primary">{(u as any).stats?.monthly || 0}</p></div>
                             <div><p className="text-[10px] text-gray-500 font-black uppercase mb-1">שיא</p><p className="text-3xl font-black text-white">{(u as any).stats?.record || 0}</p></div>
                             <div><p className="text-[10px] text-gray-500 font-black uppercase mb-1">רצף</p><p className="text-3xl font-black text-orange-400">{(u as any).stats?.streak || 0}</p></div>
                          </div>
                       </div>
                    ))}
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
                        <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest border-b border-white/5 pb-2">נוכחות ({sessionDraft.registeredPhoneNumbers.length})</p>
                        <div className="relative">
                            <input type="text" placeholder="הוספת מתאמן..." className="w-full bg-gray-900 p-4 rounded-2xl text-white text-xs border border-white/5 outline-none focus:border-brand-primary" value={traineeSearch} onChange={(e) => setTraineeSearch(e.target.value)} />
                            {traineeSuggestions.length > 0 && (
                                <div className="absolute top-full left-0 right-0 z-[210] bg-gray-900 border border-white/10 rounded-2xl mt-1 overflow-hidden shadow-2xl">
                                    {traineeSuggestions.map(u => (
                                        <button key={u.id} className="w-full p-4 text-right hover:bg-gray-800 transition-colors flex justify-between items-center group" onClick={() => { const phone = normalizePhone(u.phone); setSessionDraft({ ...sessionDraft, registeredPhoneNumbers: [...sessionDraft.registeredPhoneNumbers, phone] }); setTraineeSearch(''); }}>
                                            <span className="text-white text-sm font-bold">{u.fullName}</span>
                                            <span className="text-brand-primary">+ הוסף</span>
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
                                        <div className="flex gap-2">
                                            <button onClick={() => { const curr = sessionDraft.attendedPhoneNumbers || []; const up = isAttended ? curr.filter(p => p !== phone) : [...curr, phone]; setSessionDraft({...sessionDraft, attendedPhoneNumbers: up}); }} className={`px-4 py-2 rounded-xl text-[10px] font-black ${isAttended ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-500'}`}>{isAttended ? 'נכח' : 'לא נכח'}</button>
                                            <button onClick={() => setSessionDraft({...sessionDraft, registeredPhoneNumbers: sessionDraft.registeredPhoneNumbers.filter(p => p !== phone)})} className="text-red-500 p-2">✕</button>
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
                        <div><label className="text-[10px] text-gray-500 font-black mb-1 block uppercase">דגשים למתאמנים (פוש וואטסאפ)</label><textarea className="w-full bg-gray-800 p-5 rounded-3xl text-white font-bold h-24 text-sm" value={sessionDraft.description || ''} onChange={e=>setSessionDraft({...sessionDraft, description: e.target.value})} placeholder="כתוב כאן דגשים לאימון..."></textarea></div>
                        <Button onClick={handleShareToWhatsApp} className="w-full bg-green-600 py-3 rounded-2xl text-xs flex items-center gap-2 justify-center">שלח פוש לקבוצה 📢 ✅</Button>
                        <div className="grid grid-cols-3 gap-2 p-4 bg-gray-800/20 rounded-3xl border border-white/5">
                            <div className="flex items-center gap-2">
                                <input type="checkbox" id="isPersonalDraft" className="w-6 h-6 accent-purple-500 cursor-pointer" checked={sessionDraft.isPersonalTraining || false} onChange={e=>setSessionDraft({...sessionDraft, isPersonalTraining: e.target.checked})} />
                                <label htmlFor="isPersonalDraft" className="text-purple-400 text-[10px] font-black uppercase cursor-pointer">אישי 🏆</label>
                            </div>
                            <div className="flex items-center gap-2">
                                <input type="checkbox" id="isCancelledDraft" className="w-6 h-6 accent-red-500 cursor-pointer" checked={sessionDraft.isCancelled || false} onChange={e=>setSessionDraft({...sessionDraft, isCancelled: e.target.checked})} />
                                <label htmlFor="isCancelledDraft" className="text-red-500 text-[10px] font-black uppercase cursor-pointer">מבוטל ❌</label>
                            </div>
                            <div className="flex items-center gap-2">
                                <input type="checkbox" id="isHappeningDraft" className="w-6 h-6 accent-brand-primary cursor-pointer" checked={sessionDraft.manualHasStarted || false} onChange={e=>setSessionDraft({...sessionDraft, manualHasStarted: e.target.checked})} />
                                <label htmlFor="isHappeningDraft" className="text-brand-primary text-[10px] font-black uppercase cursor-pointer">מתקיים ✓</label>
                            </div>
                        </div>
                      </div>
                  </div>
                  <div className="mt-12 flex gap-4">
                      <Button onClick={()=>{ 
                          const isNew = !props.sessions.find(s => s.id === sessionDraft.id);
                          if (isNew) props.onAddSession(sessionDraft); else props.onUpdateSession(sessionDraft); 
                          setAttendanceSession(null); 
                      }} className="flex-1 bg-red-600 py-8 rounded-[45px] text-2xl font-black italic uppercase shadow-2xl">שמור שינויים ✓</Button>
                      <Button onClick={()=>{if(confirm('מחיקת אימון?')){props.onDeleteSession(sessionDraft.id); setAttendanceSession(null);}}} variant="danger" className="px-12 rounded-[45px]">מחק 🗑️</Button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
