
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { User, TrainingSession, PaymentStatus, WorkoutType, WeatherLocation, LocationDef, AppConfig, WeatherInfo } from './types';
import { SessionCard } from './components/SessionCard';
import { AdminPanel } from './components/AdminPanel';
import { Button } from './components/Button';
import { getMotivationQuote } from './services/geminiService';
import { getWeatherForDates, getWeatherIcon } from './services/weatherService';
import { dataService } from './services/dataService';

const normalizePhone = (phone: string): string => {
    if (!phone) return '';
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('972')) cleaned = '0' + cleaned.substring(3);
    else if (!cleaned.startsWith('0')) cleaned = '0' + cleaned;
    return cleaned;
};

const App: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isAdminMode, setIsAdminMode] = useState<boolean>(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [workoutTypes, setWorkoutTypes] = useState<string[]>([]);
  const [locations, setLocations] = useState<LocationDef[]>([]);
  const [appConfig, setAppConfig] = useState<AppConfig>({
      coachNameHeb: 'ניב כהן', coachNameEng: 'NIV COHEN', coachPhone: '0502264663', coachEmail: '', defaultCity: 'נס ציונה', coachAdditionalPhone: 'admin'
  });
  const [currentUserPhone, setCurrentUserPhone] = useState<string | null>(localStorage.getItem('niv_app_current_phone'));
  const [quote, setQuote] = useState('');
  const [weatherData, setWeatherData] = useState<Record<string, WeatherInfo>>({});
  const [viewingSession, setViewingSession] = useState<TrainingSession | null>(null);

  const currentUser = useMemo(() => users.find(u => normalizePhone(u.phone) === normalizePhone(currentUserPhone || '')), [users, currentUserPhone]);
  
  const stats = useMemo(() => {
    if (!currentUser) return { monthly: 0, record: 0, streak: 0 };
    const phone = normalizePhone(currentUser.phone);
    const now = new Date();
    const attendedSessions = sessions.filter(s => s.attendedPhoneNumbers?.includes(phone));
    
    const monthlyCount = attendedSessions.filter(s => {
        const d = new Date(s.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;

    const weekMap: Record<string, number> = {};
    attendedSessions.forEach(s => {
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
    return { monthly: monthlyCount, record: Math.max(currentUser.monthlyRecord || 0, monthlyCount), streak };
  }, [currentUser, sessions]);

  const monthLeader = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const attendanceMap: Record<string, number> = {};
    sessions.forEach(s => {
      if (new Date(s.date).getMonth() === currentMonth) {
        (s.attendedPhoneNumbers || []).forEach(p => {
          const np = normalizePhone(p);
          attendanceMap[np] = (attendanceMap[np] || 0) + 1;
        });
      }
    });
    let topCount = 0;
    let topPhone = '';
    Object.entries(attendanceMap).forEach(([phone, count]) => {
      if (count > topCount) { topCount = count; topPhone = phone; }
    });
    const leader = users.find(u => normalizePhone(u.phone) === topPhone);
    return { name: leader ? (leader.displayName || leader.fullName.split(' ')[0]) : '---', count: topCount };
  }, [sessions, users]);

  useEffect(() => {
    document.documentElement.style.setProperty('--brand-primary', isAdminMode ? '#EF4444' : '#A3E635');
  }, [isAdminMode]);

  const refreshData = useCallback(async () => {
      setIsLoadingData(true);
      try {
          const [u, s, locs, types, config] = await Promise.all([
              dataService.getUsers(), dataService.getSessions(), dataService.getLocations(), dataService.getWorkoutTypes(), dataService.getAppConfig()
          ]);
          setUsers(u); setSessions(s); setLocations(locs); setWorkoutTypes(types); setAppConfig(config);
          getMotivationQuote().then(setQuote);
          const dates = Array.from({length: 14}, (_, i) => {
            const d = new Date(); d.setDate(d.getDate() - 3 + i);
            return d.toISOString().split('T')[0];
          });
          getWeatherForDates(dates).then(setWeatherData);
      } catch (e) { console.error(e); } finally { setIsLoadingData(false); }
  }, []);

  useEffect(() => { refreshData(); }, [refreshData]);

  const handleRegisterClick = async (sid: string) => {
      if (!currentUserPhone) { document.getElementById('login-modal')?.classList.remove('hidden'); return; }
      const session = sessions.find(s => s.id === sid);
      if (!session || session.isCancelled) return;
      const phone = normalizePhone(currentUserPhone);
      let updated = { ...session };
      if (session.registeredPhoneNumbers.includes(phone)) {
          updated.registeredPhoneNumbers = session.registeredPhoneNumbers.filter(p => p !== phone);
      } else {
          if (session.registeredPhoneNumbers.length >= session.maxCapacity) { alert('האימון מלא!'); return; }
          updated.registeredPhoneNumbers = [...session.registeredPhoneNumbers, phone];
      }
      setSessions(prev => prev.map(s => s.id === sid ? updated : s));
      await dataService.updateSession(updated);
  };

  const handleUpdateProfile = async (updatedUser: User) => {
      setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
      await dataService.updateUser(updatedUser);
      setIsProfileModalOpen(false);
  };

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className={`min-h-screen ${isAdminMode ? 'bg-red-950/10' : 'bg-brand-black'} pb-20 font-sans transition-all duration-500`}>
      <header className={`p-6 sticky top-0 z-40 border-b border-gray-800/50 backdrop-blur-md ${isAdminMode ? 'bg-red-900/20 border-red-500/30' : 'bg-brand-dark/80'}`}>
          <div className="flex justify-between items-center mb-6">
              <div onClick={() => isAdminMode ? setIsAdminMode(false) : document.getElementById('admin-modal')?.classList.remove('hidden')} className="cursor-pointer">
                  <h1 className={`text-2xl font-black italic uppercase leading-none transition-colors duration-500 ${isAdminMode ? 'text-red-500' : 'text-white'}`}>
                      {appConfig.coachNameEng.split(' ')[0]} <span className={isAdminMode ? 'text-white' : 'text-brand-primary'}>{appConfig.coachNameEng.split(' ').slice(1).join(' ')}</span>
                  </h1>
                  <p className="text-[8px] font-black tracking-[0.4em] text-gray-500 uppercase mt-1">CONSIST TRAINING</p>
              </div>
              {currentUser && !isAdminMode && (
                  <div className="flex items-center gap-3">
                    <div onClick={() => setIsProfileModalOpen(true)} className="text-right cursor-pointer group">
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest group-hover:text-brand-primary transition-colors">פרופיל אישי</p>
                        <p className="text-white font-black italic text-sm" style={{ color: currentUser.userColor || 'white' }}>{currentUser.displayName || currentUser.fullName}</p>
                    </div>
                    <button onClick={()=>{setCurrentUserPhone(null); localStorage.removeItem('niv_app_current_phone');}} className="text-[9px] text-gray-700 font-bold uppercase border border-gray-800 px-3 py-1 rounded-full hover:bg-white hover:text-black transition-all">יציאה</button>
                  </div>
              )}
          </div>

          {currentUser && !isAdminMode && (
              <div className="grid grid-cols-4 gap-2">
                  <div className="bg-gray-800/40 p-4 rounded-2xl border border-white/5 flex flex-col items-center justify-center text-center">
                     <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">החודש</p>
                     <p className="text-brand-primary font-black text-4xl leading-none">{stats.monthly}</p>
                  </div>
                  <div className="bg-gray-800/40 p-4 rounded-2xl border border-white/5 flex flex-col items-center justify-center text-center">
                     <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">שיא</p>
                     <p className="text-white font-black text-4xl leading-none">{stats.record}</p>
                  </div>
                  <div className="bg-orange-500/10 p-4 rounded-2xl border border-orange-500/20 flex flex-col items-center justify-center text-center">
                     <p className="text-[10px] text-orange-500 font-bold uppercase mb-1 flex items-center gap-1">רצף 🔥</p>
                     <p className="text-orange-400 font-black text-4xl leading-none">{stats.streak}</p>
                  </div>
                  <div className="bg-brand-primary/10 p-4 rounded-2xl border border-brand-primary/20 flex flex-col items-center justify-center text-center overflow-hidden">
                     <p className="text-[10px] text-brand-primary font-bold uppercase mb-1 flex items-center gap-1">אלוף 🏆</p>
                     <p className="text-white font-black text-xl leading-none truncate w-full">{monthLeader.name}</p>
                     <p className="text-brand-primary font-black text-xs mt-1">{monthLeader.count} אימונים</p>
                  </div>
              </div>
          )}
      </header>

      <main className="max-w-4xl mx-auto p-4">
        {isAdminMode ? (
             <AdminPanel 
                users={users} sessions={sessions} primaryColor="#EF4444" workoutTypes={workoutTypes}
                locations={locations} weatherLocation={{name: appConfig.defaultCity, lat:0, lon:0}} paymentLinks={[]} streakGoal={3}
                appConfig={appConfig} quotes={[]} weatherData={weatherData}
                onAddUser={async u => { await dataService.addUser(u); setUsers([...users, u]); }}
                onUpdateUser={async u => { await dataService.updateUser(u); setUsers(users.map(x=>x.id===u.id?u:x)); }}
                onDeleteUser={async id => { await dataService.deleteUser(id); setUsers(users.filter(x=>x.id!==id)); }}
                onAddSession={async s => { await dataService.addSession(s); setSessions([...sessions, s]); }}
                onUpdateSession={async s => { await dataService.updateSession(s); setSessions(sessions.map(x=>x.id===s.id?s:x)); }}
                onDeleteSession={async id => { await dataService.deleteSession(id); setSessions(sessions.filter(x=>x.id!==id)); }}
                onColorChange={()=>{}} onUpdateWorkoutTypes={async t => { await dataService.saveWorkoutTypes(t); setWorkoutTypes(t); }} 
                onUpdateLocations={async l => { await dataService.saveLocations(l); setLocations(l); }}
                onUpdateWeatherLocation={()=>{}} onAddPaymentLink={()=>{}} onDeletePaymentLink={()=>{}} onUpdateStreakGoal={()=>{}}
                onUpdateAppConfig={async c => { await dataService.saveAppConfig(c); setAppConfig(c); }} onExitAdmin={() => setIsAdminMode(false)}
            />
        ) : (
            <div className="space-y-6">
                {quote && <div className="text-center bg-gray-900/40 p-10 rounded-[40px] border border-gray-800/30"><p className="text-2xl font-black text-white italic leading-tight">"{quote}"</p></div>}
                <div className="space-y-10">
                  {Array.from({length:7}, (_,i) => {
                      const d = new Date(); d.setDate(d.getDate() - d.getDay() + i);
                      const dateStr = d.toISOString().split('T')[0];
                      const isToday = dateStr === todayStr;
                      const daySessions = sessions.filter(s => s.date === dateStr && !s.isHidden).sort((a,b)=>a.time.localeCompare(b.time));
                      return (
                          <div key={dateStr} className={`rounded-[50px] p-8 border transition-all duration-500 ${isToday ? 'bg-brand-primary/10 border-brand-primary/40' : 'bg-gray-900/10 border-gray-800/20'}`}>
                              <h2 className={`text-[14px] font-black uppercase tracking-[0.2em] mb-8 pb-2 border-b border-white/5 ${isToday ? 'text-white' : 'text-gray-600'}`}>
                                  {d.toLocaleDateString('he-IL',{weekday:'long', day:'numeric', month:'numeric'})}
                              </h2>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                  {daySessions.map(s => <SessionCard key={s.id} session={s} allUsers={users} isRegistered={!!currentUserPhone && s.registeredPhoneNumbers.includes(normalizePhone(currentUserPhone))} onRegisterClick={handleRegisterClick} onViewDetails={()=>setViewingSession(s)} locations={locations} weather={weatherData[s.date]}/>)}
                                  {daySessions.length === 0 && <p className="text-gray-700 text-[10px] uppercase font-black tracking-widest col-span-full text-center py-4 italic">יום מנוחה</p>}
                              </div>
                          </div>
                      );
                  })}
                </div>
            </div>
        )}
      </main>

      {/* Profile Modal */}
      {isProfileModalOpen && currentUser && (
        <div className="fixed inset-0 bg-black/95 z-[70] flex items-center justify-center p-4 backdrop-blur-2xl no-scrollbar overflow-y-auto">
            <div className="bg-gray-900 p-8 rounded-[50px] w-full max-w-lg border border-white/10 flex flex-col shadow-3xl text-right my-auto" dir="rtl">
                <div className="flex justify-between items-center mb-8 border-b border-white/5 pb-4">
                    <h3 className="text-3xl font-black text-white italic uppercase">עריכת פרופיל 👤</h3>
                    <button onClick={() => setIsProfileModalOpen(false)} className="text-gray-500 text-3xl">✕</button>
                </div>
                
                <div className="space-y-6 overflow-y-auto max-h-[70vh] px-2 no-scrollbar">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] text-gray-500 font-black uppercase block mb-2">כינוי (איך יראו אותך ברשימות)</label>
                            <input className="w-full bg-gray-800 border border-white/5 p-4 rounded-2xl text-white font-bold" value={currentUser.displayName || ''} onChange={e => handleUpdateProfile({...currentUser, displayName: e.target.value})} placeholder="כינוי..." />
                        </div>
                        <div>
                            <label className="text-[10px] text-gray-500 font-black uppercase block mb-2">צבע אישי</label>
                            <input type="color" className="w-full h-14 bg-gray-800 border border-white/5 rounded-2xl p-1 cursor-pointer" value={currentUser.userColor || '#A3E635'} onChange={e => handleUpdateProfile({...currentUser, userColor: e.target.value})} />
                        </div>
                    </div>

                    <div className="bg-brand-primary/5 p-6 rounded-3xl border border-brand-primary/20 space-y-4">
                        <h4 className="text-brand-primary font-black uppercase italic text-sm border-b border-brand-primary/10 pb-2">הצהרת בריאות דיגיטלית</h4>
                        <p className="text-gray-400 text-xs">אני מצהיר בזאת כי מצבי הבריאותי תקין ומאפשר לי לבצע פעילות גופנית עצימה.</p>
                        
                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <label className="text-[10px] text-gray-400 font-black block mb-2">מספר תעודת זהות</label>
                                <input className="w-full bg-gray-900 border border-white/5 p-4 rounded-xl text-white font-mono" placeholder="123456789" value={currentUser.healthDeclarationId || ''} onChange={e => handleUpdateProfile({...currentUser, healthDeclarationId: e.target.value})} />
                            </div>
                            <div className="flex items-center gap-3 bg-gray-900/50 p-4 rounded-xl">
                                <input type="checkbox" id="health-check" className="w-6 h-6 rounded bg-gray-800 border-white/10" checked={!!currentUser.healthDeclarationDate} onChange={e => handleUpdateProfile({...currentUser, healthDeclarationDate: e.target.checked ? new Date().toISOString() : ''})} />
                                <label htmlFor="health-check" className="text-white text-xs font-bold">אני מאשר את נכונות ההצהרה</label>
                            </div>
                        </div>
                        
                        <div>
                            <label className="text-[10px] text-gray-500 font-black uppercase block mb-2">העלאת קובץ חתום (אופציונלי)</label>
                            <div className="border-2 border-dashed border-white/10 p-6 rounded-2xl text-center cursor-pointer hover:border-brand-primary transition-all">
                                <p className="text-gray-500 text-[10px] font-black italic uppercase">לחץ להעלאת הצהרה חתומה</p>
                                {currentUser.healthDeclarationFile && <p className="text-brand-primary text-[8px] mt-2 font-black uppercase">קובץ הועלה בהצלחה ✓</p>}
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] text-gray-500 font-black uppercase block mb-2">אימייל לעדכונים</label>
                        <input className="w-full bg-gray-800 border border-white/5 p-4 rounded-2xl text-white font-bold" value={currentUser.email || ''} onChange={e => handleUpdateProfile({...currentUser, email: e.target.value})} placeholder="email@example.com" />
                    </div>
                </div>

                <Button onClick={() => setIsProfileModalOpen(false)} className="w-full py-6 mt-8 rounded-[30px] text-xl font-black italic uppercase">שמור הכל ✅</Button>
            </div>
        </div>
      )}

      {viewingSession && !isAdminMode && (
        <div className="fixed inset-0 bg-black/95 z-[60] flex items-center justify-center p-4 backdrop-blur-xl">
           <div className="bg-gray-900 p-10 rounded-[50px] w-full max-w-md border border-gray-800 flex flex-col shadow-3xl text-right" dir="rtl">
              <div className="flex justify-between items-start mb-6">
                 <div>
                    <h3 className="text-3xl font-black text-white italic uppercase leading-none mb-1">{viewingSession.type}</h3>
                    <div className="flex items-center gap-2">
                      <p className="text-brand-primary font-mono text-lg font-black uppercase tracking-widest">{viewingSession.time}</p>
                      {weatherData[viewingSession.date]?.hourly?.[viewingSession.time.split(':')[0]] && (
                         <span className="text-gray-400 text-sm font-bold flex items-center gap-1 border-r border-gray-700 pr-2">
                           {getWeatherIcon(weatherData[viewingSession.date].hourly![viewingSession.time.split(':')[0]].weatherCode)}
                           {Math.round(weatherData[viewingSession.date].hourly![viewingSession.time.split(':')[0]].temp)}°
                         </span>
                      )}
                    </div>
                 </div>
                 <button onClick={()=>setViewingSession(null)} className="text-gray-500 text-3xl">✕</button>
              </div>
              <div className="space-y-6">
                 <div className="bg-gray-800/50 p-4 rounded-3xl border border-white/5">
                    <p className="text-gray-500 text-[10px] font-black uppercase mb-1">מיקום האימון</p>
                    <p className="text-white font-black text-xl">{viewingSession.location}</p>
                 </div>
                 {viewingSession.description && (
                    <div className="bg-brand-primary/5 p-6 rounded-3xl border border-brand-primary/10">
                       <p className="text-brand-primary text-[10px] font-black uppercase mb-2">דגשי המאמן 📣</p>
                       <p className="text-white font-bold text-lg leading-relaxed">{viewingSession.description}</p>
                    </div>
                 )}
                 <div>
                    <p className="text-gray-500 text-[10px] font-black uppercase mb-1">רשומים ({viewingSession.registeredPhoneNumbers.length}/{viewingSession.maxCapacity})</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                       {viewingSession.registeredPhoneNumbers.map(p => {
                           const u = users.find(x => normalizePhone(x.phone) === normalizePhone(p));
                           return (
                             <span key={p} className="bg-gray-800 text-gray-300 px-4 py-2 rounded-2xl text-xs font-bold border border-white/5" style={{ borderColor: u?.userColor || 'transparent' }}>
                               {u?.displayName || u?.fullName || 'מתאמן'}
                             </span>
                           );
                       })}
                    </div>
                 </div>
              </div>
              <Button onClick={() => { handleRegisterClick(viewingSession.id); setViewingSession(null); }} className="w-full py-6 mt-8 rounded-[30px] text-xl font-black italic uppercase">
                 {viewingSession.registeredPhoneNumbers.includes(normalizePhone(currentUserPhone || '')) ? 'ביטול הרשמה' : 'הרשמה לאימון ⚡'}
              </Button>
           </div>
        </div>
      )}
      
      {/* Admin Login & User Phone Login Modals remain as before */}
      <div id="admin-modal" className="fixed inset-0 bg-black/95 z-50 hidden flex items-center justify-center p-4 backdrop-blur-xl">
          <div className="bg-gray-900 p-12 rounded-[50px] w-full max-sm border border-gray-800 shadow-2xl">
              <h3 className="text-white font-black text-3xl mb-8 text-center italic uppercase">כניסת מאמן 🔒</h3>
              <input type="password" id="admin-pass" placeholder='סיסמה' className="w-full p-6 bg-gray-800 text-white rounded-3xl mb-4 text-center border border-gray-700 outline-none focus:border-red-500 text-3xl font-mono" />
              <Button onClick={() => { 
                  const pass = (document.getElementById('admin-pass') as HTMLInputElement).value;
                  if(pass === (appConfig.coachAdditionalPhone || 'admin')) { setIsAdminMode(true); document.getElementById('admin-modal')?.classList.add('hidden'); }
                  else alert('סיסמה שגויה');
              }} className="w-full py-6 rounded-3xl bg-red-600 hover:bg-red-500 text-white shadow-xl shadow-red-600/20">כניסה למערכת</Button>
          </div>
      </div>

      <div id="login-modal" className="fixed inset-0 bg-black/95 z-50 hidden flex items-center justify-center p-4 backdrop-blur-xl">
          <div className="bg-gray-900 p-12 rounded-[50px] w-full max-w-sm border border-gray-800 shadow-2xl text-center">
              <h3 className="text-white font-black text-3xl mb-2 italic uppercase">מי המתאמן? 🤔</h3>
              <p className="text-gray-500 text-[10px] mb-10 font-black uppercase tracking-widest">הכנס מספר טלפון להרשמה</p>
              <input type="tel" id="user-phone" placeholder='05x-xxxxxxx' className="w-full p-6 bg-gray-800 text-white rounded-3xl mb-8 text-center border border-gray-700 outline-none focus:border-brand-primary text-4xl font-mono" />
              <Button onClick={() => { 
                  const p = (document.getElementById('user-phone') as HTMLInputElement).value;
                  if(p.length >= 9) { setCurrentUserPhone(p); localStorage.setItem('niv_app_current_phone', p); document.getElementById('login-modal')?.classList.add('hidden'); }
                  else alert('מספר לא תקין');
              }} className="w-full py-6 rounded-3xl shadow-2xl shadow-brand-primary/20">התחברות 🚀</Button>
          </div>
      </div>
    </div>
  );
};

export default App;
