// Pallini sulla mappa con etichetta laterale (hover, focus o clic per fissarla).

import { Marker } from '../vendor/maplibre-gl.mjs';

// describe(item) → { variant, ariaLabel, label: [nodi] }
export function createPinGroup(map, describe) {
  let pins = [];

  function paint({ item, button, label }) {
    const { variant, ariaLabel, label: nodes } = describe(item);
    button.className = `pin pin--${variant}`;
    button.setAttribute('aria-label', ariaLabel);
    label.replaceChildren(...nodes);
  }

  function setPinned(pin, pinned) {
    pin.button.setAttribute('aria-pressed', String(pinned));
  }

  function createPin(item) {
    const button = document.createElement('button');
    button.type = 'button';
    const label = document.createElement('span');
    label.className = 'pin__label';
    label.setAttribute('aria-hidden', 'true');
    button.append(label);

    const pin = { item, button, label, marker: new Marker({ element: button }).setLngLat(item.position) };
    setPinned(pin, false);
    paint(pin);
    button.addEventListener('click', () => setPinned(pin, button.getAttribute('aria-pressed') !== 'true'));
    return pin;
  }

  return {
    setItems(items) {
      for (const pin of pins) pin.marker.remove();
      pins = items.map(createPin);
    },
    setVisible(visible) {
      for (const pin of pins) {
        if (visible) pin.marker.addTo(map);
        else pin.marker.remove();
      }
    },
    refresh() { pins.forEach(paint); },
    // Fissa l'etichetta di un solo pallino; senza id le sgancia tutte.
    select(id) {
      for (const pin of pins) setPinned(pin, pin.item.id === id);
    },
  };
}

export function labelPart(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}
