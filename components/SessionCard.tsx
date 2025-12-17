
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
  const spotsLeft = session.maxCapacity - registeredCount;
  const isFull = spotsLeft <= 0;
  const isCancelled = session.isCancelled || false;
  
  let isHappening = false;
  if (!isCancelled) {
      if (session.manualHasStarted) {
          isHappening = true;
      } else {
          const now = new Date();
          const sessionStart = new Date(`${session.date}T${session.time}`);
          const diffMs = sessionStart.getTime() - now.getTime();
          const diffHours = diffMs / (1000 * 60 * 60);
          
          // BLINKING LOGIC: Starts 3 hours before, until 1 hour after start
          if (diffHours <= 3 && diffHours > -1) {
              isHappening = true;
          }
      }
  }

  let buttonText = isRegistered ? 'רשום ✅' : (isFull ? 'המתנה ⏳' : 'הרשם +');
  if (isCancelled) buttonText = 'בוטל ✕';
  if (isAdmin) buttonText = 'נוכחות / עריכה';

  const cardColor = session.color || '#A3E635';

  return (
    <div 
      onClick={() => onViewDetails(session.id)}
      className={`relative rounded-3xl p-5 border transition-all hover:scale-[1.03] active:scale-95 cursor-pointer flex flex-col justify-between h-full shadow-xl ${isCancelled ? 'bg-red-900/10 border-red-900/20 grayscale' : 'bg-gray-800/70 border-gray-700/40'}`}
      style={{ borderColor: isRegistered && !isCancelled ? cardColor : undefined, boxShadow: isRegistered && !isCancelled ? `0 10px 30px ${cardColor}15` : undefined }}
    >
      <div className="absolute -top-2 -left-1 flex gap-1 z-10">
         {isHappening && !isCancelled && (
             <div className="bg-brand-primary text-black text-[9px] font-black px-3 py-1.5 rounded-full animate-pulse shadow-xl flex items-center gap-1.5 uppercase italic tracking-tighter">
                <span className="w-1.5 h-1.5 bg-black rounded-full animate-ping"></span> כעת
             </div>
         )}
         {session.isTrial && !isCancelled && !isHappening && (
             <div className="bg-amber-500 text-black text-[9px] font-black px-3 py-1.5 rounded-full shadow-xl uppercase italic tracking-tighter">ניסיון</div>
         )}
      </div>

      <div>
        <div className="flex justify-between items-start mb-3">
           <span className={`text-2xl font-black font-mono italic ${isCancelled ? 'text-gray-600 line-through' : 'text-white'}`}>{session.time}</span>
           {weather && <span className="text-sm opacity-60 grayscale group-hover:grayscale-0 transition-all">{getWeatherIcon(weather.weatherCode)}</span>}
        </div>
        <h3 className={`font-black text-[11px] leading-tight uppercase italic mb-1 tracking-tight ${isCancelled ? 'text-gray-600' : 'text-brand-primary'}`}>{session.type}</h3>
        <p className={`text-[10px] font-bold truncate mb-5 uppercase tracking-tighter ${isCancelled ? 'text-gray-700' : 'text-gray-500'}`}>📍 {session.location}</p>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
           <span className={isFull && !isRegistered ? 'text-red-500' : 'text-gray-500'}>{registeredCount}/{session.maxCapacity}</span>
           {isRegistered && !isCancelled && <span className="text-brand-primary flex items-center gap-1"><span className="text-[8px]">✓</span> מאושר</span>}
        </div>
        <Button 
           size="sm" 
           variant={isAdmin ? 'primary' : (isRegistered ? 'outline' : 'primary')} 
           className={`w-full text-[10px] py-2.5 font-black italic uppercase rounded-2xl shadow-lg ${isCancelled ? 'bg-gray-700 border-transparent text-gray-500' : ''}`}
           onClick={(e) => { e.stopPropagation(); if(!isAdmin) onRegisterClick(session.id); else onViewDetails(session.id); }}
           disabled={isCancelled && !isAdmin}
        >
           {buttonText}
        </Button>
      </div>
    </div>
  );
};
