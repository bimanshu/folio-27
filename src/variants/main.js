// Harness entry for variants.html: the real hero page, with the room
// rebuilt in whichever rendering style the picker selects.
import * as THREE from 'three';
import { HOTSPOTS } from '../content.js';
import { renderPixelIcons } from '../pixel-icons.js';
import { initTheme } from '../theme.js';
import { createVariantWorld } from './VariantWorld.js';
import { STYLES } from './styles.js';
import { createPicker } from './picker.js';

renderPixelIcons();

const stage = document.getElementById('stage');
const tip = stage.querySelector('.tip');
const tipLabel = tip.querySelector('.tip__label');
const tipText = tip.querySelector('.tip__text');
const bubble = stage.querySelector('.bubble');
const loading = stage.querySelector('.stage__loading');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let world = null;
let theme = document.documentElement.dataset.theme || 'light';
let visible = true;
let waved = false;

initTheme((next, animate) => {
  theme = next;
  world?.setTheme(next, animate && !reducedMotion);
});

const resize = () => {
  if (!world) return;
  const r = stage.getBoundingClientRect();
  world.setSize(Math.max(1, Math.floor(r.width)), Math.max(1, Math.floor(r.height)));
};
new ResizeObserver(resize).observe(stage);
new IntersectionObserver(([entry]) => {
  visible = entry.isIntersecting;
}).observe(stage);

// --- hover + click, bound to each new canvas --------------------------------
const ndc = new THREE.Vector2();

function showTip(key, x, y) {
  const info = HOTSPOTS[key];
  if (!info) {
    tip.hidden = true;
    return;
  }
  tipLabel.textContent = info.label;
  tipText.textContent = info.text;
  tip.hidden = false;
  const sr = stage.getBoundingClientRect();
  let left = x + 16;
  let top = y + 18;
  if (left + tip.offsetWidth > sr.width - 8) left = x - tip.offsetWidth - 16;
  if (top + tip.offsetHeight > sr.height - 8) top = y - tip.offsetHeight - 14;
  tip.style.transform = `translate(${Math.max(8, left)}px, ${Math.max(8, top)}px)`;
}

function bind(canvas) {
  let downAt = null;
  let pending = null;
  let inside = false;
  let tapTimer = 0;
  const toNdc = (e) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    return r;
  };
  const hover = (e) => {
    const r = toNdc(e);
    const key = world.dragging ? null : world.pick(ndc.x, ndc.y);
    world.setHover(key);
    canvas.style.cursor = world.dragging ? 'grabbing' : key ? 'pointer' : 'grab';
    if (e.pointerType !== 'mouse') return;
    if (key) showTip(key, e.clientX - r.left, e.clientY - r.top);
    else tip.hidden = true;
  };
  canvas.addEventListener('pointermove', (e) => {
    inside = true;
    if (!pending) {
      requestAnimationFrame(() => {
        if (inside && pending && world?.canvas === canvas) hover(pending);
        pending = null;
      });
    }
    pending = e;
  });
  canvas.addEventListener('pointerleave', () => {
    inside = false;
    world?.setHover(null);
    tip.hidden = true;
  });
  canvas.addEventListener('pointerdown', (e) => {
    downAt = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!downAt) return;
    const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
    downAt = null;
    if (moved > 6) return;
    const r = toNdc(e);
    const key = world.pick(ndc.x, ndc.y);
    if (!key) {
      tip.hidden = true;
      return;
    }
    world.activate(key);
    if (e.pointerType !== 'mouse') {
      world.setHover(key);
      showTip(key, e.clientX - r.left, e.clientY - r.top);
      clearTimeout(tapTimer);
      tapTimer = setTimeout(() => {
        tip.hidden = true;
        world?.setHover(null);
      }, 2600);
    }
  });
}

// --- speech bubble ------------------------------------------------------------
const head = new THREE.Vector3();
function placeBubble() {
  const text = world.avatar.bubble;
  if (!text) {
    bubble.hidden = true;
    return;
  }
  if (bubble.textContent !== text) bubble.textContent = text;
  bubble.hidden = false;
  world.avatar.headWorldPosition(head).project(world.camera);
  const x = ((head.x + 1) / 2) * world.size.width;
  const y = ((1 - head.y) / 2) * world.size.height;
  bubble.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
}

// --- swap the whole world when the variant changes ----------------------------
function mount(id) {
  const style = STYLES.find((s) => s.id === id);
  const old = stage.querySelector('.stage__canvas');
  const canvas = document.createElement('canvas');
  canvas.className = 'stage__canvas';
  canvas.id = 'scene';
  canvas.setAttribute('aria-label', old.getAttribute('aria-label'));
  if (world) world.dispose();
  old.replaceWith(canvas);
  tip.hidden = true;
  bubble.hidden = true;

  world = createVariantWorld(canvas, { reducedMotion }, style);
  world.setTheme(theme, false);
  bind(canvas);
  resize();
  stage.classList.add('is-ready');
  loading?.remove();
  world.renderer.setAnimationLoop(() => {
    if (!visible) return;
    world.update();
    placeBubble();
  });
  if (import.meta.env.DEV) window.__world = world;
  if (!waved && !reducedMotion) {
    waved = true;
    setTimeout(() => world.wave(), 1400);
  }
}

stage.querySelector('[data-action="wave"]').addEventListener('click', () => world?.wave());
stage.querySelector('[data-action="reset"]').addEventListener('click', () => world?.resetView());

createPicker(STYLES, mount);
