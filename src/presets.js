import * as THREE from 'three';

// Beispielmodelle aus dem Sortiment – prozedural erzeugt, Maße in mm.
// Eigene Modelle können später auch als STL in /public abgelegt und geladen werden.

export const PRESETS = [
  {
    id: 'vase',
    name: 'Designvase',
    description: 'Hohlkörper, 3 mm Wand',
    create: () => hollowLathe({ height: 320, wall: 3, floor: 4, segments: 128, radius: (t) => 55 + 35 * Math.sin(t * Math.PI * 1.1) - 10 * t }),
  },
  {
    id: 'planter',
    name: 'Pflanzkübel Hex',
    description: 'Sechseckig, 5 mm Wand',
    create: () => hollowLathe({ height: 400, wall: 5, floor: 8, segments: 6, radius: (t) => 170 + 50 * t }),
  },
  {
    id: 'gear',
    name: 'Zahnrad',
    description: '32 Zähne, Ø 240 mm',
    create: () => gear({ teeth: 32, outer: 120, root: 108, bore: 25, thickness: 30 }),
  },
  {
    id: 'sculpture',
    name: 'Skulptur',
    description: 'Torusknoten, massiv',
    create: () => new THREE.TorusKnotGeometry(110, 32, 300, 40, 2, 3),
  },
];

/** Rotationskörper mit Wandstärke – geschlossenes, druckbares Volumen. */
function hollowLathe({ height, wall, floor, segments, radius }) {
  const steps = 60;
  const pts = [new THREE.Vector2(0, 0)];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push(new THREE.Vector2(radius(t), t * height));
  }
  for (let i = steps; i >= 0; i--) {
    const t = i / steps;
    const y = Math.max(floor, t * height);
    pts.push(new THREE.Vector2(radius(t) - wall, y));
  }
  pts.push(new THREE.Vector2(0, floor));
  return new THREE.LatheGeometry(pts, segments);
}

function gear({ teeth, outer, root, bore, thickness }) {
  const shape = new THREE.Shape();
  const n = teeth * 4;
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2;
    const r = i % 4 < 2 ? outer : root;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();

  const hole = new THREE.Path();
  hole.absarc(0, 0, bore, 0, Math.PI * 2, true);
  shape.holes.push(hole);

  const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 48 });
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}
