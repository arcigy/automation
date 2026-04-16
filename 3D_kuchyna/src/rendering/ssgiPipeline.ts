import * as THREE from "three";
import * as POSTPROCESSING from "postprocessing";
import { SSGIEffect, VelocityDepthNormalPass } from "realism-effects";

export type SsgiOptions = {
  distance: number;
  thickness: number;
  steps: number;
  refineSteps: number;
  spp: number;
  denoiseIterations: number;
  resolutionScale: number;
};

export type SsgiPipeline = {
  setSize: (w: number, h: number) => void;
  render: (dt: number) => void;
  setOptions: (next: Partial<SsgiOptions>) => void;
  dispose: () => void;
};

export function createSsgiPipeline(args: {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  options?: Partial<SsgiOptions>;
}): SsgiPipeline {
  const composer = new POSTPROCESSING.EffectComposer(args.renderer);
  const vdn = new VelocityDepthNormalPass(args.scene, args.camera);
  composer.addPass(vdn);

  const defaults: SsgiOptions = {
    distance: 8,
    thickness: 2.5,
    steps: 20,
    refineSteps: 5,
    spp: 1,
    denoiseIterations: 1,
    resolutionScale: 1
  };
  let options: SsgiOptions = { ...defaults, ...(args.options ?? {}) };

  const ssgi = new SSGIEffect(args.scene, args.camera, vdn, {
    distance: options.distance,
    thickness: options.thickness,
    steps: options.steps,
    refineSteps: options.refineSteps,
    spp: options.spp,
    denoiseIterations: options.denoiseIterations,
    resolutionScale: options.resolutionScale
  });

  const pass = new POSTPROCESSING.EffectPass(args.camera, ssgi);
  composer.addPass(pass);

  const setOptions = (next: Partial<SsgiOptions>) => {
    options = { ...options, ...next };
    (ssgi as any).distance = options.distance;
    (ssgi as any).thickness = options.thickness;
    (ssgi as any).steps = options.steps;
    (ssgi as any).refineSteps = options.refineSteps;
    (ssgi as any).spp = options.spp;
    (ssgi as any).denoiseIterations = options.denoiseIterations;
    (ssgi as any).resolutionScale = options.resolutionScale;
  };

  return {
    setSize: (w, h) => composer.setSize(Math.max(1, Math.floor(w)), Math.max(1, Math.floor(h))),
    render: (dt) => composer.render(dt),
    setOptions,
    dispose: () => {
      composer.dispose();
      (ssgi as any).dispose?.();
      (vdn as any).dispose?.();
    }
  };
}

