
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

  const cardColor = isAdmin ? '#EF4444' : (session.color || '#A3E635');

  return (
    <div 
      onClick={() => onViewDetails(session.id)}
      className={`relative rounded-[40px] p-6 border transition-all hover:scale-[1.03] active:scale-95 cursor-pointer flex flex-col justify-between h-full shadow-2xl ${isCancelled ? 'bg-red-900/10 border-red-900/20 grayscale opacity-40' : 'bg-gray-800/70 border-gray-700/40'}`}
      style={{ borderColor: isRegistered && !isCancelled && !isAdmin ? cardColor : undefined, boxShadow: isRegistered && !isCancelled ? `0 10px 40px ${cardColor}20` : undefined }}
    >
      <div className="absolute -top-3 -left-1 flex gap-1 z-10">
         {isHappening && !isCancelled && (
             <div className={`${isAdmin ? 'bg-red-600' : 'bg-brand-primary'} text-black text-[9px] font-black px-4 py-1.5 rounded-full animate-pulse shadow-xl flex items-center gap-1.5 uppercase italic tracking-tighter`}>
                <span className="w-1.5 h-1.5 bg-black rounded-full animate-ping"></span> כעת
             </div>
         )}
         {session.isTrial && !isCancelled && !isHappening && (
             <div className="bg-amber-500 text-black text-[9px] font-black px-4 py-1.5 rounded-full shadow-xl uppercase italic tracking-tighter">ניסיון</div>
         )}
      </div>

      <div>
        <div className="flex justify-between items-start mb-4">
           <span className={`text-3xl font-black font-mono italic leading-none ${isCancelled ? 'text-gray-600 line-through' : 'text-white'}`}>{session.time}</span>
           {weather && <span className="text-lg opacity-40 grayscale">{getWeatherIcon(weather.weatherCode)}</span>}
        </div>
        <h3 className={`font-black text-xs leading-tight uppercase italic mb-1 tracking-tight ${isCancelled ? 'text-gray-600' : (isAdmin ? 'text-red-500' : 'text-brand-primary')}`}>{session.type}</h3>
        <p className={`text-[10px] font-black truncate mb-6 uppercase tracking-tighter ${isCancelled ? 'text-gray-700' : 'text-gray-500'}`}>📍 {session.location}</p>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
           <span className={isFull && !isRegistered ? 'text-red-500' : 'text-gray-500'}>{registeredCount}/{session.maxCapacity}</span>
           {isRegistered && !isCancelled && !isAdmin && <span className="text-brand-primary flex items-center gap-1"><span className="text-[8px]">✓</span> מאושר</span>}
        </div>
        <Button 
           size="sm" 
           variant={isAdmin ? 'danger' : (isRegistered ? 'outline' : 'primary')} 
           className={`w-full text-[10px] py-3 font-black italic uppercase rounded-[30px] shadow-xl ${isCancelled ? 'bg-gray-700 border-transparent text-gray-500' : (isAdmin ? 'bg-red-600 hover:bg-red-500 border-transparent text-white' : '')}`}
           onClick={(e) => { e.stopPropagation(); if(!isAdmin) onRegisterClick(session.id); else onViewDetails(session.id); }}
           disabled={isCancelled && !isAdmin}
        >
           {buttonText}
        </Button>
      </div>
    </div>
  );
};
