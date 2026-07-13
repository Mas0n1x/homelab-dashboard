/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useQuery } from '@tanstack/react-query';
import { GlassCard } from '@/components/ui/GlassCard';

interface WeatherData {
  temperature: number;
  windspeed: number;
  weathercode: number;
  is_day: number;
}

export interface WeatherLocation {
  latitude: number;
  longitude: number;
  city: string;
}

const WEATHER_TEXT: Record<number, string> = {
  0: 'Klar', 1: 'Heiter', 2: 'Teilweise bewölkt', 3: 'Bewölkt',
  45: 'Nebel', 48: 'Raureif-Nebel',
  51: 'Leichter Nieselregen', 53: 'Nieselregen', 55: 'Starker Nieselregen',
  61: 'Leichter Regen', 63: 'Regen', 65: 'Starker Regen',
  71: 'Leichter Schnee', 73: 'Schnee', 75: 'Starker Schnee',
  80: 'Regenschauer', 81: 'Regenschauer', 82: 'Starke Schauer',
  95: 'Gewitter', 96: 'Gewitter mit Hagel', 99: 'Starkes Gewitter',
};

function weatherEmoji(code: number, isDay: boolean): string {
  if (code === 0) return isDay ? '☀️' : '🌙';
  if (code <= 2) return isDay ? '⛅' : '🌙';
  if (code === 3) return '☁️';
  if (code <= 48) return '🌫️';
  if (code <= 55) return '🌦️';
  if (code <= 65) return '🌧️';
  if (code <= 75) return '❄️';
  if (code <= 82) return '🌦️';
  return '⚡';
}

// Farbstimmung je nach Tag/Nacht und Wetterlage
function tint(code: number, isDay: boolean): string {
  if (!isDay) return 'from-indigo-500/15 to-transparent';
  if (code === 0 || code <= 2) return 'from-amber-400/15 to-transparent';
  if (code <= 48) return 'from-slate-400/12 to-transparent';
  if (code <= 82) return 'from-sky-500/15 to-transparent';
  return 'from-violet-500/15 to-transparent';
}

export function WeatherWidget({ location }: { location: WeatherLocation }) {
  const { data: weather, isLoading } = useQuery<WeatherData>({
    queryKey: ['weather', location.latitude, location.longitude],
    queryFn: async () => {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current_weather=true`
      );
      if (!res.ok) throw new Error('Weather API error');
      const data = await res.json();
      return data.current_weather;
    },
    staleTime: 600000,
    refetchInterval: 600000,
  });

  const isDay = weather ? weather.is_day === 1 : true;
  const emoji = weather ? weatherEmoji(weather.weathercode, isDay) : '☁️';
  const description = weather ? (WEATHER_TEXT[weather.weathercode] || 'Unbekannt') : '';

  return (
    <GlassCard delay={0.3} hover className="overflow-hidden">
      <div className={`absolute inset-0 bg-gradient-to-br ${weather ? tint(weather.weathercode, isDay) : 'from-white/[0.03] to-transparent'} pointer-events-none`} />
      <div className="relative z-10 flex items-center gap-3.5">
        <div className="w-14 h-14 rounded-2xl bg-white/[0.05] border border-white/[0.06] flex items-center justify-center flex-shrink-0">
          <span className="text-3xl leading-none">{emoji}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-white/80 truncate" title={location.city}>{location.city}</p>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-3xl font-semibold tabular-nums leading-none">
              {weather ? Math.round(weather.temperature) : '–'}
            </span>
            <span className="text-base text-white/40 leading-none">°C</span>
          </div>
          <p className="text-[11px] text-white/40 truncate mt-1">
            {isLoading ? 'Lädt…' : description}
            {weather && <span className="text-white/25"> · {Math.round(weather.windspeed)} km/h</span>}
          </p>
        </div>
      </div>
    </GlassCard>
  );
}
