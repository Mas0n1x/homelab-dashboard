'use client';

import { useQuery } from '@tanstack/react-query';
import { GlassCard } from '@/components/ui/GlassCard';

interface WeatherData {
  temperature: number;
  windspeed: number;
  weathercode: number;
  is_day: number;
}

interface GeoLocation {
  latitude: number;
  longitude: number;
  city: string;
}

const WEATHER_ICONS: Record<number, string> = {
  0: 'Klar',
  1: 'Heiter',
  2: 'Teilweise bewolkt',
  3: 'Bewolkt',
  45: 'Nebel',
  48: 'Raureif-Nebel',
  51: 'Leichter Nieselregen',
  53: 'Nieselregen',
  55: 'Starker Nieselregen',
  61: 'Leichter Regen',
  63: 'Regen',
  65: 'Starker Regen',
  71: 'Leichter Schnee',
  73: 'Schnee',
  75: 'Starker Schnee',
  80: 'Regenschauer',
  81: 'Regenschauer',
  82: 'Starke Schauer',
  95: 'Gewitter',
  96: 'Gewitter mit Hagel',
  99: 'Starkes Gewitter',
};

function getWeatherEmoji(code: number, isDay: boolean): string {
  if (code === 0) return isDay ? '\u2600\uFE0F' : '\uD83C\uDF19';
  if (code <= 2) return isDay ? '\u26C5' : '\uD83C\uDF19';
  if (code === 3) return '\u2601\uFE0F';
  if (code <= 48) return '\uD83C\uDF2B\uFE0F';
  if (code <= 55) return '\uD83C\uDF26\uFE0F';
  if (code <= 65) return '\uD83C\uDF27\uFE0F';
  if (code <= 75) return '\u2744\uFE0F';
  if (code <= 82) return '\uD83C\uDF26\uFE0F';
  return '\u26A1';
}

export function WeatherWidget() {
  const { data: geo } = useQuery<GeoLocation>({
    queryKey: ['geolocation'],
    queryFn: async () => {
      const res = await fetch('https://ipapi.co/json/');
      if (!res.ok) throw new Error('Geo lookup failed');
      const data = await res.json();
      return { latitude: data.latitude, longitude: data.longitude, city: data.city };
    },
    staleTime: 3600000,
  });

  const { data: weather } = useQuery<WeatherData>({
    queryKey: ['weather', geo?.latitude, geo?.longitude],
    queryFn: async () => {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${geo!.latitude}&longitude=${geo!.longitude}&current_weather=true`
      );
      if (!res.ok) throw new Error('Weather API error');
      const data = await res.json();
      return data.current_weather;
    },
    enabled: !!geo,
    staleTime: 600000,
    refetchInterval: 600000,
  });

  if (!weather || !geo) return null;

  const emoji = getWeatherEmoji(weather.weathercode, weather.is_day === 1);
  const description = WEATHER_ICONS[weather.weathercode] || 'Unbekannt';

  return (
    <GlassCard delay={0.3} hover>
      <div className="relative z-10 flex items-center gap-3">
        <span className="text-3xl">{emoji}</span>
        <div className="flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-semibold">{weather.temperature}°C</span>
            <span className="text-xs text-white/40">{weather.windspeed} km/h</span>
          </div>
          <p className="text-xs text-white/40">{description}</p>
        </div>
        <span className="text-xs text-white/30">{geo.city}</span>
      </div>
    </GlassCard>
  );
}
