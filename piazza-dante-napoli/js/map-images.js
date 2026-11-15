// Immagini disegnate al volo per la mappa: facciate con finestre e tetti per il
// modello 3D, pallini colorati per i punti di interesse della mappa 2D.

import { PIAZZA_DANTE } from './config.js';

function draw(width, height, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  paint(context, width, height);
  return context.getImageData(0, 0, width, height);
}

// Un modulo di facciata: un piano con una finestra e la fascia marcapiano.
function facade(wall, shade) {
  return draw(32, 40, (c, w, h) => {
    c.fillStyle = wall;
    c.fillRect(0, 0, w, h);
    c.fillStyle = shade;
    c.fillRect(0, h - 3, w, 3);
    c.fillStyle = '#f4efe4';
    c.fillRect(9, 7, 14, 23);
    c.fillStyle = '#4d5a63';
    c.fillRect(11, 9, 10, 19);
    c.fillStyle = '#6f7d86';
    c.fillRect(11, 9, 10, 6);
  });
}

// Tetto: fasce alterne che suggeriscono i coppi o la guaina dei tetti piani.
function roof(base, stripe) {
  return draw(16, 16, (c, w, h) => {
    c.fillStyle = base;
    c.fillRect(0, 0, w, h);
    c.fillStyle = stripe;
    for (let y = 0; y < h; y += 4) c.fillRect(0, y, w, 1);
  });
}

function dot(color) {
  return draw(28, 28, (c) => {
    c.beginPath();
    c.arc(14, 14, 11, 0, Math.PI * 2);
    c.fillStyle = color;
    c.fill();
    c.lineWidth = 3;
    c.strokeStyle = '#ffffff';
    c.stroke();
  });
}

const IMAGES = {
  'facade-cream': () => facade('#ead9b5', '#d9c69e'),
  'facade-ochre': () => facade('#e6bd6e', '#d2a856'),
  'facade-rose': () => facade('#e3ab90', '#cf957a'),
  'facade-stone': () => facade('#d8d3c8', '#c4bfb3'),
  'roof-clay': () => roof('#d4654a', '#c2583e'),
  'roof-clay-dark': () => roof('#c05640', '#ad4a35'),
  'roof-slate': () => roof('#aeaba5', '#9c9993'),
  'poi-food': () => dot('#ee7b34'),
  'poi-culture': () => dot('#5b6bd6'),
  'poi-show': () => dot('#d5409f'),
  'poi-green': () => dot('#33a852'),
  'poi-transit': () => dot('#1ba6c4'),
  'poi-shop': () => dot('#e5a50a'),
  'poi-lodging': () => dot('#8a5cd6'),
};

export function registerMapImages(map) {
  for (const [name, create] of Object.entries(IMAGES)) map.addImage(name, create(), { pixelRatio: 2 });
}

/* ---------- Monumento a Dante ---------- */

const METERS_PER_DEGREE = 111320;

// Poligono regolare attorno al centro della piazza; il raggio è in metri.
function ring(radius, sides) {
  const [lng, lat] = PIAZZA_DANTE;
  const lngPerMeter = 1 / (METERS_PER_DEGREE * Math.cos((lat * Math.PI) / 180));
  const points = Array.from({ length: sides }, (_, i) => {
    const angle = (i / sides) * Math.PI * 2 + Math.PI / sides;
    return [lng + Math.cos(angle) * radius * lngPerMeter, lat + (Math.sin(angle) * radius) / METERS_PER_DEGREE];
  });
  return [[...points, points[0]]];
}

// Volumi impilati che riprendono il monumento al centro della piazza:
// aiuola, gradini, basamento e statua. Misure indicative.
const MONUMENT = [
  { radius: 11, sides: 4, base: 0, height: 0.4, color: '#86b562' },
  { radius: 5.5, sides: 4, base: 0.4, height: 1.6, color: '#d9d5cc' },
  { radius: 3, sides: 8, base: 1.6, height: 7, color: '#eeebe4' },
  { radius: 1.1, sides: 8, base: 7, height: 12, color: '#f7f5f0' },
];

export const LANDMARKS = {
  type: 'FeatureCollection',
  features: MONUMENT.map(({ radius, sides, ...properties }) => ({
    type: 'Feature',
    properties,
    geometry: { type: 'Polygon', coordinates: ring(radius, sides) },
  })),
};
