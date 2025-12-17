
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
  
  let isHappening = false;
  if (!isCancelled) {
      if (session.manualHasStarted) {
          isHappening = true;
      } else {
          const now = new Date();
          const sessionStart = new Date(`${session.date}T${session.time}`);
          const diffMs = sessionStart.getTime() - now.getTime();
          const diffHours = diffMs / (1000 * 60 * 60);
          // Auto Happening: 3 hours before start
          if (diffHours <= 3 && diffHours > -1) {
              isHappening = true;
          }
      }
  }

  const handleCalendar = (e: React.MouseEvent) => {
      e.stopPropagation();
      const start = `${session.date.replace(/-/g, '')}T${session.time.replace(':', '')}00`;
      const end = `${session.date.replace(/-/g, '')}T${(parseInt(session.time.split(':')[0]) + 1).toString().padStart(2, '0')}${session.time.split(':')[1]}00`;
      const url = `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent('אימון: ' + session.type)}&dates=${start}/${end}&location=${encodeURIComponent(session.location)}`;
      window.open(url, '_blank');
  };

  // Color logic
  let borderColor = isAdmin ? '#EF4444' : '#333';
  if (isCancelled) borderColor = '#EF4444';
  else if (isHappening && isZoom) borderColor = '#3B82F6'; // Transitions to blue-ish
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
           <span className={`text-4xl font-black font-mono italic leading-none transition-colors duration-500 ${isCancelled ? 'text-gray-600 line-through' : 'text-white'}`}>{session.time}</span>
           {weather && (
               <div className="flex flex-col items-end opacity-40">
                  <span className="text-xl">{getWeatherIcon(weather.weatherCode)}</span>
                  <span className="text-[10px] font-black">{Math.round(weather.maxTemp)}°</span>
               </div>
           )}
        </div>
        <h3 className={`font-black text-sm leading-tight uppercase italic mb-1 tracking-tight transition-colors duration-500 ${isCancelled ? 'text-gray-600' : (isZoom && !isHappening ? 'text-blue-400' : (isHappening ? 'text-brand-primary' : 'text-white'))}`}>{session.type}</h3>
        <p className={`text-[10px] font-black truncate mb-6 uppercase tracking-tighter transition-colors duration-500 ${isCancelled ? 'text-gray-700' : 'text-gray-500'}`}>📍 {session.location}</p>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest border-b border-gray-800/50 pb-2">
           <span className={isFull && !isRegistered ? 'text-red-500' : 'text-gray-500'}>{registeredCount}/{session.maxCapacity} מתאמנים</span>
           {isRegistered && !isCancelled && !isAdmin && <span className="text-brand-primary">רשום✓</span>}
        </div>
        
        <div className="grid grid-cols-2 gap-2">
            {isAdmin ? (
                <>
                  <button onClick={(e)=>{e.stopPropagation(); onViewDetails(session.id);}} className="bg-red-500 text-white py-2.5 rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-lg shadow-red-500/20">עריכה</button>
                  <button onClick={(e)=>{e.stopPropagation(); onDuplicate && onDuplicate(session);}} className="bg-gray-700 text-gray-300 py-2.5 rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-gray-600">שכפל</button>
                </>
            ) : (
                <>
                  <button onClick={(e)=>{e.stopPropagation(); const url = `https://waze.com/ul?q=${encodeURIComponent(session.location)}`; window.open(url, '_blank');}} className="bg-gray-800/50 text-gray-400 py-2.5 rounded-2xl text-[9px] font-black uppercase tracking-widest border border-gray-700/50 hover:text-white transition-all">ניווט</button>
                  <button onClick={handleCalendar} className="bg-gray-800/50 text-gray-400 py-2.5 rounded-2xl text-[9px] font-black uppercase tracking-widest border border-gray-700/50 hover:text-white transition-all">יומן</button>
                </>
            )}
        </div>

        {!isAdmin ? (
            <Button size="sm" variant={isRegistered ? 'outline' : 'primary'} className={`w-full text-[10px] py-4 font-black italic uppercase rounded-[30px] shadow-xl ${isCancelled ? 'bg-gray-700 border-transparent text-gray-500' : ''}`} onClick={(e) => { e.stopPropagation(); onRegisterClick(session.id); }} disabled={isCancelled || (isFull && !isRegistered)}>
               {isRegistered ? 'רשום ✅' : (isFull ? 'מלא ⏳' : 'הרשם +')}
            </Button>
        ) : (
            <Button onClick={(e)=>{e.stopPropagation(); onViewDetails(session.id);}} className="w-full py-3 bg-white text-black text-[10px] uppercase font-black italic rounded-[30px]">נוכחות</Button>
        )}
      </div>
    </div>
  );
};
