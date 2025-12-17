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
  locations?: LocationDef[];
  isAdmin?: boolean; 
}

const stringToColor = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    'bg-blue-500/20 text-blue-300 border-blue-500/30', 
    'bg-purple-500/20 text-purple-300 border-purple-500/30', 
    'bg-pink-500/20 text-pink-300 border-pink-500/30', 
    'bg-orange-500/20 text-orange-300 border-orange-500/30', 
    'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    'bg-rose-500/20 text-rose-300 border-rose-500/30',
    'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
  ];
  return colors[Math.abs(hash) % colors.length];
};

export const SessionCard: React.FC<SessionCardProps> = ({ 
  session, 
  allUsers, 
  isRegistered, 
  weather,
  onRegisterClick,
  onViewDetails,
  locations = [],
  isAdmin = false
}) => {
  const registeredCount = session.registeredPhoneNumbers.length;
  const waitingCount = session.waitingList ? session.waitingList.length : 0;
  const spotsLeft = session.maxCapacity - registeredCount;
  const isFull = spotsLeft <= 0;
  const cardColor = session.color || 'var(--brand-primary)'; 
  
  const locationObj = locations.find(l => l.name === session.location);
  const locationBadgeStyle = locationObj && locationObj.color 
      ? { backgroundColor: `${locationObj.color}33`, color: locationObj.color, borderColor: `${locationObj.color}4d` } 
      : null;
      
  const defaultLocationClass = !locationBadgeStyle ? stringToColor(session.location) : '';
  const isCancelled = session.isCancelled || false;
  
  // Format Badges Logic
  const isZoomOnly = session.isZoomSession && !session.isHybrid;
  const isHybrid = session.isHybrid;
  const showZoomIcon = session.isZoomSession || !!session.zoomLink;

  let isHappening = false;
  if (!isCancelled) {
      if (session.manualHasStarted) {
          isHappening = true;
      } else {
          const now = new Date();
          const sessionStart = new Date(`${session.date}T${session.time}`);
          const diffMs = sessionStart.getTime() - now.getTime();
          const diffHours = diffMs / (1000 * 60 * 60);
          if (diffHours <= 3 && diffHours > -1.5) isHappening = true;
      }
  }

  const handleButtonClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!isCancelled || isAdmin) onRegisterClick(session.id);
  };

  let containerClass = 'bg-brand-dark border-gray-800 hover:border-gray-600';
  if (session.isHidden) containerClass = 'bg-[#2e1065] border-purple-500/60 shadow-none';
  if (isCancelled) containerClass = 'bg-red-900/10 border-red-900/40 grayscale-[0.5]';

  let displayTemp = weather?.maxTemp;
  let displayIcon = weather ? getWeatherIcon(weather.weatherCode) : null;
  
  if (weather && weather.hourly && session.time) {
      const sessionHourStr = session.time.split(':')[0]; 
      const hourlyData = weather.hourly[sessionHourStr];
      if (hourlyData) {
          displayTemp = hourlyData.temp;
          displayIcon = getWeatherIcon(hourlyData.weatherCode, parseInt(sessionHourStr) >= 19 || parseInt(sessionHourStr) < 6);
      }
  }

  return (
    <div 
      onClick={() => onViewDetails(session.id)}
      className={`relative rounded-xl p-3 border shadow-lg cursor-pointer transition-all hover:-translate-y-1 group flex flex-col gap-2 h-full justify-between ${containerClass}`}
      style={{ borderColor: isRegistered ? cardColor : undefined, boxShadow: isRegistered ? `0 4px 14px 0 ${cardColor}20` : undefined }}
    >
      <div className="absolute top-0 left-0 flex flex-row gap-1 p-1 z-10 flex-wrap max-w-full">
        {isCancelled ? (
           <div className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg">מבוטל ✕</div>
        ) : (
            <>
                {isHappening && (
                    <div className="bg-green-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg animate-pulse flex items-center gap-1">
                        <span className="w-1 h-1 bg-white rounded-full"></span> מתקיים
                    </div>
                )}
                {isZoomOnly && <div className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg">🎥 זום בלבד</div>}
                {isHybrid && <div className="bg-purple-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg">🏠+🎥 היברידי</div>}
                {session.isTrial && <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">ניסיון</div>}
                {session.isHidden && <div className="bg-purple-900 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">👻 נסתר</div>}
                {!isRegistered && isFull && waitingCount > 0 && <div className="bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">⏳ {waitingCount} ממתינים</div>}
            </>
        )}
      </div>
      
      <div className="flex justify-between items-start mt-6">
        <span className={`text-xl font-black font-mono tracking-tight ${isCancelled ? 'text-gray-500 line-through' : 'text-white'}`}>{session.time}</span>
        {displayIcon && !isCancelled && (
            <div className="flex items-center gap-1 text-[10px] text-gray-400 bg-gray-800/50 px-2 py-1 rounded-full">
                <span>{Math.round(displayTemp || 0)}°</span><span>{displayIcon}</span>
            </div>
        )}
      </div>

      <div>
          <h3 className={`font-bold text-sm leading-tight mb-2 line-clamp-1 ${isCancelled ? 'text-gray-500' : ''}`} style={{ color: isCancelled ? undefined : cardColor }}>{session.type}</h3>
          <div className="flex flex-col gap-1.5 items-start w-full mb-2">
              <div 
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] border w-full truncate ${defaultLocationClass} ${isCancelled ? 'opacity-50' : ''}`}
                style={locationBadgeStyle && !isCancelled ? locationBadgeStyle : {}}
              >
                <span>{isZoomOnly ? '💻 אונליין' : session.location}</span>
              </div>
          </div>
      </div>

      <div className="mt-auto pt-2 border-t border-gray-800/50 flex flex-col gap-2">
          <div className="flex justify-between items-center text-[10px]">
             <span className={`font-bold ${isFull && !isCancelled ? 'text-red-400' : 'text-gray-300'}`}>{registeredCount}/{session.maxCapacity} רשומים</span>
          </div>
          <Button 
            size="sm" 
            variant={isAdmin ? 'danger' : isCancelled ? 'secondary' : isRegistered ? 'outline' : 'primary'}
            className="w-full text-[11px] py-1 h-7"
            onClick={handleButtonClick}
            disabled={isCancelled && !isAdmin}
          >
            {isAdmin ? 'ניהול' : isCancelled ? 'מבוטל' : isRegistered ? 'רשום ✅' : isFull ? 'המתנה ⏳' : 'הירשם +'}
          </Button>
      </div>
    </div>
  );
};