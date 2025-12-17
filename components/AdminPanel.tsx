import React, { useState, useMemo, useEffect } from 'react';
import { User, TrainingSession, PaymentStatus, WeatherLocation, LocationDef, AppConfig, WeatherInfo } from '../types';
import { Button } from './Button';
import { generateWorkoutDescription } from '../services/geminiService';
import { dataService } from '../services/dataService';
import { SessionCard } from './SessionCard';

interface AdminPanelProps {
  users: User[];
  sessions: TrainingSession[];
  primaryColor: string;
  workoutTypes: string[];
  locations: LocationDef[];
  weatherLocation: WeatherLocation;
  weatherData?: Record<string, WeatherInfo>;
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
  paymentLinks: any[];
  streakGoal: number;
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
    users, sessions, primaryColor, workoutTypes, locations, weatherLocation, weatherData,
    appConfig, onAddUser, onUpdateUser, onDeleteUser, 
    onAddSession, onUpdateSession, onDeleteSession,
    onUpdateWorkoutTypes, onUpdateLocations, onUpdateWeatherLocation, onUpdateAppConfig, onExitAdmin
}) => {
  const [activeTab, setActiveTab] = useState<'attendance' | 'users' | 'settings'>('attendance');
  const [weekOffset, setWeekOffset] = useState(0);
  const [attendanceSession, setAttendanceSession] = useState<TrainingSession | null>(null);
  const [markedAttendees, setMarkedAttendees] = useState<Set<string>>(new Set());
  const [messageText, setMessageText] = useState('');
  const [isSaving, setIsSaving] = useState(false);

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

  const openAttendanceModal = (session: TrainingSession) => {
      setAttendanceSession(session);
      setMessageText(`היי! תזכורת לאימון ${session.type} היום ב-${session.time}. 💪`);
      
      // Default logic: If no attendance was taken yet, check all registered users.
      const initial = session.attendedPhoneNumbers?.length 
        ? new Set(session.attendedPhoneNumbers) 
        : new Set(session.registeredPhoneNumbers);
      setMarkedAttendees(initial);
  };

  const handleSaveAttendance = async () => {
      if (!attendanceSession) return;
      setIsSaving(true);
      const updated = { ...attendanceSession, attendedPhoneNumbers: Array.from(markedAttendees) };
      await onUpdateSession(updated);
      setIsSaving(false);
      setAttendanceSession(null);
  };

  const handleSendMessage = (phone: string) => {
      const url = `https://wa.me/${normalizePhoneForWhatsapp(phone)}?text=${encodeURIComponent(messageText)}`;
      window.open(url, '_blank');
  };

  return (
    <div className="bg-gray-900 rounded-lg p-4 text-right">
      <div className="flex gap-4 mb-6 overflow-x-auto no-scrollbar pb-2">
         {['attendance', 'users', 'settings'].map(tab => (
             <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-4 py-2 rounded whitespace-nowrap ${activeTab === tab ? 'bg-brand-primary text-brand-black' : 'bg-gray-700 text-gray-300'}`}>
                 {tab === 'attendance' ? 'יומן ונוכחות' : tab === 'users' ? 'מתאמנים' : 'הגדרות'}
             </button>
         ))}
      </div>

      {activeTab === 'attendance' && (
          <div className="space-y-4">
              <div className="flex justify-between items-center">
                  <h3 className="text-xl font-bold text-white">ניהול נוכחות</h3>
                  <div className="flex gap-2">
                      <button onClick={()=>setWeekOffset(p=>p-1)} className="bg-gray-700 p-2 rounded">←</button>
                      <button onClick={()=>setWeekOffset(p=>p+1)} className="bg-gray-700 p-2 rounded">→</button>
                  </div>
              </div>
              {weekDates.map(date => (
                  <div key={date} className="bg-gray-800 p-3 rounded-lg">
                      <p className="text-brand-primary font-bold mb-2">{new Date(date).toLocaleDateString('he-IL',{weekday:'long'})} - {date}</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {(groupedSessions[date] || []).map(s => (
                              <div key={s.id} onClick={() => openAttendanceModal(s)} className="cursor-pointer">
                                  <SessionCard session={s} allUsers={users} isRegistered={false} onRegisterClick={()=>{}} onViewDetails={()=>{}} isAdmin={true}/>
                              </div>
                          ))}
                      </div>
                  </div>
              ))}
          </div>
      )}

      {activeTab === 'users' && (
          <div className="bg-gray-800 p-4 rounded-xl overflow-x-auto">
              <table className="w-full text-right text-sm">
                  <thead>
                      <tr className="text-gray-500 border-b border-gray-700">
                          <th className="p-2">שם</th>
                          <th className="p-2">טלפון</th>
                          <th className="p-2">הצהרת בריאות</th>
                          <th className="p-2">פעולות</th>
                      </tr>
                  </thead>
                  <tbody>
                      {users.map(u => (
                          <tr key={u.id} className="border-b border-gray-700/50">
                              <td className="p-2 text-white font-bold">{u.fullName}</td>
                              <td className="p-2 text-gray-400">{u.phone}</td>
                              <td className="p-2">
                                  {u.healthDeclarationDate ? (
                                      <span className="text-green-500">✅ חתום {u.healthDeclarationFile ? '(+קובץ)' : ''}</span>
                                  ) : <span className="text-red-500">❌ לא חתום</span>}
                              </td>
                              <td className="p-2">
                                  <button onClick={() => onDeleteUser(u.id)} className="text-red-500 text-xs">מחק</button>
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
      )}

      {activeTab === 'settings' && (
          <div className="space-y-4 max-w-md">
              <input type="text" placeholder="שם המאמן" className="w-full p-3 bg-gray-800 text-white rounded" defaultValue={appConfig.coachNameHeb} onBlur={e => onUpdateAppConfig({...appConfig, coachNameHeb: e.target.value})}/>
              <input type="text" placeholder="הודעה דחופה" className="w-full p-3 bg-gray-800 text-white rounded" defaultValue={appConfig.urgentMessage} onBlur={e => onUpdateAppConfig({...appConfig, urgentMessage: e.target.value})}/>
              <Button onClick={onExitAdmin} className="w-full">יציאה מהניהול</Button>
          </div>
      )}

      {attendanceSession && (
          <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
              <div className="bg-gray-800 p-6 rounded-2xl w-full max-w-lg border border-gray-700 max-h-[90vh] overflow-y-auto">
                  <h3 className="text-xl font-bold text-white mb-4">נוכחות: {attendanceSession.type} - {attendanceSession.time}</h3>
                  
                  <div className="mb-6">
                      <label className="text-xs text-gray-400 block mb-1">הודעת וואטסאפ למתאמנים:</label>
                      <textarea className="w-full p-2 bg-gray-900 text-white rounded border border-gray-700 text-sm h-16" value={messageText} onChange={e=>setMessageText(e.target.value)}/>
                  </div>

                  <div className="space-y-2 mb-6">
                      {attendanceSession.registeredPhoneNumbers.map(phone => {
                          const user = users.find(u => normalizePhone(u.phone) === phone);
                          const isMarked = markedAttendees.has(phone);
                          return (
                              <div key={phone} className="flex items-center justify-between p-2 rounded bg-gray-900 border border-gray-700">
                                  <div className="flex items-center gap-3">
                                      <button onClick={() => {
                                          const next = new Set(markedAttendees);
                                          if (next.has(phone)) next.delete(phone);
                                          else next.add(phone);
                                          setMarkedAttendees(next);
                                      }} className={`w-6 h-6 rounded-full border flex items-center justify-center ${isMarked ? 'bg-green-500 border-green-500 text-white' : 'border-gray-500'}`}>
                                          {isMarked ? '✓' : ''}
                                      </button>
                                      <span className="text-white font-bold">{user?.fullName || phone}</span>
                                  </div>
                                  <button onClick={() => handleSendMessage(phone)} className="bg-[#25D366] text-white p-1 rounded-lg px-3 text-[10px] font-bold">WhatsApp 📱</button>
                              </div>
                          );
                      })}
                  </div>

                  <div className="flex gap-2">
                      <Button onClick={handleSaveAttendance} isLoading={isSaving} className="flex-1">שמור נוכחות</Button>
                      <Button onClick={() => setAttendanceSession(null)} variant="secondary" className="flex-1">ביטול</Button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};