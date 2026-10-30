import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/** 3D-Vorschau: Modell auf einer Bauplatte mit mitwachsendem mm-Raster. */
export class Viewer {
  constructor(container) {
    this.container = container;
    this.scale = 1;
    this.mesh = null;
    this.grid = null;
    this.gridStep = 0;
    this.onGridChange = () => {};

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(35, 1, 1, 100000);
    this.camera.position.set(400, 320, 400);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI * 0.495;

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x6b7280, 1.4));
    this.sun = new THREE.DirectionalLight(0xffffff, 2.4);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.scene.add(this.sun, this.sun.target);
    const fill = new THREE.DirectionalLight(0xbfd4ff, 0.6);
    fill.position.set(-1, 0.5, -1);
    this.scene.add(fill);

    this.ground = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.ShadowMaterial({ opacity: 0.18 }),
    );
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);

    this.material = new THREE.MeshStandardMaterial({
      color: 0xdddddd,
      roughness: 0.55,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });

    this.box = new THREE.Box3Helper(new THREE.Box3(), 0x5b8cff);
    this.box.visible = false;
    this.scene.add(this.box);

    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
    this.renderer.setAnimationLoop(() => {
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    });
  }

  resize() {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  setGeometry(geometry) {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
    }
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.castShadow = true;
    this.mesh.scale.setScalar(this.scale);
    this.scene.add(this.mesh);
    this.updateHelpers();
    this.fitCamera();
  }

  setScale(scale) {
    this.scale = scale;
    if (!this.mesh) return;
    this.mesh.scale.setScalar(scale);
    this.updateHelpers();
  }

  setAppearance(hex, roughness) {
    this.material.color.set(hex);
    this.material.roughness = roughness;
  }

  setWireframe(on) {
    this.material.wireframe = on;
  }

  setBoxVisible(on) {
    this.box.visible = on && !!this.mesh;
  }

  modelSize() {
    const size = new THREE.Vector3();
    new THREE.Box3().setFromObject(this.mesh).getSize(size);
    return size;
  }

  updateHelpers() {
    const size = this.modelSize();
    const maxDim = Math.max(size.x, size.y, size.z);

    // Raster: Zellgröße als "schöne" Zahl (1/2/5 × 10^n), ca. 10–20 Zellen
    const target = Math.max(size.x, size.z) * 1.6 + maxDim * 0.4;
    const step = niceStep(target / 12);
    const gridSize = Math.ceil(target / step / 2) * 2 * step;
    if (!this.grid || this.gridSize !== gridSize || this.gridStep !== step) {
      if (this.grid) {
        this.scene.remove(this.grid);
        this.grid.geometry.dispose();
      }
      this.grid = new THREE.GridHelper(gridSize, gridSize / step, 0x7c8594, 0xc3c8d0);
      this.grid.material.transparent = true;
      this.grid.material.opacity = 0.6;
      this.scene.add(this.grid);
      this.gridSize = gridSize;
      this.gridStep = step;
      this.onGridChange(step);
    }

    this.ground.scale.set(gridSize * 2, gridSize * 2, 1);
    this.box.box.setFromObject(this.mesh);

    const d = maxDim * 2;
    this.sun.position.set(d * 0.6, d * 1.2, d * 0.8);
    const cam = this.sun.shadow.camera;
    cam.left = cam.bottom = -maxDim;
    cam.right = cam.top = maxDim;
    cam.near = 1;
    cam.far = d * 4;
    cam.updateProjectionMatrix();
  }

  fitCamera() {
    if (!this.mesh) return;
    const size = this.modelSize();
    const radius = size.length() / 2;
    const fov = THREE.MathUtils.degToRad(this.camera.fov);
    const dist = (radius / Math.sin(fov / 2)) * 1.15;
    const center = new THREE.Vector3(0, size.y / 2, 0);
    const dir = new THREE.Vector3(1, 0.75, 1.1).normalize();
    this.camera.position.copy(center).addScaledVector(dir, dist);
    this.camera.near = Math.max(0.1, dist / 1000);
    this.camera.far = dist * 50;
    this.camera.updateProjectionMatrix();
    this.controls.target.copy(center);
    this.controls.update();
  }
}

function niceStep(raw) {
  const exp = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / exp;
  return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * exp;
}

/** Rendert ein kleines Vorschaubild einer Geometrie (für die Modellauswahl). */
export function renderThumbnails(geometries, width = 240, height = 180) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x6b7280, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(1, 2, 1.5);
  scene.add(sun);
  const camera = new THREE.PerspectiveCamera(30, width / height, 1, 100000);
  const material = new THREE.MeshStandardMaterial({ color: 0xc9ced6, roughness: 0.5, side: THREE.DoubleSide });

  const urls = geometries.map((geometry) => {
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
    const size = new THREE.Vector3();
    geometry.boundingBox.getSize(size);
    const center = new THREE.Vector3(0, size.y / 2, 0);
    const dist = (size.length() / 2 / Math.sin(THREE.MathUtils.degToRad(15))) * 1.05;
    camera.position.copy(center).addScaledVector(new THREE.Vector3(1, 0.8, 1.2).normalize(), dist);
    camera.lookAt(center);
    renderer.render(scene, camera);
    scene.remove(mesh);
    return renderer.domElement.toDataURL('image/png');
  });

  renderer.dispose();
  renderer.forceContextLoss();
  return urls;
}
