/* DOM-only dropdowns for embedded Wallpaper Engine CEF.
 * Native <select> rendering can terminate the embedded renderer. Original
 * selects remain hidden as the value/event interface used by gallery.js. */
(function () {
  'use strict';
  const states = new Map();
  let opened = null;

  function closeAll(focus) {
    if (!opened) return;
    const state = opened;
    opened = null;
    state.menu.hidden = true;
    state.button.setAttribute('aria-expanded', 'false');
    state.button.removeAttribute('aria-activedescendant');
    state.wrapper.classList.remove('is-open');
    if (focus && !state.button.disabled) state.button.focus({ preventScroll: true });
  }
  function activate(state, index) {
    const options = [...state.select.options];
    if (!options.length) return;
    index = Math.max(0, Math.min(options.length - 1, index));
    if (options[index].disabled) {
      const usable = options.findIndex(option => !option.disabled);
      if (usable < 0) return;
      index = usable;
    }
    state.active = index;
    for (let i = 0; i < state.menu.children.length; i++) state.menu.children[i].classList.toggle('is-active', i === index);
    const option = state.menu.children[index];
    if (option) {
      state.button.setAttribute('aria-activedescendant', option.id);
      const top = option.offsetTop, bottom = top + option.offsetHeight;
      if (top < state.menu.scrollTop) state.menu.scrollTop = top;
      else if (bottom > state.menu.scrollTop + state.menu.clientHeight) state.menu.scrollTop = bottom - state.menu.clientHeight;
    }
  }
  function open(state) {
    if (state.select.disabled) return;
    closeAll(false);
    sync(state);
    opened = state;
    state.menu.hidden = false;
    state.button.setAttribute('aria-expanded', 'true');
    state.wrapper.classList.add('is-open');
    const panel = document.getElementById('artwork-panel');
    const bounds = panel ? panel.getBoundingClientRect() : { top: 0, bottom: innerHeight };
    const button = state.button.getBoundingClientRect();
    const below = Math.max(0, bounds.bottom - button.bottom - 5);
    const above = Math.max(0, button.top - bounds.top - 5);
    const natural = Math.min(160, state.menu.scrollHeight);
    const upward = below < natural && above > below;
    state.wrapper.classList.toggle('opens-up', upward);
    state.menu.style.maxHeight = Math.max(24, Math.min(160, upward ? above : below)) + 'px';
    activate(state, Math.max(0, state.select.selectedIndex));
  }
  function choose(state, index) {
    const option = state.select.options[index];
    if (!option || option.disabled) return;
    state.select.value = option.value;
    closeAll(true);
    sync(state);
    state.select.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function step(state, direction) {
    const length = state.select.options.length;
    let index = state.active;
    for (let i = 0; i < length; i++) {
      index = Math.max(0, Math.min(length - 1, index + direction));
      if (!state.select.options[index].disabled) { activate(state, index); return; }
    }
  }
  function sync(state) {
    const select = state.select, options = [...select.options];
    const selected = options[select.selectedIndex];
    state.value.textContent = selected ? selected.textContent : '';
    state.button.disabled = select.disabled;
    state.button.setAttribute('aria-disabled', String(select.disabled));
    const signature = options.map(option => [option.value, option.textContent, option.disabled].join('\u0001')).join('\u0002');
    if (signature !== state.signature) {
      state.signature = signature;
      state.menu.replaceChildren();
      options.forEach((option, index) => {
        const row = document.createElement('div');
        row.id = select.id + '-option-' + index;
        row.className = 'custom-select-option';
        row.setAttribute('role', 'option');
        row.setAttribute('aria-disabled', String(option.disabled));
        row.dataset.index = String(index);
        row.textContent = option.textContent;
        state.menu.appendChild(row);
      });
    }
    for (let i = 0; i < state.menu.children.length; i++) {
      state.menu.children[i].setAttribute('aria-selected', String(i === select.selectedIndex));
    }
    if (opened === state) activate(state, state.active);
  }
  function initialize(select) {
    if (states.has(select)) return;
    const wrapper = document.createElement('div'); wrapper.className = 'custom-select';
    const button = document.createElement('button');
    button.id = select.id + '-control'; button.type = 'button'; button.className = 'custom-select-button';
    button.setAttribute('role', 'combobox'); button.setAttribute('aria-haspopup', 'listbox');
    button.setAttribute('aria-expanded', 'false'); button.setAttribute('aria-controls', select.id + '-listbox');
    const value = document.createElement('span'); value.className = 'custom-select-value'; value.id = select.id + '-value';
    const arrow = document.createElement('span'); arrow.className = 'custom-select-chevron'; arrow.setAttribute('aria-hidden', 'true');
    button.append(value, arrow);
    const menu = document.createElement('div'); menu.id = select.id + '-listbox'; menu.className = 'custom-select-list';
    menu.setAttribute('role', 'listbox'); menu.hidden = true;
    const label = select.closest('label'), caption = label && label.querySelector('span');
    if (caption) {
      if (!caption.id) caption.id = select.id + '-label';
      button.setAttribute('aria-labelledby', caption.id + ' ' + value.id);
      menu.setAttribute('aria-labelledby', caption.id);
    } else button.setAttribute('aria-label', select.getAttribute('aria-label') || select.title || 'Select an option');
    if (label) label.addEventListener('click', event => {
      event.preventDefault();
      if (!wrapper.contains(event.target)) button.focus({ preventScroll: true });
    });
    select.tabIndex = -1;
    select.setAttribute('aria-hidden', 'true');
    wrapper.append(button, menu); select.insertAdjacentElement('afterend', wrapper);
    const state = { select, wrapper, button, value, menu, active: 0, signature: null };
    states.set(select, state);
    button.addEventListener('click', event => {
      event.preventDefault();
      if (opened === state) closeAll(false); else open(state);
    });
    button.addEventListener('keydown', event => {
      const key = event.key;
      if (['ArrowLeft', 'ArrowRight'].includes(key)) { event.stopPropagation(); return; }
      if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' ', 'Escape'].includes(key)) {
        event.preventDefault(); event.stopPropagation();
        if (key === 'Escape') { closeAll(true); return; }
        if (key === 'Enter' || key === ' ') {
          if (opened === state) choose(state, state.active); else open(state);
        } else if (key === 'Home' || key === 'End') {
          if (opened !== state) open(state);
          activate(state, key === 'Home' ? 0 : select.options.length - 1);
        } else if (opened !== state) open(state);
        else step(state, key === 'ArrowDown' ? 1 : -1);
      } else if (key === 'Tab') closeAll(false);
      else if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault(); event.stopPropagation();
        if (opened !== state) open(state);
        const options = [...select.options], character = key.toLocaleLowerCase();
        for (let n = 1; n <= options.length; n++) {
          const index = (state.active + n) % options.length;
          if (!options[index].disabled && options[index].textContent.trim().toLocaleLowerCase().startsWith(character)) { activate(state, index); break; }
        }
      }
    });
    menu.addEventListener('pointerdown', event => event.preventDefault());
    menu.addEventListener('mousedown', event => event.preventDefault());
    menu.addEventListener('click', event => {
      const row = event.target.closest('.custom-select-option');
      if (row && menu.contains(row)) { event.preventDefault(); choose(state, Number(row.dataset.index)); }
    });
    select.addEventListener('change', () => sync(state));
    button.addEventListener('blur', event => { if (opened === state && !wrapper.contains(event.relatedTarget)) closeAll(false); });
    sync(state);
  }
  function syncAll() {
    document.querySelectorAll('.filter-field select').forEach(initialize);
    for (const state of states.values()) sync(state);
  }
  for (const type of ['pointerdown', 'mousedown']) window.addEventListener(type, event => {
    if (opened && !opened.wrapper.contains(event.target)) closeAll(false);
  }, true);
  window.addEventListener('resize', () => closeAll(false));
  window.addEventListener('blur', () => closeAll(false));
  document.addEventListener('visibilitychange', () => { if (document.hidden) closeAll(false); });
  window.CustomSelects = { syncAll, closeAll, isOpen: () => Boolean(opened) };
  syncAll();
}());
