// Costanti condivise: coordinate, inquadrature e servizi esterni.

export const PIAZZA_DANTE = [14.2502, 40.8492];

// `fit` dice quanto l'inquadratura si allontana sugli schermi stretti (1 = stessa area, 0 = stesso zoom).
export const CAMERAS = {
  home: { center: PIAZZA_DANTE, zoom: 17.1, pitch: 60, bearing: -28, fit: 0.4 },
  city: { center: [14.2515, 40.8432], zoom: 14.2, pitch: 0, bearing: 0 },
};

// Limita la navigazione al centro di Napoli e dintorni.
export const MAP_BOUNDS = [[14.15, 40.79], [14.35, 40.9]];

export const TILES = {
  source: 'https://tiles.openfreemap.org/planet',
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
};

const [lng, lat] = PIAZZA_DANTE;

export const ENDPOINTS = {
  weather: `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code&timezone=Europe%2FRome`,
  airQuality: `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=european_aqi,pm10,pm2_5,nitrogen_dioxide&timezone=Europe%2FRome`,
  geocoder: 'https://nominatim.openstreetmap.org/search',
  // URL del servizio (LLM) che stima l'affluenza. Con null i dati sono simulati.
  // Formato atteso: { "zones": [{ "id": "centro", "affluence": 0.72 }, …] }
  crowd: null,
};

export const CROWD_INTERVAL_MS = 2500;

// Livello di qualità dell'aria mostrato sempre, a scopo dimostrativo
// (buona, discreta, moderata, scarsa, molto-scarsa, pessima).
// Con null il sito torna a leggere il dato reale da Open-Meteo.
export const AIR_QUALITY_FIXED = 'scarsa';
