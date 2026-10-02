import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { World } from '../scene/world.js';
import { TEXTURES } from '../scene/helpers.js';
import { GLOW_LAYER, ROOM } from '../scene/room.js';

// Harness only: renders the production room with a different look.
// Production never imports anything from src/variants.

// What every variant frames: the desk wall, both plants, the chair and rug.
// Tighter than the production fit so the objects read larger.
const FOCUS = {
  x: [ROOM.minX, ROOM.maxX + ROOM.wallT],
  y: [-0.02, ROOM.wallH + 0.03],
  z: [ROOM.minZ - ROOM.wallT, 0.3],
};
const NARROW = { x: [-2.0, 2.1], y: [0.1, 2.55], z: [ROOM.minZ - ROOM.wallT, 0.0] };

export function createVariantWorld(canvas, options, style) {
  TEXTURES.scale = style.textureScale ?? 4;
  try {
    return new VariantWorld(canvas, options, style);
  } finally {
    TEXTURES.scale = 1;
  }
}

class VariantWorld extends World {
  constructor(canvas, options, style) {
    super(canvas, options);
    this.style = style;

    // the production pipeline is a pixel pass; drop it
    this.pixelPass.dispose();
    this.composer.dispose();
    this.renderer.shadowMap.autoUpdate = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.shadowMap.needsUpdate = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.radius = style.shadowRadius ?? 3;

    const base = this.themes;
    this.themes = {
      light: { ...base.light, ...style.themes?.light },
      dark: { ...base.dark, ...style.themes?.dark },
    };

    if (style.perspective) {
      this.controls.dispose();
      this.camera = new THREE.PerspectiveCamera(30, 1, 0.5, 40);
      this.camera.layers.enable(GLOW_LAYER);
      this.view.distance = style.perspective.distance;
      this.target.set(0.06, 1.25, -0.75);
      this.setupControls();
    }

    smoothTextures(this.scene, this.renderer);
    this.screen.texture.magFilter = THREE.LinearFilter;
    this.screen.texture.minFilter = THREE.LinearFilter;

    style.setup(this);

    this.composer = new EffectComposer(
      this.renderer,
      new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }),
    );
    const render = style.renderPass ? style.renderPass(this) : new RenderPass(this.scene, this.camera);
    this.composer.addPass(render);
    style.passes?.(this).forEach((p) => this.composer.addPass(p));
    this.composer.addPass(new OutputPass());
  }

  setSize(width, height) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height, false);
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(width, height);
    this.style.resize?.(this, width * dpr, height * dpr);
    this.fitFrustum(width / height);
    this.size = { width, height };
  }

  _box(aspect) {
    const t = THREE.MathUtils.clamp((1.25 - aspect) / 0.6, 0, 1);
    const lerp = (a, b) => a + (b - a) * t;
    return {
      x: [lerp(FOCUS.x[0], NARROW.x[0]), lerp(FOCUS.x[1], NARROW.x[1])],
      y: [lerp(FOCUS.y[0], NARROW.y[0]), lerp(FOCUS.y[1], NARROW.y[1])],
      z: [FOCUS.z[0], lerp(FOCUS.z[1], NARROW.z[1])],
    };
  }

  // corners of the focus box in the default camera's space
  _corners(aspect) {
    const probe = new THREE.Camera(); // lookAt points -z at the target, like the real camera
    probe.position.setFromSpherical(new THREE.Spherical(this.view.distance, this.view.phi, this.view.theta)).add(this.target);
    probe.lookAt(this.target);
    probe.updateMatrixWorld();
    const inv = probe.matrixWorld.clone().invert();
    const box = this._box(aspect);
    const out = [];
    for (const x of box.x) for (const y of box.y) for (const z of box.z) out.push(new THREE.Vector3(x, y, z).applyMatrix4(inv));
    return { out, probe };
  }

  fitFrustum(aspect) {
    if (!this.camera.isPerspectiveCamera) {
      const { out } = this._corners(aspect);
      const xs = out.map((p) => p.x);
      const ys = out.map((p) => p.y);
      const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
      const pad = 0.035 * (y1 - y0);
      let w = x1 - x0 + pad * 2;
      let h = y1 - y0 + pad * 2;
      if (w / h < aspect) w = h * aspect;
      else h = w / aspect;
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      Object.assign(this.camera, { left: cx - w / 2, right: cx + w / 2, top: cy + h / 2, bottom: cy - h / 2 });
      this.camera.updateProjectionMatrix();
      return;
    }

    // perspective: re-centre the orbit target on the box once, then pick the fov
    const current = new THREE.Spherical().setFromVector3(this.camera.position.clone().sub(this.target));
    for (let pass = 0; pass < 2; pass++) {
      const { out, probe } = this._corners(aspect);
      const sx = out.map((p) => p.x / -p.z);
      const sy = out.map((p) => p.y / -p.z);
      const [x0, x1, y0, y1] = [Math.min(...sx), Math.max(...sx), Math.min(...sy), Math.max(...sy)];
      if (pass === 0) {
        const d = this.view.distance;
        const right = new THREE.Vector3().setFromMatrixColumn(probe.matrixWorld, 0);
        const up = new THREE.Vector3().setFromMatrixColumn(probe.matrixWorld, 1);
        this.target.addScaledVector(right, ((x0 + x1) / 2) * d).addScaledVector(up, ((y0 + y1) / 2) * d);
        continue;
      }
      const tanV = Math.max(Math.abs(y0), Math.abs(y1));
      const tanH = Math.max(Math.abs(x0), Math.abs(x1));
      const tan = Math.max(tanV, tanH / aspect) * 1.04;
      this.camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(tan));
      this.camera.aspect = aspect;
      this.camera.updateProjectionMatrix();
    }
    this.controls.target.copy(this.target);
    this.setView(current.theta, current.phi);
  }

  update() {
    this.style.frame?.(this);
    super.update();
  }

  dispose() {
    disposeWorld(this);
  }
}

// Tears down any world (variant or the production pixel one) before a swap.
export function disposeWorld(world) {
  world.renderer.setAnimationLoop(null);
  world.controls.dispose();
  world.scene.traverse((o) => {
    o.geometry?.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    mats.forEach((m) => {
      m.map?.dispose();
      m.dispose();
    });
  });
  world.composer.dispose?.();
  world.renderer.dispose();
  world.renderer.forceContextLoss();
}

function smoothTextures(scene, renderer) {
  const aniso = renderer.capabilities.getMaxAnisotropy();
  scene.traverse((o) => {
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      const t = m.map;
      if (!t || t.userData.smoothed) continue;
      t.magFilter = THREE.LinearFilter;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.generateMipmaps = true;
      t.anisotropy = aniso;
      t.userData.smoothed = true;
      t.needsUpdate = true;
    }
  });
}
