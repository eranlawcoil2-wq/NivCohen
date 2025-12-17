import React from 'react';
import { TrainingSession, User, LocationDef } from '../types';
import { Button } from './Button';
import { getWeatherIcon } from '../services/weatherService';

interface SessionCardProps {
  session: TrainingSession;
  allUsers: User[];
  isRegistered: boolean;
  weather?: { maxTemp: number; weatherCode: number };
  onRegisterClick: (sessionId: string) => void;
  onViewDetails: (sessionId: string) => void;
  locations?: LocationDef[];
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
  locations = []
}) => {
  const spotsLeft = session.maxCapacity - session.registeredPhoneNumbers.length;
  const isFull = spotsLeft <= 0;
  const registeredCount = session.registeredPhoneNumbers.length;
  const cardColor = session.color || 'var(--brand-primary)'; 

  // Try to find specific location color
  const locationObj = locations.find(l => l.name === session.location);
  const locationBadgeStyle = locationObj && locationObj.color 
      ? { backgroundColor: `${locationObj.color}33`, color: locationObj.color, borderColor: `${locationObj.color}4d` } // 33=20%, 4d=30% alpha
      : null;
      
  const defaultLocationClass = !locationBadgeStyle ? stringToColor(session.location) : '';

  const showZoomBadge = session.isZoomSession || !!session.zoomLink;

  const handleButtonClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      onRegisterClick(session.id);
  };

  return (
    <div 
      onClick={() => onViewDetails(session.id)}
      className={`relative bg-brand-dark rounded-xl p-3 border shadow-lg cursor-pointer transition-all hover:-translate-y-1 group flex flex-col gap-2 ${isRegistered ? 'shadow-lg' : 'border-gray-800 hover:border-gray-600'} h-full justify-between ${session.isHidden ? 'opacity-70 border-dashed border-gray-600' : ''}`}
      style={{ 
          borderColor: isRegistered ? cardColor : undefined,
          boxShadow: isRegistered ? `0 4px 14px 0 ${cardColor}20` : undefined
      }}
    >
      <div className="absolute top-0 left-0 flex flex-row gap-1 p-1 z-10 flex-wrap max-w-full">
        {session.isTrial && (
           <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg border border-white/20 animate-pulse">
               אימון ניסיון
           </div>
        )}
        {showZoomBadge && (
           <div className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg border border-white/10 flex items-center gap-1">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                   <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
               </svg>
               ZOOM
           </div>
        )}
        {session.isHidden && (
            <div className="bg-gray-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg border border-white/10 flex items-center gap-1">
               <span>👻 נסתר</span>
           </div>
        )}
      </div>
      
      <div className="flex justify-between items-start mt-5">
        <span className="text-xl font-black text-white font-mono tracking-tight">{session.time}</span>
        {weather && (
            <div className="flex items-center gap-1 text-xs text-gray-400 bg-gray-800/50 px-2 py-1 rounded-full">
                <span>{Math.round(weather.maxTemp)}°</span>
                <span>{getWeatherIcon(weather.weatherCode)}</span>
            </div>
        )}
      </div>

      <div>
          <h3 className="font-bold text-sm leading-tight mb-2 line-clamp-1" style={{ color: cardColor }}>
              {session.type}
          </h3>
          
          <div className="flex flex-col gap-1.5 items-start w-full mb-2">
              <div 
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] border w-full ${defaultLocationClass}`}
                style={locationBadgeStyle || {}}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
                <span className="truncate">{session.location}</span>
              </div>
          </div>
      </div>

      <div className="mt-auto pt-2 border-t border-gray-800">
          <div className="flex justify-between items-center mb-2 text-xs">
             <span className={`font-bold ${isFull ? 'text-red-400' : 'text-gray-300'}`}>
                {registeredCount}/{session.maxCapacity} רשומים
             </span>
          </div>
          
          <Button 
            size="sm" 
            variant={isRegistered ? 'outline' : 'primary'}
            className={`w-full text-xs py-1.5 h-8 ${isRegistered ? 'bg-transparent border-gray-600 text-gray-300' : ''}`}
            onClick={handleButtonClick}
            disabled={!isRegistered && isFull}
          >
            {isRegistered ? 'רשום ✅' : isFull ? 'מלא ⛔' : 'הירשם +'}
          </Button>
      </div>
    </div>
  );
};