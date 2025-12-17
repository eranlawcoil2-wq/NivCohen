
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
  locations = [],
  isAdmin = false
}) => {
  const registeredCount = session.registeredPhoneNumbers.length;
  const isFull = registeredCount >= session.maxCapacity;
  const isCancelled = session.isCancelled || false;
  const isZoom = session.isZoomSession || !!session.zoomLink;
  
  const sessionHour = session.time.split(':')[0];
  const hourlyWeather = weather?.hourly?.[sessionHour];
  
  let isHappening = false;
  if (!isCancelled) {
      if (session.manualHasStarted) {
          isHappening = true;
      } else {
          const now = new Date();
          const sessionStart = new Date(`${session.date}T${session.time}`);
          const diffMs = sessionStart.getTime() - now.getTime();
          const diffHours = diffMs / (1000 * 60 * 60);
          if (diffHours <= 3 && diffHours > -1) {
              isHappening = true;
          }
      }
  }

  const handleCalendar = (e: React.MouseEvent) => {
      e.stopPropagation();
      const cleanDate = session.date.replace(/-/g, '');
      const cleanTime = session.time.replace(':', '');
      const start = `${cleanDate}T${cleanTime}00`;
      const [h, m] = session.time.split(':').map(Number);
      const endHour = (h + 1).toString().padStart(2, '0');
      const end = `${cleanDate}T${endHour}${m.toString().padStart(2, '0')}00`;
      const details = session.description ? `${session.description}` : `אימון ${session.type} עם ניב כהן`;
      const url = `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent('אימון: ' + session.type)}&dates=${start}/${end}&location=${encodeURIComponent(session.location)}&details=${encodeURIComponent(details)}`;
      window.open(url, '_blank');
  };

  let borderColor = isAdmin ? '#EF4444' : '#333';
  if (isCancelled) borderColor = '#EF4444';
  else if (isHappening && isZoom) borderColor = '#3B82F6';
  else if (isHappening) borderColor = '#A3E635';
  else if (isZoom) borderColor = '#3B82F6';

  const statusBg = isCancelled 
    ? 'bg-red-500' 
    : (isHappening && isZoom 
        ? 'bg-gradient-to-r from-brand-primary to-blue-500' 
        : (isHappening ? 'bg-brand-primary' : (isZoom ? 'bg-blue-500' : 'bg-gray-700')));
  
  const statusLabel = isCancelled 
    ? 'בוטל' 
    : (isHappening ? (isZoom ? 'חי + זום' : 'מתקיים') : (isZoom ? 'זום' : 'מתוכנן'));

  return (
    <div 
      onClick={() => onViewDetails(session.id)}
      className={`relative rounded-[30px] sm:rounded-[40px] p-4 sm:p-8 border-2 transition-all hover:scale-[1.03] active:scale-95 cursor-pointer flex flex-col justify-between h-full shadow-2xl ${isCancelled ? 'opacity-40 grayscale' : 'bg-gray-800/80 backdrop-blur-sm'}`}
      style={{ borderColor: borderColor }}
    >
      <div className="absolute -top-2.5 -left-1 flex gap-1 z-10">
         <div className={`${statusBg} text-black text-[7px] font-black px-2 sm:px-4 py-1 rounded-full shadow-lg flex items-center gap-1 uppercase italic tracking-tighter`}>
            {isHappening && <span className="w-1 h-1 bg-black rounded-full animate-ping"></span>}
            {statusLabel}
         </div>
      </div>

      <div>
        <div className="flex justify-between items-start mb-2 sm:mb-6">
           <span className={`text-2xl sm:text-5xl font-black font-mono italic leading-none transition-colors duration-500 ${isCancelled ? 'text-gray-600 line-through' : 'text-white'}`}>{session.time}</span>
           {hourlyWeather && (
               <div className="flex flex-col items-end opacity-40">
                  <span className="text-lg sm:text-2xl">{getWeatherIcon(hourlyWeather.weatherCode)}</span>
                  <span className="text-[10px] sm:text-[12px] font-black">{Math.round(hourlyWeather.temp)}°</span>
               </div>
           )}
        </div>
        <h3 className={`font-black text-xs sm:text-lg leading-tight uppercase italic mb-1 tracking-tight transition-colors duration-500 ${isCancelled ? 'text-gray-600' : (isZoom && !isHappening ? 'text-blue-400' : (isHappening ? 'text-brand-primary' : 'text-white'))}`}>{session.type}</h3>
        <p className={`text-[8px] sm:text-[12px] font-black truncate mb-3 sm:mb-6 uppercase tracking-tighter transition-colors duration-500 ${isCancelled ? 'text-gray-700' : 'text-gray-500'}`}>📍 {session.location.split(',')[0]}</p>
        
        {!isAdmin && session.description && !isCancelled && (
            <div className="bg-brand-primary/10 border-r-2 sm:border-r-4 border-brand-primary p-2 sm:p-3 rounded-l-xl mb-3 sm:mb-6">
                <p className="text-white text-[9px] sm:text-xs font-bold leading-tight line-clamp-2">{session.description}</p>
            </div>
        )}
      </div>

      <div className="space-y-2 sm:space-y-4">
        <div className="flex justify-between items-center text-[8px] sm:text-[10px] font-black uppercase tracking-widest border-b border-gray-800/50 pb-1 sm:pb-2">
           <span className={isFull && !isRegistered ? 'text-red-500' : 'text-gray-500'}>{registeredCount}/{session.maxCapacity}</span>
           {isRegistered && !isCancelled && !isAdmin && <span className="text-brand-primary">✓</span>}
        </div>
        
        {!isAdmin ? (
            <Button size="sm" variant={isRegistered ? 'outline' : 'primary'} className={`w-full text-[9px] sm:text-[12px] py-2 sm:py-5 font-black italic uppercase rounded-2xl sm:rounded-[30px] shadow-xl ${isCancelled ? 'bg-gray-700 border-transparent text-gray-500' : ''}`} onClick={(e) => { e.stopPropagation(); onRegisterClick(session.id); }} disabled={isCancelled || (isFull && !isRegistered)}>
               {isRegistered ? 'ביטול' : (isFull ? 'מלא' : 'הרשם')}
            </Button>
        ) : (
            <Button onClick={(e)=>{e.stopPropagation(); onViewDetails(session.id);}} className="w-full py-2 sm:py-4 bg-white text-black text-[9px] sm:text-[12px] uppercase font-black italic rounded-2xl sm:rounded-[30px]">ניהול</Button>
        )}
      </div>
    </div>
  );
};
