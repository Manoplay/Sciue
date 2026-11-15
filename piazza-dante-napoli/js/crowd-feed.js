// Fonte dei dati di affluenza in Piazza Dante.
// Senza ENDPOINTS.crowd le letture sono simulate; con un URL vengono lette dal
// servizio (per esempio l'LLM che stima la presenza di persone) nello stesso formato.

import { ENDPOINTS, CROWD_INTERVAL_MS } from './config.js';

// `share` è il peso di ogni zona nella simulazione: il centro si scalda di più.
export const ZONES = [
  { id: 'centro', name: 'Statua di Dante', center: [14.2502, 40.8492], share: 1 },
  { id: 'port-alba', name: 'Lato Port’Alba', center: [14.25065, 40.84965], share: 0.75 },
  { id: 'emiciclo', name: 'Emiciclo del Convitto', center: [14.2507, 40.8491], share: 0.6 },
  { id: 'toledo', name: 'Lato via Toledo', center: [14.2497, 40.84905], share: 0.8 },
  { id: 'metro', name: 'Uscita metro Dante', center: [14.25, 40.8487], share: 0.7 },
];

const clamp01 = (value) => Math.min(1, Math.max(0, value));

function simulateReading(now) {
  const wave = 0.5 + 0.5 * Math.sin(now / 9000);
  return {
    source: 'simulation',
    zones: ZONES.map((zone, index) => ({
      id: zone.id,
      affluence: clamp01(zone.share * (0.12 + 0.95 * wave) + 0.1 * Math.sin(now / 2100 + index * 1.9)),
    })),
  };
}

async function fetchReading(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Servizio affluenza: ${response.status}`);
  const { zones } = await response.json();
  const known = new Set(ZONES.map((zone) => zone.id));
  return {
    source: 'live',
    zones: zones
      .filter((zone) => known.has(zone.id))
      .map((zone) => ({ id: zone.id, affluence: clamp01(Number(zone.affluence) || 0) })),
  };
}

export function overallLevel(reading) {
  if (!reading.zones.length) return 0;
  return reading.zones.reduce((sum, zone) => sum + zone.affluence, 0) / reading.zones.length;
}

export function createCrowdFeed() {
  const listeners = new Set();

  async function tick() {
    let reading;
    try {
      reading = ENDPOINTS.crowd ? await fetchReading(ENDPOINTS.crowd) : simulateReading(Date.now());
    } catch (error) {
      console.warn(error);
      reading = simulateReading(Date.now());
    }
    for (const listener of listeners) listener(reading);
  }

  return {
    subscribe(listener) { listeners.add(listener); },
    start() {
      tick();
      setInterval(tick, CROWD_INTERVAL_MS);
    },
  };
}
