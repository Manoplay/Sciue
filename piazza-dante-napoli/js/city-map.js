// Creazione della mappa, movimenti di camera e layer del traffico.

import { Map as MapLibreMap } from '../vendor/maplibre-gl.mjs';
import { CAMERAS, MAP_BOUNDS } from './config.js';
import { buildStyle } from './map-style.js';

const REFERENCE_WIDTH = 1440;
// I colori del traffico sono definiti una sola volta, nei token CSS.
const cssColor = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export function createCityMap(container) {
  return new MapLibreMap({
    container,
    style: buildStyle(),
    ...fitToViewport(CAMERAS.home),
    minZoom: 12,
    maxZoom: 19.5,
    maxPitch: 70,
    maxBounds: MAP_BOUNDS,
    attributionControl: false,
    locale: { 'Map.Title': 'Mappa 3D interattiva di Napoli' },
  });
}

// Le inquadrature delle viste sono pensate per uno schermo largo 1440 px: su quelli
// più stretti lo zoom si allontana per mostrare la stessa porzione di città.
export function fitToViewport({ fit = 1, ...camera }) {
  const zoomOffset = Math.log2(Math.min(window.innerWidth, REFERENCE_WIDTH) / REFERENCE_WIDTH);
  return { ...camera, zoom: camera.zoom + fit * zoomOffset };
}

export function moveCamera(map, camera) {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) map.jumpTo(camera);
  else map.flyTo({ ...camera, duration: 1800 });
}

// Previsione simulata: il livello di ogni strada dipende dal nome, dall'ora e
// dall'orizzonte scelto, così resta stabile finché non cambia uno dei tre.
export function setTraffic(map, visible, horizon = 0) {
  map.setLayoutProperty('traffic', 'visibility', visible ? 'visible' : 'none');
  if (!visible) return;
  const seed = new Date().getHours() + horizon;
  const level = ['%', ['+', ['length', ['coalesce', ['get', 'name'], '']], seed], 3];
  map.setPaintProperty('traffic', 'line-color',
    ['match', level, 0, cssColor('--traffic-free'), 1, cssColor('--traffic-busy'), cssColor('--traffic-jam')]);
}
