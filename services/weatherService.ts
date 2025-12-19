
import { WeatherInfo } from '../types';

export const getCityCoordinates = async (cityName: string): Promise<{name: string, lat: number, lon: number} | null> => {
  if (!cityName) return null;
  try {
    const response = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=he&format=json`
    );
    if (!response.ok) return null;
    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      return {
        name: data.results[0].name,
        lat: data.results[0].latitude,
        lon: data.results[0].longitude
      };
    }
    return null;
  } catch (error) {
    return null;
  }
};

export const getWeatherForDates = async (dates: string[], lat: number = 31.93, lon: number = 34.80): Promise<Record<string, WeatherInfo>> => {
  if (!dates || dates.length === 0) return {};
  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max&hourly=temperature_2m,weather_code&timezone=auto`
    );
    if (!response.ok) return {};
    const data = await response.json();

    const weatherMap: Record<string, WeatherInfo> = {};
    
    if (data.daily && data.daily.time) {
      data.daily.time.forEach((date: string, index: number) => {
        if (dates.includes(date)) {
          weatherMap[date] = {
            maxTemp: data.daily.temperature_2m_max[index],
            weatherCode: data.daily.weather_code[index],
            hourly: {} 
          };
        }
      });
    }

    if (data.hourly && data.hourly.time) {
      data.hourly.time.forEach((timeStr: string, index: number) => {
        const [date, time] = timeStr.split('T');
        if (weatherMap[date]) {
             const hour = time.split(':')[0];
             if (!weatherMap[date].hourly) weatherMap[date].hourly = {};
             weatherMap[date].hourly![hour] = {
                 temp: data.hourly.temperature_2m[index],
                 weatherCode: data.hourly.weather_code[index]
             };
        }
      });
    }

    return weatherMap;
  } catch (error) {
    return {};
  }
};

export const getWeatherIcon = (code: number, isNight: boolean = false): string => {
  if (code === 0) return isNight ? '🌙' : '☀️';
  if (code === 1) return isNight ? '🌙' : '🌤️';
  if (code === 2) return isNight ? '☁️' : '⛅';
  if (code === 3) return '☁️';
  if (code === 45 || code === 48) return '🌫️';
  if (code >= 51 && code <= 55) return '💧';
  if (code >= 61 && code <= 67) return '🌧️';
  if (code >= 71 && code <= 77) return '❄️';
  if (code >= 80 && code <= 82) return '🌦️';
  if (code >= 95) return '⛈️';
  return isNight ? '🌙' : '🌤️';
};

export const getWeatherDescription = (code: number): string => {
  if (code === 0) return 'בהיר';
  if (code >= 1 && code <= 3) return 'מעונן חלקית';
  if (code >= 61 && code <= 67) return 'גשום';
  if (code >= 95) return 'סוער';
  return 'נאה';
};
