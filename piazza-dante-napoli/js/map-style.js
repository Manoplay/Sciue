// Stile della mappa: un solo elenco di layer e tre temi.
//   model → modello 3D a colori con facciate e tetti (home)
//   mono  → modello 3D monocromatico (heat map)
//   plan  → mappa 2D piatta con strade bianche ed etichette (Trasporti, Parcheggio)

import { PIAZZA_DANTE, TILES } from './config.js';

const THEMES = {
  model: {
    is3d: true,
    land: '#b9b2a5', green: '#86b562', water: '#6fb2d6', paving: '#a9a7a3',
    road: '#8f8d8a', roadMajor: '#9b9996',
    wall: '#ead9b5', roof: '#d8623a', canopy: '#5f9a47', sky: '#cfe6f3',
    textured: true,
  },
  mono: {
    is3d: true,
    land: '#dcdad6', green: '#d2d1cc', water: '#c6cbcf', paving: '#e3e1dd',
    road: '#cfcdc8', roadMajor: '#d9d7d3',
    wall: '#e6e3de', roof: '#f1efeb', canopy: '#d9d8d3', sky: '#e9e8e5',
  },
  plan: {
    is3d: false,
    land: '#f8f4ec', green: '#cbe8b5', water: '#8fd6f5', paving: '#f1ece2',
    road: '#ffffff', roadMajor: '#ffffff',
    wall: '#efe9dc', roof: '#efe9dc', canopy: '#cbe8b5', sky: '#f8f4ec',
  },
};

export const MONO_BUILDING = { wall: THEMES.mono.wall, roof: THEMES.mono.roof };

const LAYERS_3D = ['tree-canopy', 'landmarks', 'building-walls', 'building-roofs'];
const LAYERS_PLAN = [
  'road-minor-case', 'road-major-case', 'ferry', 'building-flat',
  'road-label', 'water-label', 'poi', 'place-label',
];

const PIAZZA_POINT = { type: 'Point', coordinates: PIAZZA_DANTE };

// Numero stabile da 0 a n-1 per ogni edificio, ricavato dalla sua distanza dalla piazza:
// serve a variare altezze, facciate e tetti senza dipendere da attributi che spesso mancano.
const variant = (n) => ['%', ['floor', ['distance', PIAZZA_POINT]], n];

// Dove OpenStreetMap non riporta l'altezza, il dato vale 5 m: per non appiattire
// il centro storico si usa un'altezza plausibile (14–23 m).
const HEIGHT = [
  'case',
  ['>', ['coalesce', ['get', 'render_height'], 0], 6], ['get', 'render_height'],
  ['+', 14, ['*', 3, variant(4)]],
];
const ROOF_DEPTH = 1.5;

// Per facciate e tetti la variante viene da id e altezza dell'edificio: le immagini
// si scelgono in una fase in cui la distanza dalla piazza non è ancora calcolabile.
const lookVariant = (n) => ['%',
  ['+', ['to-number', ['id'], 0], ['round', ['*', 7, ['coalesce', ['get', 'render_height'], 0]]]], n];
const FACADES = ['match', lookVariant(5), 0, 'facade-ochre', 1, 'facade-rose', 2, 'facade-stone', 'facade-cream'];
const ROOFS = ['match', lookVariant(7), 0, 'roof-slate', 1, 'roof-clay-dark', 2, 'roof-clay-dark', 'roof-clay'];

// Le geometrie multiple hanno un tipo proprio: vanno elencate entrambe.
const isLine = ['match', ['geometry-type'], ['LineString', 'MultiLineString'], true, false];
const isArea = ['match', ['geometry-type'], ['Polygon', 'MultiPolygon'], true, false];
// OpenFreeMap segna con hide_3d le sagome già coperte da parti di edificio più dettagliate.
const isSolid = ['!', ['has', 'hide_3d']];
const roadClass = (...classes) => ['all', isLine, ['in', ['get', 'class'], ['literal', classes]]];
const roadWidth = (atCity, atStreet) => ['interpolate', ['exponential', 1.6], ['zoom'], 13, atCity, 18, atStreet];
const MINOR_ROADS = roadClass('minor', 'service', 'tertiary', 'pedestrian', 'path');
const MAJOR_ROADS = roadClass('motorway', 'trunk', 'primary', 'secondary');
const ROUND = { 'line-cap': 'round', 'line-join': 'round' };

// Categorie dei punti di interesse sulla mappa 2D: [classi OpenMapTiles, icona, colore del testo].
const POI_GROUPS = [
  [['restaurant', 'cafe', 'bar', 'fast_food', 'bakery', 'ice_cream', 'beer'], 'poi-food', '#b9551f'],
  [['museum', 'attraction', 'castle', 'monument', 'art_gallery', 'library'], 'poi-culture', '#4a59b8'],
  [['theatre', 'cinema', 'music'], 'poi-show', '#b03082'],
  [['park', 'garden', 'stadium', 'pitch', 'zoo'], 'poi-green', '#2a7f3a'],
  [['harbor', 'ferry_terminal', 'railway', 'bus'], 'poi-transit', '#127e8f'],
  [['shop', 'grocery', 'clothing_store', 'alcohol_shop'], 'poi-shop', '#94700a'],
  [['lodging'], 'poi-lodging', '#6b46b8'],
];
const POI_CLASSES = POI_GROUPS.flatMap(([classes]) => classes);
const poiMatch = (pick) => ['match', ['get', 'class'], ...POI_GROUPS.flatMap((group) => [group[0], pick(group)])];

export function buildStyle() {
  const t = THEMES.model;
  const extrusion = (id, extra) => ({
    id, type: 'fill-extrusion', source: 'city', 'source-layer': 'building', minzoom: 13, filter: isSolid, ...extra,
  });
  const label = (id, extra) => ({ id, type: 'symbol', source: 'city', ...extra });

  return {
    version: 8,
    glyphs: TILES.glyphs,
    sources: {
      city: { type: 'vector', url: TILES.source },
      crowd: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
      landmarks: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
    },
    light: { anchor: 'map', color: '#ffffff', intensity: 0.45, position: [1.5, 135, 50] },
    sky: {
      'sky-color': t.sky, 'horizon-color': '#ffffff', 'fog-color': '#ffffff',
      'fog-ground-blend': 0.6, 'horizon-fog-blend': 0.6, 'sky-horizon-blend': 0.7,
    },
    layers: [
      { id: 'land', type: 'background', paint: { 'background-color': t.land } },
      { id: 'green', type: 'fill', source: 'city', 'source-layer': 'landcover',
        filter: ['in', ['get', 'class'], ['literal', ['grass', 'wood']]],
        paint: { 'fill-color': t.green } },
      { id: 'park', type: 'fill', source: 'city', 'source-layer': 'park', paint: { 'fill-color': t.green } },
      { id: 'water', type: 'fill', source: 'city', 'source-layer': 'water', paint: { 'fill-color': t.water } },
      { id: 'paving', type: 'fill', source: 'city', 'source-layer': 'transportation', filter: isArea,
        paint: { 'fill-color': t.paving } },

      { id: 'road-minor-case', type: 'line', source: 'city', 'source-layer': 'transportation', filter: MINOR_ROADS,
        minzoom: 14, layout: { ...ROUND, visibility: 'none' },
        paint: { 'line-color': '#e4dccb', 'line-width': roadWidth(1.4, 11) } },
      { id: 'road-major-case', type: 'line', source: 'city', 'source-layer': 'transportation', filter: MAJOR_ROADS,
        layout: { ...ROUND, visibility: 'none' },
        paint: { 'line-color': '#e4dccb', 'line-width': roadWidth(3.2, 18.5) } },
      { id: 'road-minor', type: 'line', source: 'city', 'source-layer': 'transportation', filter: MINOR_ROADS,
        layout: ROUND, paint: { 'line-color': t.road, 'line-width': roadWidth(0.6, 9) } },
      { id: 'road-major', type: 'line', source: 'city', 'source-layer': 'transportation', filter: MAJOR_ROADS,
        layout: ROUND, paint: { 'line-color': t.roadMajor, 'line-width': roadWidth(2, 16) } },
      { id: 'ferry', type: 'line', source: 'city', 'source-layer': 'transportation', filter: roadClass('ferry'),
        layout: { visibility: 'none' }, paint: { 'line-color': '#62b8e6', 'line-width': 1.2 } },
      { id: 'traffic', type: 'line', source: 'city', 'source-layer': 'transportation_name',
        filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary', 'tertiary']]],
        layout: { ...ROUND, visibility: 'none' },
        paint: { 'line-color': '#9aa0a5', 'line-width': roadWidth(2.5, 10), 'line-opacity': 0.9 } },

      { id: 'building-flat', type: 'fill', source: 'city', 'source-layer': 'building', minzoom: 14.5,
        layout: { visibility: 'none' },
        paint: { 'fill-color': '#efe9dc', 'fill-outline-color': '#e0d8c7',
          'fill-opacity': ['interpolate', ['linear'], ['zoom'], 14.5, 0, 15.5, 1] } },

      { id: 'crowd-heat', type: 'heatmap', source: 'crowd', layout: { visibility: 'none' },
        paint: {
          'heatmap-weight': ['get', 'affluence'],
          'heatmap-intensity': 1.1,
          // Raggio costante in metri: raddoppia a ogni livello di zoom.
          'heatmap-radius': ['interpolate', ['exponential', 2], ['zoom'], 13, 2.5, 19, 160],
          'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'],
            0, 'rgba(246, 196, 69, 0)', 0.25, '#f6c445', 0.55, '#f08a2c', 0.85, '#d7301f', 1, '#a50f15'],
          'heatmap-opacity': 0.85,
        } },

      { id: 'tree-canopy', type: 'fill-extrusion', source: 'city', 'source-layer': 'landcover', minzoom: 14,
        filter: ['==', ['get', 'class'], 'wood'],
        paint: { 'fill-extrusion-color': t.canopy, 'fill-extrusion-base': 2, 'fill-extrusion-height': 9 } },
      { id: 'landmarks', type: 'fill-extrusion', source: 'landmarks', minzoom: 14,
        paint: {
          'fill-extrusion-color': ['get', 'color'],
          'fill-extrusion-base': ['get', 'base'],
          'fill-extrusion-height': ['get', 'height'],
        } },
      extrusion('building-walls', { paint: {
        'fill-extrusion-color': t.wall,
        'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
        'fill-extrusion-height': ['-', HEIGHT, ROOF_DEPTH],
      } }),
      extrusion('building-roofs', { paint: {
        'fill-extrusion-color': t.roof,
        'fill-extrusion-base': ['-', HEIGHT, ROOF_DEPTH],
        'fill-extrusion-height': HEIGHT,
      } }),

      label('road-label', { 'source-layer': 'transportation_name', minzoom: 15,
        layout: { visibility: 'none', 'symbol-placement': 'line', 'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Regular'], 'text-size': 11.5 },
        paint: { 'text-color': '#7a766d', 'text-halo-color': '#ffffff', 'text-halo-width': 1.4 } }),
      label('water-label', { 'source-layer': 'water_name',
        layout: { visibility: 'none', 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Italic'],
          'text-size': 12.5, 'text-max-width': 6 },
        paint: { 'text-color': '#4f9fc9', 'text-halo-color': '#a6def7', 'text-halo-width': 1 } }),
      label('poi', { 'source-layer': 'poi', minzoom: 13.5,
        filter: ['all', ['in', ['get', 'class'], ['literal', POI_CLASSES]], ['<=', ['get', 'rank'], 12]],
        layout: { visibility: 'none', 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Bold'],
          'text-size': 11.5, 'text-anchor': 'left', 'text-offset': [0.9, 0], 'text-max-width': 7,
          'text-justify': 'left', 'symbol-sort-key': ['get', 'rank'],
          'icon-image': poiMatch(([, icon]) => icon).concat('') },
        paint: { 'text-color': poiMatch(([, , color]) => color).concat('#555555'),
          'text-halo-color': '#ffffff', 'text-halo-width': 1.5 } }),
      label('place-label', { 'source-layer': 'place',
        filter: ['in', ['get', 'class'], ['literal', ['city', 'suburb', 'quarter', 'neighbourhood']]],
        layout: { visibility: 'none', 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Bold'],
          'text-transform': 'uppercase', 'text-letter-spacing': 0.12, 'text-max-width': 7,
          'text-size': ['match', ['get', 'class'], 'city', 17, 13] },
        paint: { 'text-color': '#6d6a63', 'text-halo-color': '#ffffff', 'text-halo-width': 1.6 } }),
    ],
  };
}

function setVisible(map, layers, visible) {
  for (const layer of layers) map.setLayoutProperty(layer, 'visibility', visible ? 'visible' : 'none');
}

// Applica un tema. Va chiamata dopo registerMapImages: il tema 'model' usa facciate e tetti.
export function applyTheme(map, themeName) {
  const t = THEMES[themeName];
  const paint = [
    ['land', 'background-color', t.land],
    ['green', 'fill-color', t.green],
    ['park', 'fill-color', t.green],
    ['water', 'fill-color', t.water],
    ['paving', 'fill-color', t.paving],
    ['road-minor', 'line-color', t.road],
    ['road-major', 'line-color', t.roadMajor],
    ['tree-canopy', 'fill-extrusion-color', t.canopy],
    ['building-walls', 'fill-extrusion-color', t.wall],
    ['building-roofs', 'fill-extrusion-color', t.roof],
    ['building-walls', 'fill-extrusion-pattern', t.textured ? FACADES : undefined],
    ['building-roofs', 'fill-extrusion-pattern', t.textured ? ROOFS : undefined],
    ['landmarks', 'fill-extrusion-color', t.textured ? ['get', 'color'] : t.roof],
  ];
  for (const [layer, property, value] of paint) map.setPaintProperty(layer, property, value);

  setVisible(map, LAYERS_3D, t.is3d);
  setVisible(map, LAYERS_PLAN, !t.is3d);
  map.setSky({ ...map.getSky(), 'sky-color': t.sky });
}
