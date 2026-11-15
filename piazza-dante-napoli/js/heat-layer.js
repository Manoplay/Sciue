// Heat map: calore al suolo e sugli edifici attorno alla piazza.
// Va accesa sul tema monocromatico, che è main.js ad applicare.

import { PIAZZA_DANTE } from './config.js';
import { ZONES, overallLevel } from './crowd-feed.js';
import { MONO_BUILDING } from './map-style.js';

const RAMP = [[0, '#f3dc9a'], [0.35, '#f6c445'], [0.65, '#f08a2c'], [1, '#d7301f']];
const PIAZZA_POINT = { type: 'Point', coordinates: PIAZZA_DANTE };

export const HEAT_GRADIENT = `linear-gradient(90deg, ${RAMP.map(([stop, color]) => `${color} ${stop * 100}%`).join(', ')})`;

// Punti attorno al centro di ogni zona (in metri), per dare corpo alla macchia di calore.
const SPREAD = [[0, 0], [14, 0], [-14, 0], [0, 14], [0, -14], [10, 10], [-10, -10]];
const METERS_PER_DEGREE = 111320;

function mix(from, to, amount) {
  const channel = (hex, index) => parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16);
  const parts = [0, 1, 2].map((i) => Math.round(channel(from, i) + (channel(to, i) - channel(from, i)) * amount));
  return `rgb(${parts.join(', ')})`;
}

function rampColor(level) {
  const upper = RAMP.findIndex(([stop]) => stop >= level);
  if (upper <= 0) return RAMP[0][1];
  const [fromStop, fromColor] = RAMP[upper - 1];
  const [toStop, toColor] = RAMP[upper];
  return mix(fromColor, toColor, (level - fromStop) / (toStop - fromStop));
}

// Più alta è l'affluenza, più il calore è intenso e si allarga dalla piazza.
function heatedColor(baseColor, level) {
  const radius = 60 + 200 * level;
  return ['interpolate', ['linear'], ['distance', PIAZZA_POINT],
    0, rampColor(level),
    radius * 0.55, rampColor(level * 0.5),
    radius, baseColor];
}

function toHeatPoints(reading) {
  const affluenceById = new Map(reading.zones.map((zone) => [zone.id, zone.affluence]));
  const features = ZONES.flatMap(({ id, center: [lng, lat] }) => {
    const lngPerMeter = 1 / (METERS_PER_DEGREE * Math.cos((lat * Math.PI) / 180));
    return SPREAD.map(([east, north]) => ({
      type: 'Feature',
      properties: { affluence: affluenceById.get(id) ?? 0 },
      geometry: { type: 'Point', coordinates: [lng + east * lngPerMeter, lat + north / METERS_PER_DEGREE] },
    }));
  });
  return { type: 'FeatureCollection', features };
}

export function createHeatLayer(map) {
  let enabled = false;
  let reading = null;

  function render() {
    if (!reading) return;
    const level = overallLevel(reading);
    map.getSource('crowd').setData(toHeatPoints(reading));
    map.setPaintProperty('building-walls', 'fill-extrusion-color', heatedColor(MONO_BUILDING.wall, level));
    map.setPaintProperty('building-roofs', 'fill-extrusion-color', heatedColor(MONO_BUILDING.roof, level));
  }

  return {
    setEnabled(on) {
      enabled = on;
      map.setLayoutProperty('crowd-heat', 'visibility', on ? 'visible' : 'none');
      if (on) render();
    },
    update(nextReading) {
      reading = nextReading;
      if (enabled) render();
    },
  };
}
