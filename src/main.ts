import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  achievements,
  missionPool,
  objects,
  regionCompletionRewards,
  regions,
  toolOrder,
  tools,
  type AchievementId,
  type MissionId,
  type ObjectKind,
  type RegionId,
  type ToolId,
} from './gameData';
import './style.css';

type Cleanable = THREE.Group & {
  userData: { kind: ObjectKind; cleaned?: boolean; progress: number };
};

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x66c8f2);
scene.fog = new THREE.Fog(0x8dd4ef, 28, 62);

const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 1.85, 8);
scene.add(camera);

scene.add(new THREE.HemisphereLight(0xc6efff, 0x5f7b32, 2.2));
const sun = new THREE.DirectionalLight(0xfff2cd, 3.2);
sun.position.set(-10, 18, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -24; sun.shadow.camera.right = 24;
sun.shadow.camera.top = 24; sun.shadow.camera.bottom = -24;
scene.add(sun);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(46, 40),
  new THREE.MeshStandardMaterial({ color: 0x75b94b, roughness: 1 }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const path = new THREE.Mesh(
  new THREE.PlaneGeometry(8, 38),
  new THREE.MeshStandardMaterial({ color: 0xd9bb83, roughness: 1 }),
);
path.rotation.x = -Math.PI / 2;
path.position.y = 0.012;
path.receiveShadow = true;
scene.add(path);

function box(size: [number, number, number], color: number, position: [number, number, number]) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(...size),
    new THREE.MeshStandardMaterial({ color, roughness: 0.85 }),
  );
  mesh.position.set(...position);
  mesh.castShadow = mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

box([12, 5.5, 5], 0xffdb9f, [-10, 2.75, -10]);
box([12.6, 0.65, 5.8], 0xe76f51, [-10, 5.8, -10]);
for (const x of [-13, -10, -7]) box([1.6, 2.2, 0.15], 0x83cceb, [x, 3.1, -7.45]);
for (let x = -21; x <= 21; x += 2.1) {
  box([0.14, 1.7, 0.18], 0xf4ead5, [x, 0.85, -18]);
  box([2.1, 0.15, 0.15], 0xf4ead5, [x, 0.55, -17.98]);
}

function tree(x: number, z: number, scale = 1) {
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28 * scale, 0.4 * scale, 3.2 * scale, 7),
    new THREE.MeshStandardMaterial({ color: 0x85532f }),
  );
  trunk.position.set(x, 1.6 * scale, z);
  trunk.castShadow = true;
  scene.add(trunk);
  const crown = new THREE.Mesh(
    new THREE.IcosahedronGeometry(2 * scale, 1),
    new THREE.MeshStandardMaterial({ color: 0x6eae35, flatShading: true }),
  );
  crown.position.set(x, 4.3 * scale, z);
  crown.castShadow = true;
  scene.add(crown);
}
tree(13, -10, 1.15); tree(17, 3, 0.9); tree(-17, 4, 1);

const cleanables: Cleanable[] = [];
const leafColors = [0xe9682c, 0xf6b82f, 0xb84b27, 0xef8d22];
const houseBounds = { minX: -16.3, maxX: -3.7, minZ: -12.8, maxZ: -7.15 };

function isInsideHouse(x: number, z: number, padding = 0) {
  return x > houseBounds.minX - padding && x < houseBounds.maxX + padding
    && z > houseBounds.minZ - padding && z < houseBounds.maxZ + padding;
}

function randomOpenPosition(): [number, number] {
  let x = 0;
  let z = 0;
  do {
    x = (Math.random() - 0.5) * 36;
    z = (Math.random() - 0.5) * 30;
  } while (isInsideHouse(x, z, 0.45));
  return [x, z];
}

function cleanableGroup(kind: ObjectKind, x: number, z: number): Cleanable {
  const group = new THREE.Group() as Cleanable;
  group.userData = { kind, progress: 0 };
  group.position.set(x, 0.05, z);
  scene.add(group);
  cleanables.push(group);
  return group;
}

function createLeaf(x: number, z: number) {
  const group = cleanableGroup('leaf', x, z);
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.42); shape.lineTo(0.17, 0.12); shape.lineTo(0.43, 0);
  shape.lineTo(0.16, -0.1); shape.lineTo(0, -0.42); shape.lineTo(-0.15, -0.1);
  shape.lineTo(-0.4, 0); shape.lineTo(-0.16, 0.13); shape.closePath();
  const mesh = new THREE.Mesh(
    new THREE.ShapeGeometry(shape),
    new THREE.MeshStandardMaterial({
      color: leafColors[Math.floor(Math.random() * leafColors.length)],
      side: THREE.DoubleSide,
      roughness: 0.9,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.rotation.z = Math.random() * Math.PI;
  mesh.scale.setScalar(0.55 + Math.random() * 0.45);
  mesh.castShadow = true;
  group.add(mesh);
}

function createCan(x: number, z: number) {
  const group = cleanableGroup('can', x, z);
  group.position.y = 0.18;
  group.rotation.y = Math.random() * Math.PI;
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, 0.48, 12),
    new THREE.MeshStandardMaterial({ color: 0xe83e35, metalness: 0.55, roughness: 0.35 }),
  );
  body.rotation.z = Math.PI / 2;
  body.castShadow = true;
  group.add(body);
  const rimMaterial = new THREE.MeshStandardMaterial({ color: 0xdde4e7, metalness: 0.8, roughness: 0.25 });
  for (const side of [-1, 1]) {
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.035, 12), rimMaterial);
    rim.rotation.z = Math.PI / 2;
    rim.position.x = 0.25 * side;
    group.add(rim);
  }
}

function createGoldCan(x: number, z: number) {
  const group = cleanableGroup('goldCan', x, z);
  group.position.y = 0.2;
  group.rotation.y = Math.random() * Math.PI;
  const gold = new THREE.MeshStandardMaterial({ color: 0xffc928, metalness: 0.85, roughness: 0.22, emissive: 0x5b3600, emissiveIntensity: 0.22 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.55, 16), gold);
  body.rotation.z = Math.PI / 2;
  body.castShadow = true;
  group.add(body);
  const rimMaterial = new THREE.MeshStandardMaterial({ color: 0xffef9a, metalness: 0.9, roughness: 0.18 });
  for (const side of [-1, 1]) {
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.205, 0.035, 16), rimMaterial);
    rim.rotation.z = Math.PI / 2;
    rim.position.x = 0.29 * side;
    group.add(rim);
  }
}

function createChest(kind: 'goldChest' | 'gemChest', x: number, z: number) {
  const group = cleanableGroup(kind, x, z);
  group.position.y = 0.28;
  group.rotation.y = Math.random() * Math.PI * 2;
  const isGem = kind === 'gemChest';
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: isGem ? 0x6b35c8 : 0xb87516,
    metalness: 0.35,
    roughness: 0.42,
    emissive: isGem ? 0x22005f : 0x513000,
    emissiveIntensity: 0.28,
  });
  const trimMaterial = new THREE.MeshStandardMaterial({ color: isGem ? 0x69e9ff : 0xffd54a, metalness: 0.8, roughness: 0.22 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.42, 0.58), bodyMaterial);
  body.castShadow = true;
  group.add(body);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.2, 0.62), bodyMaterial);
  lid.position.y = 0.3;
  lid.castShadow = true;
  group.add(lid);
  for (const xOffset of [-0.28, 0.28]) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.68, 0.66), trimMaterial);
    band.position.set(xOffset, 0.12, 0);
    group.add(band);
  }
  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 0.08), trimMaterial);
  lock.position.set(0, 0.08, 0.33);
  group.add(lock);
}

function createGrass(x: number, z: number) {
  const group = cleanableGroup('grass', x, z);
  const material = new THREE.MeshStandardMaterial({ color: 0x3f9c35, side: THREE.DoubleSide });
  for (let i = 0; i < 5; i++) {
    const blade = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.65), material);
    blade.position.set((i - 2) * 0.1, 0.3, (i % 2) * 0.08);
    blade.rotation.y = i * 0.8;
    group.add(blade);
  }
}

function createStone(x: number, z: number) {
  const group = cleanableGroup('stone', x, z);
  group.position.y = 0.22;
  const stone = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.36, 0),
    new THREE.MeshStandardMaterial({ color: 0x858987, flatShading: true, roughness: 1 }),
  );
  stone.scale.y = 0.65;
  stone.castShadow = true;
  group.add(stone);
}

function createGoldStone(x: number, z: number) {
  const group = cleanableGroup('goldStone', x, z);
  group.position.y = 0.3;
  const stone = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.48, 1),
    new THREE.MeshStandardMaterial({ color: 0xffc62f, emissive: 0x6b3c00, emissiveIntensity: 0.3, metalness: 0.7, roughness: 0.3, flatShading: true }),
  );
  stone.scale.y = 0.72;
  stone.castShadow = true;
  group.add(stone);
}

let currentRegionId: RegionId = 1;
let total = 0;
type RegionObjectCounts = Record<ObjectKind, number>;
interface RegionProgressState { remaining: Partial<RegionObjectCounts>; total: number }

function freshRegionCounts(regionId: RegionId): RegionObjectCounts {
  const counts = { ...regions[regionId].objectCounts };
  const rareCount = () => 1 + (Math.random() < 0.5 ? 0 : 1);
  counts.goldCan = rareCount();
  counts.goldChest = rareCount();
  counts.gemChest = rareCount();
  counts.goldStone = regionId === 3 ? rareCount() : 0;
  return counts;
}

function populateRegion(regionId: RegionId, state: RegionProgressState) {
  cleanables.forEach((object) => scene.remove(object));
  cleanables.length = 0;
  const counts = state.remaining;
  for (let i = 0; i < (counts.leaf ?? 0); i++) createLeaf(...randomOpenPosition());
  for (let i = 0; i < (counts.can ?? 0); i++) {
    if (i === 0) createCan(0, 3.1);
    else createCan(...randomOpenPosition());
  }
  for (let i = 0; i < (counts.grass ?? 0); i++) createGrass(7 + Math.random() * 8, -10 + Math.random() * 18);
  for (let i = 0; i < (counts.stone ?? 0); i++) createStone(-18 + Math.random() * 7, -5 + Math.random() * 15);
  for (let i = 0; i < (counts.goldCan ?? 0); i++) createGoldCan(...randomOpenPosition());
  for (let i = 0; i < (counts.goldChest ?? 0); i++) createChest('goldChest', ...randomOpenPosition());
  for (let i = 0; i < (counts.gemChest ?? 0); i++) createChest('gemChest', ...randomOpenPosition());
  for (let i = 0; i < (counts.goldStone ?? 0); i++) createGoldStone(-18 + Math.random() * 7, -5 + Math.random() * 15);
  total = state.total;
  cleaned = Math.max(0, total - cleanables.length);
}

const fallbackTool = new THREE.Group();
const fallbackHandle = new THREE.Mesh(
  new THREE.CylinderGeometry(0.035, 0.045, 2.25, 10),
  new THREE.MeshStandardMaterial({ color: 0x8e552a }),
);
fallbackHandle.rotation.z = -0.35;
fallbackHandle.position.set(0.25, -0.25, 0);
fallbackTool.add(fallbackHandle);
const fallbackHead = new THREE.Mesh(
  new THREE.BoxGeometry(0.85, 0.16, 0.25),
  new THREE.MeshStandardMaterial({ color: 0x1688da }),
);
fallbackHead.position.set(-0.1, -1.28, 0);
fallbackTool.add(fallbackHead);
for (let i = 0; i < 9; i++) {
  const bristle = new THREE.Mesh(
    new THREE.BoxGeometry(0.055, 0.38, 0.18),
    new THREE.MeshStandardMaterial({ color: 0xe5c06d }),
  );
  bristle.position.set(-0.42 + i * 0.105, -1.52, 0);
  bristle.rotation.z = (i - 4) * 0.025;
  fallbackTool.add(bristle);
}
// Tool models are held along the camera's depth axis: handle toward the player,
// working head toward the center of the screen.
fallbackTool.rotation.set(Math.PI / 2, 0, -0.32);
fallbackTool.position.y = -0.18;

const basicBroomTool = new THREE.Group();
const basicBroomHandle = new THREE.Mesh(
  new THREE.CylinderGeometry(0.03, 0.038, 1.65, 8),
  new THREE.MeshStandardMaterial({ color: 0x9c6a3d, roughness: 0.9 }),
);
basicBroomHandle.rotation.z = -0.32;
basicBroomHandle.position.set(0.2, -0.2, 0);
basicBroomTool.add(basicBroomHandle);
const basicBroomHead = new THREE.Mesh(
  new THREE.BoxGeometry(0.52, 0.12, 0.18),
  new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.9 }),
);
basicBroomHead.position.set(-0.08, -0.92, 0);
basicBroomTool.add(basicBroomHead);
for (let i = 0; i < 7; i++) {
  const bristle = new THREE.Mesh(
    new THREE.BoxGeometry(0.045, 0.26, 0.14),
    new THREE.MeshStandardMaterial({ color: 0xd8b869, roughness: 0.95 }),
  );
  bristle.position.set(-0.26 + i * 0.078, -1.1, 0);
  bristle.rotation.z = (i - 3) * 0.03;
  basicBroomTool.add(bristle);
}
basicBroomTool.rotation.set(Math.PI / 2, 0, -0.32);
basicBroomTool.position.y = -0.18;

// Builds a mesh stretching from `start` to `end` so segments always connect with no gaps,
// instead of relying on hand-tuned position/rotation offsets per part.
function boxBetween(start: THREE.Vector3, end: THREE.Vector3, width: number, depth: number, material: THREE.Material) {
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, length, depth), material);
  mesh.position.copy(start).addScaledVector(direction, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
  return mesh;
}
function cylinderBetween(start: THREE.Vector3, end: THREE.Vector3, radiusStart: number, radiusEnd: number, material: THREE.Material) {
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusStart, radiusEnd, length, 7), material);
  mesh.position.copy(start).addScaledVector(direction, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
  return mesh;
}

// Classic pickaxe silhouette: straight wooden shaft, curved double-pointed metal head on top.
const pickaxeTool = new THREE.Group();
const pickaxeWoodMaterial = new THREE.MeshStandardMaterial({ color: 0xc9a06a, roughness: 0.85 });
const pickaxeMetalMaterial = new THREE.MeshStandardMaterial({ color: 0x9aa3a8, metalness: 0.7, roughness: 0.3, flatShading: true });
const pickaxeSocketMaterial = new THREE.MeshStandardMaterial({ color: 0x5f6a70, metalness: 0.5, roughness: 0.45 });
const pickaxeGrip = new THREE.Vector3(0.15, -0.05, 0);
const pickaxeMount = new THREE.Vector3(-0.1, -1, 0);
const pickaxeLeftMid = new THREE.Vector3(-0.5, -0.85, 0);
const pickaxeLeftTip = new THREE.Vector3(-0.88, -1.18, 0);
const pickaxeRightMid = new THREE.Vector3(0.32, -0.85, 0);
const pickaxeRightTip = new THREE.Vector3(0.68, -1.18, 0);
pickaxeTool.add(cylinderBetween(pickaxeGrip, pickaxeMount, 0.045, 0.06, pickaxeWoodMaterial));
const pickaxeSocket = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.16), pickaxeSocketMaterial);
pickaxeSocket.position.copy(pickaxeMount);
pickaxeTool.add(pickaxeSocket);
pickaxeTool.add(boxBetween(pickaxeMount, pickaxeLeftMid, 0.13, 0.08, pickaxeMetalMaterial));
pickaxeTool.add(boxBetween(pickaxeLeftMid, pickaxeLeftTip, 0.08, 0.06, pickaxeMetalMaterial));
pickaxeTool.add(boxBetween(pickaxeMount, pickaxeRightMid, 0.13, 0.08, pickaxeMetalMaterial));
pickaxeTool.add(boxBetween(pickaxeRightMid, pickaxeRightTip, 0.08, 0.06, pickaxeMetalMaterial));
pickaxeTool.rotation.set(Math.PI / 2, 0, -0.32);
pickaxeTool.position.z = -0.75;

const vacuumTool = new THREE.Group();
const vacuumHandle = new THREE.Mesh(
  new THREE.CylinderGeometry(0.035, 0.045, 2.1, 8),
  new THREE.MeshStandardMaterial({ color: 0x384049, roughness: 0.5, metalness: 0.3 }),
);
vacuumHandle.rotation.z = -0.3;
vacuumHandle.position.set(0.25, -0.15, 0);
vacuumTool.add(vacuumHandle);
const vacuumBody = new THREE.Mesh(
  new THREE.CylinderGeometry(0.16, 0.14, 0.55, 8),
  new THREE.MeshStandardMaterial({ color: 0xe63946, roughness: 0.4, metalness: 0.25 }),
);
vacuumBody.rotation.z = -0.3;
vacuumBody.position.set(-0.15, -1, 0);
vacuumTool.add(vacuumBody);
const vacuumHead = new THREE.Mesh(
  new THREE.BoxGeometry(0.9, 0.16, 0.3),
  new THREE.MeshStandardMaterial({ color: 0x232a30, roughness: 0.5, metalness: 0.3 }),
);
vacuumHead.position.set(-0.12, -1.32, 0);
vacuumTool.add(vacuumHead);
const vacuumRoller = new THREE.Mesh(
  new THREE.CylinderGeometry(0.09, 0.09, 0.82, 8),
  new THREE.MeshStandardMaterial({ color: 0xb3271e, roughness: 0.8 }),
);
vacuumRoller.rotation.z = Math.PI / 2;
vacuumRoller.position.set(-0.12, -1.42, 0);
vacuumTool.add(vacuumRoller);
vacuumTool.rotation.set(Math.PI / 2, 0, -0.32);
vacuumTool.position.y = -0.1;

function buildSickle(bladeColor: number, handleColor: number, sizeScale: number) {
  const group = new THREE.Group();
  const handleMaterial = new THREE.MeshStandardMaterial({ color: handleColor, roughness: 0.85 });
  const bladeMaterial = new THREE.MeshStandardMaterial({ color: bladeColor, metalness: 0.75, roughness: 0.3, flatShading: true });
  const grip = new THREE.Vector3(0.15, -0.05, 0);
  const bladeBase = new THREE.Vector3(-0.05 * sizeScale, -0.85 * sizeScale, 0);
  const bladeMid = new THREE.Vector3(-0.45 * sizeScale, -1.15 * sizeScale, 0);
  const bladeTip = new THREE.Vector3(-0.55 * sizeScale, -1.55 * sizeScale, 0);
  group.add(cylinderBetween(grip, bladeBase, 0.045 * sizeScale, 0.03 * sizeScale, handleMaterial));
  group.add(boxBetween(bladeBase, bladeMid, 0.22 * sizeScale, 0.045 * sizeScale, bladeMaterial));
  group.add(boxBetween(bladeMid, bladeTip, 0.16 * sizeScale, 0.045 * sizeScale, bladeMaterial));
  group.rotation.set(Math.PI / 2, 0, -0.32);
  group.position.y = -0.18;
  return group;
}
const copperSickleTool = buildSickle(0xc07a3e, 0x6b4127, 0.72);
const metalSickleTool = buildSickle(0xd7dde0, 0x55483a, 0.85);

function builtinToolFor(toolId: ToolId): THREE.Group {
  switch (toolId) {
    case 'basicBroom': return basicBroomTool;
    case 'vacuum': return vacuumTool;
    case 'copperSickle': return copperSickleTool;
    case 'metalSickle': return metalSickleTool;
    case 'pickaxe': return pickaxeTool;
    case 'neonSickle': return metalSickleTool;
    case 'neonPickaxe': return pickaxeTool;
    default: return fallbackTool;
  }
}

const toolAnchor = new THREE.Group();
const toolRestX = 0.75;
const toolRestY = 0.25;
toolAnchor.position.set(toolRestX, toolRestY, -1.25);
toolAnchor.rotation.set(-0.1, 0.1, -0.12);
toolAnchor.add(fallbackTool);
camera.add(toolAnchor);

const loader = new GLTFLoader();
let modelRequest = 0;
function showToolModel(toolId: ToolId) {
  const request = ++modelRequest;
  const definition = tools[toolId];
  const modelPath = definition.model;
  if (!modelPath) {
    toolAnchor.clear();
    toolAnchor.add(builtinToolFor(toolId));
    return;
  }
  // Tools that still load a GLTF model instead of a code-built shape. Tweak x/y/z/roll per tool here.
  const gltfToolOffsets: Partial<Record<ToolId, { x: number; y: number; z: number; roll: number; yaw?: number }>> = {
    neonPickaxe: { x: -0.7, y: 0.2, z: 0.5, roll: 2.85 , yaw: -Math.PI/1.8},
    neonSickle: { x: -0.1, y: -0.1, z: 0, roll: -2 , yaw: Math.PI/2.5},
    vacuum: { x: -0.5, y: 0.2, z: -1, roll: 0, yaw: Math.PI },
  };
  loader.load(modelPath, (gltf) => {
    if (request !== modelRequest) return;
    const model = gltf.scene;
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const scale = 1.35 / Math.max(size.x, size.y, size.z, 0.001);
    model.scale.setScalar(scale);
    model.position.copy(center.multiplyScalar(-scale));
    const offset = gltfToolOffsets[toolId] ?? { x: 0, y: 0, z: 0, roll: 0 };
    model.position.x += offset.x;
    model.position.y += offset.y;
    model.position.z += offset.z;
    model.rotation.set(Math.PI / 2, offset.yaw ?? 0, offset.roll);
    model.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.castShadow = true;
      if (toolId !== 'vacuum') return;
      const tintMaterial = (material: THREE.Material) => {
        const tinted = material.clone();
        if (tinted instanceof THREE.MeshStandardMaterial) {
          tinted.color.multiply(new THREE.Color(0xff3030));
          tinted.needsUpdate = true;
        }
        return tinted;
      };
      child.material = Array.isArray(child.material)
        ? child.material.map(tintMaterial)
        : tintMaterial(child.material);
    });
    toolAnchor.clear();
    toolAnchor.add(model);
  }, undefined, () => {
    if (request !== modelRequest) return;
    toolAnchor.clear();
    toolAnchor.add(builtinToolFor(toolId));
  });
}

let yaw = 0;
let pitch = -0.12;
const standingHeight = 1.85;
let verticalVelocity = 0;
let grounded = true;
type UpgradeId = 'cleanSpeed' | 'moveSpeed' | 'coinBonus' | 'radius';
interface PlayerStats {
  leafCleaned: number;
  canCleaned: number;
  coinsEarned: number;
  regionsCleared: number;
  totalCleaned: number;
}
interface SaveData {
  coins: number;
  gems: number;
  currentRegion: RegionId;
  unlockedRegion: RegionId;
  regionProgress: Partial<Record<RegionId, RegionProgressState>>;
  unlockedTools: ToolId[];
  upgrades: Record<UpgradeId, number>;
  stats: PlayerStats;
  missionProgress: Record<MissionId, number>;
  achievementsClaimed: AchievementId[];
}
const defaultStats: PlayerStats = { leafCleaned: 0, canCleaned: 0, coinsEarned: 0, regionsCleared: 0, totalCleaned: 0 };
const defaultMissionProgress: Record<MissionId, number> = { leaf100: 0, can30: 0, regionClear: 0, fastClear5min: 0 };
const defaultSave: SaveData = {
  coins: 0,
  gems: 300,
  currentRegion: 1,
  unlockedRegion: 1,
  regionProgress: {},
  unlockedTools: ['basicBroom'],
  upgrades: { cleanSpeed: 0, moveSpeed: 0, coinBonus: 0, radius: 0 },
  stats: { ...defaultStats },
  missionProgress: { ...defaultMissionProgress },
  achievementsClaimed: [],
};
function loadSave(): SaveData {
  try {
    const parsed = JSON.parse(localStorage.getItem('yardSweepSave') ?? '') as Partial<SaveData>;
    return {
      coins: Math.max(0, Number(parsed.coins) || 0),
      gems: Number.isFinite(Number(parsed.gems)) ? Math.max(0, Number(parsed.gems)) : defaultSave.gems,
      currentRegion: ([1, 2, 3].includes(Number(parsed.currentRegion)) ? Number(parsed.currentRegion) : 1) as RegionId,
      unlockedRegion: ([1, 2, 3].includes(Number(parsed.unlockedRegion)) ? Number(parsed.unlockedRegion) : 1) as RegionId,
      regionProgress: parsed.regionProgress ?? {},
      unlockedTools: Array.isArray(parsed.unlockedTools) ? parsed.unlockedTools : ['basicBroom'],
      upgrades: { ...defaultSave.upgrades, ...(parsed.upgrades ?? {}) },
      stats: { ...defaultStats, ...(parsed.stats ?? {}) },
      missionProgress: { ...defaultMissionProgress, ...(parsed.missionProgress ?? {}) },
      achievementsClaimed: Array.isArray(parsed.achievementsClaimed) ? parsed.achievementsClaimed : [],
    };
  } catch { return structuredClone(defaultSave); }
}
const saveData = loadSave();
let coins = saveData.coins;
let gems = saveData.gems;
currentRegionId = Math.min(saveData.currentRegion, saveData.unlockedRegion) as RegionId;
let unlockedRegion = saveData.unlockedRegion;
const regionProgress = saveData.regionProgress;
const stats = saveData.stats;
const missionProgress = saveData.missionProgress;
const achievementsClaimed = new Set<AchievementId>(saveData.achievementsClaimed);
let regionEnterTimestamp = performance.now();
let cleaned = 0;
let regionCompleted = false;
let isCleaning = false;
let cleaningHeld = false;
let shopOpen = false;
let gameStarted = false;
let currentToolId: ToolId = 'basicBroom';
const unlockedTools = new Set<ToolId>(saveData.unlockedTools);
// Prototype testing: keep the six standard tools selectable; premium tools still require gems.
toolOrder.filter((toolId) => tools[toolId].slot <= 6).forEach((toolId) => unlockedTools.add(toolId));
const upgrades = saveData.upgrades;
const keys = new Set<string>();
const clock = new THREE.Clock();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const aimPoint = new THREE.Vector3();
const ray = new THREE.Ray();
const toolUi: Record<ToolId, { size: number; symbol: string }> = {
  basicBroom: { size: 122, symbol: '🧹 기본 빗자루' },
  wideBroom: { size: 176, symbol: '🧹 큰 빗자루' },
  vacuum: { size: 154, symbol: '◉ 송풍기' },
  copperSickle: { size: 142, symbol: '☾ 구리 낫' },
  metalSickle: { size: 178, symbol: '☾ 금속 낫' },
  pickaxe: { size: 112, symbol: '⛏ 곡괭이' },
  neonSickle: { size: 188, symbol: '☾ 네온 낫' },
  neonPickaxe: { size: 132, symbol: '⛏ 네온 곡괭이' },
};

const coinsEl = document.querySelector('#coins')!;
const gemsEl = document.querySelector('#gems')!;
const progressEl = document.querySelector<HTMLElement>('#progress-bar')!;
const progressText = document.querySelector('#progress-text')!;
const radiusEl = document.querySelector<HTMLElement>('.cleaning-radius')!;
const meter = document.querySelector<HTMLElement>('#clean-meter')!;
const meterFill = meter.querySelector<HTMLElement>('i')!;
const meterLabel = meter.querySelector<HTMLElement>('strong')!;
const feedback = document.querySelector<HTMLElement>('#feedback')!;
const notice = document.querySelector<HTMLElement>('#notice')!;
const hint = document.querySelector<HTMLElement>('#tool-hint')!;
const start = document.querySelector<HTMLButtonElement>('#start')!;
const shop = document.querySelector<HTMLElement>('#shop')!;
const shopCoins = document.querySelector<HTMLElement>('#shop-coins')!;
const shopGems = document.querySelector<HTMLElement>('#shop-gems')!;
const regionNameEl = document.querySelector<HTMLElement>('#region-name')!;
const regionCompleteCard = document.querySelector<HTMLButtonElement>('#region-complete')!;
const regionCompleteTitle = document.querySelector<HTMLElement>('#region-complete-title')!;
const regionCompleteAction = document.querySelector<HTMLElement>('#region-complete-action')!;
let noticeTimer = 0;

const bgmTracks = [0, 1, 2].map((index) => new Audio(`/assets/bgm-${index}.mp3`));
bgmTracks.forEach((audio) => { audio.loop = true; audio.volume = 0.28; });
const buttonSound = new Audio('/assets/button-sound.mp3');
buttonSound.volume = 0.45;
const regionCompleteSound = new Audio('/assets/region-complete-sound.mp3');
regionCompleteSound.volume = 0.75;
const coinSound = new Audio('/assets/coin-sound.mp3');
coinSound.volume = 0.55;
const jumpLandSound = new Audio('/assets/jump-land-sound.mp3');
jumpLandSound.volume = 0.6;
const footstepSound = new Audio('/assets/footstep-sound.mp3');
footstepSound.loop = true;
footstepSound.volume = 0.35;
function playCoinSound() {
  coinSound.currentTime = 0;
  void coinSound.play().catch(() => undefined);
}
function playJumpLandSound() {
  jumpLandSound.currentTime = 0;
  void jumpLandSound.play().catch(() => undefined);
}
const cleaningSounds = {
  broom: new Audio('/assets/broom-sound.mp3'),
  vacuum: new Audio('/assets/vacuum-sound.mp3'),
  sickle: new Audio('/assets/sickle-sound.mp3'),
  pickaxe: new Audio('/assets/pickaxe-sound.mp3'),
};
Object.values(cleaningSounds).forEach((audio) => { audio.loop = true; audio.volume = 0.6; });
let activeCleaningSound: HTMLAudioElement | undefined;

function cleaningSoundFor(toolId: ToolId) {
  if (toolId === 'vacuum') return cleaningSounds.vacuum;
  if (toolId === 'copperSickle' || toolId === 'metalSickle' || toolId === 'neonSickle') return cleaningSounds.sickle;
  if (toolId === 'pickaxe' || toolId === 'neonPickaxe') return cleaningSounds.pickaxe;
  return cleaningSounds.broom;
}

function setCleaningAudio(active: boolean) {
  const next = active ? cleaningSoundFor(currentToolId) : undefined;
  if (activeCleaningSound === next) return;
  if (activeCleaningSound) { activeCleaningSound.pause(); activeCleaningSound.currentTime = 0; }
  activeCleaningSound = next;
  if (next) void next.play().catch(() => undefined);
}

function playRegionBgm() {
  bgmTracks.forEach((audio) => { audio.pause(); audio.currentTime = 0; });
  if (gameStarted) void bgmTracks[currentRegionId - 1].play().catch(() => undefined);
}

function usesMobileControls() {
  return matchMedia('(max-width: 850px), (pointer: coarse)').matches;
}

async function enterFullscreen() {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    const orientation = screen.orientation as ScreenOrientation & { lock?: (mode: 'landscape') => Promise<void> };
    await orientation.lock?.('landscape');
  } catch {
    showNotice('기기를 직접 가로로 돌려주세요');
  }
}

function showNotice(message: string) {
  notice.textContent = message;
  notice.classList.add('show');
  window.clearTimeout(noticeTimer);
  noticeTimer = window.setTimeout(() => notice.classList.remove('show'), 1300);
}

function persist() {
  const data: SaveData = {
    coins,
    gems,
    currentRegion: currentRegionId,
    unlockedRegion,
    regionProgress,
    unlockedTools: [...unlockedTools],
    upgrades,
    stats,
    missionProgress,
    achievementsClaimed: [...achievementsClaimed],
  };
  localStorage.setItem('yardSweepSave', JSON.stringify(data));
}

function updateHud(reward = 0, gemReward = 0) {
  coinsEl.textContent = String(coins);
  gemsEl.textContent = String(gems);
  shopCoins.textContent = String(coins);
  shopGems.textContent = String(gems);
  const percentage = Math.round((cleaned / total) * 100);
  progressEl.style.width = `${percentage}%`;
  progressText.textContent = `${percentage}%`;
  if (reward > 0 || gemReward > 0) {
    playCoinSound();
    feedback.textContent = [reward > 0 ? `+${reward} 코인` : '', gemReward > 0 ? `+${gemReward} 💎` : ''].filter(Boolean).join(' · ');
    feedback.classList.remove('show');
    void feedback.offsetWidth;
    feedback.classList.add('show');
  }
}

function achievementProgressValue(id: AchievementId): number {
  switch (id) {
    case 'firstClean': return Math.min(stats.totalCleaned, 1);
    case 'coins1000': return stats.coinsEarned;
    case 'allRegions': return unlockedRegion >= 3 ? 1 : 0;
    case 'leaf10000': return stats.leafCleaned;
  }
}

function claimMission(id: MissionId) {
  const definition = missionPool.find((mission) => mission.id === id);
  if (!definition || (missionProgress[id] ?? 0) < definition.target) return;
  const rewardCoins = definition.reward.coins > 0
    ? Math.max(1, Math.round(definition.reward.coins * (1 + upgrades.coinBonus * 0.2)))
    : 0;
  coins += rewardCoins;
  gems += definition.reward.gems;
  missionProgress[id] = 0;
  persist();
  updateHud(rewardCoins, definition.reward.gems);
  refreshShop();
  showNotice(`${definition.label} 보상 수령!`);
}

function claimAchievement(id: AchievementId) {
  if (achievementsClaimed.has(id)) return;
  const definition = achievements[id];
  if (achievementProgressValue(id) < definition.target) return;
  const rewardCoins = definition.reward.coins > 0
    ? Math.max(1, Math.round(definition.reward.coins * (1 + upgrades.coinBonus * 0.2)))
    : 0;
  coins += rewardCoins;
  gems += definition.reward.gems;
  achievementsClaimed.add(id);
  persist();
  updateHud(rewardCoins, definition.reward.gems);
  refreshShop();
  showNotice(`${definition.label} 달성!`);
}

function equipTool(toolId: ToolId) {
  if (!unlockedTools.has(toolId)) {
    showNotice(`${tools[toolId].name} 장비가 잠겨 있습니다`);
    return;
  }
  stopCleaning();
  currentToolId = toolId;
  const tool = tools[toolId];
  document.querySelectorAll('.slot').forEach((slot) => slot.classList.remove('active'));
  document.querySelector(`[data-slot="${tool.slot}"]`)?.classList.add('active');
  const radiusBonus = 1 + upgrades.radius * 0.08;
  const ui = toolUi[toolId];
  const uiSize = Math.round(ui.size * radiusBonus);
  radiusEl.className = `cleaning-radius tool-${toolId}`;
  radiusEl.style.width = `${uiSize}px`;
  radiusEl.style.height = `${uiSize}px`;
  radiusEl.querySelector('span')!.textContent = ui.symbol;
  hint.textContent = `${tool.name} · ${tool.validTargets.map((kind) => objects[kind].label).join(', ')} 청소 가능`;
  showToolModel(toolId);
}

function calculateAimPoint() {
  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);
  ray.set(camera.position, direction);
  if (!ray.intersectPlane(groundPlane, aimPoint) || camera.position.distanceTo(aimPoint) > 8.5) {
    aimPoint.copy(camera.position).add(direction.multiplyScalar(5));
    aimPoint.y = 0;
  }
  return aimPoint;
}

function objectsInRadius() {
  const bounds = radiusEl.getBoundingClientRect();
  const centerX = bounds.left + bounds.width / 2;
  const centerY = bounds.top + bounds.height / 2;
  const screenRadius = Math.min(bounds.width, bounds.height) / 2 - 5;
  const projected = new THREE.Vector3();
  return cleanables.filter((object) => {
    if (object.userData.cleaned || !object.visible) return false;
    const worldPosition = object.getWorldPosition(projected);
    if (camera.position.distanceTo(worldPosition) > 8.5) return false;
    worldPosition.y += 0.18;
    worldPosition.project(camera);
    if (worldPosition.z < -1 || worldPosition.z > 1) return false;
    const screenX = (worldPosition.x * 0.5 + 0.5) * innerWidth;
    const screenY = (-worldPosition.y * 0.5 + 0.5) * innerHeight;
    return Math.hypot(screenX - centerX, screenY - centerY) <= screenRadius;
  });
}

function startCleaning() {
  if (shopOpen) return;
  cleaningHeld = true;
}

function stopCleaning() {
  cleaningHeld = false;
  isCleaning = false;
  setCleaningAudio(false);
  radiusEl.classList.remove('cleaning');
  meter.classList.remove('active');
  meterFill.style.width = '0%';
}

function jump() {
  const tool = tools[currentToolId];
  const movementBlocked = isCleaning && !tool.canMoveWhileCleaning;
  if (!grounded || movementBlocked || shopOpen) return;
  verticalVelocity = 5.25;
  grounded = false;
}

function incrementMissionProgress(id: MissionId, amount = 1) {
  const definition = missionPool.find((mission) => mission.id === id);
  if (!definition) return;
  missionProgress[id] = Math.min(definition.target, (missionProgress[id] ?? 0) + amount);
}

function enterRegion(regionId: RegionId) {
  stopCleaning();
  regionEnterTimestamp = performance.now();
  currentRegionId = regionId;
  regionCompleted = false;
  let state = regionProgress[regionId];
  if (!state) {
    const remaining = freshRegionCounts(regionId);
    state = { remaining, total: Object.values(remaining).reduce((sum, count) => sum + count, 0) };
    regionProgress[regionId] = state;
  }
  populateRegion(regionId, state);
  regionNameEl.textContent = regions[regionId].name;
  regionCompleteCard.classList.add('hidden');
  camera.position.set(0, standingHeight, 8);
  verticalVelocity = 0;
  grounded = true;
  updateHud();
  playRegionBgm();
  persist();
}

function completeRegion() {
  if (regionCompleted) return;
  regionCompleted = true;
  delete regionProgress[currentRegionId];
  stopCleaning();
  bgmTracks.forEach((audio) => audio.pause());
  regionCompleteSound.currentTime = 0;
  void regionCompleteSound.play().catch(() => undefined);

  const completionReward = regionCompletionRewards[currentRegionId];
  const rewardCoins = completionReward.coins > 0
    ? Math.max(1, Math.round(completionReward.coins * (1 + upgrades.coinBonus * 0.2)))
    : 0;
  coins += rewardCoins;
  gems += completionReward.gems;
  stats.coinsEarned += rewardCoins;
  stats.regionsCleared += 1;
  incrementMissionProgress('regionClear');
  if (performance.now() - regionEnterTimestamp <= 5 * 60 * 1000) incrementMissionProgress('fastClear5min');
  const rewardLabel = [rewardCoins > 0 ? `+${rewardCoins} 코인` : '', completionReward.gems > 0 ? `+${completionReward.gems} 💎` : '']
    .filter(Boolean).join(' · ');

  if (currentRegionId < 3) {
    unlockedRegion = Math.max(unlockedRegion, currentRegionId + 1) as RegionId;
    regionCompleteTitle.textContent = `${regions[currentRegionId].name} 청소 완료!${rewardLabel ? ` (${rewardLabel})` : ''}`;
    regionCompleteAction.textContent = `${regions[(currentRegionId + 1) as RegionId].name}(으)로 이동`;
  } else {
    regionCompleteTitle.textContent = `모든 지역 청소 완료!${rewardLabel ? ` (${rewardLabel})` : ''}`;
    regionCompleteAction.textContent = '앞 마당부터 다시 플레이';
  }
  updateHud(rewardCoins, completionReward.gems);
  persist();
  regionCompleteCard.classList.remove('hidden');
  document.exitPointerLock?.();
}

function removeObject(object: Cleanable) {
  object.userData.cleaned = true;
  const definition = objects[object.userData.kind];
  const reward = definition.reward > 0
    ? Math.max(1, Math.round(definition.reward * (1 + upgrades.coinBonus * 0.2)))
    : 0;
  const gemReward = definition.gemReward ?? 0;
  coins += reward;
  gems += gemReward;
  const state = regionProgress[currentRegionId];
  if (state) state.remaining[object.userData.kind] = Math.max(0, (state.remaining[object.userData.kind] ?? 0) - 1);
  cleaned += 1;
  stats.totalCleaned += 1;
  stats.coinsEarned += reward;
  if (object.userData.kind === 'leaf') stats.leafCleaned += 1;
  if (object.userData.kind === 'can') stats.canCleaned += 1;
  if (object.userData.kind === 'leaf') incrementMissionProgress('leaf100');
  if (object.userData.kind === 'can') incrementMissionProgress('can30');
  updateHud(reward, gemReward);
  persist();
  if (cleaned >= total) completeRegion();
  const started = performance.now();
  const initialY = object.position.y;
  function vanish(now: number) {
    const progress = Math.min((now - started) / 280, 1);
    object.scale.setScalar(1 - progress);
    object.position.y = initialY + progress * 0.9;
    if (progress < 1) requestAnimationFrame(vanish);
    else object.visible = false;
  }
  requestAnimationFrame(vanish);
}

function updateCleaning(delta: number) {
  if (!cleaningHeld) return;
  const tool = tools[currentToolId];
  const valid = objectsInRadius().filter((object) => tool.validTargets.includes(object.userData.kind));
  if (valid.length === 0) {
    isCleaning = false;
    setCleaningAudio(false);
    radiusEl.classList.remove('cleaning');
    meter.classList.remove('active');
    meterFill.style.width = '0%';
    return;
  }
  isCleaning = true;
  setCleaningAudio(true);
  radiusEl.classList.add('cleaning');
  meter.classList.add('active');
  let displayedProgress = 0;
  let displayedLabel = '';
  for (const object of valid) {
    const definition = objects[object.userData.kind];
    object.userData.progress += delta * tool.speed * (1 + upgrades.cleanSpeed * 0.12);
    const progress = object.userData.progress / definition.cleanTime;
    if (progress > displayedProgress) {
      displayedProgress = progress;
      displayedLabel = `${definition.label} 청소 중`;
    }
    if (progress >= 1) removeObject(object);
  }
  meterFill.style.width = `${Math.min(displayedProgress, 1) * 100}%`;
  meterLabel.textContent = displayedLabel;
}

start.addEventListener('click', () => {
  gameStarted = true;
  start.classList.add('hidden');
  playRegionBgm();
  if (!usesMobileControls()) canvas.requestPointerLock?.();
});
regionCompleteCard.addEventListener('click', () => {
  const nextRegion = currentRegionId < 3 ? (currentRegionId + 1) as RegionId : 1;
  enterRegion(nextRegion);
  if (!usesMobileControls()) canvas.requestPointerLock?.();
});
document.addEventListener('click', (event) => {
  if (!(event.target as HTMLElement).closest('button')) return;
  buttonSound.currentTime = 0;
  void buttonSound.play().catch(() => undefined);
});
canvas.addEventListener('mousedown', (event) => {
  if (event.button !== 0) return;
  if (document.pointerLockElement === canvas || usesMobileControls()) startCleaning();
  else canvas.requestPointerLock?.();
});
window.addEventListener('mouseup', stopCleaning);
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement !== canvas && !usesMobileControls() && !shopOpen) {
    stopCleaning();
    start.classList.remove('hidden');
  }
});
document.addEventListener('mousemove', (event) => {
  if (document.pointerLockElement !== canvas) return;
  yaw -= event.movementX * 0.0022;
  pitch -= event.movementY * 0.0018;
  pitch = THREE.MathUtils.clamp(pitch, -1.05, 0.75);
});

window.addEventListener('keydown', (event) => {
  if (event.code === 'Tab') {
    event.preventDefault();
    toggleShop();
    return;
  }
  if (shopOpen) return;
  keys.add(event.code);
  if (event.code === 'Space' && !event.repeat) {
    event.preventDefault();
    jump();
  }
  if (event.code.startsWith('Digit')) {
    const slot = Number(event.code.slice(5));
    const toolId = toolOrder.find((id) => tools[id].slot === slot);
    if (toolId) equipTool(toolId);
  }
});
window.addEventListener('keyup', (event) => keys.delete(event.code));
document.querySelectorAll<HTMLElement>('.slot').forEach((slot) => {
  slot.addEventListener('click', () => {
    const slotNumber = Number(slot.dataset.slot);
    const toolId = toolOrder.find((id) => tools[id].slot === slotNumber);
    if (toolId) equipTool(toolId);
  });
});

const cleanButton = document.querySelector<HTMLElement>('#clean-button')!;
const jumpButton = document.querySelector<HTMLElement>('#jump-button')!;
jumpButton.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  jump();
});
cleanButton.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  cleanButton.setPointerCapture(event.pointerId);
  startCleaning();
});
cleanButton.addEventListener('pointerup', stopCleaning);
cleanButton.addEventListener('pointercancel', stopCleaning);

const toolPrices: Partial<Record<ToolId, number>> = { wideBroom: 40, vacuum: 100, copperSickle: 180, metalSickle: 260, pickaxe: 280 };
const premiumToolPrices: Partial<Record<ToolId, number>> = { neonSickle: 120, neonPickaxe: 150 };
const upgradeBasePrices: Record<UpgradeId, number> = { cleanSpeed: 30, moveSpeed: 30, coinBonus: 40, radius: 40 };
function upgradePrice(id: UpgradeId) { return Math.round(upgradeBasePrices[id] * Math.pow(1.65, upgrades[id])); }
function refreshShop() {
  updateHud();
  document.querySelectorAll<HTMLElement>('.slot').forEach((slot) => {
    const id = toolOrder.find((toolId) => tools[toolId].slot === Number(slot.dataset.slot));
    slot.classList.toggle('locked', !id || !unlockedTools.has(id));
  });
  document.querySelectorAll<HTMLButtonElement>('.buy-tool').forEach((button) => {
    const id = button.dataset.tool as ToolId;
    const owned = unlockedTools.has(id);
    button.classList.toggle('owned', owned);
    button.textContent = owned ? '보유 중' : `● ${toolPrices[id] ?? 0}`;
  });
  document.querySelectorAll<HTMLButtonElement>('.buy-upgrade').forEach((button) => {
    const id = button.dataset.upgrade as UpgradeId;
    button.textContent = upgrades[id] >= 10 ? 'MAX' : `● ${upgradePrice(id)}`;
    document.querySelector(`#level-${id}`)!.textContent = `Lv.${upgrades[id]}`;
  });
  document.querySelectorAll<HTMLButtonElement>('.buy-premium-tool').forEach((button) => {
    const id = button.dataset.tool as ToolId;
    const owned = unlockedTools.has(id);
    button.classList.toggle('owned', owned);
    button.textContent = owned ? '보유 중' : `💎 ${premiumToolPrices[id] ?? 0}`;
  });
  document.querySelectorAll<HTMLButtonElement>('.select-region').forEach((button) => {
    const id = Number(button.dataset.region) as RegionId;
    const locked = id > unlockedRegion;
    const current = id === currentRegionId;
    const state = regionProgress[id];
    const remaining = state ? Object.values(state.remaining).reduce((sum, count) => sum + (count ?? 0), 0) : undefined;
    const percentage = state && state.total > 0 ? Math.round(((state.total - (remaining ?? state.total)) / state.total) * 100) : 0;
    button.disabled = locked || current;
    button.classList.toggle('owned', current);
    button.textContent = locked ? '잠김' : current ? '현재 지역' : '이동';
    const label = document.querySelector<HTMLElement>(`[data-region-progress="${id}"]`)!;
    label.textContent = locked ? '이전 지역 완료 시 해금' : `진행도 ${percentage}%`;
  });
  document.querySelectorAll<HTMLButtonElement>('.claim-mission').forEach((button) => {
    const id = button.dataset.mission as MissionId;
    const definition = missionPool.find((mission) => mission.id === id)!;
    const progress = missionProgress[id] ?? 0;
    document.querySelector<HTMLElement>(`[data-mission-progress="${id}"]`)!.textContent = `${progress} / ${definition.target}`;
    const ready = progress >= definition.target;
    button.disabled = !ready;
    button.classList.toggle('claimed', ready);
    button.textContent = ready ? '받기' : `${progress}/${definition.target}`;
  });
  document.querySelectorAll<HTMLButtonElement>('.claim-achievement').forEach((button) => {
    const id = button.dataset.achievement as AchievementId;
    const definition = achievements[id];
    const claimed = achievementsClaimed.has(id);
    const progress = Math.min(achievementProgressValue(id), definition.target);
    document.querySelector<HTMLElement>(`[data-achievement-progress="${id}"]`)!.textContent = `${progress} / ${definition.target}`;
    const ready = !claimed && progress >= definition.target;
    button.disabled = claimed || !ready;
    button.classList.toggle('claimed', claimed);
    button.textContent = claimed ? '완료' : ready ? '받기' : `${progress}/${definition.target}`;
  });
}
function toggleShop(force?: boolean) {
  shopOpen = force ?? !shopOpen;
  shop.classList.toggle('open', shopOpen);
  stopCleaning();
  keys.clear();
  if (shopOpen) {
    document.exitPointerLock?.();
    refreshShop();
  } else if (gameStarted) {
    start.classList.add('hidden');
    if (!usesMobileControls()) canvas.requestPointerLock?.();
  }
}
document.querySelector('#shop-button')!.addEventListener('click', () => toggleShop());
document.querySelector('#fullscreen-button')!.addEventListener('click', enterFullscreen);
document.querySelector('#rotate-fullscreen')!.addEventListener('click', enterFullscreen);
document.querySelector('#shop-close')!.addEventListener('click', () => toggleShop(false));
document.querySelectorAll<HTMLButtonElement>('[data-shop-tab]').forEach((button) => button.addEventListener('click', () => {
  document.querySelectorAll('[data-shop-tab]').forEach((item) => item.classList.toggle('selected', item === button));
  document.querySelectorAll<HTMLElement>('[data-shop-content]').forEach((content) => content.classList.toggle('selected', content.dataset.shopContent === button.dataset.shopTab));
}));
document.querySelectorAll<HTMLButtonElement>('.buy-tool').forEach((button) => button.addEventListener('click', () => {
  const id = button.dataset.tool as ToolId;
  if (unlockedTools.has(id)) return;
  const price = toolPrices[id] ?? Infinity;
  if (coins < price) { showNotice('코인이 부족합니다'); return; }
  coins -= price; unlockedTools.add(id); persist(); refreshShop(); showNotice(`${tools[id].name} 해금!`);
}));
document.querySelectorAll<HTMLButtonElement>('.buy-upgrade').forEach((button) => button.addEventListener('click', () => {
  const id = button.dataset.upgrade as UpgradeId;
  if (upgrades[id] >= 10) return;
  const price = upgradePrice(id);
  if (coins < price) { showNotice('코인이 부족합니다'); return; }
  coins -= price; upgrades[id] += 1; persist(); refreshShop(); equipTool(currentToolId); showNotice('업그레이드 완료!');
}));
document.querySelectorAll<HTMLButtonElement>('.buy-premium-tool').forEach((button) => button.addEventListener('click', () => {
  const id = button.dataset.tool as ToolId;
  if (unlockedTools.has(id)) return;
  const price = premiumToolPrices[id] ?? Infinity;
  if (gems < price) { showNotice('프리미엄 재화가 부족합니다'); return; }
  gems -= price;
  unlockedTools.add(id);
  persist();
  refreshShop();
  equipTool(id);
  showNotice(`${tools[id].name} 해금!`);
}));
document.querySelectorAll<HTMLButtonElement>('.select-region').forEach((button) => button.addEventListener('click', () => {
  const id = Number(button.dataset.region) as RegionId;
  if (id > unlockedRegion || id === currentRegionId) return;
  enterRegion(id);
  toggleShop(false);
  showNotice(`${regions[id].name}(으)로 이동`);
}));
document.querySelectorAll<HTMLButtonElement>('.claim-mission').forEach((button) => button.addEventListener('click', () => {
  claimMission(button.dataset.mission as MissionId);
}));
document.querySelectorAll<HTMLButtonElement>('.claim-achievement').forEach((button) => button.addEventListener('click', () => {
  claimAchievement(button.dataset.achievement as AchievementId);
}));

let joystickPointer: number | undefined;
let joystickX = 0;
let joystickY = 0;
const joystick = document.querySelector<HTMLElement>('#joystick');
const joystickKnob = joystick?.querySelector<HTMLElement>('i');
joystick?.addEventListener('pointerdown', (event) => {
  joystickPointer = event.pointerId;
  joystick.setPointerCapture(event.pointerId);
});
joystick?.addEventListener('pointermove', (event) => {
  if (event.pointerId !== joystickPointer) return;
  const bounds = joystick.getBoundingClientRect();
  joystickX = THREE.MathUtils.clamp((event.clientX - (bounds.left + bounds.width / 2)) / (bounds.width * 0.35), -1, 1);
  joystickY = THREE.MathUtils.clamp((event.clientY - (bounds.top + bounds.height / 2)) / (bounds.height * 0.35), -1, 1);
  if (joystickKnob) joystickKnob.style.transform = `translate(${joystickX * 26}px,${joystickY * 26}px)`;
});
joystick?.addEventListener('pointerup', () => {
  joystickPointer = undefined;
  joystickX = joystickY = 0;
  if (joystickKnob) joystickKnob.style.transform = '';
});

let lastTouchX = 0;
let lastTouchY = 0;
canvas.addEventListener('touchstart', (event) => {
  const touch = event.touches[0];
  lastTouchX = touch.clientX;
  lastTouchY = touch.clientY;
}, { passive: true });
canvas.addEventListener('touchmove', (event) => {
  const touch = event.touches[0];
  yaw -= (touch.clientX - lastTouchX) * 0.006;
  pitch -= (touch.clientY - lastTouchY) * 0.004;
  pitch = THREE.MathUtils.clamp(pitch, -1.05, 0.75);
  lastTouchX = touch.clientX;
  lastTouchY = touch.clientY;
}, { passive: true });

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();
enterRegion(currentRegionId);
equipTool('basicBroom');

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  camera.rotation.order = 'YXZ';
  camera.rotation.y = yaw;
  camera.rotation.x = pitch;
  updateCleaning(delta);

  const tool = tools[currentToolId];
  const movementBlocked = shopOpen || (isCleaning && !tool.canMoveWhileCleaning);
  const movement = new THREE.Vector3(
    Number(keys.has('KeyD')) - Number(keys.has('KeyA')) + joystickX,
    0,
    Number(keys.has('KeyS')) - Number(keys.has('KeyW')) + joystickY,
  );
  const isMoving = !movementBlocked && movement.lengthSq() > 0;
  if (isMoving) {
    movement.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    const previousX = camera.position.x;
    const previousZ = camera.position.z;
    camera.position.addScaledVector(movement, 5.5 * (1 + upgrades.moveSpeed * 0.1) * delta);
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, -20, 20);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, -16, 16);
    if (isInsideHouse(camera.position.x, camera.position.z, 0.35)) {
      camera.position.x = previousX;
      camera.position.z = previousZ;
    }
  }
  if (!grounded) {
    verticalVelocity -= 13.5 * delta;
    camera.position.y += verticalVelocity * delta;
    if (camera.position.y <= standingHeight) {
      camera.position.y = standingHeight;
      verticalVelocity = 0;
      grounded = true;
      playJumpLandSound();
    }
  }
  if (isMoving && grounded) {
    if (footstepSound.paused) void footstepSound.play().catch(() => undefined);
  } else if (!footstepSound.paused) {
    footstepSound.pause();
    footstepSound.currentTime = 0;
  }
  const walkBob = isMoving ? Math.sin(performance.now() * 0.012) * 0.025 : 0;
  toolAnchor.position.x = toolRestX;
  toolAnchor.position.y = THREE.MathUtils.lerp(toolAnchor.position.y, toolRestY + walkBob, 0.18);
  if (isCleaning && (currentToolId === 'pickaxe' || currentToolId === 'neonPickaxe')) {
    // Overhead strike: slow raise, then a quick downward chop.
    const raiseFraction = 0.62;
    const cycleT = (performance.now() % 620) / 620;
    const raiseAmount = cycleT < raiseFraction ? cycleT / raiseFraction : 1 - (cycleT - raiseFraction) / (1 - raiseFraction);
    toolAnchor.rotation.x = -0.15 - raiseAmount * 0.85;
  } else if (isCleaning) {
    toolAnchor.rotation.x = Math.sin(performance.now() * 0.045) * 0.045 - 0.02;
  } else {
    toolAnchor.rotation.x = THREE.MathUtils.lerp(toolAnchor.rotation.x, -0.1, 0.15);
  }
  renderer.render(scene, camera);
}
animate();
refreshShop();
