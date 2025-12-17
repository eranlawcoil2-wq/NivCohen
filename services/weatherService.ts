import { WeatherInfo } from '../types';

export const getCityCoordinates = async (cityName: string): Promise<{name: string, lat: number, lon: number} | null> => {
  try {
    const response = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=he&format=json`
    );
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
    console.error("Failed to fetch coordinates", error);
    return null;
  }
};

export const getWeatherForDates = async (dates: string[], lat: number = 31.93, lon: number = 34.80): Promise<Record<string, WeatherInfo>> => {
  try {
    // Open-Meteo API: Fetching both Daily (max temp) and Hourly (temp + code)
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max&hourly=temperature_2m,weather_code&timezone=auto`
    );
    const data = await response.json();

    const weatherMap: Record<string, WeatherInfo> = {};
    
    // 1. Map Daily Data (Baseline)
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

    // 2. Map Hourly Data
    if (data.hourly && data.hourly.time) {
      data.hourly.time.forEach((timeStr: string, index: number) => {
        // timeStr format is usually "YYYY-MM-DDTHH:MM"
        const [date, time] = timeStr.split('T');
        if (weatherMap[date]) {
             const hour = time.split(':')[0]; // Extract "18" from "18:00"
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
    console.error("Failed to fetch weather", error);
    return {};
  }
};

export const getWeatherIcon = (code: number): string => {
  // WMO Weather interpretation codes (WW)
  if (code === 0) return '☀️'; // Clear sky
  if (code === 1 || code === 2 || code === 3) return '⛅'; // Mainly clear, partly cloudy, and overcast
  if (code === 45 || code === 48) return '🌫️'; // Fog
  if (code >= 51 && code <= 55) return 'DRIZZLE'; // Drizzle (use generic rain or text)
  if (code >= 61 && code <= 67) return '🌧️'; // Rain
  if (code >= 71 && code <= 77) return '❄️'; // Snow
  if (code >= 80 && code <= 82) return '🌦️'; // Rain showers
  if (code >= 95) return '⛈️'; // Thunderstorm
  return '🌤️';
};

export const getWeatherDescription = (code: number): string => {
  if (code === 0) return 'בהיר';
  if (code >= 1 && code <= 3) return 'מעונן חלקית';
  if (code >= 61 && code <= 67) return 'גשום';
  if (code >= 95) return 'סוער';
  return 'נאה';
};