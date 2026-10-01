import { RenderPixelatedPass } from 'three/addons/postprocessing/RenderPixelatedPass.js';

// three's RenderPixelatedPass, with two tweaks:
//  - objects on `glowLayer` (sprites, wires) render in the beauty pass but
//    are skipped in the normal pass, so they don't produce outline artefacts;
//  - edge darkening only touches RGB so the transparent background survives.
export class PixelPass extends RenderPixelatedPass {
  constructor(pixelSize, scene, camera, options = {}, glowLayer = 1) {
    super(pixelSize, scene, camera, options);
    this.glowLayer = glowLayer;
    this.pixelatedMaterial.fragmentShader = this.pixelatedMaterial.fragmentShader.replace(
      'gl_FragColor = texel * Strength;',
      'gl_FragColor = vec4( texel.rgb * Strength, texel.a );',
    );
  }

  render(renderer, writeBuffer) {
    const uniforms = this._fsQuad.material.uniforms;
    uniforms.normalEdgeStrength.value = this.normalEdgeStrength;
    uniforms.depthEdgeStrength.value = this.depthEdgeStrength;

    this.camera.layers.enable(this.glowLayer);
    renderer.shadowMap.needsUpdate = true; // shadows once per frame, not per pass
    renderer.setRenderTarget(this._beautyRenderTarget);
    renderer.render(this.scene, this.camera);

    this.camera.layers.disable(this.glowLayer);
    const previous = this.scene.overrideMaterial;
    renderer.setRenderTarget(this._normalRenderTarget);
    this.scene.overrideMaterial = this._normalMaterial;
    renderer.render(this.scene, this.camera);
    this.scene.overrideMaterial = previous;
    this.camera.layers.enable(this.glowLayer);

    uniforms.tDiffuse.value = this._beautyRenderTarget.texture;
    uniforms.tDepth.value = this._beautyRenderTarget.depthTexture;
    uniforms.tNormal.value = this._normalRenderTarget.texture;

    if (this.renderToScreen) {
      renderer.setRenderTarget(null);
    } else {
      renderer.setRenderTarget(writeBuffer);
      if (this.clear) renderer.clear();
    }
    this._fsQuad.render(renderer);
  }
}
