import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  achievements,
  categories,
  categoryOrder,
  missionPool,
  objects,
  regionCompletionRewards,
  regions,
  tools,
  type AchievementId,
  type CategoryId,
  type MissionId,
  type ObjectKind,
  type RegionId,
  type ToolId,
} from './gameData';
import { getLocale, setLocale, t } from './i18n';
import { initRanking, isConnected, syncStats, loadRankings, getNickname, setNickname, resetAllData, scheduleCloudSave, flushCloudSave, loadCloudSave, getVxShopUrl } from './ranking';
import './style.css';

type Cleanable = THREE.Group & {
  userData: { kind: ObjectKind; cleaned?: boolean; progress: number };
};

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isTouchDevice() });
renderer.setPixelRatio(Math.min(devicePixelRatio, isTouchDevice() ? 1.5 : 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x66c8f2);
scene.fog = new THREE.Fog(0x8dd4ef, 28, 62);

const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.1, 100);
const cameraBaseZ = matchMedia('(pointer: coarse)').matches ? 13 : 11;
camera.position.set(0, 1.85, cameraBaseZ);
scene.add(camera);

scene.add(new THREE.HemisphereLight(0xc6efff, 0x5f7b32, 2.2));
const sun = new THREE.DirectionalLight(0xfff2cd, 3.2);
sun.position.set(-10, 18, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(isTouchDevice() ? 1024 : 2048, isTouchDevice() ? 1024 : 2048);
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

// 집: 벽 4면 + 문 개구부로 구성해 안으로 들어갈 수 있음.
// 외벽면 x -18..-6, z -12.5..-7.5 — 산책로(x -4..4)와 정원 산울타리 라인(x -4.3)에 겹치지 않게 왼쪽으로 물러남.
box([10.0, 5.5, 0.3], 0xffdb9f, [-13, 2.75, -7.65]);   // 앞벽 (문 왼쪽, x -18..-8)
box([0.6, 5.5, 0.3], 0xffdb9f, [-6.3, 2.75, -7.65]);   // 앞벽 (문 오른쪽, x -6.6..-6)
box([1.4, 2.8, 0.3], 0xffdb9f, [-7.3, 4.1, -7.65]);    // 문 위 상인방
box([12, 5.5, 0.3], 0xffdb9f, [-12, 2.75, -12.35]);    // 뒷벽
box([0.3, 5.5, 5], 0xffdb9f, [-17.85, 2.75, -10]);     // 왼쪽 벽
box([0.3, 5.5, 5], 0xffdb9f, [-6.15, 2.75, -10]);      // 오른쪽 벽
box([12.6, 0.65, 5.8], 0xe76f51, [-12, 5.8, -10]);     // 지붕
box([11.4, 0.06, 4.4], 0xc9a06a, [-12, 0.03, -10]);    // 실내 바닥
box([3.2, 0.04, 2.2], 0xa8524a, [-12, 0.07, -10]);     // 러그
const interiorLight = new THREE.PointLight(0xffe6b8, 18, 12, 1.8);
interiorLight.position.set(-12, 4.2, -10);
scene.add(interiorLight);
// 집 디테일: 창문(테두리·창살·창턱), 현관문, 굴뚝
for (const x of [-15, -12, -9]) {
  box([1.9, 2.5, 0.1], 0x8a5a33, [x, 3.1, -7.49]);   // 창문 테두리
  box([1.6, 2.2, 0.15], 0x83cceb, [x, 3.1, -7.45]);  // 유리
  box([0.08, 2.2, 0.17], 0xf7f2e6, [x, 3.1, -7.44]); // 세로 창살
  box([1.6, 0.08, 0.17], 0xf7f2e6, [x, 3.1, -7.44]); // 가로 창살
  box([1.9, 0.12, 0.3], 0xf7f2e6, [x, 1.92, -7.38]); // 창턱
}
// 현관문: 경첩(피벗)에 달려 있어 가까이 가면 자동으로 열림
box([0.12, 2.8, 0.4], 0x6b4426, [-8.03, 1.4, -7.65]);  // 문설주 좌
box([0.12, 2.8, 0.4], 0x6b4426, [-6.57, 1.4, -7.65]);  // 문설주 우
const doorPivot = new THREE.Group();
doorPivot.position.set(-7.95, 0, -7.65);
scene.add(doorPivot);
const doorPanel = new THREE.Mesh(
  new THREE.BoxGeometry(1.3, 2.55, 0.1),
  new THREE.MeshStandardMaterial({ color: 0x8a5a33, roughness: 0.8 }),
);
doorPanel.position.set(0.65, 1.28, 0);
doorPanel.castShadow = true;
doorPivot.add(doorPanel);
const doorKnob = new THREE.Mesh(
  new THREE.SphereGeometry(0.06, 8, 6),
  new THREE.MeshStandardMaterial({ color: 0xf2c14e, metalness: 0.6, roughness: 0.35 }),
);
doorKnob.position.set(1.15, 1.25, 0.09);
doorPivot.add(doorKnob);
let doorOpenAmount = 0;
let doorIsOpen = false;
box([1.9, 0.2, 1.1], 0xcfc0a5, [-7.3, 0.1, -7.1]);     // 현관 계단
box([0.95, 1.7, 0.95], 0xb0563a, [-15.2, 6.7, -10.6]); // 굴뚝
box([1.15, 0.22, 1.15], 0x8f4430, [-15.2, 7.65, -10.6]); // 굴뚝 캡

// 집 안 일일 보물상자 (하루 1회 F키/탭으로 개봉)
const chestGroup = new THREE.Group();
chestGroup.position.set(-12.5, 0, -10);
// 상자 정면(자물쇠 쪽, +Z)이 현관문 쪽을 향하도록 90도 회전 (러그 위에 딱 맞게)
chestGroup.rotation.y = Math.PI / 2;
scene.add(chestGroup);
const chestWoodMat = new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.7 });
const chestGoldMat = new THREE.MeshStandardMaterial({ color: 0xf2c14e, metalness: 0.55, roughness: 0.35 });
const chestBody = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.62, 0.8), chestWoodMat);
chestBody.position.y = 0.31; chestBody.castShadow = chestBody.receiveShadow = true;
chestGroup.add(chestBody);
for (const bx of [-0.42, 0.42]) {
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.64, 0.82), chestGoldMat);
  band.position.set(bx, 0.31, 0); chestGroup.add(band);
}
const chestLock = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.08), chestGoldMat);
chestLock.position.set(0, 0.42, 0.42); chestGroup.add(chestLock);
const chestLid = new THREE.Group();
chestLid.position.set(0, 0.62, -0.4); // 뒤쪽 경첩
chestGroup.add(chestLid);
const chestLidMesh = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.24, 0.8), chestWoodMat);
chestLidMesh.position.set(0, 0.12, 0.4); chestLidMesh.castShadow = true;
chestLid.add(chestLidMesh);
const chestLidBand = new THREE.Mesh(new THREE.BoxGeometry(1.17, 0.1, 0.1), chestGoldMat);
chestLidBand.position.set(0, 0.12, 0.78); chestLid.add(chestLidBand);
const chestGlow = new THREE.Mesh(
  new THREE.IcosahedronGeometry(0.13, 0),
  new THREE.MeshBasicMaterial({ color: 0xffe27a }),
);
chestGlow.position.set(0, 1.15, 0); chestGroup.add(chestGlow);
// 울타리: 기둥 + 2단 레일 + 기둥 캡
for (let x = -21; x <= 21; x += 2.1) {
  box([0.14, 1.7, 0.18], 0xf4ead5, [x, 0.85, -18]);
  box([2.1, 0.15, 0.15], 0xf4ead5, [x, 0.55, -17.98]);
  box([2.1, 0.12, 0.12], 0xf4ead5, [x, 1.15, -17.98]);
  box([0.26, 0.1, 0.3], 0xe6d8bc, [x, 1.76, -18]);
}

// 배경 나무: 그래픽 품질에 따라 폴리곤 디테일을 바꿔 다시 생성할 수 있게 그룹으로 관리
const treeSpecs: Array<[number, number, number]> = [[13, -10, 1.15], [17, 3, 0.9], [-17, 4, 1]];
const treeGroup = new THREE.Group();
scene.add(treeGroup);
// 수관 블롭 오프셋(x, y, z, 크기 배율): 품질이 높을수록 여러 덩어리를 겹쳐 풍성하게
const crownBlobOffsets: Array<[number, number, number, number]> = [
  [0, 0, 0, 1],
  [0.9, -0.5, 0.55, 0.62],
  [-0.85, -0.45, -0.5, 0.58],
  [0.15, 0.75, -0.7, 0.55],
];
function disposeGroup(group: THREE.Group) {
  group.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      (Array.isArray(child.material) ? child.material : [child.material]).forEach((material) => material.dispose());
    }
  });
  group.clear();
}
function buildTrees(quality: GraphicsQuality) {
  const preset = graphicsPresets[quality];
  disposeGroup(treeGroup);
  for (const [x, z, scale] of treeSpecs) {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28 * scale, 0.4 * scale, 3.2 * scale, preset.trunkSegments),
      new THREE.MeshStandardMaterial({ color: 0x85532f }),
    );
    trunk.position.set(x, 1.6 * scale, z);
    trunk.castShadow = true;
    treeGroup.add(trunk);
    for (const [bx, by, bz, bs] of crownBlobOffsets.slice(0, preset.crownBlobs)) {
      const crown = new THREE.Mesh(
        new THREE.IcosahedronGeometry(2 * scale * bs, preset.crownDetail),
        new THREE.MeshStandardMaterial({ color: 0x6eae35, flatShading: true }),
      );
      crown.position.set(x + bx * scale, (4.3 + by) * scale, z + bz * scale);
      crown.castShadow = true;
      treeGroup.add(crown);
    }
  }
}

// 배경 소품(구름): 품질별 개수만큼 시드 고정 랜덤 배치 (품질 바꿔도 같은 자리)
const backgroundGroup = new THREE.Group();
scene.add(backgroundGroup);
function buildBackgroundDetail(quality: GraphicsQuality) {
  const preset = graphicsPresets[quality];
  disposeGroup(backgroundGroup);
  let seed = 20260709;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < preset.cloudCount; i += 1) {
    const cloud = new THREE.Group();
    const puffMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
    const puffs = 3 + Math.floor(rand() * 2);
    for (let p = 0; p < puffs; p += 1) {
      const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1 + rand() * 1.2, 1), puffMaterial);
      puff.position.set(p * 1.6 - puffs * 0.8, rand() * 0.5, rand() * 0.8);
      cloud.add(puff);
    }
    cloud.position.set((rand() - 0.5) * 46, 13.5 + rand() * 3.5, (rand() - 0.5) * 36);
    backgroundGroup.add(cloud);
  }
}

// 그래픽 품질 프리셋: 배경 폴리곤 디테일 + 소품 개수 + 그림자 해상도 + 렌더 픽셀비율
type GraphicsQuality = 'low' | 'medium' | 'high';
interface GraphicsPreset {
  crownDetail: number;
  crownBlobs: number;
  trunkSegments: number;
  cloudCount: number;
  shadowMapSize: number;
  pixelRatio: number;
}
const graphicsPresets: Record<GraphicsQuality, GraphicsPreset> = {
  low: { crownDetail: 1, crownBlobs: 1, trunkSegments: 7, cloudCount: 0, shadowMapSize: 1024, pixelRatio: 1.25 },
  medium: { crownDetail: 2, crownBlobs: 2, trunkSegments: 10, cloudCount: 3, shadowMapSize: 2048, pixelRatio: 1.5 },
  high: { crownDetail: 2, crownBlobs: 4, trunkSegments: 16, cloudCount: 5, shadowMapSize: 4096, pixelRatio: 2 },
};
function applyGraphicsQuality(quality: GraphicsQuality) {
  const preset = graphicsPresets[quality];
  buildTrees(quality);
  buildBackgroundDetail(quality);
  sun.shadow.mapSize.set(preset.shadowMapSize, preset.shadowMapSize);
  sun.shadow.map?.dispose();
  sun.shadow.map = null;
  renderer.setPixelRatio(Math.min(devicePixelRatio, preset.pixelRatio));
}

const cleanables: Cleanable[] = [];
const leafColors = [0xe9682c, 0xf6b82f, 0xb84b27, 0xef8d22];
const houseBounds = { minX: -18.3, maxX: -5.7, minZ: -12.8, maxZ: -7.15 };

function isInsideHouse(x: number, z: number, padding = 0) {
  return x > houseBounds.minX - padding && x < houseBounds.maxX + padding
    && z > houseBounds.minZ - padding && z < houseBounds.maxZ + padding;
}

// 플레이어 이동 충돌용 벽 목록(문 개구부 x -8.0..-6.6 제외). isInsideHouse는 오브젝트 스폰 제외용으로 유지.
const wallRects = [
  { minX: -18, maxX: -8.0, minZ: -7.8, maxZ: -7.5 },   // 앞벽 좌
  { minX: -6.6, maxX: -6, minZ: -7.8, maxZ: -7.5 },    // 앞벽 우
  { minX: -18, maxX: -6, minZ: -12.5, maxZ: -12.2 },   // 뒷벽
  { minX: -18, maxX: -17.7, minZ: -12.5, maxZ: -7.5 }, // 왼쪽 벽
  { minX: -6.3, maxX: -6, minZ: -12.5, maxZ: -7.5 },   // 오른쪽 벽
];
function hitsWall(x: number, z: number, padding = 0) {
  return wallRects.some((wall) =>
    x > wall.minX - padding && x < wall.maxX + padding && z > wall.minZ - padding && z < wall.maxZ + padding);
}

// 청소 불가 구조물 회피 목록. [x, z, 반경]
// - 정적(항상): 나무(수관 2*scale+여유), 현관 계단. 울타리(z=-18)는 스폰 z범위 밖이라 제외.
// - 지역 장식(해당 지역에서만): 정원 산울타리·꽃(2), 돌 정원 디딤돌(3).
const staticObstacles: Array<[number, number, number]> = [
  ...treeSpecs.map(([x, z, s]) => [x, z, 2 * s + 0.6] as [number, number, number]),
  [-7.3, -6.9, 1.3], // 현관 계단 (앞쪽으로 튀어나온 부분)
];
const decorObstacles: Partial<Record<RegionId, Array<[number, number, number]>>> = {};
function addDecorObstacle(region: RegionId, x: number, z: number, r: number) {
  (decorObstacles[region] ??= []).push([x, z, r]);
}
function nearAny(list: Array<[number, number, number]> | undefined, x: number, z: number) {
  return !!list?.some(([ox, oz, r]) => Math.hypot(x - ox, z - oz) < r);
}
// 청소물 스폰 회피: 집 + 정적 구조물 + 현재 지역 장식
function isBlockedSpawn(x: number, z: number) {
  return isInsideHouse(x, z, 0.45) || nearAny(staticObstacles, x, z) || nearAny(decorObstacles[currentRegionId], x, z);
}
// 고정 범위 스폰(잔디/돌)도 구조물을 피하도록: 최대 20회까지 다시 뽑는다.
function avoidObstacles(gen: () => [number, number]): [number, number] {
  let pos = gen();
  for (let tries = 0; tries < 20 && (nearAny(staticObstacles, pos[0], pos[1]) || nearAny(decorObstacles[currentRegionId], pos[0], pos[1])); tries++) {
    pos = gen();
  }
  return pos;
}

// 청소물 스폰 위치 (집 + 구조물 + 현재 지역 장식 회피)
function randomOpenPosition(): [number, number] {
  let x = 0;
  let z = 0;
  do {
    x = (Math.random() - 0.5) * 36;
    z = (Math.random() - 0.5) * 30;
  } while (isBlockedSpawn(x, z));
  return [x, z];
}

// 장식(꽃/디딤돌) 배치 위치 — 집 + 정적 구조물만 회피 (장식끼리는 겹쳐도 됨)
function randomDecorPosition(): [number, number] {
  let x = 0;
  let z = 0;
  do {
    x = (Math.random() - 0.5) * 36;
    z = (Math.random() - 0.5) * 30;
  } while (isInsideHouse(x, z, 0.45) || nearAny(staticObstacles, x, z));
  return [x, z];
}

// 집 실내 바닥에 스폰할 위치. 벽에서 0.5 안쪽으로 여유를 두고, 일일 보급상자와도 겹치지 않게.
function randomHousePosition(): [number, number] {
  let x = 0;
  let z = 0;
  do {
    x = -17.2 + Math.random() * 10.4; // 좌우 벽 사이 (-17.2 ~ -6.8)
    z = -11.7 + Math.random() * 3.4;  // 앞뒤 벽 사이 (-11.7 ~ -8.3)
  } while (Math.hypot(x - chestGroup.position.x, z - chestGroup.position.z) < 1.7);
  return [x, z];
}

// Region visual themes: front yard (grass), garden (flowers/hedges), stone garden (rock/gravel).
const regionThemes: Record<RegionId, { sky: number; fog: number; ground: number; path: number }> = {
  1: { sky: 0x66c8f2, fog: 0x8dd4ef, ground: 0x75b94b, path: 0xd9bb83 },
  2: { sky: 0x78d6b8, fog: 0x9fe4cf, ground: 0x4f9e3f, path: 0xc9a86a },
  3: { sky: 0xe0c9a0, fog: 0xd8c295, ground: 0xab9877, path: 0x8f7a5c },
};

function flowerCluster(x: number, z: number, color: number) {
  const group = new THREE.Group();
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 0.4, 5),
    new THREE.MeshStandardMaterial({ color: 0x3f7a2f }),
  );
  stem.position.y = 0.2;
  group.add(stem);
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const petal = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 6, 5),
      new THREE.MeshStandardMaterial({ color, roughness: 0.6 }),
    );
    petal.position.set(Math.cos(angle) * 0.15, 0.42, Math.sin(angle) * 0.15);
    group.add(petal);
  }
  const center = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 6, 5),
    new THREE.MeshStandardMaterial({ color: 0xffd23f }),
  );
  center.position.y = 0.42;
  group.add(center);
  group.position.set(x, 0, z);
  group.castShadow = true;
  return group;
}

const gardenDecor = new THREE.Group();
const flowerColors = [0xe85f8a, 0xf2b6d4, 0x9b6fd6, 0xf7e14a];
for (let i = 0; i < (isTouchDevice() ? 18 : 36); i++) {
  const [x, z] = randomDecorPosition();
  gardenDecor.add(flowerCluster(x, z, flowerColors[Math.floor(Math.random() * flowerColors.length)]));
  addDecorObstacle(2, x, z, 0.8);
}
for (const side of [-1, 1]) {
  for (let z = -16; z <= 16; z += (isTouchDevice() ? 4.8 : 3.2)) {
    const hedge = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 7, 6),
      new THREE.MeshStandardMaterial({ color: 0x3f8a3a, flatShading: true, roughness: 0.9 }),
    );
    hedge.position.set(side * 4.3, 0.5, z);
    hedge.castShadow = hedge.receiveShadow = true;
    gardenDecor.add(hedge);
    addDecorObstacle(2, side * 4.3, z, 0.9);
  }
}
gardenDecor.visible = false;
scene.add(gardenDecor);

// Flat stepping-stone slabs: a dry rock-garden look that reads clearly differently from the
// small round dodecahedron "stone" cleanable objects.
function slabStone(x: number, z: number) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.9 + Math.random() * 0.4, 0.12, 0.6 + Math.random() * 0.3),
    new THREE.MeshStandardMaterial({ color: 0x9a9188, roughness: 1 }),
  );
  mesh.position.set(x, 0.06, z);
  mesh.rotation.y = Math.random() * Math.PI;
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

const stoneDecor = new THREE.Group();
for (let i = 0; i < (isTouchDevice() ? 9 : 18); i++) {
  const [x, z] = randomDecorPosition();
  stoneDecor.add(slabStone(x, z));
  addDecorObstacle(3, x, z, 0.8);
}
stoneDecor.visible = false;
scene.add(stoneDecor);

function applyRegionTheme(regionId: RegionId) {
  const theme = regionThemes[regionId];
  scene.background = new THREE.Color(theme.sky);
  (scene.fog as THREE.Fog).color.setHex(theme.fog);
  (ground.material as THREE.MeshStandardMaterial).color.setHex(theme.ground);
  (path.material as THREE.MeshStandardMaterial).color.setHex(theme.path);
  gardenDecor.visible = regionId === 2;
  stoneDecor.visible = regionId === 3;
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
  // Five-lobed maple leaf silhouette (top, two upper side, two lower side lobes) with a short stem.
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.5);
  shape.lineTo(0.1, 0.3); shape.lineTo(0.4, 0.24);
  shape.lineTo(0.18, 0.08); shape.lineTo(0.34, -0.15);
  shape.lineTo(0.1, -0.18); shape.lineTo(0.09, -0.36);
  shape.lineTo(0.03, -0.5);
  shape.lineTo(-0.09, -0.36); shape.lineTo(-0.1, -0.18);
  shape.lineTo(-0.34, -0.15); shape.lineTo(-0.18, 0.08);
  shape.lineTo(-0.4, 0.24); shape.lineTo(-0.1, 0.3);
  shape.closePath();
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

// 집 실내에 추가로 스폰할 청소 오브젝트 수 (빗자루로 청소 가능한 낙엽/캔)
const HOUSE_LEAF = 6;
const HOUSE_CAN = 2;

function freshRegionCounts(regionId: RegionId): RegionObjectCounts {
  const counts = { ...regions[regionId].objectCounts };
  const rareCount = () => 1 + (Math.random() < 0.5 ? 0 : 1);
  counts.goldCan = rareCount();
  counts.goldChest = rareCount();
  counts.gemChest = rareCount();
  counts.goldStone = regionId === 3 ? rareCount() : 0;
  // 집 안 청소 오브젝트도 지역 완료 카운트에 포함
  counts.leaf = (counts.leaf ?? 0) + HOUSE_LEAF;
  counts.can = (counts.can ?? 0) + HOUSE_CAN;
  return counts;
}

function populateRegion(regionId: RegionId, state: RegionProgressState) {
  cleanables.forEach((object) => scene.remove(object));
  cleanables.length = 0;
  const counts = state.remaining;
  // 집 안 오브젝트는 실내 바닥(윗면 y≈0.06) 위에 앉도록 마지막 생성물의 y를 올린다.
  const liftLastIntoHouse = () => { cleanables[cleanables.length - 1].position.y = 0.11; };
  for (let i = 0; i < (counts.leaf ?? 0); i++) {
    if (i < HOUSE_LEAF) { createLeaf(...randomHousePosition()); liftLastIntoHouse(); } // 처음 몇 개는 집 안에
    else createLeaf(...randomOpenPosition());
  }
  for (let i = 0; i < (counts.can ?? 0); i++) {
    if (i === 0) createCan(0, 3.1);                            // 튜토리얼용 첫 캔은 고정 위치
    else if (i <= HOUSE_CAN) { createCan(...randomHousePosition()); liftLastIntoHouse(); }
    else createCan(...randomOpenPosition());
  }
  for (let i = 0; i < (counts.grass ?? 0); i++) createGrass(...avoidObstacles(() => [7 + Math.random() * 8, -10 + Math.random() * 18]));
  // x/z 범위가 집 왼쪽으로 이동한 뒤로도 집 앞면(z -7.15)과 겹치지 않도록 z 시작점을 -6.5로 뒤로 뺌.
  for (let i = 0; i < (counts.stone ?? 0); i++) createStone(...avoidObstacles(() => [-18 + Math.random() * 7, -6.5 + Math.random() * 16.5]));
  for (let i = 0; i < (counts.goldCan ?? 0); i++) createGoldCan(...randomOpenPosition());
  for (let i = 0; i < (counts.goldChest ?? 0); i++) createChest('goldChest', ...randomOpenPosition());
  for (let i = 0; i < (counts.gemChest ?? 0); i++) createChest('gemChest', ...randomOpenPosition());
  for (let i = 0; i < (counts.goldStone ?? 0); i++) createGoldStone(...avoidObstacles(() => [-18 + Math.random() * 7, -6.5 + Math.random() * 16.5]));
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
pickaxeTool.rotation.set(0.3, -1.2, -1.3);
pickaxeTool.position.z = -0.4;

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
  group.rotation.set(-0.8, 0, -2);
  group.position.y = -0.65;
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
type UpgradeId = 'cleanSpeed' | 'moveSpeed' | 'coinBonus' | 'radius';
interface PlayerStats {
  leafCleaned: number;
  canCleaned: number;
  coinsEarned: number;
  regionsCleared: number;
  totalCleaned: number;
}
interface GameSettings {
  language: 'ko' | 'en';
  bgmVolume: number;
  sfxVolume: number;
  sensitivity: number;
  graphicsQuality: GraphicsQuality;
}
interface SaveData {
  coins: number;
  gems: number;
  currentRegion: RegionId;
  unlockedRegion: RegionId;
  regionProgress: Partial<Record<RegionId, RegionProgressState>>;
  unlockedTools: ToolId[];
  equipped: Record<CategoryId, ToolId | null>;
  upgrades: Record<UpgradeId, number>;
  stats: PlayerStats;
  missionProgress: Record<MissionId, number>;
  achievementsClaimed: AchievementId[];
  coinBoostExpiry: number;
  robotVacuumOwned: boolean;
  settings: GameSettings;
  tutorial: number;
  chestDayClaimed: number;
  adsRemoved: boolean;
  savedAt: number;
}
const defaultStats: PlayerStats = { leafCleaned: 0, canCleaned: 0, coinsEarned: 0, regionsCleared: 0, totalCleaned: 0 };
const defaultMissionProgress: Record<MissionId, number> = { leaf100: 0, can30: 0, regionClear: 0, fastClear5min: 0 };
const defaultSettings: GameSettings = { language: 'en', bgmVolume: 1, sfxVolume: 1, sensitivity: 1, graphicsQuality: 'high' };
const defaultSave: SaveData = {
  coins: 0,
  gems: 0,
  currentRegion: 1,
  unlockedRegion: 1,
  regionProgress: {},
  unlockedTools: ['basicBroom'],
  equipped: { 1: 'basicBroom', 2: null, 3: null },
  upgrades: { cleanSpeed: 0, moveSpeed: 0, coinBonus: 0, radius: 0 },
  stats: { ...defaultStats },
  missionProgress: { ...defaultMissionProgress },
  achievementsClaimed: [],
  coinBoostExpiry: 0,
  robotVacuumOwned: false,
  settings: { ...defaultSettings },
  tutorial: 0,
  chestDayClaimed: -1,
  adsRemoved: false,
  savedAt: 0,
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
      equipped: { ...defaultSave.equipped, ...(parsed.equipped ?? {}) },
      upgrades: { ...defaultSave.upgrades, ...(parsed.upgrades ?? {}) },
      stats: { ...defaultStats, ...(parsed.stats ?? {}) },
      missionProgress: { ...defaultMissionProgress, ...(parsed.missionProgress ?? {}) },
      achievementsClaimed: Array.isArray(parsed.achievementsClaimed) ? parsed.achievementsClaimed : [],
      coinBoostExpiry: Number(parsed.coinBoostExpiry) || 0,
      robotVacuumOwned: Boolean(parsed.robotVacuumOwned),
      settings: { ...defaultSettings, ...(parsed.settings ?? {}) },
      tutorial: Number.isFinite(Number(parsed.tutorial)) ? Number(parsed.tutorial) : 0,
      chestDayClaimed: Number.isFinite(Number(parsed.chestDayClaimed)) ? Number(parsed.chestDayClaimed) : -1,
      adsRemoved: Boolean(parsed.adsRemoved),
      savedAt: Number(parsed.savedAt) || 0,
    };
  } catch { return structuredClone(defaultSave); }
}
const saveData = loadSave();
let coins = saveData.coins;
let gems = saveData.gems;

// ── 콤보: 끊기지 않고 연속 청소하면 배수가 붙는다 (COMBO_WINDOW 초 안에 다음 청소) ──
const COMBO_WINDOW = 3;
let comboCount = 0;
let comboTimer = 0;
const comboEl = document.querySelector<HTMLElement>('#combo')!;
const comboCountEl = document.querySelector<HTMLElement>('#combo-count')!;
const comboMultEl = document.querySelector<HTMLElement>('#combo-mult')!;
const comboBarEl = document.querySelector<HTMLElement>('#combo-bar')!;
function comboMultiplier() {
  return 1 + Math.min(Math.floor(comboCount / 3), 8) * 0.25; // 3연속마다 +0.25, 최대 x3
}
function registerComboClean() {
  comboCount += 1;
  comboTimer = COMBO_WINDOW;
  if (comboCount >= 2) {
    comboEl.classList.remove('hidden');
    comboCountEl.textContent = String(comboCount);
    comboMultEl.textContent = `x${comboMultiplier()}`;
    comboEl.classList.remove('pop');
    void comboEl.offsetWidth; // 리플로우로 애니메이션 재시작
    comboEl.classList.add('pop');
  }
}
function tickCombo(delta: number) {
  if (comboTimer <= 0) return;
  comboTimer -= delta;
  comboBarEl.style.transform = `scaleX(${Math.max(0, comboTimer / COMBO_WINDOW)})`;
  if (comboTimer <= 0) {
    comboCount = 0;
    comboEl.classList.add('hidden');
  }
}

// ── 일일 보물상자: 하루 1회 개봉, UTC 자정 기준 리셋 ──
let chestDayClaimed = saveData.chestDayClaimed;
let chestLidAngle = 0;
const interactHintEl = document.querySelector<HTMLButtonElement>('#interact-hint')!;
function todayIndex() { return Math.floor(Date.now() / 86400000); }
function chestAvailable() { return chestDayClaimed !== todayIndex(); }
function openChest() {
  if (!chestAvailable()) return;
  chestDayClaimed = todayIndex();
  const bonusCoins = 150 + Math.floor(Math.random() * 351); // 150~500
  const bonusGems = Math.random() < 0.5 ? 2 + Math.floor(Math.random() * 4) : 0; // 50% 확률 2~5
  coins += bonusCoins;
  gems += bonusGems;
  stats.coinsEarned += bonusCoins;
  updateHud(bonusCoins, bonusGems);
  checkMissionsAndAchievements();
  persist();
  showNotice(t('notice.chestOpened'));
  interactHintEl.classList.add('hidden');
}
// 초기 뚜껑/반짝임 상태
if (!chestAvailable()) { chestLidAngle = -1.9; chestGlow.visible = false; }
chestLid.rotation.x = chestLidAngle;
interactHintEl.addEventListener('click', () => { if (chestAvailable() && playerNearChest()) openChest(); });
function playerNearChest() {
  return Math.hypot(camera.position.x - chestGroup.position.x, camera.position.z - chestGroup.position.z) < 2.6;
}
currentRegionId = Math.min(saveData.currentRegion, saveData.unlockedRegion) as RegionId;
let unlockedRegion = saveData.unlockedRegion;
const regionProgress = saveData.regionProgress;
const stats = saveData.stats;
const missionProgress = saveData.missionProgress;
const achievementsClaimed = new Set<AchievementId>(saveData.achievementsClaimed);
let coinBoostExpiry = saveData.coinBoostExpiry;
let robotVacuumOwned = saveData.robotVacuumOwned;
const settings = saveData.settings;
let tutorialStep = saveData.tutorial;
let tutorialProgress = 0;
let tutorialCleanCount = 0;
let tutorialMoveDist = 0;

function updateTutorialUI() {
  if (tutorialStep === 0 || tutorialStep > 3) {
    tutorialEl.classList.add('hidden');
    return;
  }
  tutorialEl.classList.remove('hidden');
  tutorialTextEl.textContent = t(`tutorial.step${tutorialStep}`);
  tutorialProgressEl.textContent = t('tutorial.progress', { current: tutorialStep, total: 3 });
}

function advanceTutorial() {
  tutorialStep += 1;
  tutorialProgress = 0;
  tutorialCleanCount = 0;
  tutorialMoveDist = 0;
  if (tutorialStep > 3) {
    tutorialEl.classList.add('hidden');
  } else {
    updateTutorialUI();
  }
  persist();
}
setLocale(settings.language);
document.documentElement.lang = settings.language;
applyGraphicsQuality(settings.graphicsQuality);
let robotVacuumTarget: Cleanable | null = null;
// Independent world position: the robot roams and searches on its own, it does not follow the player.
const robotVacuumPosition = new THREE.Vector3(0, 0, 5);
const ROBOT_VACUUM_SPEED = 2.2;
const ROBOT_VACUUM_ARRIVAL_RADIUS = 0.35;
const robotVacuumGroup = new THREE.Group();
robotVacuumGroup.visible = false;
scene.add(robotVacuumGroup);
function loadRobotVacuumModel() {
  loader.load('/assets/RobotVacuum.glb', (gltf) => {
    const model = gltf.scene;
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const scale = 1 / Math.max(size.x, size.y, size.z, 0.001);
    model.scale.setScalar(scale);
    model.position.copy(center.multiplyScalar(-scale));
    model.traverse((child) => { if (child instanceof THREE.Mesh) child.castShadow = true; });
    robotVacuumGroup.add(model);
  });
}
if (robotVacuumOwned) loadRobotVacuumModel();

function updateRobotVacuumVisual() {
  robotVacuumGroup.visible = robotVacuumOwned && gameStarted && !shopOpen;
  if (!robotVacuumGroup.visible) return;
  robotVacuumGroup.position.set(robotVacuumPosition.x, 0.18, robotVacuumPosition.z);
  if (robotVacuumTarget) {
    robotVacuumGroup.lookAt(robotVacuumTarget.position.x, 0.18, robotVacuumTarget.position.z);
  }
}
function coinBoostMultiplier() {
  return coinBoostExpiry > Date.now() ? 2 : 1;
}
let regionEnterTimestamp = performance.now();
let cleaned = 0;
let regionCompleted = false;
let isCleaning = false;
let cleaningHeld = false;
let activeCleaningObjects = new Set<Cleanable>();
let cleaningGraceTimer = 0;
// Momentary aim dropout (e.g. crosshair edge jitter) shouldn't reset progress or restart the
// cleaning sound; only a sustained loss of target for this long counts as a real interruption.
const CLEANING_GRACE_PERIOD = 0.15;
let shopOpen = false;
let settingsOpen = false;
let gameStarted = false;
let currentToolId: ToolId = 'basicBroom';
let currentCategory: CategoryId = 1;
const unlockedTools = new Set<ToolId>(saveData.unlockedTools);
// 카테고리별 장착 도구(각 카테고리당 1개). 보유하지 않은 도구가 저장돼 있으면 해제.
const equippedByCategory: Record<CategoryId, ToolId | null> = { ...saveData.equipped };
categoryOrder.forEach((catId) => {
  const equipped = equippedByCategory[catId];
  if (equipped && !unlockedTools.has(equipped)) equippedByCategory[catId] = null;
});
const upgrades = saveData.upgrades;
const keys = new Set<string>();
const clock = new THREE.Clock();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const aimPoint = new THREE.Vector3();
const ray = new THREE.Ray();
const toolUi: Record<ToolId, { size: number; icon: string }> = {
  basicBroom: { size: 122, icon: '🧹' },
  wideBroom: { size: 176, icon: '🧹' },
  vacuum: { size: 154, icon: '◉' },
  copperSickle: { size: 142, icon: '☾' },
  metalSickle: { size: 178, icon: '☾' },
  pickaxe: { size: 112, icon: '⛏' },
  neonSickle: { size: 188, icon: '☾' },
  neonPickaxe: { size: 132, icon: '⛏' },
};
// HUD 인벤토리 슬롯에 표시할 도구 아이콘 이미지
const toolImage: Record<ToolId, string> = {
  basicBroom: '/assets/Broom-2.png',
  wideBroom: '/assets/Broom-1.png',
  vacuum: '/assets/VacuumImg.png',
  copperSickle: '/assets/Sickle-1.png',
  metalSickle: '/assets/Sickle-0.png',
  pickaxe: '/assets/PickImg.png',
  neonSickle: '/assets/SickleSkinImg.png',
  neonPickaxe: '/assets/PickSkinImg.png',
};

const coinsEl = document.querySelector('#coins')!;
const gemsEl = document.querySelector('#gems')!;
const playerLevelEl = document.querySelector('#player-level')!;
const levelBarFill = document.querySelector<HTMLElement>('#level-bar-fill')!;
const rankingMyLevelEl = document.querySelector('#ranking-my-rank')!;
const coinBoostBadge = document.querySelector<HTMLElement>('#coin-boost-badge')!;
const coinBoostTimerEl = document.querySelector('#coin-boost-timer')!;
const coinBoostButton = document.querySelector<HTMLButtonElement>('#buy-coin-boost')!;
const robotVacuumButton = document.querySelector<HTMLButtonElement>('#buy-robot-vacuum')!;

function buildRewardLabel(coins: number, gems: number): string {
  return [coins > 0 ? t('unit.coinGain', { n: coins }) : '', gems > 0 ? t('unit.gemGain', { n: gems }) : '']
    .filter(Boolean).join(' · ');
}

function formatCountdown(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function updateCoinBoostBadge() {
  const remaining = coinBoostExpiry - Date.now();
  coinBoostBadge.classList.toggle('hidden', remaining <= 0);
  if (remaining > 0) coinBoostTimerEl.textContent = formatCountdown(remaining);
}

function updateRegionTimer() {
  regionTimerEl.textContent = formatCountdown(performance.now() - regionEnterTimestamp);
}
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
const tutorialEl = document.querySelector<HTMLElement>('#tutorial')!;
const tutorialTextEl = document.querySelector<HTMLElement>('#tutorial-text')!;
const tutorialProgressEl = document.querySelector<HTMLElement>('#tutorial-progress')!;
const shop = document.querySelector<HTMLElement>('#shop')!;
const shopCoins = document.querySelector<HTMLElement>('#shop-coins')!;
const shopGems = document.querySelector<HTMLElement>('#shop-gems')!;
const settingsPanel = document.querySelector<HTMLElement>('#settings-panel')!;
const regionNameEl = document.querySelector<HTMLElement>('#region-name')!;
const regionTimerEl = document.querySelector('#region-timer')!;
const regionCompleteCard = document.querySelector<HTMLButtonElement>('#region-complete')!;
const regionCompleteTitle = document.querySelector<HTMLElement>('#region-complete-title')!;
const regionCompleteAction = document.querySelector<HTMLElement>('#region-complete-action')!;
const regionAdDoubleBtn = document.querySelector<HTMLButtonElement>('#region-ad-double')!;
const regionAdStatus = document.querySelector<HTMLElement>('#region-ad-status')!;
let pendingAdRewardCoins = 0;
let pendingAdRewardGems = 0;
let pendingAdDoubled = false;
// 광고 제거(VX 상점)를 구매하면 광고 없이 2배 보상이 자동 지급된다.
// 실제 광고 SDK 연동 시: 이 플래그가 false일 때만 진짜 광고를 재생하도록 훅을 걸면 됨.
let adsRemoved = saveData.adsRemoved;
let noticeTimer = 0;

const BGM_BASE_VOLUME = 0.28;
const BUTTON_BASE_VOLUME = 0.45;
const REGION_COMPLETE_BASE_VOLUME = 0.75;
const COIN_BASE_VOLUME = 0.55;
const FOOTSTEP_BASE_VOLUME = 0.35;
const CLEANING_BASE_VOLUME = 0.6;
const DOOR_BASE_VOLUME = 0.6;

const bgmTracks = [0, 1, 2].map((index) => new Audio(`/assets/bgm-${index}.mp3`));
bgmTracks.forEach((audio) => { audio.loop = true; });
const buttonSound = new Audio('/assets/button-sound.mp3');
const regionCompleteSound = new Audio('/assets/region-complete-sound.mp3');
const coinSound = new Audio('/assets/coin-sound.mp3');
const footstepSound = new Audio('/assets/footstep-sound.mp3');
footstepSound.loop = true;
const doorSound = new Audio('/assets/door-sound.mp3');
function playDoorSound() {
  doorSound.currentTime = 0;
  void doorSound.play().catch(() => undefined);
}
function playCoinSound() {
  coinSound.currentTime = 0;
  void coinSound.play().catch(() => undefined);
}
const cleaningSounds = {
  broom: new Audio('/assets/broom-sound.mp3'),
  vacuum: new Audio('/assets/vacuum-sound.mp3'),
  sickle: new Audio('/assets/sickle-sound.mp3'),
  pickaxe: new Audio('/assets/pickaxe-sound.mp3'),
};
Object.values(cleaningSounds).forEach((audio) => { audio.loop = true; });
const robotVacuumSound = new Audio('/assets/vacuum-sound.mp3');
robotVacuumSound.loop = true;
let activeCleaningSound: HTMLAudioElement | undefined;

function applyAudioSettings() {
  bgmTracks.forEach((audio) => { audio.volume = BGM_BASE_VOLUME * settings.bgmVolume; });
  buttonSound.volume = BUTTON_BASE_VOLUME * settings.sfxVolume;
  regionCompleteSound.volume = REGION_COMPLETE_BASE_VOLUME * settings.sfxVolume;
  coinSound.volume = COIN_BASE_VOLUME * settings.sfxVolume;
  footstepSound.volume = FOOTSTEP_BASE_VOLUME * settings.sfxVolume;
  doorSound.volume = DOOR_BASE_VOLUME * settings.sfxVolume;
  Object.values(cleaningSounds).forEach((audio) => { audio.volume = CLEANING_BASE_VOLUME * settings.sfxVolume; });
  robotVacuumSound.volume = CLEANING_BASE_VOLUME * 0.5 * settings.sfxVolume;
}
applyAudioSettings();

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
  return matchMedia('(max-width: 850px) and (pointer: coarse)').matches;
}

function isTouchDevice() {
  return matchMedia('(pointer: coarse)').matches;
}

// F11이나 브라우저 자체 전체화면 버튼은 Fullscreen API를 거치지 않아
// document.fullscreenElement가 설정되지 않는다. 뷰포트가 화면 전체를
// 채우는지로 이런 "수동" 전체화면도 함께 감지한다.
function isEffectivelyFullscreen() {
  return !!document.fullscreenElement
    || (Math.abs(innerWidth - screen.width) < 2 && Math.abs(innerHeight - screen.height) < 2);
}
function refreshFullscreenBanner() {
  const prompt = document.querySelector<HTMLElement>('#fullscreen-prompt')!;
  if (isEffectivelyFullscreen()) {
    prompt.classList.add('hidden');
  } else if (!usesMobileControls() && gameStarted && !shopOpen && !settingsOpen) {
    prompt.classList.remove('hidden');
  }
}

function enterFullscreen() {
  if (!document.fullscreenElement) {
    try { document.documentElement.requestFullscreen(); } catch { /* ignore */ }
  }
  try {
    const orientation = screen.orientation as ScreenOrientation & { lock?: (mode: string) => Promise<void> };
    orientation.lock?.('landscape')?.catch(() => {});
  } catch {}
  setTimeout(() => {
    if (!document.fullscreenElement && isTouchDevice()) {
      showNotice(t('notice.rotateDevice'));
    }
  }, 800);
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
    equipped: { ...equippedByCategory },
    upgrades,
    stats,
    missionProgress,
    achievementsClaimed: [...achievementsClaimed],
    coinBoostExpiry,
    robotVacuumOwned,
    settings,
    tutorial: tutorialStep,
    chestDayClaimed,
    adsRemoved,
    savedAt: Date.now(),
  };
  localStorage.setItem('yardSweepSave', JSON.stringify(data));
  // 계정(서버)에도 저장 — 다른 기기에서 이어하기 (디바운스로 몰아서 전송)
  scheduleCloudSave(data as unknown as Record<string, unknown>);
}

function getLevelInfo() {
  const level = Math.floor(stats.totalCleaned / 100) + 1;
  const progressPercent = stats.totalCleaned % 100;
  return { level, progressPercent };
}

// Hook for the platform's (Verse8) ranking/leaderboard integration. Called whenever
// the player's level changes so it can be reported to the platform's ranking API.
function reportScoreToPlatform(level: number, expProgress: number) {
  syncStats(level, expProgress);
}

function updateHud(reward = 0, gemReward = 0) {
  coinsEl.textContent = String(Math.floor(coins));
  gemsEl.textContent = String(Math.floor(gems));
  shopCoins.textContent = String(Math.floor(coins));
  shopGems.textContent = String(Math.floor(gems));
  const percentage = Math.floor((cleaned / total) * 100);
  progressEl.style.width = `${percentage}%`;
  progressText.textContent = `${percentage}%`;
  const { level, progressPercent } = getLevelInfo();
  playerLevelEl.textContent = `Lv.${level}`;
  levelBarFill.style.width = `${progressPercent}%`;
  rankingMyLevelEl.textContent = `Lv.${level}`;
  reportScoreToPlatform(level, progressPercent);
  if (reward > 0 || gemReward > 0) {
    playCoinSound();
    feedback.textContent = buildRewardLabel(Math.floor(reward), Math.floor(gemReward));
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

function grantMissionReward(id: MissionId) {
  const definition = missionPool.find((mission) => mission.id === id);
  if (!definition || (missionProgress[id] ?? 0) < definition.target) return;
  const rewardCoins = definition.reward.coins > 0
    ? definition.reward.coins * (1 + upgrades.coinBonus * 0.2) * coinBoostMultiplier()
    : 0;
  coins += rewardCoins;
  gems += definition.reward.gems;
  missionProgress[id] = 0;
  updateHud(rewardCoins, definition.reward.gems);
  showNotice(t('notice.missionClaimed', { label: t(definition.label) }));
}

function grantAchievementReward(id: AchievementId) {
  if (achievementsClaimed.has(id)) return;
  const definition = achievements[id];
  if (achievementProgressValue(id) < definition.target) return;
  const rewardCoins = definition.reward.coins > 0
    ? definition.reward.coins * (1 + upgrades.coinBonus * 0.2) * coinBoostMultiplier()
    : 0;
  coins += rewardCoins;
  gems += definition.reward.gems;
  achievementsClaimed.add(id);
  updateHud(rewardCoins, definition.reward.gems);
  showNotice(t('notice.achievementUnlocked', { label: t(definition.label) }));
}

function checkMissionsAndAchievements() {
  for (const mission of missionPool) {
    if ((missionProgress[mission.id] ?? 0) >= mission.target) grantMissionReward(mission.id);
  }
  for (const id of Object.keys(achievements) as AchievementId[]) {
    if (!achievementsClaimed.has(id) && achievementProgressValue(id) >= achievements[id].target) grantAchievementReward(id);
  }
}

function updateToolHintUi(toolId: ToolId) {
  const tool = tools[toolId];
  const radiusBonus = 1 + upgrades.radius * 0.08;
  const ui = toolUi[toolId];
  const uiSize = Math.round(ui.size * radiusBonus);
  radiusEl.className = `cleaning-radius tool-${toolId}`;
  radiusEl.style.width = `${uiSize}px`;
  radiusEl.style.height = `${uiSize}px`;
  radiusEl.querySelector('span')!.textContent = `${ui.icon} ${t(tool.name)}`;
  hint.textContent = t('hint.toolTargets', { tool: t(tool.name), targets: tool.validTargets.map((kind) => t(objects[kind].label)).join(', ') });
}
// 인벤토리 3슬롯(카테고리)의 아이콘/라벨/활성 표시 갱신
function refreshInventoryBar() {
  categoryOrder.forEach((catId) => {
    const slot = document.querySelector<HTMLElement>(`.slot[data-slot="${catId}"]`);
    if (!slot) return;
    const toolId = equippedByCategory[catId];
    const img = slot.querySelector('img');
    const label = slot.querySelector('small');
    if (toolId) {
      if (img) { img.setAttribute('src', toolImage[toolId]); (img as HTMLElement).style.visibility = 'visible'; }
      if (label) label.textContent = t(tools[toolId].name);
      slot.classList.remove('locked');
    } else {
      if (img) (img as HTMLElement).style.visibility = 'hidden';
      if (label) label.textContent = t(categories[catId].name);
      slot.classList.add('locked');
    }
    slot.classList.toggle('active', catId === currentCategory && !!toolId);
  });
}

// 상점에서 도구를 "장착" → 해당 카테고리의 활성 도구로 지정하고 즉시 전환
function equipTool(toolId: ToolId) {
  if (!unlockedTools.has(toolId)) {
    showNotice(t('notice.toolLocked', { name: t(tools[toolId].name) }));
    return;
  }
  equippedByCategory[tools[toolId].category] = toolId;
  persist();
  selectCategory(tools[toolId].category);
}

// 인벤토리 슬롯(키 1~3) 선택 → 그 카테고리에 장착된 도구로 전환
function selectCategory(categoryId: CategoryId) {
  const toolId = equippedByCategory[categoryId];
  if (!toolId) {
    showNotice(t('notice.noToolInCategory'));
    return;
  }
  stopCleaning();
  currentCategory = categoryId;
  currentToolId = toolId;
  refreshInventoryBar();
  updateToolHintUi(toolId);
  showToolModel(toolId);
}

function calculateAimPoint() {
  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);
  ray.set(camera.position, direction);
  if (!ray.intersectPlane(groundPlane, aimPoint) || camera.position.distanceTo(aimPoint) > 5) {
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
    if (camera.position.distanceTo(worldPosition) > 5) return false;
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
  for (const object of activeCleaningObjects) object.userData.progress = 0;
  activeCleaningObjects.clear();
  cleaningGraceTimer = 0;
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
  robotVacuumTarget = null;
  let state = regionProgress[regionId];
  if (!state) {
    const remaining = freshRegionCounts(regionId);
    state = { remaining, total: Object.values(remaining).reduce((sum, count) => sum + count, 0) };
    regionProgress[regionId] = state;
  }
  populateRegion(regionId, state);
  applyRegionTheme(regionId);
  regionNameEl.textContent = t(regions[regionId].name);
  regionCompleteCard.classList.add('hidden');
  camera.position.set(0, standingHeight, cameraBaseZ);
  updateHud();
  playRegionBgm();
  persist();
}

function completeRegion() {
  if (regionCompleted) return;
  regionCompleted = true;
  delete regionProgress[currentRegionId];
  stopCleaning();
  resetJoystick(); // 완료 카드가 뜨는 동안 조이스틱 입력이 고정되지 않도록
  bgmTracks.forEach((audio) => audio.pause());
  regionCompleteSound.currentTime = 0;
  void regionCompleteSound.play().catch(() => undefined);

  const completionReward = regionCompletionRewards[currentRegionId];
  const rewardCoins = completionReward.coins > 0
    ? completionReward.coins * (1 + upgrades.coinBonus * 0.2) * coinBoostMultiplier()
    : 0;
  coins += rewardCoins;
  gems += completionReward.gems;
  stats.coinsEarned += Math.floor(rewardCoins);
  stats.regionsCleared += 1;
  incrementMissionProgress('regionClear');
  if (performance.now() - regionEnterTimestamp <= 5 * 60 * 1000) incrementMissionProgress('fastClear5min');
  const rewardLabel = buildRewardLabel(rewardCoins, completionReward.gems);
  const rewardSuffix = rewardLabel ? ` (${rewardLabel})` : '';

  pendingAdRewardCoins = rewardCoins;
  pendingAdRewardGems = completionReward.gems;
  pendingAdDoubled = false;

  if (currentRegionId < 3) {
    unlockedRegion = Math.max(unlockedRegion, currentRegionId + 1) as RegionId;
    regionCompleteTitle.textContent = t('region.completeTitle', { region: t(regions[currentRegionId].name), reward: rewardSuffix });
    regionCompleteAction.textContent = t('region.moveTo', { region: t(regions[(currentRegionId + 1) as RegionId].name) });
  } else {
    regionCompleteTitle.textContent = t('region.allCompleteTitle', { reward: rewardSuffix });
    regionCompleteAction.textContent = t('region.replayFrom', { region: t(regions[1].name) });
  }
  updateHud(rewardCoins, completionReward.gems);
  checkMissionsAndAchievements();
  persist();
  regionCompleteCard.classList.remove('hidden');
  if (adsRemoved) {
    // 광고 제거 구매자는 시청/대기 없이 2배 보상이 즉시 자동 지급됨
    grantAdDoubleReward(true);
  } else {
    regionAdDoubleBtn.classList.remove('hidden');
    regionAdDoubleBtn.disabled = false;
    regionAdStatus.classList.add('hidden');
  }
  document.exitPointerLock?.();
}

function removeObject(object: Cleanable) {
  object.userData.cleaned = true;
  registerComboClean();
  const definition = objects[object.userData.kind];
  const reward = definition.reward > 0
    ? definition.reward * (1 + upgrades.coinBonus * 0.2) * coinBoostMultiplier() * comboMultiplier()
    : 0;
  const gemReward = definition.gemReward ?? 0;
  coins += reward;
  gems += gemReward;
  const state = regionProgress[currentRegionId];
  if (state) state.remaining[object.userData.kind] = Math.max(0, (state.remaining[object.userData.kind] ?? 0) - 1);
  cleaned += 1;
  stats.totalCleaned += 1;
  stats.coinsEarned += Math.floor(reward);
  if (object.userData.kind === 'leaf') stats.leafCleaned += 1;
  if (object.userData.kind === 'can') stats.canCleaned += 1;
  if (object.userData.kind === 'leaf') incrementMissionProgress('leaf100');
  if (object.userData.kind === 'can') incrementMissionProgress('can30');
  updateHud(reward, gemReward);
  checkMissionsAndAchievements();
  tutorialCleanCount += 1;
  if (tutorialCleanCount >= 3 && tutorialStep === 2) advanceTutorial();
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
    cleaningGraceTimer += delta;
    if (cleaningGraceTimer < CLEANING_GRACE_PERIOD) return;
    for (const object of activeCleaningObjects) object.userData.progress = 0;
    activeCleaningObjects.clear();
    isCleaning = false;
    setCleaningAudio(false);
    radiusEl.classList.remove('cleaning');
    meter.classList.remove('active');
    meterFill.style.width = '0%';
    return;
  }
  cleaningGraceTimer = 0;
  isCleaning = true;
  setCleaningAudio(true);
  radiusEl.classList.add('cleaning');
  meter.classList.add('active');
  const currentSet = new Set(valid);
  for (const object of activeCleaningObjects) {
    if (!currentSet.has(object)) object.userData.progress = 0;
  }
  activeCleaningObjects = currentSet;
  let displayedProgress = 0;
  let displayedLabel = '';
  for (const object of valid) {
    const definition = objects[object.userData.kind];
    object.userData.progress += delta * tool.speed * (1 + upgrades.cleanSpeed * 0.12);
    const progress = object.userData.progress / definition.cleanTime;
    if (progress > displayedProgress) {
      displayedProgress = progress;
      displayedLabel = t('label.cleaningItem', { label: t(definition.label) });
    }
    if (progress >= 1) {
      activeCleaningObjects.delete(object);
      removeObject(object);
    }
  }
  meterFill.style.width = `${Math.min(displayedProgress, 1) * 100}%`;
  meterLabel.textContent = displayedLabel;
}

function stopRobotVacuumSound() {
  if (!robotVacuumSound.paused) {
    robotVacuumSound.pause();
    robotVacuumSound.currentTime = 0;
  }
}
function updateRobotVacuum(delta: number) {
  if (!robotVacuumOwned || !gameStarted || shopOpen) { stopRobotVacuumSound(); return; }
  if (robotVacuumTarget && (robotVacuumTarget.userData.cleaned || !robotVacuumTarget.visible)) {
    robotVacuumTarget = null;
  }
  if (!robotVacuumTarget) {
    let nearestDistSq = Infinity;
    for (const object of cleanables) {
      if (object.userData.cleaned || !object.visible) continue;
      const distSq = object.position.distanceToSquared(robotVacuumPosition);
      if (distSq < nearestDistSq) {
        nearestDistSq = distSq;
        robotVacuumTarget = object;
      }
    }
  }
  if (!robotVacuumTarget) { stopRobotVacuumSound(); return; }
  const dx = robotVacuumTarget.position.x - robotVacuumPosition.x;
  const dz = robotVacuumTarget.position.z - robotVacuumPosition.z;
  const distance = Math.hypot(dx, dz);
  if (distance > ROBOT_VACUUM_ARRIVAL_RADIUS) {
    // Still travelling toward the target; drive straight at it (no obstacle avoidance/pathfinding).
    stopRobotVacuumSound();
    robotVacuumPosition.x += (dx / distance) * ROBOT_VACUUM_SPEED * delta;
    robotVacuumPosition.z += (dz / distance) * ROBOT_VACUUM_SPEED * delta;
    return;
  }
  if (robotVacuumSound.paused) void robotVacuumSound.play().catch(() => undefined);
  const definition = objects[robotVacuumTarget.userData.kind];
  robotVacuumTarget.userData.progress += delta * (definition.cleanTime / 5);
  if (robotVacuumTarget.userData.progress >= definition.cleanTime) {
    const cleanedObject = robotVacuumTarget;
    robotVacuumTarget = null;
    removeObject(cleanedObject);
  }
}

function startGame() {
  if (gameStarted) return;
  gameStarted = true;
  start.classList.add('hidden');
  if (isTouchDevice()) {
    camera.position.set(0, standingHeight, 13);
    camera.fov = 72;
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    yaw = 0;
    pitch = -0.12;
  }
  playRegionBgm();
  refreshFullscreenBanner();
  if (!usesMobileControls()) canvas.requestPointerLock?.();
  if (tutorialStep === 0) {
    tutorialStep = 1;
    tutorialProgress = 0;
    tutorialCleanCount = 0;
    tutorialMoveDist = 0;
    persist();
  }
  if (tutorialStep > 0 && tutorialStep <= 3) {
    tutorialEl.classList.remove('hidden');
    updateTutorialUI();
  }
}

start.addEventListener('click', () => {
  if (isTouchDevice() && !document.fullscreenElement) {
    enterFullscreen();
    return;
  }
  startGame();
});

document.addEventListener('fullscreenchange', () => {
  refreshFullscreenBanner();
  if (document.fullscreenElement) {
    if (isTouchDevice() && !gameStarted) startGame();
  }
  if (!document.fullscreenElement && isTouchDevice() && !shopOpen && !settingsOpen) {
    gameStarted = false;
    stopCleaning();
    bgmTracks.forEach((audio) => audio.pause());
  }
  // The fullscreen transition interrupts any in-progress touch with pointercancel/touchcancel
  // (not pointerup/touchend), so reset movement/look input directly here as a safety net.
  resetJoystick();
  canvasTouchId = null;
});
regionCompleteCard.addEventListener('click', () => {
  const nextRegion = currentRegionId < 3 ? (currentRegionId + 1) as RegionId : 1;
  enterRegion(nextRegion);
  if (!usesMobileControls()) canvas.requestPointerLock?.();
});

// 2배 보상 실제 지급. instant=true면 대기 없이 즉시(광고 제거 구매자용),
// 그렇지 않으면 광고 SDK 없이 "재생 중" 표시 후 잠시 뒤 지급하는 시뮬레이션.
function grantAdDoubleReward(instant = false) {
  if (pendingAdDoubled) return;
  pendingAdDoubled = true;
  const apply = () => {
    coins += pendingAdRewardCoins;
    gems += pendingAdRewardGems;
    stats.coinsEarned += Math.floor(pendingAdRewardCoins);
    updateHud(pendingAdRewardCoins, pendingAdRewardGems);
    persist();
    regionAdDoubleBtn.classList.add('hidden');
    regionAdStatus.classList.remove('hidden');
    regionAdStatus.textContent = t('ad.doubleApplied', { coins: Math.floor(pendingAdRewardCoins), gems: pendingAdRewardGems });
  };
  if (instant) { apply(); return; }
  regionAdDoubleBtn.disabled = true;
  regionAdStatus.classList.remove('hidden');
  regionAdStatus.textContent = t('ad.playing');
  window.setTimeout(apply, 1200);
}
regionAdDoubleBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  grantAdDoubleReward();
});

// VX(실결제) 상품: CrossRamp 결제 페이지를 새 탭으로 연다. SKU/가격은 Verse8 대시보드에서 구성.
// '광고 제거'는 CrossRamp가 재화(보석) 충전만 지원하고 개별 아이템 구매 개념이 없어서,
// 실제 지급은 여전히 수동 훅으로 남겨둠: 구매 완료가 확인되면 이 버튼 대신
// `adsRemoved = true; persist(); refreshShop();` 를 호출하도록 연결하면 됨(적용 로직은 이미 동작).
document.querySelectorAll<HTMLButtonElement>('.buy-vx-gem').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const url = await getVxShopUrl(getLocale());
    if (!url) { showNotice(t('ranking.serverNotConnected')); return; }
    window.open(url, '_blank', 'noopener');
  });
});
const removeAdsButton = document.querySelector<HTMLButtonElement>('#buy-remove-ads')!;
// 보석 → 골드(코인) 교환
document.querySelectorAll<HTMLButtonElement>('.exchange-gold').forEach((btn) => {
  btn.addEventListener('click', () => {
    const needGems = Number(btn.dataset.gems);
    const gainCoins = Number(btn.dataset.coins);
    if (gems < needGems) { showNotice(t('notice.notEnoughGems')); return; }
    gems -= needGems;
    coins += gainCoins;
    persist();
    refreshShop();
    showNotice(t('notice.goldExchanged', { coins: gainCoins }));
  });
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
    refreshFullscreenBanner();
  }
});
document.addEventListener('mousemove', (event) => {
  if (document.pointerLockElement !== canvas) return;
  yaw -= event.movementX * 0.0022 * settings.sensitivity;
  pitch -= event.movementY * 0.0018 * settings.sensitivity;
  pitch = THREE.MathUtils.clamp(pitch, -1.05, 0.75);
});

window.addEventListener('keydown', (event) => {
  if (event.code === 'Tab') {
    event.preventDefault();
    toggleShop();
    return;
  }
  if (event.code === 'KeyT') {
    event.preventDefault();
    toggleSettings();
    return;
  }
  if (shopOpen || settingsOpen) return;
  if (event.code === 'KeyF' && chestAvailable() && playerNearChest()) {
    openChest();
    return;
  }
  keys.add(event.code);
  if (event.code.startsWith('Digit')) {
    const num = Number(event.code.slice(5));
    if (num >= 1 && num <= 3) selectCategory(num as CategoryId);
  }
});
window.addEventListener('keyup', (event) => keys.delete(event.code));
document.querySelectorAll<HTMLElement>('.slot').forEach((slot) => {
  slot.addEventListener('click', () => {
    selectCategory(Number(slot.dataset.slot) as CategoryId);
  });
});

const cleanButton = document.querySelector<HTMLElement>('#clean-button')!;
cleanButton.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  cleanButton.setPointerCapture(event.pointerId);
  startCleaning();
});
cleanButton.addEventListener('pointerup', stopCleaning);
cleanButton.addEventListener('pointercancel', stopCleaning);

// 각 도구의 획득 비용. basicBroom은 기본 보유(비용 없음). coins 또는 gems 중 하나.
const toolCost: Record<ToolId, { coins?: number; gems?: number }> = {
  basicBroom: {},
  wideBroom: { coins: 100 },
  vacuum: { coins: 500 },
  copperSickle: { coins: 300 },
  metalSickle: { coins: 600 },
  pickaxe: { coins: 500 },
  neonSickle: { gems: 150 },
  neonPickaxe: { gems: 150 },
};
const upgradeBasePrices: Record<UpgradeId, number> = { cleanSpeed: 30, moveSpeed: 30, coinBonus: 40, radius: 40 };
function upgradePrice(id: UpgradeId) { return Math.round(upgradeBasePrices[id] * Math.pow(1.65, upgrades[id])); }
function refreshShop() {
  updateHud();
  refreshInventoryBar();
  document.querySelectorAll<HTMLButtonElement>('.tool-action').forEach((button) => {
    const id = button.dataset.tool as ToolId;
    const owned = unlockedTools.has(id);
    const equipped = equippedByCategory[tools[id].category] === id;
    button.classList.toggle('owned', equipped); // 장착 중일 때만 초록색
    button.classList.toggle('equip-ready', owned && !equipped); // 보유·미장착 = 장착 가능
    button.disabled = equipped;
    if (!owned) {
      const cost = toolCost[id];
      button.textContent = cost.gems ? `💎 ${cost.gems}` : `● ${cost.coins ?? 0}`;
    } else {
      button.textContent = equipped ? t('shop.equipped') : t('shop.equip');
    }
  });
  document.querySelectorAll<HTMLButtonElement>('.buy-upgrade').forEach((button) => {
    const id = button.dataset.upgrade as UpgradeId;
    button.textContent = upgrades[id] >= 10 ? 'MAX' : `● ${upgradePrice(id)}`;
    document.querySelector(`#level-${id}`)!.textContent = `Lv.${upgrades[id]}`;
  });
  document.querySelectorAll<HTMLButtonElement>('.select-region').forEach((button) => {
    const id = Number(button.dataset.region) as RegionId;
    const locked = id > unlockedRegion;
    const current = id === currentRegionId;
    const state = regionProgress[id];
    const remaining = state ? Object.values(state.remaining).reduce((sum, count) => sum + (count ?? 0), 0) : undefined;
    const percentage = state && state.total > 0 ? Math.floor(((state.total - (remaining ?? state.total)) / state.total) * 100) : 0;
    button.disabled = locked || current;
    button.classList.toggle('owned', current);
    button.textContent = locked ? t('shop.locked') : current ? t('shop.currentRegion') : t('shop.move');
    const label = document.querySelector<HTMLElement>(`[data-region-progress="${id}"]`)!;
    label.textContent = locked ? t('region.lockedHint') : t('region.progressLabel', { pct: percentage });
  });
  document.querySelectorAll<HTMLButtonElement>('.claim-mission').forEach((button) => {
    const id = button.dataset.mission as MissionId;
    const definition = missionPool.find((mission) => mission.id === id)!;
    const progress = missionProgress[id] ?? 0;
    document.querySelector<HTMLElement>(`[data-mission-progress="${id}"]`)!.textContent = `${progress} / ${definition.target}`;
    button.disabled = true;
    button.textContent = `${progress}/${definition.target}`;
  });
  document.querySelectorAll<HTMLButtonElement>('.claim-achievement').forEach((button) => {
    const id = button.dataset.achievement as AchievementId;
    const definition = achievements[id];
    const claimed = achievementsClaimed.has(id);
    const progress = Math.min(achievementProgressValue(id), definition.target);
    document.querySelector<HTMLElement>(`[data-achievement-progress="${id}"]`)!.textContent = `${progress} / ${definition.target}`;
    button.disabled = true;
    button.classList.toggle('claimed', claimed);
    button.textContent = claimed ? t('shop.claimed') : `${progress}/${definition.target}`;
  });
  const boostRemaining = coinBoostExpiry - Date.now();
  coinBoostButton.textContent = boostRemaining > 0 ? `⏱ ${formatCountdown(boostRemaining)}` : '💎 30';
  robotVacuumButton.textContent = robotVacuumOwned ? t('shop.owned') : '💎 200';
  robotVacuumButton.disabled = robotVacuumOwned;
  robotVacuumButton.classList.toggle('owned', robotVacuumOwned);
  removeAdsButton.textContent = adsRemoved ? t('shop.owned') : 'VX';
  removeAdsButton.disabled = adsRemoved;
  removeAdsButton.classList.toggle('owned', adsRemoved);
}
function toggleShop(force?: boolean) {
  shopOpen = force ?? !shopOpen;
  shop.classList.toggle('open', shopOpen);
  stopCleaning();
  keys.clear();
  resetJoystick(); // 오버레이가 조이스틱 터치를 삼켜 전진 입력이 고정되는 것 방지
  if (shopOpen) {
    if (tutorialStep === 3) advanceTutorial();
    if (settingsOpen) toggleSettings(false);
    document.exitPointerLock?.();
    refreshShop();
  } else if (gameStarted && !settingsOpen) {
    start.classList.add('hidden');
    if (!usesMobileControls()) canvas.requestPointerLock?.();
  }
}
function toggleSettings(force?: boolean) {
  settingsOpen = force ?? !settingsOpen;
  settingsPanel.classList.toggle('open', settingsOpen);
  stopCleaning();
  keys.clear();
  resetJoystick();
  if (settingsOpen) {
    if (shopOpen) toggleShop(false);
    document.exitPointerLock?.();
  } else if (gameStarted && !shopOpen) {
    start.classList.add('hidden');
    if (!usesMobileControls()) canvas.requestPointerLock?.();
  }
}
document.querySelector('#shop-button')!.addEventListener('click', () => toggleShop());
document.querySelector('#fullscreen-button')!.addEventListener('click', enterFullscreen);
document.querySelector('#rotate-fullscreen')!.addEventListener('click', () => {
  enterFullscreen();
});
document.querySelector('#shop-close')!.addEventListener('click', () => toggleShop(false));
document.querySelector('#settings')!.addEventListener('click', () => toggleSettings());
document.querySelector('#settings-close')!.addEventListener('click', () => toggleSettings(false));

const bgmVolumeSlider = document.querySelector<HTMLInputElement>('#bgm-volume')!;
const bgmVolumeValueEl = document.querySelector<HTMLElement>('#bgm-volume-value')!;
const sfxVolumeSlider = document.querySelector<HTMLInputElement>('#sfx-volume')!;
const sfxVolumeValueEl = document.querySelector<HTMLElement>('#sfx-volume-value')!;
bgmVolumeSlider.value = String(Math.round(settings.bgmVolume * 100));
bgmVolumeValueEl.textContent = `${Math.round(settings.bgmVolume * 100)}%`;
sfxVolumeSlider.value = String(Math.round(settings.sfxVolume * 100));
sfxVolumeValueEl.textContent = `${Math.round(settings.sfxVolume * 100)}%`;
bgmVolumeSlider.addEventListener('input', () => {
  settings.bgmVolume = Number(bgmVolumeSlider.value) / 100;
  bgmVolumeValueEl.textContent = `${bgmVolumeSlider.value}%`;
  applyAudioSettings();
  persist();
});
sfxVolumeSlider.addEventListener('input', () => {
  settings.sfxVolume = Number(sfxVolumeSlider.value) / 100;
  sfxVolumeValueEl.textContent = `${sfxVolumeSlider.value}%`;
  applyAudioSettings();
  persist();
});

const sensitivitySlider = document.querySelector<HTMLInputElement>('#sensitivity')!;
const sensitivityValueEl = document.querySelector<HTMLElement>('#sensitivity-value')!;
sensitivitySlider.value = String(Math.round(settings.sensitivity * 100));
sensitivityValueEl.textContent = `${Math.round(settings.sensitivity * 100)}%`;
sensitivitySlider.addEventListener('input', () => {
  settings.sensitivity = Number(sensitivitySlider.value) / 100;
  sensitivityValueEl.textContent = `${sensitivitySlider.value}%`;
  persist();
});

const langOptions = document.querySelectorAll<HTMLButtonElement>('.lang-option');
langOptions.forEach((button) => button.classList.toggle('selected', button.dataset.lang === settings.language));
langOptions.forEach((button) => button.addEventListener('click', () => {
  settings.language = button.dataset.lang as 'ko' | 'en';
  langOptions.forEach((item) => item.classList.toggle('selected', item === button));
  setLocale(settings.language);
  applyLocale();
  persist();
}));

const qualityOptions = document.querySelectorAll<HTMLButtonElement>('.quality-option');
qualityOptions.forEach((button) => button.classList.toggle('selected', button.dataset.quality === settings.graphicsQuality));
qualityOptions.forEach((button) => button.addEventListener('click', () => {
  settings.graphicsQuality = button.dataset.quality as GraphicsQuality;
  qualityOptions.forEach((item) => item.classList.toggle('selected', item === button));
  applyGraphicsQuality(settings.graphicsQuality);
  persist();
}));

const nicknameInput = document.querySelector<HTMLInputElement>('#nickname-input')!;
const nicknameSaveBtn = document.querySelector<HTMLButtonElement>('#nickname-save')!;
const nicknameStatus = document.querySelector('#nickname-status')!;
nicknameSaveBtn.addEventListener('click', async () => {
  const val = nicknameInput.value.trim();
  if (!val) { nicknameStatus.textContent = t('settings.nicknameEmpty'); return; }
  nicknameSaveBtn.textContent = t('settings.nicknameSaving');
  const error = await setNickname(val);
  nicknameSaveBtn.textContent = t('settings.nicknameSave');
  nicknameStatus.textContent = error || t('settings.nicknameSaved', { name: val });
});

const resetDataBtn = document.querySelector<HTMLButtonElement>('#reset-data-btn')!;
const resetDataStatus = document.querySelector('#reset-data-status')!;
let resetConfirming = false;

function cancelResetConfirm() {
  resetConfirming = false;
  resetDataBtn.textContent = t('settings.resetBtn');
  resetDataBtn.classList.remove('reset-btn-confirm');
  resetDataStatus.textContent = '';
}

resetDataBtn.addEventListener('click', async () => {
  if (!resetConfirming) {
    resetConfirming = true;
    resetDataBtn.textContent = t('settings.resetConfirm');
    resetDataBtn.classList.add('reset-btn-confirm');
    resetDataStatus.textContent = t('settings.resetConfirmDesc');
    return;
  }

  resetDataBtn.textContent = t('settings.resetting');
  resetDataBtn.classList.remove('reset-btn-confirm');
  resetDataStatus.textContent = '';

  localStorage.removeItem('yardSweepSave');
  const error = await resetAllData();
  resetConfirming = false;
  if (!error) {
    location.reload();
  } else {
    resetDataBtn.textContent = t('settings.resetBtn');
    resetDataStatus.textContent = error;
  }
});

document.addEventListener('click', (e) => {
  if (resetConfirming && !resetDataBtn.contains(e.target as Node)) {
    cancelResetConfirm();
  }
});
document.querySelectorAll<HTMLButtonElement>('[data-shop-tab]').forEach((button) => button.addEventListener('click', () => {
  document.querySelectorAll('[data-shop-tab]').forEach((item) => item.classList.toggle('selected', item === button));
  document.querySelectorAll<HTMLElement>('[data-shop-content]').forEach((content) => content.classList.toggle('selected', content.dataset.shopContent === button.dataset.shopTab));
  if (button.dataset.shopTab === 'ranking') loadRankings();
}));
document.querySelectorAll<HTMLButtonElement>('.tool-action').forEach((button) => button.addEventListener('click', () => {
  const id = button.dataset.tool as ToolId;
  // 이미 보유 중이면 → 장착
  if (unlockedTools.has(id)) {
    equipTool(id);
    refreshShop();
    return;
  }
  // 미보유 → 구매 (coins 또는 gems)
  const cost = toolCost[id];
  if (cost.gems != null) {
    if (gems < cost.gems) { showNotice(t('notice.notEnoughGems')); return; }
    gems -= cost.gems;
  } else {
    const price = cost.coins ?? 0;
    if (coins < price) { showNotice(t('notice.notEnoughCoins')); return; }
    coins -= price;
  }
  unlockedTools.add(id);
  // 해당 카테고리에 장착된 게 없으면 구매 즉시 자동 장착
  if (!equippedByCategory[tools[id].category]) equipTool(id); else persist();
  refreshShop();
  showNotice(t('notice.toolUnlocked', { name: t(tools[id].name) }));
}));
document.querySelectorAll<HTMLButtonElement>('.buy-upgrade').forEach((button) => button.addEventListener('click', () => {
  const id = button.dataset.upgrade as UpgradeId;
  if (upgrades[id] >= 10) return;
  const price = upgradePrice(id);
  if (coins < price) { showNotice(t('notice.notEnoughCoins')); return; }
  coins -= price; upgrades[id] += 1; persist(); refreshShop(); equipTool(currentToolId); showNotice(t('notice.upgradeComplete'));
}));
document.querySelectorAll<HTMLButtonElement>('.select-region').forEach((button) => button.addEventListener('click', () => {
  const id = Number(button.dataset.region) as RegionId;
  if (id > unlockedRegion || id === currentRegionId) return;
  enterRegion(id);
  toggleShop(false);
  showNotice(t('region.moveTo', { region: t(regions[id].name) }));
}));
coinBoostButton.addEventListener('click', () => {
  const price = 30;
  if (gems < price) { showNotice(t('notice.notEnoughGems')); return; }
  gems -= price;
  coinBoostExpiry = Math.max(coinBoostExpiry, Date.now()) + 30 * 60 * 1000;
  persist();
  refreshShop();
  updateCoinBoostBadge();
  showNotice(t('notice.coinBoostActivated'));
});
robotVacuumButton.addEventListener('click', () => {
  if (robotVacuumOwned) return;
  const price = 200;
  if (gems < price) { showNotice(t('notice.notEnoughGems')); return; }
  gems -= price;
  robotVacuumOwned = true;
  loadRobotVacuumModel();
  persist();
  refreshShop();
  showNotice(t('notice.robotVacuumAcquired'));
});

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
function resetJoystick() {
  joystickPointer = undefined;
  joystickX = joystickY = 0;
  if (joystickKnob) joystickKnob.style.transform = '';
}
joystick?.addEventListener('pointerup', resetJoystick);
joystick?.addEventListener('pointercancel', resetJoystick);
// 안전망: 오버레이·브라우저 제스처·요소 숨김 등으로 조이스틱이 release 이벤트를 못 받아
// 이동 입력이 고정(stuck)된 채 계속 전진하는 버그 방지
joystick?.addEventListener('lostpointercapture', resetJoystick);
window.addEventListener('pointerup', (event) => {
  if (event.pointerId === joystickPointer) resetJoystick();
});
window.addEventListener('pointercancel', (event) => {
  if (event.pointerId === joystickPointer) resetJoystick();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    resetJoystick();
    keys.clear();
    stopCleaning();
    flushCloudSave(); // 탭 이탈/앱 전환 시 대기 중인 클라우드 세이브 즉시 전송
  }
});
window.addEventListener('blur', resetJoystick);

let lastTouchX = 0;
let lastTouchY = 0;
let canvasTouchId: number | null = null;
canvas.addEventListener('touchstart', (event) => {
  if (canvasTouchId !== null || event.target !== canvas) return;
  const touch = event.changedTouches[0];
  canvasTouchId = touch.identifier;
  lastTouchX = touch.clientX;
  lastTouchY = touch.clientY;
}, { passive: true });
canvas.addEventListener('touchmove', (event) => {
  for (let i = 0; i < event.changedTouches.length; i++) {
    const touch = event.changedTouches[i];
    if (touch.identifier === canvasTouchId) {
      yaw -= (touch.clientX - lastTouchX) * 0.006 * settings.sensitivity;
      pitch -= (touch.clientY - lastTouchY) * 0.004 * settings.sensitivity;
      pitch = THREE.MathUtils.clamp(pitch, -1.05, 0.75);
      lastTouchX = touch.clientX;
      lastTouchY = touch.clientY;
      break;
    }
  }
}, { passive: true });
function releaseCanvasTouch(event: TouchEvent) {
  for (let i = 0; i < event.changedTouches.length; i++) {
    if (event.changedTouches[i].identifier === canvasTouchId) {
      canvasTouchId = null;
      break;
    }
  }
}
canvas.addEventListener('touchend', releaseCanvasTouch, { passive: true });
canvas.addEventListener('touchcancel', releaseCanvasTouch, { passive: true });

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  // aspect는 항상 실제 뷰포트에 맞춘다. (예전엔 세로 모드를 건너뛰었는데, 전체화면/회전
  // 전환 중 세로 타이밍에 걸리면 aspect가 낡은 값으로 고정돼 화면이 확 당겨 보이는 버그가 있었음)
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  // F11/브라우저 자체 전체화면은 fullscreenchange 없이 resize만 발생시키므로 여기서도 재확인
  if (gameStarted) refreshFullscreenBanner();
}
// 모바일 전체화면·회전은 뷰포트 크기가 비동기로 정착하므로, 즉시 + 정착 후 한 번 더 갱신
function resizeSoon() {
  resize();
  window.setTimeout(resize, 120);
  window.setTimeout(resize, 400);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resizeSoon);
document.addEventListener('fullscreenchange', resizeSoon);
resize();
enterRegion(currentRegionId);
selectCategory(1);
// 서버 연결 후 계정 클라우드 세이브와 로컬 세이브를 비교해 최신 쪽을 사용한다.
// 클라우드가 더 최신이면 로컬에 덮어쓰고 새로고침(1회)으로 적용 — 다른 기기에서 이어하기.
initRanking().then(async () => {
  const cloud = await loadCloudSave();
  const cloudSavedAt = Number((cloud as { savedAt?: number } | null)?.savedAt ?? 0);
  if (cloud && cloudSavedAt > saveData.savedAt) {
    if (!gameStarted) {
      localStorage.setItem('yardSweepSave', JSON.stringify(cloud));
      location.reload();
    }
    return;
  }
  // 클라우드가 없거나 로컬이 최신이면 현재 로컬 상태를 클라우드로 올림
  persist();
});

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  camera.rotation.order = 'YXZ';
  camera.rotation.y = yaw;
  camera.rotation.x = pitch;
  // 현관문 자동 개폐: 문 근처(3.2m)에 오면 안쪽으로 스르륵 열림
  const doorDistance = Math.hypot(camera.position.x + 7.3, camera.position.z + 7.6);
  const doorShouldOpen = doorDistance < 3.2;
  if (doorShouldOpen && !doorIsOpen && gameStarted) playDoorSound();
  doorIsOpen = doorShouldOpen;
  const doorTarget = doorShouldOpen ? 1.95 : 0;
  doorOpenAmount += (doorTarget - doorOpenAmount) * Math.min(1, delta * 5);
  doorPivot.rotation.y = doorOpenAmount;
  // 콤보 타이머 감소
  tickCombo(delta);
  // 보물상자: 반짝임(개봉 가능 시)·뚜껑 개폐·근접 힌트
  const chestOpen = chestAvailable();
  chestGlow.visible = chestOpen;
  if (chestOpen) {
    chestGlow.rotation.y += delta * 1.6;
    chestGlow.position.y = 1.12 + Math.sin(clock.elapsedTime * 2.4) * 0.06;
  }
  chestLidAngle += ((chestOpen ? 0 : -1.9) - chestLidAngle) * Math.min(1, delta * 6);
  chestLid.rotation.x = chestLidAngle;
  if (gameStarted && !shopOpen && !settingsOpen && playerNearChest()) {
    interactHintEl.classList.remove('hidden');
    interactHintEl.textContent = chestOpen ? t('hint.chestOpen') : t('hint.chestClaimed');
    interactHintEl.classList.toggle('claimed', !chestOpen);
  } else {
    interactHintEl.classList.add('hidden');
  }
  updateCleaning(delta);
  updateRobotVacuum(delta);
  updateRobotVacuumVisual();
  updateCoinBoostBadge();
  updateRegionTimer();

  const tool = tools[currentToolId];
  const movementBlocked = shopOpen || settingsOpen || !gameStarted || (isCleaning && !tool.canMoveWhileCleaning);
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
    const step = 5.5 * (1 + upgrades.moveSpeed * 0.1) * delta;
    let nextX = THREE.MathUtils.clamp(previousX + movement.x * step, -20, 20);
    let nextZ = THREE.MathUtils.clamp(previousZ + movement.z * step, -16, 16);
    // 벽 슬라이딩: 대각선으로 벽에 닿으면 막히는 축만 멈추고 나머지 축은 계속 이동 (문 개구부는 통과)
    if (hitsWall(nextX, nextZ, 0.3)) {
      if (!hitsWall(nextX, previousZ, 0.3)) nextZ = previousZ;      // z쪽 벽 → x축으로 미끄러짐
      else if (!hitsWall(previousX, nextZ, 0.3)) nextX = previousX; // x쪽 벽 → z축으로 미끄러짐
      else { nextX = previousX; nextZ = previousZ; }                // 모서리 등 둘 다 막힘 → 정지
    }
    camera.position.x = nextX;
    camera.position.z = nextZ;
    tutorialMoveDist += camera.position.distanceTo(new THREE.Vector3(previousX, 0, previousZ));
    if (tutorialMoveDist >= 4 && tutorialStep === 1) advanceTutorial();
  }
  if (isMoving) {
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
function applyLocale() {
  document.documentElement.lang = getLocale();
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n!);
  });
  document.querySelectorAll<HTMLInputElement>('[data-i18n-placeholder]').forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder!);
  });
  document.querySelectorAll<HTMLElement>('[data-i18n-aria]').forEach((el) => {
    el.setAttribute('aria-label', t(el.dataset.i18nAria!));
  });
  regionNameEl.textContent = t(regions[currentRegionId].name);
  updateToolHintUi(currentToolId);
  updateTutorialUI();
  refreshShop();
}

animate();
applyLocale();

if (isTouchDevice()) {
  startGame();
}
