
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
  
  // Extract specific hour weather
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
    : (isHappening ? (isZoom ? 'מתקיים + זום' : 'מתקיים') : (isZoom ? 'אימון זום' : 'מתוכנן'));

  return (
    <div 
      onClick={() => onViewDetails(session.id)}
      className={`relative rounded-[40px] p-8 border-2 transition-all hover:scale-[1.03] active:scale-95 cursor-pointer flex flex-col justify-between h-full shadow-2xl ${isCancelled ? 'opacity-40 grayscale' : 'bg-gray-800/80 backdrop-blur-sm'}`}
      style={{ borderColor: borderColor }}
    >
      <div className="absolute -top-3 -left-1 flex gap-1 z-10">
         <div className={`${statusBg} text-black text-[8px] font-black px-4 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 uppercase italic tracking-tighter`}>
            {isHappening && <span className="w-1.5 h-1.5 bg-black rounded-full animate-ping"></span>}
            {statusLabel}
         </div>
      </div>

      <div>
        <div className="flex justify-between items-start mb-6">
           <span className={`text-5xl font-black font-mono italic leading-none transition-colors duration-500 ${isCancelled ? 'text-gray-600 line-through' : 'text-white'}`}>{session.time}</span>
           {hourlyWeather && (
               <div className="flex flex-col items-end opacity-40">
                  <span className="text-2xl">{getWeatherIcon(hourlyWeather.weatherCode)}</span>
                  <span className="text-[12px] font-black">{Math.round(hourlyWeather.temp)}°</span>
               </div>
           )}
        </div>
        <h3 className={`font-black text-lg leading-tight uppercase italic mb-1 tracking-tight transition-colors duration-500 ${isCancelled ? 'text-gray-600' : (isZoom && !isHappening ? 'text-blue-400' : (isHappening ? 'text-brand-primary' : 'text-white'))}`}>{session.type}</h3>
        <p className={`text-[12px] font-black truncate mb-6 uppercase tracking-tighter transition-colors duration-500 ${isCancelled ? 'text-gray-700' : 'text-gray-500'}`}>📍 {session.location}</p>
        
        {/* NEW: Display Highlights directly on card */}
        {!isAdmin && session.description && !isCancelled && (
            <div className="bg-brand-primary/10 border-r-4 border-brand-primary p-3 rounded-l-xl mb-6">
                <p className="text-[9px] text-brand-primary font-black uppercase mb-1">דגשים לשעה זו 📣</p>
                <p className="text-white text-xs font-bold leading-snug line-clamp-2">{session.description}</p>
            </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest border-b border-gray-800/50 pb-2">
           <span className={isFull && !isRegistered ? 'text-red-500' : 'text-gray-500'}>{registeredCount}/{session.maxCapacity} מתאמנים</span>
           {isRegistered && !isCancelled && !isAdmin && <span className="text-brand-primary">רשום✓</span>}
        </div>
        
        <div className="grid grid-cols-2 gap-2">
            {isAdmin ? (
                <>
                  <button onClick={(e)=>{e.stopPropagation(); onViewDetails(session.id);}} className="bg-red-500 text-white py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-red-500/20">עריכה</button>
                  <button onClick={(e)=>{e.stopPropagation(); onDuplicate && onDuplicate(session);}} className="bg-gray-700 text-gray-300 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-600">שכפל</button>
                </>
            ) : (
                <>
                  <button onClick={(e)=>{e.stopPropagation(); const url = `https://waze.com/ul?q=${encodeURIComponent(session.location)}`; window.open(url, '_blank');}} className="bg-gray-800/50 text-gray-400 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-gray-700/50 hover:text-white transition-all">ניווט</button>
                  <button onClick={handleCalendar} className="bg-gray-800/50 text-gray-400 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-gray-700/50 hover:text-white transition-all">יומן</button>
                </>
            )}
        </div>

        {!isAdmin ? (
            <Button size="sm" variant={isRegistered ? 'outline' : 'primary'} className={`w-full text-[12px] py-5 font-black italic uppercase rounded-[30px] shadow-xl ${isCancelled ? 'bg-gray-700 border-transparent text-gray-500' : ''}`} onClick={(e) => { e.stopPropagation(); onRegisterClick(session.id); }} disabled={isCancelled || (isFull && !isRegistered)}>
               {isRegistered ? 'רשום ✅' : (isFull ? 'מלא ⏳' : 'הרשם +')}
            </Button>
        ) : (
            <Button onClick={(e)=>{e.stopPropagation(); onViewDetails(session.id);}} className="w-full py-4 bg-white text-black text-[12px] uppercase font-black italic rounded-[30px]">ניהול נוכחות</Button>
        )}
      </div>
    </div>
  );
};
