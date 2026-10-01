const KEY = 'folio-theme';

function readStored() {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function store(theme) {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // private mode / blocked storage: the toggle still works for this visit
  }
}

// Wires the header toggle; calls onChange(theme, animate) on every switch.
export function initTheme(onChange) {
  const root = document.documentElement;
  const button = document.querySelector('.theme-toggle');
  const label = button?.querySelector('.theme-toggle__label');
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  let explicit = readStored();
  let theme = root.dataset.theme || explicit || (media.matches ? 'dark' : 'light');

  const apply = (next, animate) => {
    theme = next;
    root.dataset.theme = next;
    if (button) {
      const dark = next === 'dark';
      button.setAttribute('aria-pressed', String(dark));
      button.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
      if (label) label.textContent = dark ? 'dark' : 'light';
    }
    onChange(next, animate);
  };

  button?.addEventListener('click', () => {
    explicit = theme === 'dark' ? 'light' : 'dark';
    store(explicit);
    apply(explicit, true);
  });

  media.addEventListener('change', (e) => {
    if (!explicit) apply(e.matches ? 'dark' : 'light', true);
  });

  // If something else flips the attribute (e.g. a page embedding this one),
  // follow it so the room and the toggle never disagree with the CSS.
  new MutationObserver(() => {
    const next = root.dataset.theme;
    if ((next === 'dark' || next === 'light') && next !== theme) apply(next, true);
  }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });

  apply(theme, false);
  return () => theme;
}
