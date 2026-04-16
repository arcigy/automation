import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export function createScene(container: HTMLElement) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0c10);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 200);
  camera.position.set(1.4, 1.0, 1.6);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = false;
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 0.6, 0);
  controls.update();

  // Helpers
  const grid = new THREE.GridHelper(4, 40, 0x2c3142, 0x1d2231);
  grid.position.y = 0;
  scene.add(grid);

  const axes = new THREE.AxesHelper(0.5);
  scene.add(axes);

  // Lights
  const amb = new THREE.AmbientLight(0xffffff, 0.65);
  scene.add(amb);

  const dir = new THREE.DirectionalLight(0xffffff, 1.1);
  dir.position.set(2, 3, 1.5);
  scene.add(dir);

  const setSize = (width: number, height: number) => {
    const w = Math.max(1, Math.floor(width));
    const h = Math.max(1, Math.floor(height));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };

  // Initial size
  setSize(container.clientWidth, container.clientHeight);

  return { scene, camera, renderer, controls, setSize };
}

