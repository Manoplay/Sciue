// Sezione Eventi: cards orizzontali con foto, titolo, descrizione, ora e giorno.

import { formatDay } from './conditions.js';

const template = document.getElementById('event-template');

function eventDate(event) {
  const date = new Date();
  date.setDate(date.getDate() + event.dayOffset);
  return date;
}

function createCard(event) {
  const card = template.content.cloneNode(true);
  const date = eventDate(event);
  const fill = (field, text) => { card.querySelector(`[data-field="${field}"]`).textContent = text; };

  fill('title', event.title);
  fill('description', event.description);
  fill('place', event.place);
  fill('time', event.time);
  fill('day', formatDay(date));
  card.querySelector('[data-field="time"]').dateTime = event.time;
  card.querySelector('[data-field="day"]').dateTime = date.toISOString().slice(0, 10);

  if (event.photo) {
    const image = new Image(412, 384);
    image.src = event.photo;
    image.alt = event.photoAlt ?? '';
    image.loading = 'lazy';
    // Se la foto non si carica, l'immagine si toglie e torna visibile il segnaposto.
    image.addEventListener('error', () => image.remove());
    card.querySelector('.event__photo').append(image);
  }
  if (event.credit) {
    const link = card.querySelector('[data-field="credit"]');
    link.textContent = event.credit.text;
    link.href = event.credit.url;
    link.parentElement.hidden = false;
  }
  return card;
}

export function createEventsView(list, message) {
  let events = null;

  function showMessage(text) {
    message.textContent = text;
    message.hidden = !text;
  }

  function render(query = '') {
    if (!events) return;
    const needle = query.toLowerCase();
    const matches = events.filter((event) =>
      [event.title, event.description, event.place].some((text) => text.toLowerCase().includes(needle)));
    list.replaceChildren(...matches.map(createCard));
    const emptyText = query ? `Nessun evento corrisponde a “${query}”.` : 'Nessun evento in programma.';
    showMessage(matches.length ? '' : emptyText);
  }

  return {
    async load(url) {
      showMessage('Caricamento degli eventi…');
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Eventi: ${response.status}`);
        events = (await response.json()).events;
        render();
      } catch (error) {
        console.warn(error);
        showMessage('Non è stato possibile caricare gli eventi. Riprova più tardi.');
      }
    },
    filter: render,
  };
}
