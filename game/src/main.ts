import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  achievements,
  categories,
  categoryOrder,
  MAX_REGION,
  missionPool,
  objects,
  regionCompletionRewards,
  regionIds,
  regions,
  tools,
  type AchievementId,
  type CategoryId,
  type MissionId,
  type ObjectKind,
  type RegionId,
  type ToolId,
} from './gameData';
import { getLocale, setLocale, t, isLocale, type Locale } from './i18n';
import { initRanking, isConnected, syncStats, loadRankings, prefetchRankings, getNickname, setNickname, resetAllData, scheduleCloudSave, flushCloudSave, loadCloudSave, buyItem, getItem, refresh, onClose, fetchVxServerState } from './ranking';
import { showRewardAd, isAdBusy } from './ads';
import { claimAdFreeGemReward } from './ranking';
import toolModelFitData from './toolModelFit.json';
import { kitAdd, kitClear, kitCommit, kitTintAll, setSceneryKit } from './sceneryKit';
import { buildBeachWorld, buildParkWorld, buildYardSurroundings, createSkyDome, type Circle, type RegionWorld } from './scenery';
import './style.css';

type Cleanable = THREE.Group & {
  userData: { kind: ObjectKind; cleaned?: boolean; progress: number; floorY?: number };
};

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isTouchDevice() });
renderer.setPixelRatio(Math.min(devicePixelRatio, isTouchDevice() ? 1.5 : 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x66c8f2);
// 안개는 지평선(하늘 돔 아래쪽)과 같은 색이라, 먼 언덕·바다가 하늘로 자연스럽게 녹아든다.
scene.fog = new THREE.Fog(0x8dd4ef, 40, 170);
const skyDome = createSkyDome();
scene.add(skyDome.mesh);

const camera = new THREE.PerspectiveCamera(72, 1, 0.1, 500);
const cameraBaseZ = matchMedia('(pointer: coarse)').matches ? 13 : 11;
camera.position.set(0, 1.85, cameraBaseZ);
scene.add(camera);

// 하늘빛(위)·잔디 반사광(아래). 아래쪽을 따뜻한 연두로 두면 그늘이 칙칙한 회색이 되지 않는다.
scene.add(new THREE.HemisphereLight(0xcdeeff, 0x7a8f45, 2.1));
const sun = new THREE.DirectionalLight(0xffeac4, 3.35); // 살짝 노을 쪽으로 기운 오후 햇빛
sun.position.set(-10, 18, 8);
sun.castShadow = true;
// 풍경 키트·청소물은 플랫 셰이딩 로우폴리라 면이 그림자 맵과 비스듬히 만나는 곳에 줄무늬(acne)가 생긴다.
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
sun.shadow.mapSize.set(isTouchDevice() ? 1024 : 2048, isTouchDevice() ? 1024 : 2048);
sun.shadow.camera.left = -24; sun.shadow.camera.right = 24;
sun.shadow.camera.top = 24; sun.shadow.camera.bottom = -24;
scene.add(sun);
scene.add(sun.target); // 그림자 범위가 플레이어를 따라가도록 해와 과녁을 매 프레임 옮긴다
const SUN_OFFSET = new THREE.Vector3(-10, 18, 8);

// 마당(지역 1~3)에만 있는 것: 집·울타리·나무·바닥·동네 배경. 공원·해변에서는 통째로 숨긴다.
const yardWorld = new THREE.Group();
scene.add(yardWorld);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(46, 40),
  new THREE.MeshStandardMaterial({ color: 0x75b94b, roughness: 1 }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
yardWorld.add(ground);

const path = new THREE.Mesh(
  new THREE.PlaneGeometry(8, 38),
  new THREE.MeshStandardMaterial({ color: 0xd9bb83, roughness: 1 }),
);
path.rotation.x = -Math.PI / 2;
path.position.y = 0.012;
path.receiveShadow = true;
yardWorld.add(path);

function box(size: [number, number, number], color: number, position: [number, number, number]) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(...size),
    new THREE.MeshStandardMaterial({ color, roughness: 0.85 }),
  );
  mesh.position.set(...position);
  mesh.castShadow = mesh.receiveShadow = true;
  yardWorld.add(mesh);
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
yardWorld.add(interiorLight);
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
yardWorld.add(doorPivot);
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
yardWorld.add(chestGroup);
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
yardWorld.add(treeGroup);
// 마당 큰 나무: 풍경 키트 treeRound(그림자 O). 품질과 무관하게 같은 모델이라 한 번만 깐다.
// 예전 코드 나무는 꼭대기가 약 6.3×scale이라 키트(약 5.2m)에 1.2배를 곱한다.
let treesBuilt = false;
function buildTrees() {
  if (treesBuilt) return;
  treesBuilt = true;
  treeSpecs.forEach(([x, z, scale], i) => {
    kitAdd(treeGroup, `treeRound_${i % 3}`, [x, 0, z], i * 1.7, scale * 1.2, { shadow: true });
  });
  kitCommit(treeGroup);
}

// 배경 소품(구름): 품질별 개수만큼 시드 고정 랜덤 배치 (품질 바꿔도 같은 자리)
const backgroundGroup = new THREE.Group();
scene.add(backgroundGroup);
function buildBackgroundDetail(quality: GraphicsQuality) {
  const preset = graphicsPresets[quality];
  kitClear(backgroundGroup); // 키트 구름은 공유 geometry라 dispose하지 않고 인스턴스만 지운다
  let seed = 20260709;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < preset.cloudCount; i += 1) {
    kitAdd(backgroundGroup, `cloud_${i % 3}`, [(rand() - 0.5) * 46, 12 + rand() * 3.5, (rand() - 0.5) * 36], rand() * Math.PI, 0.9 + rand() * 0.4);
  }
  kitCommit(backgroundGroup);
}

// 그래픽 품질 프리셋: 구름 개수 + 그림자 해상도 + 렌더 픽셀비율 (나무는 풍경 키트라 품질과 무관)
type GraphicsQuality = 'low' | 'medium' | 'high';
interface GraphicsPreset {
  cloudCount: number;
  shadowMapSize: number;
  pixelRatio: number;
}
const graphicsPresets: Record<GraphicsQuality, GraphicsPreset> = {
  low: { cloudCount: 0, shadowMapSize: 1024, pixelRatio: 1.25 },
  medium: { cloudCount: 3, shadowMapSize: 2048, pixelRatio: 1.5 },
  high: { cloudCount: 5, shadowMapSize: 4096, pixelRatio: 2 },
};
function applyGraphicsQuality(quality: GraphicsQuality) {
  const preset = graphicsPresets[quality];
  buildTrees();
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
// sky = 하늘 꼭대기, fog = 지평선·안개, outer/hill = 마당 바깥 동네 바닥·먼 언덕(마당 지역만 사용).
const regionThemes: Record<RegionId, { sky: number; fog: number; ground: number; path: number; outer: number; hill: number }> = {
  1: { sky: 0x4fb6ec, fog: 0xbfe6f5, ground: 0x75b94b, path: 0xd9bb83, outer: 0x6aa944, hill: 0x7fb85a },
  2: { sky: 0x5cc7b0, fog: 0xc4eedf, ground: 0x4f9e3f, path: 0xc9a86a, outer: 0x4a9140, hill: 0x5f9f55 },
  3: { sky: 0xd3b37f, fog: 0xeadcb8, ground: 0xab9877, path: 0x8f7a5c, outer: 0x9d8a68, hill: 0xa89470 },
  4: { sky: 0x58b9f0, fog: 0xcdeaf7, ground: 0x86c95a, path: 0xead6a8, outer: 0x86c95a, hill: 0x8cc46a },
  5: { sky: 0x3fb0f2, fog: 0xd2f0fb, ground: 0xf3dfa6, path: 0xc98a4b, outer: 0xf3dfa6, hill: 0xe9d08c },
};

// 지역별 이동 범위·시작 위치. yard=true면 집이 있는 마당(지역 1~3)이고, 아니면 전용 월드를 쓴다.
interface RegionLayout { yard: boolean; minX: number; maxX: number; minZ: number; maxZ: number; spawnZ: number }
const yardLayout: RegionLayout = { yard: true, minX: -20, maxX: 20, minZ: -16, maxZ: 16, spawnZ: cameraBaseZ };
const regionLayouts: Record<RegionId, RegionLayout> = {
  1: yardLayout,
  2: yardLayout,
  3: yardLayout,
  4: { yard: false, minX: -30, maxX: 30, minZ: -24, maxZ: 24, spawnZ: 22 },
  5: { yard: false, minX: -30, maxX: 30, minZ: -11, maxZ: 24, spawnZ: 22 },
};
function isYardRegion() { return regionLayouts[currentRegionId].yard; }

const yardSurroundings = buildYardSurroundings(isTouchDevice());
yardWorld.add(yardSurroundings.group);
const regionWorlds: Partial<Record<RegionId, RegionWorld>> = {
  4: buildParkWorld(isTouchDevice()),
  5: buildBeachWorld(isTouchDevice()),
};
for (const world of Object.values(regionWorlds)) {
  world.group.visible = false;
  scene.add(world.group);
}
function currentWorld() { return regionWorlds[currentRegionId]; }
function hitsCollider(list: Circle[] | undefined, x: number, z: number, padding: number) {
  return !!list?.some(([cx, cz, r]) => Math.hypot(x - cx, z - cz) < r + padding);
}

const gardenDecor = new THREE.Group();
// 꽃·생울타리: 풍경 키트 flowers_0~3(분홍/연분홍/보라/노랑), hedge_0
// 청소 못 하는 장식이라 시야를 가리지 않게 적게, 무릎 높이로만 둔다.
for (let i = 0; i < (isTouchDevice() ? 9 : 16); i++) {
  const [x, z] = randomDecorPosition();
  kitAdd(gardenDecor, `flowers_${Math.floor(Math.random() * 4)}`, [x, 0, z], Math.random() * Math.PI * 2, 0.9 + Math.random() * 0.25);
  addDecorObstacle(2, x, z, 0.8);
}
// 산책로 옆 생울타리는 덤불 청소물과 똑같아 보여 뺐다(청소 못 하는 장식은 플레이 영역에 두지 않는다).
kitCommit(gardenDecor);
gardenDecor.visible = false;
yardWorld.add(gardenDecor);

// Flat stepping-stone slabs: a dry rock-garden look that reads clearly differently from the
// small round dodecahedron "stone" cleanable objects.
const stoneDecor = new THREE.Group();
for (let i = 0; i < (isTouchDevice() ? 9 : 18); i++) {
  const [x, z] = randomDecorPosition();
  // 청소물 돌(회색 덩어리)과 헷갈리지 않게 납작하고 밝은 베이지 디딤돌로 깐다.
  kitAdd(stoneDecor, `slab_${i % 2}`, [x, 0, z], Math.random() * Math.PI, [1.1, 0.5, 1.1], { tint: 0xfff0d0 });
  addDecorObstacle(3, x, z, 0.8);
}
kitCommit(stoneDecor);
stoneDecor.visible = false;
yardWorld.add(stoneDecor);

// Perimeter scenery hides the abrupt edge of the playable ground while keeping the
// front path open. Everything sits outside the player clamp (x ±20, z ±16), so it
// does not alter movement or cleanable spawn positions.
const perimeterDecor = new THREE.Group();
const fenceMaterial = new THREE.MeshStandardMaterial({ color: 0xd7b37a, roughness: 0.95 });
// 울타리 주변 관목·나무는 키트 인스턴스. 지역 테마 색은 kitTintAll로 곱해 바꾼다.
const perimeterFoliage = new THREE.Group();
perimeterDecor.add(perimeterFoliage);
const fencePostGeometry = new THREE.BoxGeometry(0.22, 1.5, 0.22);
const sideRailGeometry = new THREE.BoxGeometry(0.14, 0.14, 3.05);
const frontRailGeometry = new THREE.BoxGeometry(3.05, 0.14, 0.14);

function addFencePost(x: number, z: number) {
  const post = new THREE.Mesh(fencePostGeometry, fenceMaterial);
  post.position.set(x, 0.75, z);
  post.castShadow = post.receiveShadow = true;
  perimeterDecor.add(post);
}

function addFenceRails(x: number, z: number, side: boolean) {
  for (const y of [0.5, 1.05]) {
    const rail = new THREE.Mesh(side ? sideRailGeometry : frontRailGeometry, fenceMaterial);
    rail.position.set(x, y, z);
    rail.castShadow = rail.receiveShadow = true;
    perimeterDecor.add(rail);
  }
}

function addPerimeterShrub(x: number, z: number, scale = 1) {
  kitAdd(perimeterFoliage, 'shrub_0', [x, 0, z], Math.random() * Math.PI, scale, { shadow: true });
}

function addPerimeterTree(x: number, z: number, scale: number) {
  kitAdd(perimeterFoliage, `treeRound_${Math.floor(Math.random() * 3)}`, [x, 0, z], Math.random() * Math.PI * 2, scale * 0.85, { shadow: true });
}

for (const x of [-21.25, 21.25]) {
  for (let z = -16.5; z <= 16.5; z += 3) {
    addFencePost(x, z);
    if (z < 16.5) addFenceRails(x, z + 1.5, true);
    if (Math.round((z + 16.5) / 3) % 2 === 0) addPerimeterShrub(x * 0.985, z + 0.5, 0.9);
  }
}
// Front fence has a wide opening aligned with the path.
for (let x = -21; x <= 21; x += 3) {
  if (Math.abs(x) < 3) continue;
  addFencePost(x, 18.1);
  if (x < -3 || (x >= 3 && x < 21)) addFenceRails(x + 1.5, 18.1, false);
  if (Math.abs(x) > 4 && Math.round((x + 21) / 3) % 2 === 0) addPerimeterShrub(x + 0.7, 17.75, 0.95);
}
for (const [x, z, scale] of [
  [-19, 18.4, 0.9], [-13, 18.7, 1.1], [-7, 18.5, 0.85],
  [7, 18.5, 0.9], [13, 18.7, 1.05], [19, 18.4, 0.88],
] as Array<[number, number, number]>) addPerimeterTree(x, z, scale);
kitCommit(perimeterFoliage);
yardWorld.add(perimeterDecor);

// 키트 원래 색에 곱하는 배율: 1 앞마당 그대로, 2 정원 짙은 초록, 3 돌 정원 마른 올리브빛.
const perimeterFoliageColors: Record<1 | 2 | 3, number> = {
  1: 0xffffff,
  2: 0xb8dcc0,
  3: 0xe0c890,
};

function applyRegionTheme(regionId: RegionId) {
  const theme = regionThemes[regionId];
  scene.background = new THREE.Color(theme.fog);
  skyDome.setColors(theme.sky, theme.fog);
  (scene.fog as THREE.Fog).color.setHex(theme.fog);
  const yard = regionLayouts[regionId].yard;
  yardWorld.visible = yard;
  for (const [id, world] of Object.entries(regionWorlds)) world.group.visible = Number(id) === regionId;
  if (!yard) return;
  (ground.material as THREE.MeshStandardMaterial).color.setHex(theme.ground);
  (path.material as THREE.MeshStandardMaterial).color.setHex(theme.path);
  yardSurroundings.recolor(theme.outer, theme.hill);
  gardenDecor.visible = regionId === 2;
  stoneDecor.visible = regionId === 3;
  kitTintAll(perimeterFoliage, perimeterFoliageColors[regionId as 1 | 2 | 3]);
}

function cleanableGroup(kind: ObjectKind, x: number, z: number): Cleanable {
  const group = new THREE.Group() as Cleanable;
  group.userData = { kind, progress: 0 };
  group.position.set(x, 0.05, z);
  scene.add(group);
  cleanables.push(group);
  return group;
}

// 낙엽 3D 모델은 포토그래메트리 스캔이라 압축 한계까지 줄여도 약 2.5만 정점이다.
// 지역당 100개면 250만 정점이라 약한 기기에서 감당이 안 되므로, 그래픽 품질이 '높음'일 때만 쓰고
// 낮음/보통에서는 기존 평면 낙엽(정점 10개 남짓)을 그대로 쓴다.
// 낙엽은 평면 1장(정점 10개대)을 유지하되, 오크 잎 GLB에서 뽑아낸 잎 표면 텍스처를 입힌다.
// 3D 스캔 메시를 그대로 쓰면 개당 2.5만 정점이라 지역당 100개를 감당할 수 없다.
// 실루엣은 아래 Shape이 만들고, 텍스처는 잎맥·색 얼룩만 담당한다.
const LEAF_TEXTURE_PATH = '/assets/leaf-texture.png';
const leafTexture = new THREE.TextureLoader().load(LEAF_TEXTURE_PATH);
leafTexture.colorSpace = THREE.SRGBColorSpace;

// 잎 하나짜리 오크형 실루엣(끝이 뾰족한 타원 + 짧은 잎자루). 텍스처의 주맥이 가로로 놓여 있어
// 실루엣도 같은 방향(x축이 길게)으로 그린다.
function createLeafShape() {
  const shape = new THREE.Shape();
  shape.moveTo(-0.5, 0);            // 잎자루 끝
  shape.quadraticCurveTo(-0.2, 0.22, 0.16, 0.2);
  shape.quadraticCurveTo(0.38, 0.16, 0.5, 0);   // 잎 끝(뾰족)
  shape.quadraticCurveTo(0.38, -0.16, 0.16, -0.2);
  shape.quadraticCurveTo(-0.2, -0.22, -0.5, 0);
  shape.closePath();
  return shape;
}

// ShapeGeometry의 UV는 도형 좌표를 그대로 쓰므로 텍스처가 잘린다. 바운딩박스 기준 0~1로 다시 매핑.
function remapUv(geometry: THREE.BufferGeometry) {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const sx = box.max.x - box.min.x;
  const sy = box.max.y - box.min.y;
  const pos = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) - box.min.x) / sx, (pos.getY(i) - box.min.y) / sy);
  }
  uv.needsUpdate = true;
}

const leafGeometry = new THREE.ShapeGeometry(createLeafShape());
remapUv(leafGeometry);

function buildFlatLeaf(group: THREE.Group) {
  const mesh = new THREE.Mesh(
    leafGeometry,
    new THREE.MeshStandardMaterial({
      map: leafTexture,
      // 텍스처가 이미 잎 색이라 색조는 살짝만 섞어 개체 간 차이를 준다.
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

// ── Blender로 만든 청소 오브젝트 모델 (tools/blender/build_cleanables.py → Yardsweep-Cleanables.glb) ──
// GLB 하나에 "<kind>_<variant>" 노드가 들어 있다. 노드마다 메시 1개(+유리/금속 부분만 추가 primitive),
// 색은 버텍스 컬러, 재질은 파일 전체에서 5개(Matte/Shiny/Glass/GoldGlow/GemGlow)만 공유한다.
// 원점은 바닥 중심이라 그룹 y = 바닥 높이. geometry·material은 전부 공유 리소스라 dispose하지 않는다.
// 모델 로드 전에 생성된 오브젝트는 아래 legacy 코드 모양으로 만들어지고, 로드 후 upgradeCleanableVisuals()가 교체한다.
const CLEANABLES_PATH = '/assets/Yardsweep-Cleanables.glb';
const SCENERY_KIT_PATH = '/assets/Yardsweep-Scenery.glb';
const GROUND_Y = 0.02;
const cleanableModels = new Map<ObjectKind, THREE.Object3D[]>();
// 종류별 크기 흔들림 [최소, 최대]. 같은 모델 반복이 덜 티 나게.
const cleanableScale: Partial<Record<ObjectKind, [number, number]>> = {
  leaf: [0.5, 0.85], grass: [0.85, 1.15], stone: [0.85, 1.15], bush: [0.9, 1.1], seaweed: [0.85, 1.15], boulder: [0.9, 1.1],
};
// 발치의 작은 것들은 그림자를 꺼서 섀도우 패스 비용을 아낀다.
const noShadowKinds = new Set<ObjectKind>(['grass', 'seaweed']);
function attachCleanableModel(group: Cleanable) {
  const variants = cleanableModels.get(group.userData.kind);
  if (!variants) return false;
  const model = variants[Math.floor(Math.random() * variants.length)].clone(true);
  const [min, max] = cleanableScale[group.userData.kind] ?? [0.95, 1.05];
  model.scale.setScalar(min + Math.random() * (max - min));
  const shadow = !noShadowKinds.has(group.userData.kind);
  model.traverse((child) => { if (child instanceof THREE.Mesh) child.castShadow = shadow; });
  group.add(model);
  group.position.y = group.userData.floorY ?? GROUND_Y;
  group.rotation.set(0, Math.random() * Math.PI * 2, 0);
  return true;
}
function createModelCleanable(kind: ObjectKind, x: number, z: number) {
  if (!cleanableModels.has(kind)) return false;
  attachCleanableModel(cleanableGroup(kind, x, z));
  return true;
}
function loadCleanableModels() {
  return loadModelScene(CLEANABLES_PATH).then(async (source) => {
    await renderer.compileAsync(source, camera);
    registerSharedResources(source);
    cleanableModels.clear();
    for (const child of source.children) {
      const kind = child.name.split('_')[0] as ObjectKind;
      if (!(kind in objects)) continue;
      // 노드 자체 위치는 원점이어야 하지만, 혹시 몰라 복제본 기준점을 0으로 맞춘다.
      const prototype = child.clone(true);
      prototype.position.set(0, 0, 0);
      const list = cleanableModels.get(kind) ?? [];
      list.push(prototype);
      cleanableModels.set(kind, list);
    }
  });
}
// 모델 로드 전에 legacy 모양으로 놓인 오브젝트를 모델로 바꾼다(그룹 유지: 진행도·위치 보존).
function upgradeCleanableVisuals() {
  if (cleanableModels.size === 0) return;
  for (const object of cleanables) {
    if (object.userData.cleaned || !cleanableModels.has(object.userData.kind)) continue;
    clearVisual(object);
    attachCleanableModel(object);
  }
}

function createLeaf(x: number, z: number) {
  if (createModelCleanable('leaf', x, z)) return;
  buildFlatLeaf(cleanableGroup('leaf', x, z));
}

function createCan(x: number, z: number) {
  if (createModelCleanable('can', x, z)) return;
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
  if (createModelCleanable('goldCan', x, z)) return;
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
  if (createModelCleanable(kind, x, z)) return;
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

// 잔디 폴백(모델 로드 전): 평면 잎 5장. 로드 후 upgradeCleanableVisuals()가 모델로 교체한다.
function buildBladeGrass(group: THREE.Group) {
  const material = new THREE.MeshStandardMaterial({ color: 0x3f9c35, side: THREE.DoubleSide });
  for (let i = 0; i < 5; i++) {
    const blade = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.65), material);
    blade.position.set((i - 2) * 0.1, 0.3, (i % 2) * 0.08);
    blade.rotation.y = i * 0.8;
    group.add(blade);
  }
}

// GLB 프로토타입을 clone(true)하면 geometry/material은 원본과 공유된다.
// 인스턴스를 버릴 때 이걸 dispose하면 프로토타입과 다른 인스턴스까지 깨지므로,
// 프로토타입이 소유한 리소스는 여기 등록해두고 dispose 대상에서 제외한다.
const sharedResourceIds = new Set<string>();
function registerSharedResources(root: THREE.Object3D) {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    sharedResourceIds.add(child.geometry.uuid);
    (Array.isArray(child.material) ? child.material : [child.material]).forEach((m) => sharedResourceIds.add(m.uuid));
  });
}
// 그룹의 자식을 비우면서, 그 그룹만 쓰던(=공유가 아닌) 리소스만 해제한다.
function clearVisual(group: THREE.Object3D) {
  group.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    if (!sharedResourceIds.has(child.geometry.uuid)) child.geometry.dispose();
    (Array.isArray(child.material) ? child.material : [child.material])
      .forEach((m) => { if (!sharedResourceIds.has(m.uuid)) m.dispose(); });
  });
  group.clear();
}

function createGrass(x: number, z: number) {
  if (createModelCleanable('grass', x, z)) return;
  buildBladeGrass(cleanableGroup('grass', x, z));
}

function createStone(x: number, z: number) {
  if (createModelCleanable('stone', x, z)) return;
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
  if (createModelCleanable('goldStone', x, z)) return;
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

// ── 공원·해변 전용 청소물 ──
function createTrashBag(x: number, z: number) {
  if (createModelCleanable('trashBag', x, z)) return;
  const group = cleanableGroup('trashBag', x, z);
  group.position.y = 0.02;
  group.rotation.y = Math.random() * Math.PI * 2;
  // 밝은 민트색 + 위로 벌어진 매듭: 어두운 공 모양이면 폭탄처럼 보인다.
  const bagMaterial = new THREE.MeshStandardMaterial({ color: 0x6cc79a, roughness: 0.4, metalness: 0.05 });
  const bag = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 10), bagMaterial);
  bag.scale.set(1.05, 1, 0.9);
  bag.position.y = 0.38;
  bag.castShadow = true;
  group.add(bag);
  const knot = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.3, 8), bagMaterial);
  knot.position.y = 0.86;
  knot.rotation.x = Math.PI;
  group.add(knot);
  const tie = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.025, 6, 12), new THREE.MeshStandardMaterial({ color: 0xffd84a }));
  tie.position.y = 0.74;
  tie.rotation.x = Math.PI / 2;
  group.add(tie);
}

function createBottle(x: number, z: number) {
  if (createModelCleanable('bottle', x, z)) return;
  const group = cleanableGroup('bottle', x, z);
  group.position.y = 0.12;
  group.rotation.y = Math.random() * Math.PI * 2;
  const glass = new THREE.MeshStandardMaterial({ color: Math.random() < 0.5 ? 0x4fbf7a : 0x6fc3e8, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.82 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.42, 12), glass);
  body.rotation.z = Math.PI / 2;
  body.castShadow = true;
  group.add(body);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.11, 0.2, 10), glass);
  neck.rotation.z = Math.PI / 2;
  neck.position.x = 0.3;
  group.add(neck);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.06, 10), new THREE.MeshStandardMaterial({ color: 0xff6b6b }));
  cap.rotation.z = Math.PI / 2;
  cap.position.x = 0.42;
  group.add(cap);
}

function createBush(x: number, z: number) {
  if (createModelCleanable('bush', x, z)) return;
  const group = cleanableGroup('bush', x, z);
  group.position.y = 0;
  const leafMaterial = new THREE.MeshStandardMaterial({ color: 0x4a9a3a, flatShading: true, roughness: 0.9 });
  for (const [bx, by, bz, s] of [[0, 0.45, 0, 0.55], [0.38, 0.32, 0.2, 0.38], [-0.35, 0.3, -0.15, 0.4], [0.05, 0.35, -0.38, 0.34]]) {
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), leafMaterial);
    blob.position.set(bx, by, bz);
    blob.castShadow = true;
    group.add(blob);
  }
  const berryMaterial = new THREE.MeshStandardMaterial({ color: 0xe8435a, roughness: 0.5 });
  for (let i = 0; i < 5; i++) {
    const berry = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), berryMaterial);
    const angle = Math.random() * Math.PI * 2;
    berry.position.set(Math.cos(angle) * 0.5, 0.35 + Math.random() * 0.4, Math.sin(angle) * 0.5);
    group.add(berry);
  }
}

function createSeaweed(x: number, z: number) {
  if (createModelCleanable('seaweed', x, z)) return;
  const group = cleanableGroup('seaweed', x, z);
  group.position.y = 0.02;
  group.rotation.y = Math.random() * Math.PI * 2;
  const material = new THREE.MeshStandardMaterial({ color: 0x5f8f3a, roughness: 0.6, side: THREE.DoubleSide });
  for (let i = 0; i < 6; i++) {
    const strand = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.03, 0.1), material);
    strand.position.set(0, 0.03 + i * 0.012, 0);
    strand.rotation.y = (i / 6) * Math.PI + Math.random() * 0.3;
    strand.castShadow = true;
    group.add(strand);
  }
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 5), new THREE.MeshStandardMaterial({ color: 0x8a7a2f }));
  bulb.position.y = 0.08;
  group.add(bulb);
}

function createBoulder(x: number, z: number) {
  if (createModelCleanable('boulder', x, z)) return;
  const group = cleanableGroup('boulder', x, z);
  group.position.y = 0.42;
  group.rotation.y = Math.random() * Math.PI * 2;
  const rock = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.7, 0),
    new THREE.MeshStandardMaterial({ color: 0x7b8086, flatShading: true, roughness: 1 }),
  );
  rock.scale.set(1.15, 0.75, 1);
  rock.castShadow = true;
  group.add(rock);
  // 이끼 덮인 윗면: 작은 회색 돌과 한눈에 구분된다
  const moss = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6, 0, Math.PI * 2, 0, Math.PI / 3), new THREE.MeshStandardMaterial({ color: 0x6aa944, roughness: 1, flatShading: true }));
  moss.position.y = 0.12;
  moss.scale.set(1.15, 0.9, 1);
  group.add(moss);
}

const objectFactories: Record<ObjectKind, (x: number, z: number) => void> = {
  leaf: createLeaf,
  can: createCan,
  grass: createGrass,
  stone: createStone,
  goldCan: createGoldCan,
  goldChest: (x, z) => createChest('goldChest', x, z),
  gemChest: (x, z) => createChest('gemChest', x, z),
  goldStone: createGoldStone,
  trashBag: createTrashBag,
  bottle: createBottle,
  bush: createBush,
  seaweed: createSeaweed,
  boulder: createBoulder,
};

// 공원·해변 스폰: 종류별로 어울리는 구역을 뽑고, 구조물(spawnAvoid)을 피한다.
function openMapSpawnPoint(regionId: RegionId, kind: ObjectKind): [number, number] {
  const layout = regionLayouts[regionId];
  const world = regionWorlds[regionId]!;
  const anywhere = (): [number, number] => [
    layout.minX + 1 + Math.random() * (layout.maxX - layout.minX - 2),
    layout.minZ + 1 + Math.random() * (layout.maxZ - layout.minZ - 2),
  ];
  const near = (points: Array<[number, number]> | undefined, min: number, max: number): [number, number] => {
    if (!points?.length) return anywhere();
    const [px, pz] = points[Math.floor(Math.random() * points.length)];
    const angle = Math.random() * Math.PI * 2;
    const dist = min + Math.random() * (max - min);
    return [px + Math.cos(angle) * dist, pz + Math.sin(angle) * dist];
  };
  let generate = anywhere;
  if (regionId === 4) {
    if (kind === 'bush') generate = () => { // 경계 생울타리 안쪽 띠
      const [x, z] = anywhere();
      return Math.random() < 0.5 ? [x, Math.sign(z || 1) * (19 + Math.random() * 4)] : [Math.sign(x || 1) * (25 + Math.random() * 4), z];
    };
    else if (kind === 'boulder' || kind === 'goldStone') generate = () => near(world.anchors.pond, 10.5, 13.5);
    else if (kind === 'trashBag') generate = () => near(world.anchors.benches, 1.6, 3);
  } else if (regionId === 5) {
    if (kind === 'seaweed') generate = () => [layout.minX + 1 + Math.random() * (layout.maxX - layout.minX - 2), -10.5 + Math.random() * 4];
    else if (kind === 'stone' || kind === 'boulder' || kind === 'goldStone') generate = () => [-29 + Math.random() * 9, -10 + Math.random() * 30];
    else if (kind === 'trashBag') generate = () => near(world.anchors.umbrellas, 2.6, 4);
  }
  let pos = generate();
  for (let tries = 0; tries < 30; tries++) {
    const [x, z] = pos;
    const inside = x > layout.minX + 0.5 && x < layout.maxX - 0.5 && z > layout.minZ + 0.5 && z < layout.maxZ - 0.5;
    if (inside && !hitsCollider(world.spawnAvoid, x, z, 0)) break;
    pos = tries < 20 ? generate() : anywhere();
  }
  return pos;
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
  counts.goldStone = counts.stone > 0 ? rareCount() : 0;
  if (!regionLayouts[regionId].yard) {
    // 넓은 지역은 희귀 오브젝트도 하나씩 더 깔아 둔다(찾아다니는 재미).
    counts.goldCan += 1;
    counts.goldChest += 1;
    counts.gemChest += 1;
    return counts;
  }
  // 집 안 청소 오브젝트도 지역 완료 카운트에 포함
  counts.leaf = (counts.leaf ?? 0) + HOUSE_LEAF;
  counts.can = (counts.can ?? 0) + HOUSE_CAN;
  return counts;
}

function populateRegion(regionId: RegionId, state: RegionProgressState) {
  cleanables.forEach((object) => scene.remove(object));
  cleanables.length = 0;
  const counts = state.remaining;
  if (!regionLayouts[regionId].yard) {
    for (const kind of Object.keys(objectFactories) as ObjectKind[]) {
      for (let i = 0; i < (counts[kind] ?? 0); i++) objectFactories[kind](...openMapSpawnPoint(regionId, kind));
    }
    total = state.total;
    cleaned = Math.max(0, total - cleanables.length);
    return;
  }
  // 집 안 오브젝트는 실내 바닥(윗면 y≈0.06) 위에 앉도록 마지막 생성물의 y를 올린다.
  const liftLastIntoHouse = () => { const last = cleanables[cleanables.length - 1]; last.userData.floorY = 0.11; last.position.y = 0.11; };
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
    case 'wideBroom': return basicBroomTool;
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
const modelCache = new Map<string, Promise<THREE.Group>>();
function loadModelScene(path: string) {
  let pending = modelCache.get(path);
  if (!pending) {
    pending = loader.loadAsync(path).then((gltf) => gltf.scene);
    modelCache.set(path, pending);
  }
  return pending;
}
// Yardsweep-*.glb 도구 모델(Tripo image-to-3D)은 원화 각도(비스듬한 3/4 뷰)대로 기울어져 나온다.
// 그래서 정점 분포의 주축(PCA)으로 모든 도구를 같은 기준 자세로 먼저 맞춘다(canonicalToolBasis):
//   가장 긴 축 = Y(손잡이 끝 +Y, 작업부 −Y), 두 번째로 넓은 축 = X, 가장 얇은 축 = Z.
//   작업부는 축 양끝 중 단면이 더 넓게 퍼진 쪽(솔·날·곡괭이 머리)으로 자동 판정한다. 틀리면 flip.
// 그다음 yaw(모델 자체 Y회전), length(세로 길이)로 다듬고 손잡이 끝을 원점에 둔 뒤,
// rx/ry/rz(라디안)·px/py/pz로 손에 쥔 자세를 정한다. 원점 = toolAnchor = 손 위치라 휘두르기 회전 중심도 손이 된다.
// 값은 개발 서버의 http://localhost:5173/?tooltune 패널(toolTuner.ts)에서 맞추고 "저장"을 누른다.
export interface ToolModelFit {
  flip: boolean; yaw: number; length: number;
  rx: number; ry: number; rz: number; px: number; py: number; pz: number;
}
// 자세값 데이터는 toolModelFit.json. ?tooltune 패널의 저장 버튼이 이 파일을 직접 덮어쓴다(vite.config.ts 플러그인).
const toolModelFit = toolModelFitData as Record<ToolId, ToolModelFit>;

// 3x3 대칭 행렬의 최대 고유벡터(거듭제곱법). 도구 메시는 축 길이 차이가 커서 수십 번이면 수렴한다.
function principalAxis(c: number[][], skip?: THREE.Vector3) {
  const v = new THREE.Vector3(0.577, 0.577, 0.577);
  if (skip) v.addScaledVector(skip, -v.dot(skip)).normalize();
  for (let i = 0; i < 64; i++) {
    const next = new THREE.Vector3(
      c[0][0] * v.x + c[0][1] * v.y + c[0][2] * v.z,
      c[1][0] * v.x + c[1][1] * v.y + c[1][2] * v.z,
      c[2][0] * v.x + c[2][1] * v.y + c[2][2] * v.z,
    );
    if (skip) next.addScaledVector(skip, -next.dot(skip));
    if (next.lengthSq() < 1e-12) break;
    v.copy(next.normalize());
  }
  return v;
}
// 소스 GLB마다 한 번만 계산해서 캐시한다(정점 수천 개 샘플).
const toolBasisCache = new WeakMap<THREE.Object3D, THREE.Quaternion>();
function canonicalToolBasis(source: THREE.Object3D) {
  const cached = toolBasisCache.get(source);
  if (cached) return cached;
  source.updateMatrixWorld(true);
  const points: THREE.Vector3[] = [];
  source.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const position = child.geometry.getAttribute('position');
    const stride = Math.max(1, Math.floor(position.count / 4000));
    for (let i = 0; i < position.count; i += stride) {
      points.push(new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(child.matrixWorld));
    }
  });
  const mean = new THREE.Vector3();
  for (const p of points) mean.add(p);
  mean.divideScalar(Math.max(points.length, 1));
  const c = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const p of points) {
    const d = [p.x - mean.x, p.y - mean.y, p.z - mean.z];
    for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) c[r][k] += d[r] * d[k];
  }
  // 고유축 3개를 구한 뒤, 분산(정점 밀도에 끌림: 빽빽한 빗자루 솔) 대신 실제 길이(투영 범위)로 순서를 정한다.
  const e1 = principalAxis(c);
  const e2 = principalAxis(c, e1);
  const axes = [e1, e2, new THREE.Vector3().crossVectors(e1, e2).normalize()];
  const extentOf = (axis: THREE.Vector3) => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const p of points) {
      const t = axis.dot(p);
      if (t < lo) lo = t;
      if (t > hi) hi = t;
    }
    return hi - lo;
  };
  const sorted = axes.map((axis) => ({ axis, extent: extentOf(axis) })).sort((a, b) => b.extent - a.extent);
  const ay = sorted[0].axis.clone();
  const ax = sorted[1].axis.clone();
  // 축 양끝 25% 구간에서 축에 수직인 퍼짐을 비교: 더 넓은 쪽이 작업부(−Y로 보낸다).
  const along = points.map((p) => new THREE.Vector3().subVectors(p, mean).dot(ay));
  const min = Math.min(...along);
  const max = Math.max(...along);
  const spread = (lo: number, hi: number) => {
    let sum = 0;
    let n = 0;
    const offset = new THREE.Vector3();
    points.forEach((p, i) => {
      if (along[i] < lo || along[i] > hi) return;
      offset.subVectors(p, mean).addScaledVector(ay, -along[i]);
      sum += offset.length();
      n++;
    });
    return n ? sum / n : 0;
  };
  const quarter = (max - min) * 0.25;
  if (spread(max - quarter, max) > spread(min, min + quarter)) ay.negate();
  // 작업부의 무게중심이 −X 쪽으로 오게(낫 날이 코드 도구처럼 왼쪽으로 휘게) X 부호를 정한다.
  // ay를 뒤집었을 수 있으니 투영을 다시 구해서, −Y 끝 25% 구간을 작업부로 본다.
  const headCenter = new THREE.Vector3();
  let headCount = 0;
  const projected = points.map((p) => new THREE.Vector3().subVectors(p, mean).dot(ay));
  const headEnd = Math.min(...projected);
  const headSpan = (Math.max(...projected) - headEnd) * 0.25;
  points.forEach((p, i) => {
    if (projected[i] <= headEnd + headSpan) { headCenter.add(p); headCount++; }
  });
  if (headCount && headCenter.divideScalar(headCount).sub(mean).dot(ax) > 0) ax.negate();
  const az = new THREE.Vector3().crossVectors(ax, ay).normalize();
  const basis = new THREE.Matrix4().makeBasis(ax, ay, az).transpose();
  const quaternion = new THREE.Quaternion().setFromRotationMatrix(basis);
  toolBasisCache.set(source, quaternion);
  return quaternion;
}

// clone(true)는 geometry/material을 캐시 원본과 공유한다. 여기서 dispose하지 않는다.
function placeToolModel(toolId: ToolId, source: THREE.Object3D) {
  const fit = toolModelFit[toolId];
  const model = source.clone(true);
  model.quaternion.copy(canonicalToolBasis(source));
  const oriented = new THREE.Group();
  oriented.add(model);
  oriented.rotation.set(fit.flip ? Math.PI : 0, fit.yaw, 0);
  const bounds = new THREE.Box3().setFromObject(oriented);
  const center = bounds.getCenter(new THREE.Vector3());
  const scale = fit.length / Math.max(bounds.max.y - bounds.min.y, 0.001);
  oriented.scale.setScalar(scale);
  oriented.position.set(-center.x * scale, -bounds.max.y * scale, -center.z * scale);
  model.traverse((child) => {
    if (child instanceof THREE.Mesh) child.castShadow = true;
  });
  const holder = new THREE.Group();
  holder.add(oriented);
  holder.rotation.set(fit.rx, fit.ry, fit.rz);
  holder.position.set(fit.px, fit.py, fit.pz);
  return holder;
}

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
  void loadModelScene(modelPath).then((source) => {
    if (request !== modelRequest) return;
    toolAnchor.clear();
    toolAnchor.add(placeToolModel(toolId, source));
  }).catch(() => {
    if (request !== modelRequest) return;
    toolAnchor.clear();
    toolAnchor.add(builtinToolFor(toolId));
  });
}
// 개발 서버에서만: http://localhost:5173/?tooltune 로 도구 자세 튜너 패널을 연다.
if (import.meta.env.DEV && new URLSearchParams(location.search).has('tooltune')) {
  void import('./toolTuner').then(({ mountToolTuner }) => mountToolTuner(toolModelFit, showToolModel));
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
  boulderCleaned: number;
  bestCombo: number;
}
interface GameSettings {
  language: Locale;
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
  lastGemAdTime: number;
  savedAt: number;
}

const GEM_AD_COOLDOWN = 30 * 60 * 1000; // 30 minutes
const GEM_AD_REWARD = 30;
const defaultStats: PlayerStats = { leafCleaned: 0, canCleaned: 0, coinsEarned: 0, regionsCleared: 0, totalCleaned: 0, boulderCleaned: 0, bestCombo: 0 };
const defaultMissionProgress: Record<MissionId, number> = {
  leaf100: 0, can30: 0, regionClear: 0, fastClear5min: 0, grass50: 0, stone20: 0, bigTrash15: 0, combo30: 0,
};
const UPGRADE_MAX = 15;
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
  lastGemAdTime: 0,
  savedAt: 0,
};
function loadSave(): SaveData {
  try {
    const parsed = JSON.parse(localStorage.getItem('yardSweepSave') ?? '') as Partial<SaveData>;
    return {
      coins: Math.max(0, Number(parsed.coins) || 0),
      gems: Number.isFinite(Number(parsed.gems)) ? Math.max(0, Number(parsed.gems)) : defaultSave.gems,
      currentRegion: ((regionIds as number[]).includes(Number(parsed.currentRegion)) ? Number(parsed.currentRegion) : 1) as RegionId,
      unlockedRegion: ((regionIds as number[]).includes(Number(parsed.unlockedRegion)) ? Number(parsed.unlockedRegion) : 1) as RegionId,
      regionProgress: parsed.regionProgress ?? {},
      unlockedTools: Array.isArray(parsed.unlockedTools) ? parsed.unlockedTools : ['basicBroom'],
      equipped: { ...defaultSave.equipped, ...(parsed.equipped ?? {}) },
      upgrades: { ...defaultSave.upgrades, ...(parsed.upgrades ?? {}) },
      stats: { ...defaultStats, ...(parsed.stats ?? {}) },
      missionProgress: { ...defaultMissionProgress, ...(parsed.missionProgress ?? {}) },
      achievementsClaimed: Array.isArray(parsed.achievementsClaimed) ? parsed.achievementsClaimed : [],
      coinBoostExpiry: Number(parsed.coinBoostExpiry) || 0,
      robotVacuumOwned: Boolean(parsed.robotVacuumOwned),
      settings: (() => {
        const merged = { ...defaultSettings, ...(parsed.settings ?? {}) };
        // 지원하지 않는 언어 코드가 저장돼 있으면 t()가 키를 그대로 뱉으므로 기본값으로 되돌린다.
        if (!isLocale(merged.language)) merged.language = defaultSettings.language;
        return merged;
      })(),
      tutorial: Number.isFinite(Number(parsed.tutorial)) ? Number(parsed.tutorial) : 0,
      chestDayClaimed: Number.isFinite(Number(parsed.chestDayClaimed)) ? Number(parsed.chestDayClaimed) : -1,
      adsRemoved: Boolean(parsed.adsRemoved),
      lastGemAdTime: Number(parsed.lastGemAdTime) || 0,
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
  if (comboCount > stats.bestCombo) stats.bestCombo = comboCount;
  if (comboCount === 30) incrementMissionProgress('combo30');
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
  return isYardRegion() && Math.hypot(camera.position.x - chestGroup.position.x, camera.position.z - chestGroup.position.z) < 2.6;
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
  // 터치 기기에서는 WASD·좌클릭·Tab이 존재하지 않으므로 조이스틱·버튼 기준 문구를 쓴다.
  tutorialTextEl.textContent = t(`tutorial.step${tutorialStep}${usesMobileControls() ? 'Mobile' : ''}`);
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
  void loadModelScene('/assets/RobotVacuum.glb').then((source) => {
    const model = source.clone(true);
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const scale = 1 / Math.max(size.x, size.y, size.z, 0.001);
    model.scale.setScalar(scale);
    model.position.copy(center.multiplyScalar(-scale));
    model.traverse((child) => { if (child instanceof THREE.Mesh) child.castShadow = true; });
    robotVacuumGroup.add(model);
  }).catch(() => undefined);
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
const toolUi: Record<ToolId, { size: number }> = {
  basicBroom: { size: 122 },
  wideBroom: { size: 176 },
  vacuum: { size: 154 },
  copperSickle: { size: 142 },
  metalSickle: { size: 178 },
  pickaxe: { size: 112 },
  neonSickle: { size: 188 },
  neonPickaxe: { size: 132 },
};
// HUD 인벤토리 슬롯에 표시할 도구 아이콘 이미지
const toolImage: Record<ToolId, string> = {
  basicBroom: '/assets/Yardsweep-BasicBroom-Icon.png',
  wideBroom: '/assets/Yardsweep-WideBroom-Icon.png',
  vacuum: '/assets/Yardsweep-Vacuum-Icon.png',
  copperSickle: '/assets/Yardsweep-CopperSickle-Icon.png',
  metalSickle: '/assets/Yardsweep-MetalSickle-Icon.png',
  pickaxe: '/assets/Yardsweep-Pickaxe-Icon.png',
  neonSickle: '/assets/Yardsweep-NeonSickle-Icon.png',
  neonPickaxe: '/assets/Yardsweep-NeonPickaxe-Icon.png',
};

const coinsEl = document.querySelector('#coins')!;
const gemsEl = document.querySelector('#gems')!;
const playerLevelEl = document.querySelector('#player-level')!;
const levelBarFill = document.querySelector<HTMLElement>('#level-bar-fill')!;
const coinBoostBadge = document.querySelector<HTMLElement>('#coin-boost-badge')!;
const coinBoostTimerEl = document.querySelector('#coin-boost-timer')!;
const coinBoostButton = document.querySelector<HTMLButtonElement>('#buy-coin-boost')!;
const robotVacuumButton = document.querySelector<HTMLButtonElement>('#buy-robot-vacuum')!;

function uiIcon(name: string) {
  return `<i class="ui-icon icon-${name}" aria-hidden="true"></i>`;
}

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
const start = document.querySelector<HTMLButtonElement>('#start')!;
const loadingScreen = document.querySelector<HTMLElement>('#loading-screen')!;
const loadingProgress = document.querySelector<HTMLElement>('#loading-progress')!;
const loadingStatus = document.querySelector<HTMLElement>('#loading-status')!;
let assetsReady = false;
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
let lastGemAdTime = saveData.lastGemAdTime;
let noticeTimer = 0;

const BGM_BASE_VOLUME = 0.28;
const BUTTON_BASE_VOLUME = 0.45;
const REGION_COMPLETE_BASE_VOLUME = 0.75;
const COIN_BASE_VOLUME = 0.55;
const FOOTSTEP_BASE_VOLUME = 0.35;
const CLEANING_BASE_VOLUME = 0.6;
const DOOR_BASE_VOLUME = 0.6;

// BGM 3곡은 합쳐서 ~9MB라 전부 미리 받으면 첫 로딩이 크게 느려진다.
// 시작 시엔 현재 지역 곡만 받고, 나머지는 그 지역에 들어갈 때 받는다.
const bgmTracks = [0, 1, 2].map((index) => new Audio(`/assets/bgm-${index}.mp3`));
bgmTracks.forEach((audio) => { audio.loop = true; audio.preload = 'none'; });
// 곡은 3개뿐이라 공원은 정원 곡, 해변은 앞 마당 곡을 함께 쓴다.
function bgmIndexFor(regionId: RegionId) { return [0, 1, 2, 1, 0][regionId - 1]; }
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

// 로딩 화면에서 미리 받을 오디오. BGM은 여기 넣지 않는다(현재 지역 곡만 따로 받는다).
const allAudio = [
  buttonSound,
  regionCompleteSound,
  coinSound,
  footstepSound,
  doorSound,
  ...Object.values(cleaningSounds),
  robotVacuumSound,
];

function preloadAudio(audio: HTMLAudioElement) {
  return new Promise<void>((resolve) => {
    if (audio.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) { resolve(); return; }
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      audio.removeEventListener('canplaythrough', finish);
      audio.removeEventListener('error', finish);
      resolve();
    };
    const timeout = window.setTimeout(finish, 15000);
    audio.preload = 'auto';
    audio.addEventListener('canplaythrough', finish, { once: true });
    audio.addEventListener('error', finish, { once: true });
    audio.load();
  });
}

function preloadImage(path: string) {
  return new Promise<void>((resolve) => {
    const image = new Image();
    image.onload = () => { void image.decode().catch(() => undefined).finally(resolve); };
    image.onerror = () => resolve();
    image.src = path;
  });
}

async function prepareGameAssets() {
  const modelPaths = [...new Set([
    ...Object.values(tools).map((tool) => tool.model).filter((path): path is string => !!path),
    '/assets/RobotVacuum.glb',
  ])];
  const imagePaths = [...new Set(Object.values(toolImage))];
  const tasks: Array<Promise<unknown>> = [
    ...modelPaths.map(async (path) => {
      const model = await loadModelScene(path);
      await renderer.compileAsync(model, camera);
    }),
    ...imagePaths.map(preloadImage),
    ...allAudio.map(preloadAudio),
    // 현재 지역 BGM 1곡만. 나머지 2곡은 해당 지역 진입 시 playRegionBgm()이 받는다.
    preloadAudio(bgmTracks[bgmIndexFor(currentRegionId)]),
    loadCleanableModels(),
    // 풍경 키트: 실패하면 같은 이름의 단순 도형 키트로 깐다(지형·집이 통째로 비지 않게).
    loadModelScene(SCENERY_KIT_PATH).then(
      async (source) => { await renderer.compileAsync(source, camera); registerSharedResources(source); setSceneryKit(source); },
      () => setSceneryKit(null),
    ),
  ];
  let completed = 0;
  loadingProgress.style.width = '2%';
  await Promise.all(tasks.map(async (task) => {
    try { await task; } catch { /* individual assets already have runtime fallbacks */ }
    completed += 1;
    loadingProgress.style.width = `${Math.max(2, Math.round((completed / tasks.length) * 100))}%`;
  }));
  upgradeCleanableVisuals();
  renderer.compile(scene, camera);
  renderer.render(scene, camera);
  loadingProgress.style.width = '100%';
  loadingStatus.textContent = t('loading.ready');
  await new Promise((resolve) => window.setTimeout(resolve, 180));
  assetsReady = true;
  start.disabled = false;
  loadingScreen.classList.add('ready');
}

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
  const track = bgmTracks[bgmIndexFor(currentRegionId)];
  // preload='none'으로 두었으므로 이 지역 곡을 처음 틀 때 여기서 받기 시작한다.
  if (track.preload !== 'auto') { track.preload = 'auto'; track.load(); }
  if (gameStarted) void track.play().catch(() => undefined);
}

function usesMobileControls() {
  // CSS의 터치 컨트롤 미디어쿼리와 조건을 반드시 일치시킬 것.
  // 너비를 섞으면 태블릿에서 "터치 UI는 뜨는데 포인터 락을 거는" 불일치가 생긴다.
  return matchMedia('(pointer: coarse)').matches;
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

// 전체화면 진입 버튼은 없앴다. Verse8 셸 iframe에는 allow="fullscreen"이 없어
// requestFullscreen()이 항상 거부되고(거부는 Promise로 와서 try/catch에도 안 잡힌다),
// 전제 조건이 풀스크린인 screen.orientation.lock()도 함께 불가능하다. 눌러도 아무 일도
// 일어나지 않는 버튼이라 제거하고, 가로 전환은 사용자가 기기를 직접 돌리는 것으로 통일한다.
// (#fullscreen-prompt 배너는 F11을 쓸 수 있는 데스크톱 전용이라 그대로 둔다.)

// 다만 우리가 직접 풀스크린에 들어가지 못할 뿐, 플랫폼(Verse8 셸)이 자체 풀스크린
// 버튼으로 넣어주는 경우는 있다. 그 순간을 잡아 가로 고정을 시도한다 — 성공하면
// 사용자가 기기를 돌릴 필요가 없어지고, #rotate-screen 안내도 미디어쿼리가 더 이상
// 매치되지 않아 저절로 사라진다. 미지원(iOS Safari)·거부면 조용히 무시하고 기존
// 회전 안내가 그대로 대비책 역할을 한다.
function tryLockLandscape() {
  const orientation = screen.orientation as ScreenOrientation & {
    lock?: (o: string) => Promise<void>;
  };
  if (typeof orientation?.lock !== 'function') return;
  orientation.lock('landscape').catch(() => {});
}
document.addEventListener('fullscreenchange', () => {
  if (document.fullscreenElement) tryLockLandscape();
});
if (document.fullscreenElement) tryLockLandscape(); // 이미 풀스크린으로 로드된 경우

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
    lastGemAdTime,
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

// 랭킹 갱신: 레벨이 바뀌면 즉시, 경험치만 바뀌었으면 30초에 한 번 보낸다.
// updateHud()는 오브젝트를 하나 치울 때마다 돌아서 매번 보내면 서버 호출이 과하다.
// 예전엔 레벨업 때만 보내서 랭킹의 XP가 늘 0 근처였고, 같은 레벨끼리는 진행도와 상관없이 동점이 됐다.
const EXP_SYNC_INTERVAL = 30000;
let lastSyncedLevel = -1;
let lastSyncedExp = -1;
let lastExpSyncAt = 0;
function reportScoreToPlatform(level: number, expProgress: number) {
  const now = performance.now();
  const levelChanged = level !== lastSyncedLevel;
  if (!levelChanged && (expProgress === lastSyncedExp || now - lastExpSyncAt < EXP_SYNC_INTERVAL)) return;
  lastSyncedLevel = level;
  lastSyncedExp = expProgress;
  lastExpSyncAt = now;
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
  // #ranking-my-rank는 랭킹 탭의 "내 순위" 칸이라 renderRankings()가 소유한다.
  // 예전엔 여기서도 "Lv.N"으로 덮어써서, 랭킹을 띄운 뒤 오브젝트를 하나만 치워도
  // (updateHud()가 매번 돌기 때문에) 순위가 곧바로 사라진 것처럼 보였다.
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
    case 'allRegions': return unlockedRegion >= MAX_REGION ? 1 : 0;
    case 'leaf10000': return stats.leafCleaned;
    case 'regions10': return stats.regionsCleared;
    case 'cleaned5000': return stats.totalCleaned;
    case 'coins20000': return stats.coinsEarned;
    case 'combo50': return stats.bestCombo;
    case 'boulder100': return stats.boulderCleaned;
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
  wrongToolHint = null;
  const tool = tools[toolId];
  const radiusBonus = 1 + upgrades.radius * 0.08;
  const ui = toolUi[toolId];
  const uiSize = Math.round(ui.size * radiusBonus);
  radiusEl.className = `cleaning-radius tool-${toolId}`;
  radiusEl.style.width = `${uiSize}px`;
  radiusEl.style.height = `${uiSize}px`;
  const radiusLabel = radiusEl.querySelector('span')!;
  radiusLabel.replaceChildren();
  const toolIcon = document.createElement('img');
  toolIcon.className = 'tool-image-icon';
  toolIcon.src = toolImage[toolId];
  toolIcon.alt = '';
  radiusLabel.append(toolIcon, document.createTextNode(` ${t(tool.name)}`));
}
// 지금 도구로는 못 치우는 청소물(예: 빗자루로 잔디)을 겨누면 반응이 없어 "청소가 되는 건가?" 헷갈렸다.
// 범위 안에 청소물이 있는데 지금 도구로 치울 수 있는 게 하나도 없으면, 필요한 도구를 원 아래 라벨로 알린다.
let wrongToolHint: ToolId | null = null;
let targetHintTimer = 0;
function updateTargetHint(delta: number) {
  targetHintTimer += delta;
  if (targetHintTimer < 0.12) return; // 화면 투영 검사라 매 프레임 돌릴 필요는 없다
  targetHintTimer = 0;
  const tool = tools[currentToolId];
  const inRange = objectsInRadius();
  let need: ToolId | null = null;
  let needCategory: CategoryId | null = null;
  if (inRange.length > 0 && !inRange.some((object) => tool.validTargets.includes(object.userData.kind))) {
    const kind = inRange[0].userData.kind;
    needCategory = categoryOrder.find((id) => categories[id].tools.some((toolId) => tools[toolId].validTargets.includes(kind))) ?? null;
    if (needCategory) need = equippedByCategory[needCategory] ?? categories[needCategory].tools[0];
  }
  if (need === wrongToolHint) return;
  if (!need || !needCategory) { updateToolHintUi(currentToolId); return; }
  wrongToolHint = need;
  radiusEl.classList.add('wrong-tool');
  const label = radiusEl.querySelector('span')!;
  const icon = document.createElement('img');
  icon.className = 'tool-image-icon';
  icon.src = toolImage[need];
  icon.alt = '';
  label.replaceChildren(icon, document.createTextNode(` ${t('hint.needTool', { tool: t(tools[need].name), n: needCategory })}`));
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
  camera.position.set(0, standingHeight, regionLayouts[regionId].spawnZ);
  robotVacuumPosition.set(0, 0, regionLayouts[regionId].spawnZ - 6);
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

  if (currentRegionId < MAX_REGION) {
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
  if (object.userData.kind === 'boulder') stats.boulderCleaned += 1;
  for (const mission of missionPool) {
    if (mission.trackKinds?.includes(object.userData.kind)) incrementMissionProgress(mission.id);
  }
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
  if (gameStarted || !assetsReady) return;
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
  if (!assetsReady) return;
  startGame();
});

document.addEventListener('fullscreenchange', () => {
  // 데스크톱에서 F11 등으로 전체화면을 오갈 때 배너만 갱신한다. 모바일에서는 전체화면
  // 자체가 불가능하므로 여기서 게임을 시작하거나 멈추지 않는다 — 예전에는 전체화면을
  // 벗어나면 터치 기기에서 게임을 정지시켰는데, 전체화면에 못 들어가는 환경에서는
  // 그 분기가 게임을 시작조차 못 하게 만드는 원인이 됐다.
  refreshFullscreenBanner();
  // The fullscreen transition interrupts any in-progress touch with pointercancel/touchcancel
  // (not pointerup/touchend), so reset movement/look input directly here as a safety net.
  resetJoystick();
  canvasTouchId = null;
});
regionCompleteCard.addEventListener('click', () => {
  const nextRegion = currentRegionId < MAX_REGION ? (currentRegionId + 1) as RegionId : 1;
  enterRegion(nextRegion);
  if (!usesMobileControls()) canvas.requestPointerLock?.();
});

// 2배 보상 실제 지급. instant=true면 대기 없이 즉시(광고 제거 구매자용),
// 그렇지 않으면 광고 SDK 없이 "재생 중" 표시 후 잠시 뒤 지급하는 시뮬레이션.
function grantAdDoubleReward(instant = false) {
  if (pendingAdDoubled || isAdBusy()) return;
  const apply = () => {
    coins += pendingAdRewardCoins;
    gems += pendingAdRewardGems;
    stats.coinsEarned += Math.floor(pendingAdRewardCoins);
    updateHud(pendingAdRewardCoins, pendingAdRewardGems);
    persist();
    regionAdDoubleBtn.classList.add('hidden');
    regionAdStatus.classList.remove('hidden');
    regionAdStatus.textContent = t('ad.doubleApplied', { coins: Math.floor(pendingAdRewardCoins), gems: pendingAdRewardGems });
    pendingAdDoubled = true;
  };
  if (instant) { apply(); return; }
  regionAdDoubleBtn.disabled = true;
  regionAdStatus.classList.remove('hidden');
  regionAdStatus.textContent = t('ad.playing');
  showRewardAd('region-double-reward', (outcome) => {
    if (outcome.status === 'rewarded') {
      // SDK가 시청 완료를 알려주면 바로 지급한다(서버 검증 없음).
      apply();
      return;
    }
    regionAdDoubleBtn.disabled = false;
    if (outcome.status === 'dismissed') regionAdStatus.textContent = t('ad.watchFull');
    else if (outcome.code === 'busy') regionAdStatus.classList.add('hidden');
    else regionAdStatus.textContent = t('ad.unavailable');
  });
}
regionAdDoubleBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  grantAdDoubleReward();
});

const gemAdBtn = document.querySelector<HTMLButtonElement>('#buy-gem-ad')!;
const gemAdGlyph = document.querySelector<HTMLElement>('#gem-ad-glyph')!;
const gemAdTitle = document.querySelector<HTMLElement>('#gem-ad-title')!;
const gemAdDesc = document.querySelector<HTMLElement>('#gem-ad-desc')!;
let gemAdTimer: ReturnType<typeof setInterval> | null = null;

async function grantGemAdReward() {
  if (Date.now() - lastGemAdTime < GEM_AD_COOLDOWN || isAdBusy()) return;
  gemAdBtn.disabled = true;
  if (adsRemoved) {
    gemAdBtn.textContent = t('ad.claiming');
    const claim = await claimAdFreeGemReward();
    if (claim.granted) {
      gems += claim.gems;
      lastGemAdTime = Date.now();
      updateHud(0, claim.gems);
      persist();
      refreshShop();
      showNotice(t('notice.gemAdClaimed', { gems: claim.gems }));
    } else {
      if (claim.reason === 'cooldown' && claim.retryAfterMs) {
        lastGemAdTime = Date.now() - (GEM_AD_COOLDOWN - claim.retryAfterMs);
      } else {
        showNotice(t('ad.verifyFailed'));
      }
      updateGemAdBtn();
    }
    return;
  }
  gemAdBtn.textContent = t('ad.playing');
  showRewardAd('gem-reward-30', (outcome) => {
    if (outcome.status === 'rewarded') {
      // SDK가 시청 완료를 알려주면 바로 지급한다(서버 검증 없음).
      gems += GEM_AD_REWARD;
      lastGemAdTime = Date.now();
      updateHud(0, GEM_AD_REWARD);
      persist();
      refreshShop();
      showNotice(t('notice.gemAdClaimed', { gems: GEM_AD_REWARD }));
      return;
    }
    if (outcome.status === 'dismissed') showNotice(t('ad.watchFull'));
    else if (outcome.code !== 'busy') showNotice(t('ad.unavailable'));
    updateGemAdBtn();
  });
}

function updateGemAdBtn() {
  // 광고 제거 구매자는 광고 없이 받으므로 TV 대신 보석 더미 아이콘
  gemAdGlyph.innerHTML = `<img src="/assets/card-icons/Yardsweep-Icon-${adsRemoved ? 'gems' : 'ad-gems'}.png" alt="" />`;
  gemAdTitle.textContent = t(adsRemoved ? 'ad.gemAd.adFreeTitle' : 'ad.gemAd.title');
  gemAdDesc.textContent = t(adsRemoved ? 'ad.gemAd.adFreeDesc' : 'ad.gemAd.desc');
  const remaining = GEM_AD_COOLDOWN - (Date.now() - lastGemAdTime);
  if (remaining <= 0) {
    gemAdBtn.disabled = false;
    gemAdBtn.innerHTML = adsRemoved
      ? `${uiIcon('gem')} ${t('ad.claimWithoutAd', { gems: GEM_AD_REWARD })}`
      : `${uiIcon('video')} ${t('ad.watchForGems', { gems: GEM_AD_REWARD })}`;
  } else {
    gemAdBtn.disabled = true;
    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    gemAdBtn.textContent = `${mins}:${String(secs).padStart(2, '0')}`;
  }
}

gemAdBtn.addEventListener('click', () => {
  void grantGemAdReward();
});

if (gemAdTimer) clearInterval(gemAdTimer);
gemAdTimer = setInterval(() => {
  updateGemAdBtn();
  updateCoinBoostBadge();
}, 1000);

// VX(실결제) 상품: @verse8/platform VXShop API를 통해 결제 다이얼로그를 열고,
// 서버의 $onItemPurchased 핸들러가 지급을 처리한 뒤 클라이언트에서 검증한다.
let vxBuying = false;
let pendingVxProductId: string | null = null;

onClose((payload: { action?: string; productId?: string }) => {
  if (payload.action !== 'purchased' || !payload.productId) {
    vxBuying = false;
    pendingVxProductId = null;
    refresh();
    return;
  }
  pendingVxProductId = payload.productId;
  verifyVxPurchase();
});

async function verifyVxPurchase() {
  if (!pendingVxProductId) return;
  const productId = pendingVxProductId;

  for (let attempt = 0; attempt < 8; attempt++) {
    await new Promise((r) => setTimeout(r, 500 + attempt * 250));
    const serverState = await fetchVxServerState();
    if (!serverState) continue;

    const prevGems = gems;
    const prevAdRemoved = adsRemoved;

    if (productId === 'ad-removal') {
      if (serverState.adRemoved) {
        adsRemoved = true;
        persist();
        refreshShop();
        showNotice(t('notice.adsRemoved'));
        vxBuying = false;
        pendingVxProductId = null;
        refresh();
        return;
      }
    } else {
      const expectedGain: Record<string, number> = {
        'gems-100': 100,
        'gems-550': 550,
        'gems-1200': 1200,
      };
      const gain = expectedGain[productId];
      if (gain && serverState.crystals >= prevGems + gain) {
        gems = serverState.crystals;
        updateHud();
        refreshShop();
        showNotice(t('notice.vxPurchaseSuccess', { product: t(`vxshop.${productId}.title`) }));
        vxBuying = false;
        pendingVxProductId = null;
        refresh();
        return;
      }
    }
  }

  // 최종 시도: 서버 동기화에 실패했더라도 1회 더 확인
  refresh();
  vxBuying = false;
  pendingVxProductId = null;
}

function handleVxBuy(productId: string) {
  if (vxBuying) return;
  vxBuying = true;
  buyItem(productId);
}

document.querySelectorAll<HTMLButtonElement>('.buy-vx-gem').forEach((btn) => {
  btn.addEventListener('click', () => {
    const productId = btn.dataset.vx;
    if (!productId) return;
    handleVxBuy(productId);
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
      button.innerHTML = cost.gems
        ? `${uiIcon('gem')} ${cost.gems}`
        : `${uiIcon('coin')} ${cost.coins ?? 0}`;
    } else {
      button.textContent = equipped ? t('shop.equipped') : t('shop.equip');
    }
  });
  document.querySelectorAll<HTMLButtonElement>('.buy-upgrade').forEach((button) => {
    const id = button.dataset.upgrade as UpgradeId;
    button.innerHTML = upgrades[id] >= UPGRADE_MAX ? 'MAX' : `${uiIcon('coin')} ${upgradePrice(id)}`;
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
  coinBoostButton.innerHTML = boostRemaining > 0
    ? `${uiIcon('timer')} ${formatCountdown(boostRemaining)}`
    : `${uiIcon('gem')} 30`;
  robotVacuumButton.innerHTML = robotVacuumOwned ? t('shop.owned') : `${uiIcon('gem')} 200`;
  robotVacuumButton.disabled = robotVacuumOwned;
  robotVacuumButton.classList.toggle('owned', robotVacuumOwned);
  removeAdsButton.textContent = adsRemoved ? t('shop.owned') : 'VX';
  removeAdsButton.disabled = adsRemoved;
  removeAdsButton.classList.toggle('owned', adsRemoved);
  document.querySelectorAll<HTMLButtonElement>('.buy-vx-gem').forEach((button) => {
    const productId = button.dataset.vx;
    if (!productId) return;
    const item = getItem(productId);
    if (item) {
      button.classList.toggle('owned', item.purchaseLimitReached);
      button.disabled = item.purchaseLimitReached || vxBuying;
      if (item.purchaseLimitReached) {
        button.textContent = t('shop.owned');
      } else if (item.purchasable) {
        button.textContent = `${item.price} VX`;
      } else {
        button.textContent = item.purchaseBlockReason || 'VX';
        button.disabled = true;
      }
    }
  });
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
  settings.language = button.dataset.lang as Locale;
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

// ── 첫 실행 온보딩 ──────────────────────────────────────────────────────────
// 계정에 닉네임이 아직 없을 때만 로딩 직후 한 번 뜬다. 저장하거나 건너뛰면 게임이 시작된다.
// 값은 설정 패널과 공유한다 — 닉네임은 setNickname(), 언어는 settings.language가 단일 출처다.
const onboardingEl = document.querySelector<HTMLElement>('#onboarding')!;
const onboardingNickname = document.querySelector<HTMLInputElement>('#onboarding-nickname')!;
const onboardingStatus = document.querySelector<HTMLElement>('#onboarding-status')!;
const onboardingStartBtn = document.querySelector<HTMLButtonElement>('#onboarding-start')!;
const onboardingSkipBtn = document.querySelector<HTMLButtonElement>('#onboarding-skip')!;
const onboardingLangs = document.querySelectorAll<HTMLButtonElement>('[data-onboarding-lang]');

// applyLocale()은 문구만 바꾸고 선택 표시는 건드리지 않으므로, 온보딩과 설정 패널의
// 언어 버튼 상태를 한 곳에서 함께 맞춘다.
function syncLanguageButtons() {
  onboardingLangs.forEach((button) => button.classList.toggle('selected', button.dataset.onboardingLang === settings.language));
  langOptions.forEach((button) => button.classList.toggle('selected', button.dataset.lang === settings.language));
}

onboardingLangs.forEach((button) => button.addEventListener('click', () => {
  settings.language = button.dataset.onboardingLang as Locale;
  setLocale(settings.language);
  applyLocale(); // 온보딩 창 문구까지 즉시 전환된다
  syncLanguageButtons();
  onboardingStatus.textContent = '';
  persist();
}));

function closeOnboarding() {
  onboardingEl.classList.add('hidden');
  // 데스크톱은 시작 카드가 이미 활성화되어 있어 사용자가 직접 누른다.
  if (isTouchDevice()) startGame();
}

onboardingSkipBtn.addEventListener('click', closeOnboarding);

onboardingStartBtn.addEventListener('click', async () => {
  const value = onboardingNickname.value.trim();
  if (!value) { onboardingStatus.textContent = t('onboarding.empty'); return; }
  onboardingStartBtn.disabled = true;
  onboardingStartBtn.textContent = t('onboarding.saving');
  const error = await setNickname(value);
  onboardingStartBtn.disabled = false;
  onboardingStartBtn.textContent = t('onboarding.start');
  // 저장에 실패하면 창을 유지한다. 갇히지 않도록 건너뛰기는 계속 쓸 수 있다.
  if (error) { onboardingStatus.textContent = error; return; }
  closeOnboarding();
});

// 서버에 닉네임이 없을 때만 띄운다. 미연결이면 저장 자체가 불가능하므로 그냥 건너뛴다.
function shouldShowOnboarding() {
  return isConnected() && !getNickname();
}

function showOnboarding() {
  onboardingStatus.textContent = '';
  onboardingNickname.value = '';
  syncLanguageButtons();
  onboardingEl.classList.remove('hidden');
  // 터치 기기에서 자동 포커스를 주면 키보드가 즉시 올라와 창을 가린다.
  if (!isTouchDevice()) onboardingNickname.focus();
}

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
  if (upgrades[id] >= UPGRADE_MAX) return;
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
  // 모바일 주소창·전체화면·회전 중에는 innerWidth/innerHeight와 실제 CSS 캔버스 크기가
  // 서로 다른 프레임에 갱신될 수 있다. 렌더 버퍼와 카메라가 같은 실측값을 사용해야
  // 화면이 가로 또는 세로로 눌리는 현상이 생기지 않는다.
  const bounds = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(bounds.width));
  const height = Math.max(1, Math.round(bounds.height));
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
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
window.visualViewport?.addEventListener('resize', resizeSoon);
new ResizeObserver(resize).observe(canvas);
resize();
enterRegion(currentRegionId);
selectCategory(1);
// 서버 연결 후 계정 클라우드 세이브와 로컬 세이브를 비교해 최신 쪽을 사용한다.
// 클라우드가 더 최신이면 로컬에 덮어쓰고 새로고침(1회)으로 적용 — 다른 기기에서 이어하기.
// VX Shop에서 구매한 크리스탈/광고제거도 서버 상태를 우선으로 동기화한다.
// 온보딩은 "계정에 닉네임이 있는가"로 표시 여부를 정하므로 이 체인이 끝나야 판단할 수 있다.
// 에셋 로딩과 병렬로 돌기 때문에 로딩이 끝날 무렵이면 대개 이미 완료되어 있다.
const rankingReady = initRanking().then(async () => {
  // 접속되자마자 지금 레벨/경험치를 서버에 올려 내 랭킹 행을 만든다.
  // 이게 없으면 다음 레벨업(오브젝트 100개) 전까지 rankings 컬렉션에 행이 없어
  // 내 순위가 계속 "-"로 뜨고, 아무도 레벨업하지 않은 동안엔 상위 목록도 비어 보였다.
  const { level, progressPercent } = getLevelInfo();
  lastSyncedLevel = level;
  lastSyncedExp = progressPercent;
  lastExpSyncAt = performance.now();
  await syncStats(level, progressPercent);
  // 랭킹을 미리 받아 캐시해둔다. 탭을 열면 로딩 없이 바로 뜨고 뒤에서 조용히 갱신된다.
  // 아래 클라우드 세이브 동기화를 기다릴 필요가 없어 병렬로 먼저 띄운다.
  prefetchRankings();
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

  // 서버 VX 상태 동기화: 서버에 기록된 crystals/adRemoved가 로컬보다 높으면 덮어쓴다.
  const serverVx = await fetchVxServerState();
  if (serverVx) {
    if (serverVx.crystals > gems) {
      gems = serverVx.crystals;
      updateHud();
    }
    if (serverVx.adRemoved && !adsRemoved) {
      adsRemoved = true;
      refreshShop();
    }
  }
});

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  camera.rotation.order = 'YXZ';
  camera.rotation.y = yaw;
  camera.rotation.x = pitch;
  // 현관문 자동 개폐: 문 근처(3.2m)에 오면 안쪽으로 스르륵 열림
  const doorDistance = Math.hypot(camera.position.x + 7.3, camera.position.z + 7.6);
  const doorShouldOpen = isYardRegion() && doorDistance < 3.2;
  // 하늘 돔·그림자 범위는 플레이어를 따라간다(넓은 지역에서도 발밑 그림자가 유지되도록).
  skyDome.mesh.position.set(camera.position.x, 0, camera.position.z);
  sun.target.position.set(camera.position.x, 0, camera.position.z);
  sun.position.copy(sun.target.position).add(SUN_OFFSET);
  currentWorld()?.update(clock.elapsedTime);
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
  updateTargetHint(delta);
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
    const layout = regionLayouts[currentRegionId];
    let nextX = THREE.MathUtils.clamp(previousX + movement.x * step, layout.minX, layout.maxX);
    let nextZ = THREE.MathUtils.clamp(previousZ + movement.z * step, layout.minZ, layout.maxZ);
    // 마당은 집 벽, 공원·해변은 연못·나무 줄기·놀이기구 같은 원형 충돌체가 막는다.
    const colliders = currentWorld()?.colliders;
    const blocked = (x: number, z: number) => (layout.yard && hitsWall(x, z, 0.3)) || hitsCollider(colliders, x, z, 0.3);
    // 벽 슬라이딩: 대각선으로 벽에 닿으면 막히는 축만 멈추고 나머지 축은 계속 이동 (문 개구부는 통과)
    // 이미 충돌체 안에 있으면(스폰 직후 등) 막지 않아 갇히지 않게 한다.
    if (blocked(nextX, nextZ) && !blocked(previousX, previousZ)) {
      if (!blocked(nextX, previousZ)) nextZ = previousZ;      // z쪽 벽 → x축으로 미끄러짐
      else if (!blocked(previousX, nextZ)) nextX = previousX; // x쪽 벽 → z축으로 미끄러짐
      else { nextX = previousX; nextZ = previousZ; }          // 모서리 등 둘 다 막힘 → 정지
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

// 개발 서버 전용 점검 도구: 콘솔에서 지역 이동·시점 이동으로 맵을 확인한다(배포 빌드에는 없다).
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__ys = {
    camera,
    renderer, // 누수 측정: __ys.renderer.info.memory

    enterRegion: (id: RegionId) => { unlockedRegion = Math.max(unlockedRegion, id) as RegionId; enterRegion(id); },
    look: (x: number, z: number, lookYaw: number, lookPitch = -0.05) => { camera.position.set(x, standingHeight, z); yaw = lookYaw; pitch = lookPitch; },
    start: () => { assetsReady = true; startGame(); },
    // 녹화·자동 점검용: 포인터락 없이 청소 버튼을 누른 상태로 만들고, 도구를 바로 쥔다.
    clean: (on: boolean) => (on ? startCleaning() : stopCleaning()),
    equip: (id: ToolId) => equipTool(id),
    setView: (lookYaw: number, lookPitch: number) => { yaw = lookYaw; pitch = lookPitch; },
    targets: () => cleanables.filter((o) => !o.userData.cleaned).map((o) => [o.position.x, o.position.z, o.userData.kind] as const),
    remaining: () => cleanables.filter((o) => !o.userData.cleaned).length,
    clearAll: () => cleanables.filter((o) => !o.userData.cleaned).forEach(removeObject),
    state: () => ({ region: currentRegionId, unlockedRegion, coins: Math.floor(coins), gems, missionProgress, bestCombo: stats.bestCombo }),
  };
}

animate();
applyLocale();
// 세로 모드에선 회전 안내만 띄우고 에셋 다운로드를 미룬다.
// 가로로 돌린 뒤에 받아야 로딩 진행률이 실제로 보이고, 세로로 둔 채 방치해서
// 데이터만 쓰는 상황도 막을 수 있다. (CSS도 세로에선 #loading-screen을 숨긴다)
let assetLoadStarted = false;
function startAssetLoadWhenReady() {
  if (assetLoadStarted) return;
  if (matchMedia('(pointer: coarse) and (orientation: portrait)').matches) return;
  assetLoadStarted = true;
  void prepareGameAssets().then(async () => {
    // 카메라·렌더 버퍼는 실제로 가로가 된 지금의 뷰포트 기준으로 다시 계산한다.
    // 초기 resize()는 아직 세로일 때 돌아 세로 비율로 잡혀 있다. 회전 직후에는
    // 뷰포트 크기가 몇 프레임에 걸쳐 정착하므로 resizeSoon()으로 지연 재확인까지 한다.
    resizeSoon();
    // 닉네임 조회가 끝나야 온보딩 표시 여부를 판단할 수 있다. 실패해도 그대로 진행한다.
    await rankingReady.catch(() => undefined);
    if (shouldShowOnboarding()) {
      showOnboarding(); // 저장 또는 건너뛰기 후 closeOnboarding()이 게임을 시작한다
      return;
    }
    if (isTouchDevice()) startGame();
  });
}
startAssetLoadWhenReady();
// 기기·브라우저마다 발화하는 이벤트가 달라 셋 다 걸어둔다(중복 호출은 플래그로 무시).
matchMedia('(orientation: portrait)').addEventListener('change', startAssetLoadWhenReady);
window.addEventListener('orientationchange', startAssetLoadWhenReady);
window.addEventListener('resize', startAssetLoadWhenReady);
