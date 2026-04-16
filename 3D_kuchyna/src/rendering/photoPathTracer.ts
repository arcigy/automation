import * as THREE from "three";
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass.js";
import { DynamicPathTracingSceneGenerator, PathTracingRenderer, PhysicalPathTracingMaterial } from "three-gpu-pathtracer";

export type PhotoPathTracer = {
  setSize: (w: number, h: number) => void;
  renderSample: () => void;
  reset: () => void;
  updateFromScene: () => void;
  updateCamera: () => void;
  dispose: () => void;
  getSamples: () => number;
  setMaxSamples: (n: number) => void;
  getMaxSamples: () => number;
};

export function createPhotoPathTracer(args: {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
}): PhotoPathTracer {
  const ptMaterial = new PhysicalPathTracingMaterial();
  const ptRenderer = new PathTracingRenderer(args.renderer);
  ptRenderer.camera = args.camera;
  ptRenderer.material = ptMaterial;
  ptRenderer.alpha = false;

  const screenMat = new THREE.MeshBasicMaterial({ map: ptRenderer.target.texture });
  const screenQuad = new FullScreenQuad(screenMat);

  const generator = new DynamicPathTracingSceneGenerator(args.scene);

  let maxSamples = 256;

  const setMaxSamples = (n: number) => {
    if (!Number.isFinite(n)) return;
    maxSamples = Math.max(1, Math.min(4096, Math.floor(n)));
  };

  const syncScene = () => {
    const { bvh, materials, textures, lights } = generator.generate();
    const geometry = generator.geometry;

    ptMaterial.bvh.updateFrom(bvh);
    ptMaterial.attributesArray.updateFrom(
      geometry.attributes.normal,
      geometry.attributes.tangent,
      geometry.attributes.uv,
      geometry.attributes.color
    );
    ptMaterial.materialIndexAttribute.updateFrom(geometry.attributes.materialIndex);
    ptMaterial.textures.setTextures(args.renderer, 2048, 2048, textures);
    ptMaterial.materials.updateFrom(materials, textures);
    ptMaterial.lights.updateFrom(lights);

    const bg = args.scene.background;
    if (bg && (bg as any).isTexture) {
      ptMaterial.envMapInfo.updateFrom(bg as THREE.Texture);
      ptMaterial.environmentIntensity = 1;
    }

    ptRenderer.reset();
  };

  syncScene();

  const blitToScreen = () => {
    const prevTarget = args.renderer.getRenderTarget();
    args.renderer.setRenderTarget(null);
    screenMat.map = ptRenderer.target.texture;
    screenMat.needsUpdate = true;
    screenQuad.render(args.renderer);
    args.renderer.setRenderTarget(prevTarget);
  };

  return {
    setSize: (w, h) => {
      ptRenderer.setSize(Math.max(1, Math.floor(w)), Math.max(1, Math.floor(h)));
      ptMaterial.resolution.set(Math.max(1, Math.floor(w)), Math.max(1, Math.floor(h)));
      ptRenderer.reset();
    },
    renderSample: () => {
      if (ptRenderer.samples >= maxSamples) {
        blitToScreen();
        return;
      }
      ptRenderer.update();
      blitToScreen();
    },
    reset: () => {
      ptRenderer.reset();
    },
    updateFromScene: () => {
      syncScene();
    },
    updateCamera: () => {
      ptRenderer.camera = args.camera;
      ptRenderer.reset();
    },
    dispose: () => {
      ptRenderer.dispose();
      ptMaterial.dispose();
      screenMat.dispose();
      screenQuad.dispose();
      generator.geometry.dispose();
    },
    getSamples: () => ptRenderer.samples,
    setMaxSamples,
    getMaxSamples: () => maxSamples
  };
}

