// Variant picker: deliberately outside the design system (see
// .claude/skills/variant/picker.md). The URL is the source of truth.

const CSS = `
.variant-picker {
  position: fixed;
  top: calc(16px + env(safe-area-inset-top, 0px));
  left: 50%;
  translate: -50% 0;
  z-index: 2147483647;
  display: flex;
  gap: 2px;
  padding: 4px;
  border-radius: 999px;
  background: rgb(20 20 20 / 0.9);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.1), 0 8px 24px rgb(0 0 0 / 0.25);
  font: 13px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  user-select: none;
}
.variant-picker button {
  padding: 7px 14px;
  border: 0;
  border-radius: 999px;
  background: none;
  color: rgb(255 255 255 / 0.6);
  font: inherit;
  cursor: pointer;
}
.variant-picker button:hover { color: rgb(255 255 255 / 0.85); }
.variant-picker button[aria-current="true"] { background: rgb(255 255 255 / 0.14); color: rgb(255 255 255); }
.variant-picker button:focus-visible { outline: 2px solid rgb(255 255 255 / 0.7); outline-offset: 2px; }
/* the picker sits top centre (the room fills the bottom); on narrow
   screens push the page down so it never covers the brand or toggle */
@media (max-width: 760px) { body { padding-top: 52px; } }
`;

function readVariant(ids) {
  let id = null;
  try {
    id = new URLSearchParams(window.location.search).get('variant');
  } catch {
    id = null;
  }
  if (!ids.includes(id)) {
    const hash = window.location.hash.slice(1);
    id = ids.includes(hash) ? hash : null;
  }
  return id || ids[0];
}

function writeVariant(id) {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('variant', id);
    window.history.replaceState(null, '', url);
  } catch {
    // sandboxed frames may refuse; the picker still works in-page
  }
}

export function createPicker(variants, onChange) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.append(style);

  const ids = variants.map((v) => v.id);
  const nav = document.createElement('nav');
  nav.className = 'variant-picker';
  nav.setAttribute('aria-label', 'Variants');
  const buttons = variants.map((v) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.variant = v.id;
    b.textContent = v.label;
    b.addEventListener('click', () => select(v.id));
    nav.append(b);
    return b;
  });
  document.body.append(nav);

  let current = null;
  function select(id) {
    if (id === current) return;
    current = id;
    buttons.forEach((b) => b.setAttribute('aria-current', String(b.dataset.variant === id)));
    writeVariant(id);
    onChange(id);
  }

  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
    const i = ids.indexOf(current);
    if (e.key === 'ArrowRight') select(ids[(i + 1) % ids.length]);
    else if (e.key === 'ArrowLeft') select(ids[(i - 1 + ids.length) % ids.length]);
    else if (/^[1-9]$/.test(e.key) && ids[+e.key - 1]) select(ids[+e.key - 1]);
  });

  select(readVariant(ids));
}
