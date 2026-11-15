import { AIR_QUALITY_FIXED, CAMERAS, ENDPOINTS, MAP_BOUNDS } from './config.js';
import { createCityMap, fitToViewport, moveCamera, setTraffic } from './city-map.js';
import { createCrowdFeed, overallLevel } from './crowd-feed.js';
import { applyTheme } from './map-style.js';
import { registerMapImages, LANDMARKS } from './map-images.js';
import { createHeatLayer, HEAT_GRADIENT } from './heat-layer.js';
import { createPinGroup, labelPart } from './pins.js';
import { createCombobox } from './combobox.js';
import { createEventsView } from './events.js';
import {
  startClock, formatTime, fetchWeather, fetchAirQuality, describeWeather, airLevelForIndex, airLevelById,
} from './conditions.js';

const $ = (id) => document.getElementById(id);

// theme: aspetto della mappa; tools: heat map e traffico; status: qualità dell'aria e avvisi.
const VIEWS = {
  home: { name: 'Mappa 3D di Piazza Dante', camera: CAMERAS.home, theme: 'model', search: 'places', tools: true, status: true },
  trasporti: { name: 'Trasporti', camera: CAMERAS.city, theme: 'plan', search: 'lines', tools: false, status: true },
  parcheggio: { name: 'Parcheggio', camera: CAMERAS.city, theme: 'plan', search: 'places', tools: false, status: false },
  eventi: { name: 'Eventi', search: 'events', tools: false, status: false },
};

const REFRESH_CONDITIONS_MS = 15 * 60_000;
const state = { view: 'home', heat: false, traffic: false, weather: null, air: null, crowdAlert: false, crowdSource: 'simulation' };

/* ---------- Mappa ---------- */

const mapError = $('map-error');
function showMapError(text) {
  mapError.textContent = text;
  mapError.hidden = !text;
}

let map = null;
try {
  map = createCityMap($('map'));
} catch (error) {
  console.warn(error);
  showMapError('La mappa 3D non può essere mostrata: questo browser non supporta WebGL.');
}

const heat = map && createHeatLayer(map);
// Registrata subito: lo stile può finire di caricarsi mentre si attendono i dati.
const styleReady = map && new Promise((resolve) => map.once('style.load', resolve));
let mapStyled = false; // vero quando stile e immagini sono pronti: prima i temi non si possono applicare

function updateTheme() {
  const { theme } = VIEWS[state.view];
  if (!mapStyled || !theme) return;
  applyTheme(map, state.heat ? 'mono' : theme);
  heat.setEnabled(state.heat);
}

async function loadJson(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url}: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn(error);
    return {};
  }
}

const [{ lines = [] }, { areas = [] }, { places = [] }] = await Promise.all(
  ['data/lines.json', 'data/parking.json', 'data/places.json'].map(loadJson),
);

/* ---------- Pallini: trasporti e parcheggi ---------- */

// Prossimo passaggio simulato: una corsa ogni `everyMin` minuti, sfasata di `offsetMin`.
function nextArrival(line) {
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const wait = (line.offsetMin - (minutes % line.everyMin) + line.everyMin) % line.everyMin || line.everyMin;
  return formatTime(new Date(now.getTime() + wait * 60_000));
}

function describeLine(line) {
  const time = nextArrival(line);
  const detail = labelPart('span', 'pin__detail', '');
  detail.append(labelPart('span', 'pin__caption', 'Arrivo stimato'), labelPart('span', 'pin__value', time));
  return {
    variant: 'transit',
    ariaLabel: `Linea ${line.id}, arrivo stimato alle ${time}`,
    label: [labelPart('strong', 'pin__name', line.id), detail],
  };
}

const capitalize = (text) => text[0].toUpperCase() + text.slice(1);

function describeParking(area) {
  const detail = labelPart('span', 'pin__detail', '');
  detail.append(
    labelPart('span', 'pin__caption', 'Disponibilità parcheggio:'),
    labelPart('span', 'pin__value', capitalize(area.availability)),
  );
  return {
    variant: `parking-${area.availability}`,
    ariaLabel: `Parcheggio ${area.area}: disponibilità ${area.availability}`,
    label: [detail],
  };
}

const transitPins = createPinGroup(map, describeLine);
const parkingPins = createPinGroup(map, describeParking);
transitPins.setItems(lines);
parkingPins.setItems(areas);

/* ---------- Ricerca ---------- */

const normalize = (text) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/’/g, "'").toLowerCase();

function goToPlace(position) {
  if (!map) return;
  const { pitch, bearing } = VIEWS[state.view].camera;
  moveCamera(map, { center: position, zoom: pitch ? 17.1 : 16, pitch, bearing });
}

async function searchOnline(query) {
  const url = new URL(ENDPOINTS.geocoder);
  url.search = new URLSearchParams({
    q: query, format: 'jsonv2', limit: '1', bounded: '1', viewbox: MAP_BOUNDS.flat().join(','), 'accept-language': 'it',
  });
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Geocoder: ${response.status}`);
    const [place] = await response.json();
    if (!place) return 'Nessun luogo trovato a Napoli con questo nome.';
    goToPlace([Number(place.lon), Number(place.lat)]);
    return `Trovato: ${place.display_name}`;
  } catch (error) {
    console.warn(error);
    return 'La ricerca online non è disponibile in questo momento.';
  }
}

const eventsView = createEventsView($('events-list'), $('events-message'));

const searchModes = {
  places: {
    label: 'Cerca un luogo',
    placeholder: 'Cerca un luogo…',
    emptyMessage: 'Nessun luogo in elenco: premi Invio per cercarlo online.',
    getOptions: (query) => (query ? places.filter((place) => normalize(place.name).includes(normalize(query))).slice(0, 6) : [])
      .map((place) => ({ id: place.id, label: place.name, position: place.position })),
    onSelect: (option) => goToPlace(option.position),
    onSubmit: searchOnline,
  },
  lines: {
    label: 'Traccia una linea',
    placeholder: 'Traccia linea…',
    openOnFocus: true,
    emptyMessage: `Linea non in archivio. Disponibili: ${lines.map((line) => line.id).join(', ')}.`,
    getOptions: (query) => lines.filter((line) => line.id.includes(query))
      .map((line) => ({ id: line.id, label: line.id, hint: `arrivo stimato ${nextArrival(line)}`, position: line.position })),
    onSelect(option) {
      transitPins.select(option.id);
      if (map) moveCamera(map, { ...CAMERAS.city, center: option.position, zoom: 15.6 });
    },
  },
  events: {
    label: 'Cerca un evento',
    placeholder: 'Cerca un evento…',
    onInput: (query) => eventsView.filter(query),
  },
};

const search = createCombobox({
  form: $('search'), input: $('search-input'), list: $('search-list'), status: $('search-status'), label: $('search-label'),
});

/* ---------- Strumenti: heat map e previsione traffico ---------- */

const heatToggle = $('heat-toggle');
const trafficToggle = $('traffic-toggle');

function setToggle(button, stateNode, panel, on) {
  button.setAttribute('aria-pressed', String(on));
  stateNode.textContent = on ? 'on' : 'off';
  panel.hidden = !on;
}

function setHeat(on) {
  if (state.heat === on) return;
  state.heat = on;
  updateTheme();
  setToggle(heatToggle, $('heat-state'), $('heat-panel'), on);
}

function setTrafficOn(on) {
  if (state.traffic === on) return;
  state.traffic = on;
  const horizon = Number(document.querySelector('[name="traffic-horizon"]:checked').value);
  setTraffic(map, on, horizon);
  setToggle(trafficToggle, $('traffic-state'), $('traffic-panel'), on);
}

heatToggle.addEventListener('click', () => setHeat(!state.heat));
trafficToggle.addEventListener('click', () => setTrafficOn(!state.traffic));
$('traffic-panel').addEventListener('change', (event) => setTraffic(map, true, Number(event.target.value)));

/* ---------- Affluenza ---------- */

const HEAT_LEVELS = [[0.35, 'Bassa'], [0.6, 'Media'], [Infinity, 'Alta']];

function onCrowdReading(reading) {
  const level = overallLevel(reading);
  const label = HEAT_LEVELS.find(([limit]) => level < limit)[1];
  heat?.update(reading);
  $('heat-level').textContent = label;
  $('heat-percent').textContent = `${Math.round(level * 100)}%`;
  $('heat-source').textContent = reading.source === 'live' ? 'Tempo reale' : 'Simulazione';

  state.crowdAlert = label === 'Alta';
  state.crowdSource = reading.source;
  renderAlerts();
}

/* ---------- Meteo, aria e avvisi ---------- */

const WET_WEATHER = new Set(['rain', 'storm', 'snow']);
const POOR_AIR = new Set(['poor', 'bad']);
let shownAlerts = '';

function renderAlerts() {
  const alerts = [];
  if (state.crowdAlert) {
    alerts.push(`Affluenza alta in Piazza Dante${state.crowdSource === 'live' ? '' : ' (simulazione)'}.`);
  }
  if (state.weather && WET_WEATHER.has(state.weather.icon)) alerts.push(`${state.weather.label} in corso su Napoli.`);
  if (state.air && POOR_AIR.has(state.air.level.icon)) {
    const detail = state.air.fixed ? 'dimostrativo' : `indice ${state.air.aqi}`;
    alerts.push(`Qualità dell’aria ${state.air.level.label.toLowerCase()} (${detail}).`);
  }
  if (!alerts.length) alerts.push('Nessun avviso in questo momento.');

  const key = alerts.join('|');
  if (key === shownAlerts) return;
  shownAlerts = key;
  $('alerts-list').replaceChildren(...alerts.map((text) => labelPart('li', '', text)));
}

async function refreshWeather() {
  try {
    const { temperature, code } = await fetchWeather();
    state.weather = describeWeather(code);
    $('weather-icon').firstElementChild.setAttribute('href', `#icon-weather-${state.weather.icon}`);
    $('weather-temp').textContent = `${temperature}°`;
    $('weather-summary').textContent = `${state.weather.label}, ${temperature} gradi`;
  } catch (error) {
    console.warn(error);
    state.weather = null;
    $('weather-icon').firstElementChild.setAttribute('href', '#icon-weather-unknown');
    $('weather-temp').textContent = 'n.d.';
    $('weather-summary').textContent = 'Meteo non disponibile';
  }
  renderAlerts();
}

function airDetail(term, value) {
  return [labelPart('dt', '', term), labelPart('dd', '', value)];
}

// air: { level, fixed } oppure { level, aqi, pm25, pm10, no2 }; null se il dato manca.
function showAirQuality(air) {
  const details = $('air-details');
  const label = air ? air.level.label : 'n.d.';
  state.air = air;

  $('air-icon').firstElementChild.setAttribute('href', `#icon-air-${air ? air.level.icon : 'unknown'}`);
  $('air-button').dataset.level = air ? air.level.icon : 'unknown';
  $('air-state').textContent = label;
  $('air-button').setAttribute('aria-label', `Air quality: ${air ? label.toLowerCase() : 'dato non disponibile'}`);
  $('air-tag').hidden = !air?.fixed;

  if (!air) {
    details.replaceChildren();
    $('air-note').textContent = 'Dato non disponibile: il servizio non è raggiungibile.';
  } else if (air.fixed) {
    details.replaceChildren(...airDetail('Livello', label));
    $('air-note').textContent = 'Valore dimostrativo, impostato a mano.';
  } else {
    details.replaceChildren(
      ...airDetail('Indice europeo', `${air.aqi} · ${label}`),
      ...airDetail('PM2,5', `${air.pm25} µg/m³`),
      ...airDetail('PM10', `${air.pm10} µg/m³`),
      ...airDetail('NO₂', `${air.no2} µg/m³`),
    );
    $('air-note').textContent = `Fonte Open-Meteo, aggiornato alle ${formatTime(new Date())}.`;
  }
  renderAlerts();
}

async function refreshAirQuality() {
  if (AIR_QUALITY_FIXED) return showAirQuality({ level: airLevelById(AIR_QUALITY_FIXED), fixed: true });
  try {
    const reading = await fetchAirQuality();
    showAirQuality({ level: airLevelForIndex(reading.aqi), ...reading });
  } catch (error) {
    console.warn(error);
    showAirQuality(null);
  }
}

/* ---------- Pannelli a comparsa ---------- */

function bindDisclosure(button, panel) {
  const setOpen = (open) => {
    panel.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
  };
  button.addEventListener('click', () => setOpen(panel.hidden));
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || panel.hidden) return;
    setOpen(false);
    button.focus();
  });
  document.addEventListener('pointerdown', (event) => {
    if (!panel.hidden && !panel.contains(event.target) && !button.contains(event.target)) setOpen(false);
  });
}

/* ---------- Viste ---------- */

const viewLinks = document.querySelectorAll('[data-view-link]');

function viewFromHash() {
  const key = location.hash.slice(1);
  return key in VIEWS ? key : 'home';
}

function showView(key) {
  const view = VIEWS[key];
  state.view = key;
  document.body.dataset.view = key;

  for (const link of viewLinks) {
    const target = link.dataset.viewLink;
    const active = target === key;
    link.href = active ? '#home' : `#${target}`;
    if (active) {
      link.setAttribute('aria-current', 'page');
      link.setAttribute('aria-label', `${link.textContent}: sezione attiva, torna alla mappa 3D`);
    } else {
      link.removeAttribute('aria-current');
      link.removeAttribute('aria-label');
    }
  }

  $('events-section').hidden = key !== 'eventi';
  window.scrollTo(0, 0);
  for (const group of document.querySelectorAll('[data-dock]')) group.hidden = !view[group.dataset.dock];
  document.querySelector('.dock').hidden = !view.tools && !view.status;
  search.configure(searchModes[view.search]);
  $('view-status').textContent = `Vista: ${view.name}`;
  if (key === 'eventi') eventsView.filter('');

  if (!map) return;
  if (!view.tools) {
    setHeat(false);
    setTrafficOn(false);
  }
  transitPins.setVisible(key === 'trasporti');
  parkingPins.setVisible(key === 'parcheggio');
  transitPins.select(null);
  parkingPins.select(null);
  updateTheme();
  if (view.camera) moveCamera(map, fitToViewport(view.camera));
}

/* ---------- Avvio ---------- */

$('heat-scale').style.background = HEAT_GRADIENT;
renderAlerts();
bindDisclosure($('account-button'), $('account-panel'));
bindDisclosure($('air-button'), $('air-panel'));

startClock($('clock-date'), $('clock-time'), () => transitPins.refresh());
eventsView.load('data/events.json');

refreshWeather();
refreshAirQuality();
setInterval(() => { refreshWeather(); refreshAirQuality(); }, REFRESH_CONDITIONS_MS);

const crowdFeed = createCrowdFeed();
crowdFeed.subscribe(onCrowdReading);

if (map) {
  // I glifi delle etichette non sono indispensabili: l'avviso riguarda solo la mappa di base.
  map.on('error', ({ error }) => {
    console.warn(error);
    if (!error?.url?.includes('/fonts/')) showMapError('La mappa non è raggiungibile: controlla la connessione a internet.');
  });
  map.on('sourcedata', (event) => {
    if (event.sourceId === 'city' && event.tile) showMapError('');
  });
  styleReady.then(() => {
    registerMapImages(map);
    map.getSource('landmarks').setData(LANDMARKS);
    mapStyled = true;
    updateTheme();
    heatToggle.disabled = false;
    trafficToggle.disabled = false;
    crowdFeed.start();
  });
}

window.addEventListener('hashchange', () => showView(viewFromHash()));
showView(viewFromHash());
