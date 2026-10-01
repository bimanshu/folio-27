import * as THREE from 'three';
import { HOTSPOTS } from './content.js';
import { renderPixelIcons } from './pixel-icons.js';
import { initTheme } from './theme.js';

renderPixelIcons();

const stage = document.getElementById('stage');
const canvas = document.getElementById('scene');
const tip = stage.querySelector('.tip');
const tipLabel = tip.querySelector('.tip__label');
const tipText = tip.querySelector('.tip__text');
const bubble = stage.querySelector('.bubble');
const loading = stage.querySelector('.stage__loading');
const fallback = stage.querySelector('.stage__fallback');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGL2RenderingContext && c.getContext('webgl2'));
  } catch {
    return false;
  }
}

async function start() {
  if (!webglAvailable()) {
    loading.remove();
    fallback.hidden = false;
    initTheme(() => {});
    return;
  }

  const { World } = await import('./scene/world.js');
  const world = new World(canvas, { reducedMotion });
  initTheme((theme, animate) => world.setTheme(theme, animate && !reducedMotion));

  // size the renderer to the stage box
  const resize = () => {
    const r = stage.getBoundingClientRect();
    world.setSize(Math.max(1, Math.floor(r.width)), Math.max(1, Math.floor(r.height)));
  };
  new ResizeObserver(resize).observe(stage);
  resize();

  // --- hover + click -------------------------------------------------------
  const ndc = new THREE.Vector2();
  let downAt = null;
  let pointerType = 'mouse';
  let tapTimer = 0;

  const toNdc = (e) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    return r;
  };

  const showTip = (key, x, y) => {
    const info = HOTSPOTS[key];
    if (!info) {
      tip.hidden = true;
      return;
    }
    tipLabel.textContent = info.label;
    tipText.textContent = info.text;
    tip.hidden = false;
    const sr = stage.getBoundingClientRect();
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    let left = x + 16;
    let top = y + 18;
    if (left + w > sr.width - 8) left = x - w - 16;
    if (top + h > sr.height - 8) top = y - h - 14;
    tip.style.transform = `translate(${Math.max(8, left)}px, ${Math.max(8, top)}px)`;
  };

  const hover = (e) => {
    const r = toNdc(e);
    const key = world.dragging ? null : world.pick(ndc.x, ndc.y);
    world.setHover(key);
    canvas.style.cursor = world.dragging ? 'grabbing' : key ? 'pointer' : 'grab';
    if (key && pointerType === 'mouse') showTip(key, e.clientX - r.left, e.clientY - r.top);
    else if (pointerType === 'mouse') tip.hidden = true;
  };

  // raycast at most once per frame
  let pendingMove = null;
  let inside = false;
  canvas.addEventListener('pointermove', (e) => {
    pointerType = e.pointerType;
    inside = true;
    if (!pendingMove) {
      requestAnimationFrame(() => {
        if (inside && pendingMove) hover(pendingMove);
        pendingMove = null;
      });
    }
    pendingMove = e;
  });
  canvas.addEventListener('pointerleave', () => {
    inside = false;
    world.setHover(null);
    tip.hidden = true;
  });
  canvas.addEventListener('pointerdown', (e) => {
    pointerType = e.pointerType;
    downAt = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!downAt) return;
    const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
    downAt = null;
    if (moved > 6) return; // that was a drag
    const r = toNdc(e);
    const key = world.pick(ndc.x, ndc.y);
    if (!key) {
      tip.hidden = true;
      return;
    }
    world.activate(key);
    // touch has no hover, so a tap shows the label too
    if (e.pointerType !== 'mouse') {
      world.setHover(key);
      showTip(key, e.clientX - r.left, e.clientY - r.top);
      clearTimeout(tapTimer);
      tapTimer = setTimeout(() => {
        tip.hidden = true;
        world.setHover(null);
      }, 2600);
    }
  });

  stage.querySelector('[data-action="wave"]').addEventListener('click', () => world.wave());
  stage.querySelector('[data-action="reset"]').addEventListener('click', () => world.resetView());

  // --- speech bubble follows the avatar's head ------------------------------
  const head = new THREE.Vector3();
  const placeBubble = () => {
    const text = world.avatar.bubble;
    if (!text) {
      if (!bubble.hidden) bubble.hidden = true;
      return;
    }
    if (bubble.textContent !== text) bubble.textContent = text;
    bubble.hidden = false;
    world.avatar.headWorldPosition(head).project(world.camera);
    const x = ((head.x + 1) / 2) * world.size.width;
    const y = ((1 - head.y) / 2) * world.size.height;
    bubble.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
  };

  // --- loop, paused while the stage is off-screen ---------------------------
  let visible = true;
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
  }).observe(stage);

  let first = true;
  world.renderer.setAnimationLoop(() => {
    if (!visible) return;
    world.update();
    placeBubble();
    if (first) {
      first = false;
      stage.classList.add('is-ready');
      setTimeout(() => loading.remove(), 600);
    }
  });

  if (import.meta.env.DEV) window.__world = world; // poke at the scene from devtools

  // say hello once the room has faded in
  if (!reducedMotion) setTimeout(() => world.wave(), 1400);
}

start();
