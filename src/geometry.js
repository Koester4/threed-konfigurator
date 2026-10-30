import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { ThreeMFLoader } from 'three/addons/loaders/3MFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const SUPPORTED_EXTENSIONS = ['stl', 'obj', '3mf'];

/** Lädt eine STL/OBJ/3MF-Datei und gibt eine vorbereitete Geometrie samt Kennzahlen zurück. */
export async function loadModelFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (!SUPPORTED_EXTENSIONS.includes(ext)) {
    throw new Error(`Dateiformat .${ext} wird nicht unterstützt. Erlaubt: ${SUPPORTED_EXTENSIONS.join(', ')}`);
  }

  const buffer = await file.arrayBuffer();
  let geometry;

  if (ext === 'stl') {
    geometry = new STLLoader().parse(buffer);
    geometry.rotateX(-Math.PI / 2); // STL ist Z-up, three.js Y-up
  } else if (ext === 'obj') {
    geometry = objectToGeometry(new OBJLoader().parse(new TextDecoder().decode(buffer)));
  } else {
    geometry = objectToGeometry(new ThreeMFLoader().parse(buffer));
    geometry.rotateX(-Math.PI / 2);
  }

  if (!geometry?.attributes.position?.count) {
    throw new Error('In der Datei wurden keine Dreiecke gefunden.');
  }

  // Nur Positionen behalten, Normalen neu berechnen (flache Facetten wie im Slicer)
  for (const name of Object.keys(geometry.attributes)) {
    if (name !== 'position') geometry.deleteAttribute(name);
  }
  if (geometry.index) geometry = geometry.toNonIndexed();
  geometry.computeVertexNormals();

  return prepareGeometry(geometry);
}

/** Fasst alle Meshes einer Gruppe (OBJ/3MF) zu einer Geometrie zusammen. */
function objectToGeometry(object) {
  object.updateMatrixWorld(true);
  const parts = [];
  object.traverse((child) => {
    if (!child.isMesh) return;
    let g = child.geometry.index ? child.geometry.toNonIndexed() : child.geometry.clone();
    g.applyMatrix4(child.matrixWorld);
    const clean = new THREE.BufferGeometry();
    clean.setAttribute('position', g.getAttribute('position'));
    parts.push(clean);
  });
  return parts.length ? mergeGeometries(parts) : null;
}

/** Zentriert die Geometrie auf der Bauplatte (Boden auf y = 0) und berechnet Kennzahlen. */
export function prepareGeometry(geometry) {
  geometry.computeBoundingBox();
  const { min, max } = geometry.boundingBox;
  geometry.translate(-(min.x + max.x) / 2, -min.y, -(min.z + max.z) / 2);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return { geometry, stats: computeStats(geometry) };
}

/** Volumen (Divergenzsatz über Tetraeder), Oberfläche und Abmessungen in mm. */
export function computeStats(geometry) {
  const pos = geometry.attributes.position;
  const index = geometry.index;
  const count = index ? index.count : pos.count;

  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();

  let volume = 0;
  let area = 0;

  for (let i = 0; i < count; i += 3) {
    const ia = index ? index.getX(i) : i;
    const ib = index ? index.getX(i + 1) : i + 1;
    const ic = index ? index.getX(i + 2) : i + 2;
    a.fromBufferAttribute(pos, ia);
    b.fromBufferAttribute(pos, ib);
    c.fromBufferAttribute(pos, ic);

    volume += a.dot(ab.copy(b).cross(c)) / 6;
    area += ab.subVectors(b, a).cross(ac.subVectors(c, a)).length() / 2;
  }

  const size = new THREE.Vector3();
  geometry.boundingBox.getSize(size);

  return {
    volumeMm3: Math.abs(volume),
    areaMm2: area,
    size: [size.x, size.z, size.y], // Breite, Tiefe, Höhe
    triangles: count / 3,
  };
}
