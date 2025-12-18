
import React from 'react';
import { TrainingSession, User, LocationDef, WeatherInfo } from '../types';
import { Button } from './Button';
import { getWeatherIcon } from '../services/weatherService';

interface SessionCardProps {
  session: TrainingSession;
  allUsers: User[];
  isRegistered: boolean;
  weather?: WeatherInfo;
  onRegisterClick: (sessionId: string) => void;
  onViewDetails: (sessionId: string) => void;
  onDuplicate?: (session: TrainingSession) => void;
  onAddToCalendar?: (session: TrainingSession) => void;
  onWazeClick?: (location: string) => void;
  locations?: LocationDef[];
  isAdmin?: boolean; 
}

export const SessionCard: React.FC<SessionCardProps> = ({ 
  session, 
  allUsers, 
  isRegistered, 
  weather,
  onRegisterClick,
  onViewDetails,
  onDuplicate,
  onAddToCalendar,
  onWazeClick,
  locations = [],
  isAdmin = false
}) => {
  const registeredCount = session.registeredPhoneNumbers.length;
  const isFull = registeredCount >= session.maxCapacity;
  const isCancelled = session.isCancelled || false;
  const isZoom = session.isZoomSession || !!session.zoomLink;
  const isPersonal = session.isPersonalTraining || false;
  
  const sessionHour = session.time.split(':')[0];
  const hourlyWeather = weather?.hourly?.[sessionHour];
  
  const now = new Date();
  const sessionStart = new Date(`${session.date}T${session.time}`);
  const diffMs = sessionStart.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  const isFinished = !isCancelled && diffHours <= -1.5;
  let isHappening = false;
  if (!isCancelled && !isFinished) {
      if (session.manualHasStarted) {
          isHappening = true;
      } else {
          if (diffHours <= 3 && diffHours > -1.5) {
              isHappening = true;
          }
      }
  }

  let borderColor = isAdmin ? '#EF4444' : '#333';
  if (isCancelled) borderColor = '#EF4444';
  else if (isFinished) borderColor = '#374151'; 
  else if (isHappening && isZoom) borderColor = '#3B82F6';
  else if (isHappening) borderColor = '#A3E635';
  else if (isPersonal) borderColor = '#3B82F6';
  else if (isZoom) borderColor = '#3B82F6';

  const statusBg = isCancelled 
    ? 'bg-red-600 border-2 border-white shadow-[0_0_15px_rgba(239,68,68,0.8)]' 
    : (isFinished ? 'bg-gray-600 text-gray-200' 
    : (isHappening && isZoom 
        ? 'bg-gradient-to-r from-brand-primary to-blue-500' 
        : (isHappening ? 'bg-brand-primary' : (isPersonal ? 'bg-blue-600' : (isZoom ? 'bg-blue-500' : 'bg-gray-700')))));
  
  const statusLabel = isCancelled 
    ? 'בוטל' 
    : (isFinished ? 'הסתיים' 
    : (isHappening ? (isZoom ? 'חי + זום' : 'מתקיים') : (isPersonal ? 'אימון אישי 🏆' : (isZoom ? 'זום' : 'מתוכנן'))));

  // Get trainee names for personal training sessions in admin mode
  const traineeNames = isAdmin && isPersonal 
    ? session.registeredPhoneNumbers.map(phone => {
        const u = allUsers.find(user => user.phone.replace(/\D/g, '').endsWith(phone.replace(/\D/g, '').slice(-9)));
        return u ? (u.displayName || u.fullName.split(' ')[0]) : phone;
      }).join(', ')
    : '';

  return (
    <div 
      onClick={() => onViewDetails(session.id)}
      className={`relative rounded-[30px] sm:rounded-[40px] p-4 sm:p-8 border-2 transition-all hover:scale-[1.03] active:scale-95 cursor-pointer flex flex-col justify-between h-full shadow-2xl ${(isCancelled || isFinished) ? 'opacity-50' : 'bg-gray-800/80 backdrop-blur-sm'}`}
      style={{ borderColor: borderColor }}
    >
      <div className="absolute -top-3 -left-1 flex gap-1 z-20">
         <div className={`${statusBg} ${isFinished ? 'text-gray-200' : 'text-white sm:text-black'} text-[10px] sm:text-[13px] font-black px-3 sm:px-5 py-1.5 sm:py-2 rounded-full shadow-2xl flex items-center gap-1.5 uppercase italic tracking-tighter`}>
            {isHappening && !isCancelled && !isFinished && <span className="w-1.5 h-1.5 bg-black rounded-full animate-ping"></span>}
            {statusLabel}
         </div>
      </div>

      <div>
        <div className="flex justify-between items-start mb-2 sm:mb-6">
           <span className={`text-2xl sm:text-5xl font-black font-mono italic leading-none transition-colors duration-500 ${isCancelled ? 'text-gray-600 line-through' : (isFinished ? 'text-gray-500' : 'text-white')}`}>{session.time}</span>
           {hourlyWeather && (
               <div className="flex flex-col items-end opacity-40">
                  <span className="text-lg sm:text-2xl">{getWeatherIcon(hourlyWeather.weatherCode)}</span>
                  <span className="text-[10px] sm:text-[12px] font-black">{Math.round(hourlyWeather.temp)}°</span>
               </div>
           )}
        </div>
        <h3 className={`font-black text-xs sm:text-lg leading-tight uppercase italic mb-1 tracking-tight transition-colors duration-500 ${(isCancelled || isFinished) ? 'text-gray-600' : (isPersonal ? 'text-blue-400' : (isZoom && !isHappening ? 'text-blue-400' : (isHappening ? 'text-brand-primary' : 'text-white')))}`}>{session.type}</h3>
        <p className={`text-[8px] sm:text-[12px] font-black truncate mb-3 sm:mb-6 uppercase tracking-tighter transition-colors duration-500 ${(isCancelled || isFinished) ? 'text-gray-700' : 'text-gray-500'}`}>📍 {session.location.split(',')[0]}</p>
        
        {isAdmin && isPersonal && traineeNames && (
            <div className="bg-blue-500/10 border-r-2 border-blue-500 p-2 rounded-l-lg mb-3">
                <p className="text-blue-400 text-[9px] font-black uppercase mb-1">מתאמנים:</p>
                <p className="text-white text-xs font-bold truncate">{traineeNames}</p>
            </div>
        )}

        {session.description && !isCancelled && !isFinished && (
            <div className="bg-brand-primary/10 border-r-2 sm:border-r-4 border-brand-primary p-2 sm:p-3 rounded-l-xl mb-3 sm:mb-6">
                <p className="text-white text-[9px] sm:text-xs font-bold leading-tight">{session.description}</p>
            </div>
        )}
      </div>

      <div className="space-y-2 sm:space-y-4">
        <div className="flex justify-between items-center text-[8px] sm:text-[10px] font-black uppercase tracking-widest border-b border-gray-800/50 pb-1 sm:pb-2">
           <span className={(isFull && !isRegistered && !isFinished) ? 'text-red-500' : 'text-gray-500'}>{registeredCount}/{session.maxCapacity}</span>
           {isRegistered && !isCancelled && !isFinished && !isAdmin && <span className="text-brand-primary">✓</span>}
        </div>
        
        {!isAdmin ? (
            <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                    <button 
                        onClick={(e) => { e.stopPropagation(); onWazeClick?.(session.location); }}
                        className={`py-2 rounded-xl text-[8px] sm:text-[10px] font-black uppercase italic flex items-center justify-center gap-1 ${isFinished ? 'bg-gray-800 text-gray-600' : 'bg-blue-600/20 text-blue-400 border border-blue-500/20'}`}
                        disabled={isFinished}
                    >
                        <span>🚙</span> Waze
                    </button>
                    <button 
                        onClick={(e) => { e.stopPropagation(); onAddToCalendar?.(session); }}
                        className="py-2 rounded-xl bg-gray-700 text-white text-[8px] sm:text-[10px] font-black uppercase italic flex items-center justify-center gap-1"
                    >
                        <span>📅</span> יומן
                    </button>
                </div>
                <Button size="sm" variant={isRegistered ? 'outline' : 'primary'} className={`w-full text-[9px] sm:text-[12px] py-2 sm:py-5 font-black italic uppercase rounded-2xl sm:rounded-[30px] shadow-xl ${(isCancelled || isFinished) ? 'bg-gray-700 border-transparent text-gray-500' : ''}`} onClick={(e) => { e.stopPropagation(); onRegisterClick(session.id); }} disabled={isCancelled || isFinished || (isFull && !isRegistered)}>
                {isFinished ? 'הסתיים' : (isRegistered ? 'ביטול' : (isFull ? 'מלא' : 'הרשם'))}
                </Button>
            </div>
        ) : (
            <div className="space-y-2">
                <Button onClick={(e)=>{e.stopPropagation(); onViewDetails(session.id);}} className="w-full py-2 sm:py-4 bg-white text-brand-black text-[9px] sm:text-[12px] uppercase font-black italic rounded-2xl sm:rounded-[30px] shadow-lg">ניהול ⚙️</Button>
                <div className="grid grid-cols-2 gap-2">
                    <Button onClick={(e)=>{e.stopPropagation(); onDuplicate?.(session);}} className="py-1 sm:py-2 bg-gray-700 text-white text-[7px] sm:text-[9px] uppercase font-black rounded-xl">שכפל 📑</Button>
                    <Button onClick={(e)=>{e.stopPropagation(); onAddToCalendar?.(session);}} className="py-1 sm:py-2 bg-gray-700 text-white text-[7px] sm:text-[9px] uppercase font-black rounded-xl">ליומן 📅</Button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};
