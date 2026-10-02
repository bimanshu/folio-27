import * as THREE from 'three';
import { Pass } from 'three/addons/postprocessing/Pass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLOW_LAYER } from '../scene/room.js';

// Four answers to one brief: the same room, drawn by a different renderer.
// The axis is the rendering language; framing, content and lighting rig stay put.

// --- shared helpers ---------------------------------------------------------

function convertMaterials(world, make) {
  const done = new Map();
  const convert = (m) => {
    if (!m.isMeshLambertMaterial) return m;
    if (!done.has(m)) {
      const next = make(m);
      next.userData = { ...m.userData, ...next.userData };
      done.set(m, next);
      m.dispose();
    }
    return done.get(m);
  };
  world.scene.traverse((o) => {
    if (!o.isMesh) return;
    o.material = Array.isArray(o.material) ? o.material.map(convert) : convert(o.material);
  });
  if (done.has(world.lamp.shadeMat)) world.lamp.shadeMat = done.get(world.lamp.shadeMat);
  return [...done.values()];
}

const props = (m) => ({
  color: m.color.clone(),
  map: m.map,
  emissive: m.emissive.clone(),
  emissiveIntensity: m.emissiveIntensity,
  vertexColors: m.vertexColors,
  transparent: m.transparent,
  opacity: m.opacity,
  side: m.side,
});

function environment(world) {
  const pmrem = new THREE.PMREMGenerator(world.renderer);
  world.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
}

const lerp = (a, b, t) => a + (b - a) * t;

// --- 1. Clay: soft matte miniature ------------------------------------------

function roundBoxes(scene) {
  const cache = new Map();
  scene.traverse((o) => {
    if (!o.isMesh || o.geometry.type !== 'BoxGeometry') return;
    const p = o.geometry.parameters;
    if (p.widthSegments > 1 || p.heightSegments > 1 || p.depthSegments > 1) return; // tapered leaves
    const r = Math.min(0.05, Math.min(p.width, p.height, p.depth) * 0.42);
    if (r < 0.0025) return;
    const key = `${p.width}|${p.height}|${p.depth}`;
    if (!cache.has(key)) cache.set(key, new RoundedBoxGeometry(p.width, p.height, p.depth, 3, r));
    o.geometry.dispose();
    o.geometry = cache.get(key);
  });
}

const clay = {
  id: 'clay',
  label: 'Clay',
  perspective: { distance: 9 },
  shadowRadius: 10,
  themes: {
    light: { hemi: 0.8, sunI: 2.6 },
    dark: { hemi: 0.5, sunI: 0.35, fillI: 0.9 },
  },
  setup(world) {
    roundBoxes(world.scene);
    convertMaterials(world, (m) => {
      const p = props(m);
      // a touch lighter and softer, like painted modelling clay
      if (!p.map && !p.vertexColors) p.color.lerp(new THREE.Color('#fff3e6'), 0.14);
      return new THREE.MeshStandardMaterial({ ...p, roughness: 0.92, metalness: 0 });
    });
    environment(world);
    world.renderer.toneMapping = THREE.NeutralToneMapping;
    world.renderer.toneMappingExposure = 1.0;
  },
  frame(world) {
    world.scene.environmentIntensity = lerp(0.45, 0.1, world.mix);
  },
};

// --- 2. Toon: cel shading with ink outlines ---------------------------------

class OutlineRenderPass extends Pass {
  constructor(effect, scene, camera) {
    super();
    this.effect = effect;
    this.scene = scene;
    this.camera = camera;
    this.needsSwap = false;
  }

  render(renderer, writeBuffer, readBuffer) {
    renderer.setRenderTarget(this.renderToScreen ? null : readBuffer);
    renderer.clear();
    this.effect.render(this.scene, this.camera);
  }
}

const OUTLINE = { thickness: 0.005, color: [0.07, 0.05, 0.04], alpha: 1 };
const NO_OUTLINE = { visible: false };

const toon = {
  id: 'toon',
  label: 'Toon',
  shadowRadius: 1,
  themes: {
    light: { hemi: 1.5, sunI: 2.8 },
    dark: { hemi: 0.9, sunI: 0.5 },
  },
  setup(world) {
    const tones = new Uint8Array([90, 170, 255]);
    const gradientMap = new THREE.DataTexture(tones, tones.length, 1, THREE.RedFormat);
    gradientMap.minFilter = gradientMap.magFilter = THREE.NearestFilter;
    gradientMap.needsUpdate = true;
    const hsl = {};
    convertMaterials(world, (m) => {
      const p = props(m);
      if (!p.map && !p.vertexColors) {
        p.color.getHSL(hsl);
        p.color.setHSL(hsl.h, Math.min(1, hsl.s * 1.25), hsl.l);
      }
      const t = new THREE.MeshToonMaterial({ ...p, gradientMap });
      return t;
    }).forEach((m) => {
      m.userData.outlineParameters = OUTLINE;
    });
    // glowing bits, the screen and the flame stay unoutlined
    world.scene.traverse((o) => {
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      mats.forEach((m) => {
        if (m.isMeshBasicMaterial) m.userData.outlineParameters = NO_OUTLINE;
      });
    });
    world.outline = new OutlineEffect(world.renderer, { defaultThickness: OUTLINE.thickness });
    world.renderer.toneMapping = THREE.NoToneMapping;
  },
  renderPass: (world) => new OutlineRenderPass(world.outline, world.scene, world.camera),
  frame(world) {
    // ink goes from warm brown-black by day to deep indigo at night
    OUTLINE.color[0] = lerp(0.09, 0.03, world.mix);
    OUTLINE.color[1] = lerp(0.06, 0.03, world.mix);
    OUTLINE.color[2] = lerp(0.04, 0.09, world.mix);
  },
};

// --- 3. Ink: architectural line drawing / blueprint at night ----------------

const PAPER = new THREE.Color('#fbf7ef');
const NIGHT = new THREE.Color('#1b2647');
const INK = new THREE.Color('#2a221d');
const CHALK = new THREE.Color('#dce6ff');

const ink = {
  id: 'ink',
  label: 'Ink',
  shadowRadius: 4,
  themes: {
    light: { hemi: 2.5, sunI: 1.5, sky: new THREE.Color('#fffaf2'), ground: new THREE.Color('#d8cfc2') },
    dark: { hemi: 1.6, sunI: 0.3, sky: new THREE.Color('#9db0e8'), ground: new THREE.Color('#2a2f55') },
  },
  setup(world) {
    // posters and prints keep their colour; everything else is a paper wash
    const artwork = new Set();
    world.scene.traverse((o) => {
      if (o.isMesh && (o.userData.hotspot === 'posters' || o.userData.hotspot === 'frames')) {
        [].concat(o.material).forEach((m) => artwork.add(m));
      }
    });
    const wash = { uWash: { value: 0.6 }, uWashColor: { value: PAPER.clone() } };
    const artWash = { uWash: { value: 0 }, uWashColor: { value: PAPER.clone() } };
    world.inkWash = { wash, artWash };
    convertMaterials(world, (m) => {
      const n = new THREE.MeshLambertMaterial(props(m));
      const u = artwork.has(m) ? artWash : wash;
      n.onBeforeCompile = (shader) => {
        shader.uniforms.uWash = u.uWash;
        shader.uniforms.uWashColor = u.uWashColor;
        shader.fragmentShader = `uniform float uWash;\nuniform vec3 uWashColor;\n${shader.fragmentShader}`.replace(
          '#include <color_fragment>',
          '#include <color_fragment>\n  diffuseColor.rgb = mix( diffuseColor.rgb, uWashColor, uWash );',
        );
      };
      return n;
    });
    world.inkLine = new THREE.LineBasicMaterial({ color: INK.clone() });
    const meshes = [];
    world.scene.traverse((o) => {
      if (!o.isMesh) return;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      if (!m.isMeshBasicMaterial) meshes.push(o);
    });
    for (const o of meshes) {
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 28), world.inkLine);
      edges.layers.set(GLOW_LAYER);
      edges.raycast = () => {};
      o.add(edges);
    }
    world.sun.shadow.intensity = 0.45;
    world.renderer.toneMapping = THREE.NoToneMapping;
  },
  frame(world) {
    const { wash, artWash } = world.inkWash;
    const m = world.mix;
    wash.uWashColor.value.copy(PAPER).lerp(NIGHT, m);
    artWash.uWashColor.value.copy(wash.uWashColor.value);
    wash.uWash.value = lerp(0.6, 0.72, m);
    artWash.uWash.value = lerp(0, 0.3, m);
    world.inkLine.color.copy(INK).lerp(CHALK, m);
  },
};

// --- 4. Studio: realistic product render ------------------------------------

const studio = {
  id: 'studio',
  label: 'Studio',
  perspective: { distance: 6.5 },
  shadowRadius: 2,
  themes: {
    light: { hemi: 0.45, sunI: 2.7, glow: 0.12 },
    dark: { hemi: 0.32, sunI: 0.35, glow: 0.4, lampI: 1.5, fairy: 0.5, bulb: 1.15 },
  },
  setup(world) {
    convertMaterials(world, (m) => {
      const p = props(m);
      const lum = p.color.r * 0.2126 + p.color.g * 0.7152 + p.color.b * 0.0722;
      let roughness = 0.55;
      if (p.map) roughness = 0.78; // paper, fabric, wood
      else if (p.vertexColors) roughness = 0.6; // leaves
      else if (lum < 0.03) roughness = 0.32; // black plastics: monitor, chair, pots
      else if (lum > 0.75) roughness = 0.42; // white desk, console, ceramics
      return new THREE.MeshStandardMaterial({ ...p, roughness, metalness: 0 });
    });
    environment(world);
    world.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    // bloom does the glowing here, so the painted-on glow sprites shrink
    world.scene.traverse((o) => {
      if (o.isSprite) o.scale.multiplyScalar(0.45);
    });
    world.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0, 0.35, 1.0);
  },
  passes: (world) => [world.bloom],
  frame(world) {
    const m = world.mix;
    world.scene.environmentIntensity = lerp(0.6, 0.08, m);
    world.bloom.strength = lerp(0, 0.3, m);
    world.bloom.enabled = world.bloom.strength > 0.01;
    world.renderer.toneMappingExposure = lerp(0.95, 1.15, m);
  },
};

export const STYLES = [clay, toon, ink, studio];
