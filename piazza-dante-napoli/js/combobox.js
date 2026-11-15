// Barra di ricerca con elenco di suggerimenti. Il comportamento cambia con la vista:
// configure({ label, placeholder, openOnFocus, emptyMessage, getOptions, onSelect, onSubmit, onInput })

export function createCombobox({ form, input, list, status, label }) {
  let mode = {};
  let options = [];
  let activeIndex = -1;

  function setActive(index) {
    activeIndex = index;
    [...list.children].forEach((node, i) => node.setAttribute('aria-selected', String(i === index)));
    if (index >= 0) input.setAttribute('aria-activedescendant', list.children[index].id);
    else input.removeAttribute('aria-activedescendant');
  }

  function close() {
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    setActive(-1);
  }

  function open() {
    const query = input.value.trim();
    options = mode.getOptions ? mode.getOptions(query) : [];
    list.replaceChildren(...options.map((option, index) => {
      const item = document.createElement('li');
      item.id = `search-option-${index}`;
      item.className = 'search__option';
      item.setAttribute('role', 'option');
      item.textContent = option.label;
      if (option.hint) {
        const hint = document.createElement('span');
        hint.className = 'search__hint';
        hint.textContent = option.hint;
        item.append(hint);
      }
      return item;
    }));
    const wantsList = mode.getOptions && (query || mode.openOnFocus);
    list.hidden = !wantsList || !options.length;
    input.setAttribute('aria-expanded', String(!list.hidden));
    setActive(-1);
    status.textContent = wantsList && query && !options.length ? mode.emptyMessage ?? '' : '';
  }

  function select(option) {
    input.value = option.label;
    close();
    status.textContent = '';
    mode.onSelect?.(option);
  }

  async function submit() {
    const query = input.value.trim();
    if (activeIndex >= 0) return select(options[activeIndex]);
    if (options.length) return select(options[0]);
    if (!query || !mode.onSubmit) return;
    close();
    status.textContent = 'Ricerca in corso…';
    status.textContent = (await mode.onSubmit(query)) ?? '';
  }

  input.addEventListener('input', () => {
    mode.onInput?.(input.value.trim());
    open();
  });
  input.addEventListener('focus', () => { if (mode.openOnFocus) open(); });
  input.addEventListener('blur', close);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') return close();
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    if (list.hidden) open();
    if (!options.length) return;
    const step = event.key === 'ArrowDown' ? 1 : -1;
    setActive((activeIndex + step + options.length) % options.length);
  });
  // pointerdown anziché click: evita che il blur chiuda l'elenco prima della scelta.
  list.addEventListener('pointerdown', (event) => {
    const item = event.target.closest('[role="option"]');
    if (!item) return;
    event.preventDefault();
    select(options[[...list.children].indexOf(item)]);
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submit();
  });

  return {
    configure(nextMode) {
      mode = nextMode;
      label.textContent = mode.label;
      input.placeholder = mode.placeholder;
      input.value = '';
      status.textContent = '';
      close();
    },
  };
}
