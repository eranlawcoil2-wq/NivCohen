import React from 'react';
import { TrainingSession, User } from '../types';
import { Button } from './Button';
import { getWeatherIcon } from '../services/weatherService';

interface SessionCardProps {
  session: TrainingSession;
  allUsers: User[];
  isRegistered: boolean;
  weather?: { maxTemp: number; weatherCode: number };
  onRegisterClick: (sessionId: string) => void;
  onViewDetails: (sessionId: string) => void;
}

// Helper to generate a consistent color from a string (for location badges)
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
  onViewDetails
}) => {
  const spotsLeft = session.maxCapacity - session.registeredPhoneNumbers.length;
  const isFull = spotsLeft <= 0;
  const registeredCount = session.registeredPhoneNumbers.length;
  const cardColor = session.color || 'var(--brand-primary)'; // Fallback to brand primary

  const locationBadgeClass = stringToColor(session.location);

  return (
    <div 
      onClick={() => onViewDetails(session.id)}
      className={`relative bg-brand-dark rounded-xl p-3 border shadow-lg mb-3 cursor-pointer transition-all hover:-translate-y-1 group flex flex-col gap-2 ${isRegistered ? 'shadow-lg' : 'border-gray-800 hover:border-gray-600'}`}
      style={{ 
          borderColor: isRegistered ? cardColor : undefined,
          boxShadow: isRegistered ? `0 4px 14px 0 ${cardColor}20` : undefined
      }}
    >
      <div className="flex justify-between items-start">
        <span className="text-xl font-black text-white font-mono tracking-tight">{session.time}</span>
        {isRegistered && (
            <span 
                className="w-2 h-2 rounded-full shadow-[0_0_8px]" 
                style={{ backgroundColor: cardColor, boxShadow: `0 0 8px ${cardColor}` }} 
            />
        )}
      </div>

      <div>
          <h3 className="font-bold text-sm leading-tight mb-2 line-clamp-1" style={{ color: cardColor }}>
              {session.type}
          </h3>
          
          <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] border ${locationBadgeClass} w-fit max-w-full`}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
            </svg>
            <span className="truncate">{session.location}</span>
          </div>
      </div>

      <div className="flex justify-between items-center mt-1 pt-2 border-t border-gray-700/50">
          <div className="flex items-center gap-1">
             <span className={`text-xs font-bold ${isFull ? 'text-red-400' : 'text-gray-300'}`}>
                {registeredCount}/{session.maxCapacity}
             </span>
             <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
             </svg>
          </div>
          {weather && (
               <div className="flex items-center gap-1 text-[10px] text-gray-400">
                  <span>{Math.round(weather.maxTemp)}°</span>
                  <span>{getWeatherIcon(weather.weatherCode)}</span>
               </div>
          )}
      </div>
    </div>
  );
};