// Orologio, meteo e qualità dell'aria (dati reali da Open-Meteo).

import { ENDPOINTS } from './config.js';

const DATE_FORMAT = new Intl.DateTimeFormat('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
const TIME_FORMAT = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' });

export const formatTime = (date) => TIME_FORMAT.format(date);
export const formatDay = (date) => DATE_FORMAT.format(date);

export function startClock(dateNode, timeNode, onMinute) {
  function tick() {
    const now = new Date();
    dateNode.textContent = formatDay(now);
    dateNode.dateTime = now.toISOString().slice(0, 10);
    timeNode.textContent = formatTime(now);
    onMinute?.(now);
  }
  tick();
  setInterval(tick, 30_000);
}

// Codici meteo WMO → icona e descrizione.
const WEATHER = [
  [[0, 1], 'clear', 'Sereno'],
  [[2, 3], 'cloud', 'Nuvoloso'],
  [[45, 48], 'fog', 'Nebbia'],
  [[51, 67], 'rain', 'Pioggia'],
  [[71, 77], 'snow', 'Neve'],
  [[80, 82], 'rain', 'Rovesci'],
  [[85, 86], 'snow', 'Neve'],
  [[95, 99], 'storm', 'Temporale'],
];

export function describeWeather(code) {
  const match = WEATHER.find(([[from, to]]) => code >= from && code <= to);
  return match ? { icon: match[1], label: match[2] } : { icon: 'unknown', label: 'Meteo' };
}

// Fasce dell'indice europeo di qualità dell'aria (EAQI), con l'icona che le rappresenta.
export const AIR_LEVELS = [
  { id: 'buona', label: 'Buona', max: 20, icon: 'good' },
  { id: 'discreta', label: 'Discreta', max: 40, icon: 'good' },
  { id: 'moderata', label: 'Moderata', max: 60, icon: 'fair' },
  { id: 'scarsa', label: 'Scarsa', max: 80, icon: 'poor' },
  { id: 'molto-scarsa', label: 'Molto scarsa', max: 100, icon: 'bad' },
  { id: 'pessima', label: 'Pessima', max: Infinity, icon: 'bad' },
];

export const airLevelForIndex = (aqi) => AIR_LEVELS.find((level) => aqi <= level.max);
export const airLevelById = (id) => AIR_LEVELS.find((level) => level.id === id);

async function fetchCurrent(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Open-Meteo: ${response.status}`);
  return (await response.json()).current;
}

export async function fetchWeather() {
  const current = await fetchCurrent(ENDPOINTS.weather);
  return { temperature: Math.round(current.temperature_2m), code: current.weather_code };
}

export async function fetchAirQuality() {
  const current = await fetchCurrent(ENDPOINTS.airQuality);
  return {
    aqi: Math.round(current.european_aqi),
    pm10: current.pm10,
    pm25: current.pm2_5,
    no2: current.nitrogen_dioxide,
  };
}
