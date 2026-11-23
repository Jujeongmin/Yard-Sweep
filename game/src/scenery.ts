import * as THREE from 'three';
import { kitAdd, kitCommit } from './sceneryKit';

// 플레이 공간 밖(울타리 너머)과 공원·해변 지역을 코드 도형으로 만든다.
// 바깥 장식은 이동·스폰에 관여하지 않는 순수 배경이고, 지역 월드 안쪽 구조물만
// colliders(이동 차단)와 spawnAvoid(청소물 스폰 회피)로 알린다. 둘 다 [x, z, 반경] 원.

export type Circle = [number, number, number];

export interface RegionWorld {
  group: THREE.Group;
  colliders: Circle[];
  spawnAvoid: Circle[];
  // 청소물 배치에 쓰는 기준점(벤치·파라솔 등). 지역별 스폰 규칙이 이름으로 꺼내 쓴다.
  anchors: Record<string, Array<[number, number]>>;
  update(time: number): void;
}

// ── 공용 재료·도형 ──────────────────────────────────────────────────────────────
const materialCache = new Map<string, THREE.MeshStandardMaterial>();
function mat(color: number, rough = 0.85, flat = false, metal = 0) {
  const key = `${color}|${rough}|${flat}|${metal}`;
  let material = materialCache.get(key);
  if (!material) {
    material = new THREE.MeshStandardMaterial({ color, roughness: rough, flatShading: flat, metalness: metal });
    materialCache.set(key, material);
  }
  return material;
}

const unitBox = new THREE.BoxGeometry(1, 1, 1);
const unitCylinder = new THREE.CylinderGeometry(1, 1, 1, 10);
const unitCone = new THREE.ConeGeometry(1, 1, 9);
const unitSphere = new THREE.SphereGeometry(1, 14, 10);
const unitIco = new THREE.IcosahedronGeometry(1, 1);
const lowSphere = new THREE.SphereGeometry(1, 18, 8);

interface PlaceOptions { rx?: number; ry?: number; rz?: number; shadow?: boolean; receive?: boolean }
function place(
  parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material,
  pos: [number, number, number], scale: [number, number, number] = [1, 1, 1], opts: PlaceOptions = {},
) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...pos);
  mesh.scale.set(...scale);
  mesh.rotation.set(opts.rx ?? 0, opts.ry ?? 0, opts.rz ?? 0);
  mesh.castShadow = opts.shadow ?? false;
  mesh.receiveShadow = opts.receive ?? false;
  parent.add(mesh);
  return mesh;
}

function flatPlane(parent: THREE.Object3D, w: number, d: number, color: number, x: number, z: number, y = 0, receive = true) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat(color, 1));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, y, z);
  mesh.receiveShadow = receive;
  parent.add(mesh);
  return mesh;
}

// 삼각 지붕: 삼각형 단면을 길이 방향으로 밀어낸다(밑변 중앙이 원점).
const roofCache = new Map<string, THREE.BufferGeometry>();
function roofGeometry(width: number, height: number, length: number) {
  const key = `${width}|${height}|${length}`;
  let geometry = roofCache.get(key);
  if (!geometry) {
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2, 0);
    shape.lineTo(width / 2, 0);
    shape.lineTo(0, height);
    shape.closePath();
    geometry = new THREE.ExtrudeGeometry(shape, { depth: length, bevelEnabled: false });
    geometry.translate(0, 0, -length / 2);
    roofCache.set(key, geometry);
  }
  return geometry;
}

let seed = 1;
function seeded(start: number) { seed = start; }
function rand() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
function pick<T>(list: T[]) { return list[Math.floor(rand() * list.length)]; }

const wallColors = [0xffd6a5, 0xa8d8ff, 0xfff1a8, 0xffc4d6, 0xc8f0b8, 0xe2d4ff, 0xffe0c2];
const roofColors = [0xe76f51, 0x5b8bd9, 0xf4a259, 0xe85f8a, 0x2a9d8f, 0x9b6fd6];

// 이웃집: Blender 키트 house_<형태 0~2><색 0~3>. 앞면(문)이 앵커의 +z를 본다.
// 돌려준 앵커를 옮기면(해변의 고상 가옥처럼) 그 위치로 그려진다. 앵커에 자식을 붙여도 된다.
function toyHouse(parent: THREE.Object3D, x: number, z: number, rotY: number, scale = 1) {
  const name = `house_${Math.floor(rand() * 3)}${Math.floor(rand() * 4)}`;
  return kitAdd(parent, name, [x, 0, z], rotY, scale * (0.92 + rand() * 0.16), { shadow: true });
}

// 나무: Blender 키트. crownColor는 키트 원래 색에 아주 약하게만 섞어(밝기 변화) 단조로움을 줄인다.
// s=1일 때 높이 약 5m(예전 코드 나무와 같은 비율).
function roundTree(parent: THREE.Object3D, x: number, z: number, s: number, crownColor: number, shadow = false) {
  const variant = rand() < 0.12 ? 'treeBlossom_0' : `treeRound_${Math.floor(rand() * 3)}`;
  const tint = new THREE.Color(crownColor).lerp(new THREE.Color(0xffffff), 0.82);
  kitAdd(parent, variant, [x, 0, z], rand() * Math.PI * 2, s, { shadow, tint });
}
function pineTree(parent: THREE.Object3D, x: number, z: number, s: number, _color: number) {
  kitAdd(parent, `treePine_${Math.floor(rand() * 2)}`, [x, 0, z], rand() * Math.PI * 2, s);
}

// 지평선 쪽 완만한 언덕 띠. 안개에 거의 묻혀 실루엣만 남는다.
function hillRing(parent: THREE.Object3D, material: THREE.Material, radius: number, count: number, skipArc?: [number, number]) {
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + rand() * 0.2;
    if (skipArc && angle > skipArc[0] && angle < skipArc[1]) continue;
    const r = radius + rand() * 30;
    place(parent, lowSphere, material, [Math.cos(angle) * r, -3, Math.sin(angle) * r], [30 + rand() * 25, 10 + rand() * 12, 22 + rand() * 12]);
  }
}

// ── 하늘 돔: 위는 짙고 지평선은 안개색과 같게. 안개 영향을 받지 않는다. ─────────────
export function createSkyDome() {
  const geometry = new THREE.SphereGeometry(420, 32, 16);
  const colors = new Float32Array(geometry.attributes.position.count * 3);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  mesh.renderOrder = -1;
  const top = new THREE.Color();
  const horizon = new THREE.Color();
  const mixed = new THREE.Color();
  function setColors(topHex: number, horizonHex: number) {
    top.setHex(topHex);
    horizon.setHex(horizonHex);
    const pos = geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const t = THREE.MathUtils.clamp(pos.getY(i) / 420, 0, 1);
      mixed.copy(horizon).lerp(top, Math.pow(t, 0.55));
      colors.set([mixed.r, mixed.g, mixed.b], i * 3);
    }
    geometry.attributes.color.needsUpdate = true;
  }
  return { mesh, setColors };
}

// ── 마당(지역 1~3) 바깥: 동네 ────────────────────────────────────────────────────
// 마당 바닥판은 x ±23, z ±20, 울타리는 x ±21.25 / 뒤 z -18 / 앞 z 18.1.
export function buildYardSurroundings(low: boolean) {
  seeded(4417);
  const group = new THREE.Group();
  const outerGround = flatPlane(group, 520, 520, 0x6aa944, 0, 0, -0.03, false);
  // 앞쪽 인도·도로·건너편 인도
  flatPlane(group, 120, 2.2, 0xe4ddd0, 0, 19.6, -0.01);
  flatPlane(group, 120, 6, 0x8a93a3, 0, 23.7, -0.01);
  for (let x = -58; x <= 58; x += 5) flatPlane(group, 2.4, 0.22, 0xffe27a, x, 23.7, 0.0, false);
  flatPlane(group, 120, 2.2, 0xe4ddd0, 0, 27.8, -0.01);
  flatPlane(group, 3.2, 1.6, 0xd9bb83, 0, 18.8, -0.005); // 마당 산책로 → 인도
  // 우체통
  place(group, unitCylinder, mat(0x6b4426), [3.2, 0.55, 18.9], [0.06, 1.1, 0.06]);
  place(group, unitBox, mat(0x5b8bd9, 0.6), [3.2, 1.2, 18.9], [0.5, 0.36, 0.7], { shadow: true });

  // 건너편 집들(마당 쪽을 본다)
  for (let x = -44; x <= 44; x += 11) toyHouse(group, x + (rand() - 0.5) * 2, 34 + rand() * 2, Math.PI, 0.95);
  // 뒤쪽 이웃집(울타리 너머, 앞면이 마당 쪽 +z)
  for (let x = -40; x <= 40; x += 12) toyHouse(group, x + (rand() - 0.5) * 3, -27 - rand() * 3, 0, 1);
  // 양옆 집
  for (const side of [-1, 1]) {
    for (let z = -12; z <= 12; z += 12) toyHouse(group, side * (33 + rand() * 2), z, -side * Math.PI / 2, 0.95);
  }
  // 집 사이·뒤의 나무 띠
  const greens = [0x5fa83a, 0x4f913f, 0x6eae35, 0x3f8a3a];
  const treeCount = low ? 26 : 52;
  for (let i = 0; i < treeCount; i++) {
    const angle = rand() * Math.PI * 2;
    const r = 30 + rand() * 30;
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    if (z > 18.5 && z < 30) continue; // 도로 위는 비운다
    if (Math.abs(x) < 24 && z > -20 && z < 20) continue;
    if (rand() < 0.35) pineTree(group, x, z, 1.1 + rand() * 0.8, 0x3d7d3a);
    else roundTree(group, x, z, 0.9 + rand() * 0.6, pick(greens));
  }
  // 뒤 울타리와 이웃집 사이 생울타리
  for (let x = -22; x <= 22; x += 2.2) kitAdd(group, 'hedge_0', [x, 0, -19.4], (rand() - 0.5) * 0.3, [1.4, 1.15, 1.2]);
  const hillMaterial = new THREE.MeshStandardMaterial({ color: 0x7fb85a, roughness: 1, flatShading: true });
  hillRing(group, hillMaterial, 95, low ? 10 : 16);

  function recolor(ground: number, hill: number) {
    (outerGround.material as THREE.MeshStandardMaterial).color.setHex(ground);
    hillMaterial.color.setHex(hill);
  }
  // 바깥 바닥은 지역 테마마다 색을 바꾸므로 캐시 재료가 아닌 전용 재료를 쓴다.
  outerGround.material = new THREE.MeshStandardMaterial({ color: 0x6aa944, roughness: 1 });
  kitCommit(group);
  return { group, recolor };
}

// ── 지역 4: 공원 ─────────────────────────────────────────────────────────────────
// 플레이 범위 x ±30, z ±24. 가운데 연못·분수, 오른쪽 위 놀이터, 벤치·가로등이 길을 따라 놓인다.
export function buildParkWorld(low: boolean): RegionWorld {
  seeded(9031);
  const group = new THREE.Group();
  const colliders: Circle[] = [];
  const spawnAvoid: Circle[] = [];
  const block = (x: number, z: number, r: number, avoid = r + 0.6) => { colliders.push([x, z, r]); spawnAvoid.push([x, z, avoid]); };

  flatPlane(group, 600, 600, 0x86c95a, 0, 0, -0.02);
  // 산책로: 가로·세로 대로 + 연못 둘레 원형 길
  const pathColor = 0xead6a8;
  flatPlane(group, 4.4, 50, pathColor, 0, 0, 0.01);
  flatPlane(group, 62, 4.4, pathColor, 0, 9, 0.01);
  const ringPath = new THREE.Mesh(new THREE.RingGeometry(7.6, 10, 48), mat(pathColor, 1));
  ringPath.rotation.x = -Math.PI / 2;
  ringPath.position.set(0, 0.012, -6);
  ringPath.receiveShadow = true;
  group.add(ringPath);

  // 연못 + 둘레 돌 + 분수 + 오리
  const pondX = 0;
  const pondZ = -6;
  const water = new THREE.Mesh(new THREE.CircleGeometry(6.8, 40), new THREE.MeshStandardMaterial({ color: 0x5cc0ec, roughness: 0.25, metalness: 0.1 }));
  water.rotation.x = -Math.PI / 2;
  water.position.set(pondX, 0.04, pondZ);
  group.add(water);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(7, 0.38, 8, 40), mat(0xd8cdb8, 0.9));
  rim.rotation.x = -Math.PI / 2;
  rim.position.set(pondX, 0.12, pondZ);
  rim.castShadow = rim.receiveShadow = true;
  group.add(rim);
  place(group, unitCylinder, mat(0xe9e2d2), [pondX, 0.5, pondZ], [1.6, 1, 1.6], { shadow: true });
  place(group, unitCylinder, mat(0xe9e2d2), [pondX, 1.4, pondZ], [0.35, 1.8, 0.35], { shadow: true });
  place(group, unitCylinder, mat(0xe9e2d2), [pondX, 2.3, pondZ], [1, 0.25, 1], { shadow: true });
  const spout = place(group, unitSphere, new THREE.MeshStandardMaterial({ color: 0xbfeaff, transparent: true, opacity: 0.75, roughness: 0.1 }), [pondX, 2.8, pondZ], [0.5, 0.7, 0.5]);
  block(pondX, pondZ, 7.3, 7.8);
  const ducks: THREE.Group[] = [];
  for (let i = 0; i < 3; i++) {
    const duck = new THREE.Group();
    place(duck, unitSphere, mat(0xffd84a, 0.6), [0, 0.22, 0], [0.42, 0.3, 0.32], { shadow: true });
    place(duck, unitSphere, mat(0xffd84a, 0.6), [0.3, 0.52, 0], [0.2, 0.2, 0.2]);
    place(duck, unitCone, mat(0xf28c28, 0.6), [0.52, 0.5, 0], [0.07, 0.16, 0.07], { rz: -Math.PI / 2 });
    group.add(duck);
    ducks.push(duck);
  }

  // 놀이터(오른쪽 위): 미끄럼틀·그네·모래놀이터
  const play = new THREE.Group();
  play.position.set(19, 0, -15);
  group.add(play);
  const pink = mat(0xff8fb1, 0.55);
  const blue = mat(0x5ab0ff, 0.55);
  const yellow = mat(0xffd84a, 0.55);
  for (const [lx, lz] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) place(play, unitCylinder, blue, [lx, 1.2, lz], [0.12, 2.4, 0.12], { shadow: true });
  place(play, unitBox, yellow, [0, 2.4, 0], [2.1, 0.2, 2.1], { shadow: true });
  place(play, roofGeometry(2.5, 1.2, 2.5), pink, [0, 3.6, 0], [1, 1, 1], { shadow: true });
  for (const lx of [-0.9, 0.9]) place(play, unitCylinder, blue, [lx, 3, 0], [0.1, 1.2, 0.1]);
  place(play, unitBox, pink, [2.6, 1.25, 0], [3.6, 0.15, 1.2], { rz: -0.62, shadow: true });
  for (let i = 0; i < 5; i++) place(play, unitBox, yellow, [-1.2, 0.4 + i * 0.45, 0], [0.12, 0.08, 1]);
  block(20.5, -15, 3);
  // 그네
  const swing = new THREE.Group();
  swing.position.set(11, 0, -19);
  group.add(swing);
  for (const sx of [-2.4, 2.4]) {
    place(swing, unitCylinder, blue, [sx, 1.6, -0.6], [0.11, 3.4, 0.11], { rx: 0.35, shadow: true });
    place(swing, unitCylinder, blue, [sx, 1.6, 0.6], [0.11, 3.4, 0.11], { rx: -0.35, shadow: true });
  }
  place(swing, unitCylinder, pink, [0, 3.15, 0], [0.12, 5, 0.12], { rz: Math.PI / 2, shadow: true });
  const seats: THREE.Group[] = [];
  for (const sx of [-1.1, 1.1]) {
    const seat = new THREE.Group();
    seat.position.set(sx, 3.15, 0);
    place(seat, unitBox, mat(0x8a93a3), [-0.3, -1.1, 0], [0.03, 2.2, 0.03]);
    place(seat, unitBox, mat(0x8a93a3), [0.3, -1.1, 0], [0.03, 2.2, 0.03]);
    place(seat, unitBox, yellow, [0, -2.2, 0], [0.8, 0.1, 0.4], { shadow: true });
    swing.add(seat);
    seats.push(seat);
  }
  block(11, -19, 2.8);
  // 모래놀이터
  const sandbox = new THREE.Group();
  sandbox.position.set(23, 0, -5);
  group.add(sandbox);
  flatPlane(sandbox, 4.4, 4.4, 0xf3dc9a, 0, 0, 0.03);
  for (const [bx, bz, w, d] of [[0, -2.3, 4.8, 0.3], [0, 2.3, 4.8, 0.3], [-2.3, 0, 0.3, 4.8], [2.3, 0, 0.3, 4.8]]) {
    place(sandbox, unitBox, mat(0xff9a5a, 0.6), [bx, 0.18, bz], [w, 0.36, d], { shadow: true, receive: true });
  }
  place(sandbox, unitCone, mat(0xffd84a, 0.6), [0.6, 0.35, 0.4], [0.3, 0.5, 0.3], { rz: 2.4 });
  place(sandbox, unitCylinder, mat(0x5ab0ff, 0.6), [-0.7, 0.2, -0.5], [0.3, 0.4, 0.3]);
  spawnAvoid.push([23, -5, 3.4]);

  // 벤치(길가) + 가로등
  const benches: Array<[number, number]> = [];
  const benchSpots: Array<[number, number, number]> = [
    [-3.4, 15, Math.PI / 2], [3.4, 19, -Math.PI / 2], [-3.4, -18, Math.PI / 2], [3.4, -21, -Math.PI / 2],
    [-14, 6.6, 0], [14, 6.6, 0], [-24, 11.4, Math.PI], [24, 11.4, Math.PI], [-11, -6, Math.PI / 2],
  ];
  for (const [bx, bz, rot] of benchSpots) {
    const bench = new THREE.Group();
    bench.position.set(bx, 0, bz);
    bench.rotation.y = rot;
    place(bench, unitBox, mat(0xc98a4b, 0.8), [0, 0.5, 0], [1.9, 0.12, 0.6], { shadow: true });
    place(bench, unitBox, mat(0xc98a4b, 0.8), [0, 0.95, -0.28], [1.9, 0.5, 0.1], { shadow: true });
    for (const lx of [-0.8, 0.8]) place(bench, unitBox, mat(0x4b5563, 0.5), [lx, 0.25, 0], [0.1, 0.5, 0.55]);
    group.add(bench);
    benches.push([bx, bz]);
    block(bx, bz, 1.1, 1.4);
  }
  const lampSpots: Array<[number, number]> = [[-2.8, 22], [2.8, 2], [-2.8, -22], [10, 11.6], [-20, 6.4], [20, 6.4], [-28, 11.6], [28, 6.4]];
  for (const [lx, lz] of lampSpots) {
    place(group, unitCylinder, mat(0x3f4b5b, 0.5), [lx, 1.7, lz], [0.08, 3.4, 0.08], { shadow: true });
    place(group, unitSphere, new THREE.MeshStandardMaterial({ color: 0xfff3c4, emissive: 0xffe08a, emissiveIntensity: 0.6 }), [lx, 3.5, lz], [0.28, 0.28, 0.28]);
    block(lx, lz, 0.35, 0.8);
  }

  // 꽃밭(원형 화단)
  const flowerColors = [0xe85f8a, 0xf2b6d4, 0x9b6fd6, 0xf7e14a, 0xff8f4a];
  for (const [fx, fz] of [[-17, -14], [-17, 17], [14, 17], [-24, -3]] as Array<[number, number]>) {
    const bed = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.4, 0.3, 24), mat(0x7a5236, 1));
    bed.position.set(fx, 0.15, fz);
    bed.receiveShadow = true;
    group.add(bed);
    for (let i = 0; i < (low ? 8 : 16); i++) {
      const a = rand() * Math.PI * 2;
      const r = rand() * 1.8;
      place(group, unitSphere, mat(pick(flowerColors), 0.6), [fx + Math.cos(a) * r, 0.45, fz + Math.sin(a) * r], [0.2, 0.2, 0.2]);
    }
    block(fx, fz, 2.3, 2.8);
  }

  // 공원 안 나무(이동은 줄기만 막고, 스폰은 수관 아래를 피한다)
  const parkTrees: Array<[number, number, number]> = [
    [-25, -18, 1.2], [-12, -20, 1], [-27, 2, 1.1], [-20, 19, 1.15], [-9, 20, 0.95], [9, 15, 1.05],
    [26, 18, 1.2], [27, -21, 1], [16, -2, 1.1], [-14, -2, 0.9], [7, -21, 0.95], [-6, 3, 0.85],
  ];
  for (const [tx, tz, s] of parkTrees) {
    roundTree(group, tx, tz, s, pick([0x6eae35, 0x5fa83a, 0x7cbf45]), true);
    colliders.push([tx, tz, 0.55 * s]);
    spawnAvoid.push([tx, tz, 1.4 * s]);
  }

  // 경계: 반듯하게 깎은 상자형 생울타리 + 철제 울타리(길 끝은 열어 둔다).
  // 예전엔 둥근 덩어리를 이어 붙여, 바로 안쪽에 생기는 덤불 청소물과 구분이 안 됐다. 벽처럼 보이게 각지게 깎는다.
  const hedge = mat(0x2f7a3a, 0.95);
  const hedgeTop = mat(0x4a9a48, 0.95);
  const hedgeRun = (x0: number, z0: number, x1: number, z1: number) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const ry = Math.atan2(x1 - x0, z1 - z0);
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    place(group, unitBox, hedge, [cx, 0.6, cz], [0.9, 1.2, len], { ry, receive: true });
    place(group, unitBox, hedgeTop, [cx, 1.23, cz], [0.95, 0.06, len + 0.05], { ry });
  };
  for (const z of [-25.6, 25.6]) { hedgeRun(-32.5, z, -3, z); hedgeRun(3, z, 32.5, z); }
  for (const x of [-32, 32]) { hedgeRun(x, -25.6, x, 6); hedgeRun(x, 12, x, 25.6); }
  const iron = mat(0x2f3b4a, 0.5, false, 0.4);
  for (let x = -33; x <= 33; x += 1.6) {
    for (const z of [-26.8, 26.8]) if (Math.abs(x) > 3) place(group, unitBox, iron, [x, 0.8, z], [0.08, 1.6, 0.08]);
  }
  for (const z of [-26.8, 26.8]) {
    for (const side of [-1, 1]) place(group, unitBox, iron, [side * 18, 1.45, z], [30, 0.08, 0.08]);
  }

  // 바깥: 인도·도로 고리 → 파스텔 빌딩 → 나무 띠 → 언덕
  flatPlane(group, 82, 3, 0xe4ddd0, 0, 29, -0.01);
  flatPlane(group, 82, 3, 0xe4ddd0, 0, -29, -0.01);
  flatPlane(group, 3, 62, 0xe4ddd0, 35, 0, -0.01);
  flatPlane(group, 3, 62, 0xe4ddd0, -35, 0, -0.01);
  flatPlane(group, 96, 6, 0x8a93a3, 0, 33.5, -0.012);
  flatPlane(group, 96, 6, 0x8a93a3, 0, -33.5, -0.012);
  flatPlane(group, 6, 72, 0x8a93a3, 39.5, 0, -0.012);
  flatPlane(group, 6, 72, 0x8a93a3, -39.5, 0, -0.012);
  const buildingColors = [0xffc4d6, 0xa8d8ff, 0xfff1a8, 0xc8f0b8, 0xe2d4ff, 0xffd6a5, 0xb8f0ee];
  const windowMat = mat(0xdff4ff, 0.3);
  const buildingCount = low ? 18 : 34;
  for (let i = 0; i < buildingCount; i++) {
    const angle = (i / buildingCount) * Math.PI * 2;
    const r = 64 + rand() * 24;
    const bx = Math.cos(angle) * r;
    const bz = Math.sin(angle) * r * 0.85;
    const w = 8 + rand() * 7;
    const h = 8 + rand() * 14;
    const building = new THREE.Group();
    building.position.set(bx, 0, bz);
    building.lookAt(0, 0, 0);
    place(building, unitBox, mat(pick(buildingColors), 0.8), [0, h / 2, 0], [w, h, w * 0.8]);
    place(building, unitBox, mat(0xffffff, 0.8), [0, h + 0.3, 0], [w + 0.4, 0.6, w * 0.8 + 0.4]);
    for (let fy = 2.5; fy < h - 1; fy += 3) place(building, unitBox, windowMat, [0, fy, w * 0.4 + 0.02], [w * 0.8, 1.2, 0.05]);
    group.add(building);
  }
  for (let i = 0; i < (low ? 24 : 48); i++) {
    const angle = rand() * Math.PI * 2;
    const r = 44 + rand() * 14;
    roundTree(group, Math.cos(angle) * r, Math.sin(angle) * r * 0.85, 0.9 + rand() * 0.5, pick([0x5fa83a, 0x4f913f]));
  }
  hillRing(group, mat(0x8cc46a, 1, true), 120, low ? 10 : 16);

  function update(time: number) {
    spout.scale.set(0.5 + Math.sin(time * 6) * 0.04, 0.7 + Math.sin(time * 5) * 0.08, 0.5);
    ducks.forEach((duck, i) => {
      const a = time * 0.18 + (i * Math.PI * 2) / 3;
      duck.position.set(pondX + Math.cos(a) * 4.6, 0.02 + Math.sin(time * 2 + i) * 0.03, pondZ + Math.sin(a) * 4.6);
      duck.rotation.y = -a - Math.PI / 2;
    });
    seats.forEach((seat, i) => { seat.rotation.x = Math.sin(time * 1.4 + i * 1.7) * 0.28; });
  }
  kitCommit(group);
  return { group, colliders, spawnAvoid, anchors: { benches, pond: [[pondX, pondZ]] }, update };
}

// ── 지역 5: 해변 ─────────────────────────────────────────────────────────────────
// 플레이 범위 x ±30, z -11..24. z -12부터 바다, 서쪽(x < -20)은 갯바위, 뒤쪽 z 20 근처 데크길.
export function buildBeachWorld(low: boolean): RegionWorld {
  seeded(7723);
  const group = new THREE.Group();
  const colliders: Circle[] = [];
  const spawnAvoid: Circle[] = [];
  const block = (x: number, z: number, r: number, avoid = r + 0.6) => { colliders.push([x, z, r]); spawnAvoid.push([x, z, avoid]); };

  flatPlane(group, 600, 320, 0xf3dfa6, 0, 148, -0.02);
  flatPlane(group, 600, 5, 0xd9bf85, 0, -11, -0.01); // 젖은 모래
  const shallow = flatPlane(group, 600, 8, 0x86dcf2, 0, -17, 0.0, false);
  (shallow.material as THREE.MeshStandardMaterial).roughness = 0.3;
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(600, 400), new THREE.MeshStandardMaterial({ color: 0x3aaee0, roughness: 0.3, metalness: 0.1 }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -0.01, -221);
  group.add(sea);
  const foamMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, transparent: true, opacity: 0.85 });
  const foams: THREE.Mesh[] = [];
  for (const [fz, w] of [[-13.2, 600], [-15.6, 600]] as Array<[number, number]>) {
    const foam = flatPlane(group, w, 0.5, 0xffffff, 0, fz, 0.02, false);
    foam.material = foamMaterial;
    foams.push(foam);
  }

  // 데크길(뒤쪽) + 바다로 뻗은 부두
  const plank = mat(0xc98a4b, 0.85);
  for (let x = -40; x <= 40; x += 1.05) place(group, unitBox, plank, [x, 0.08, 21], [0.95, 0.16, 3], { receive: true });
  for (let z = -10; z >= -46; z -= 1.05) place(group, unitBox, plank, [22, 0.32, z], [3, 0.12, 0.95], { receive: true });
  for (let z = -12; z >= -46; z -= 4) {
    for (const px of [20.6, 23.4]) place(group, unitCylinder, mat(0x8a5a33), [px, -0.4, z], [0.18, 1.6, 0.18]);
  }

  // 야자수: Blender 키트 palm_0(휘어진 줄기 + 잎 7장 + 코코넛)
  const palms: Array<[number, number, number]> = [
    [-16, 14, 1.1], [-6, 17, 1], [7, 16, 1.15], [17, 13, 1], [27, 17, 1.1], [-26, 16, 1], [12, 3, 0.95], [-12, 4, 0.9],
  ];
  for (const [px, pz, s] of palms) {
    kitAdd(group, 'palm_0', [px, 0, pz], rand() * Math.PI * 2, s, { shadow: true });
    colliders.push([px, pz, 0.45 * s]);
    spawnAvoid.push([px, pz, 1.2 * s]);
  }

  // 파라솔 + 수건 + 비치체어
  const umbrellas: Array<[number, number]> = [];
  const umbrellaColors: Array<[number, number]> = [[0xff6b6b, 0xffffff], [0x5ab0ff, 0xfff1a8], [0xffd84a, 0xff8fb1], [0x2a9d8f, 0xffffff], [0x9b6fd6, 0xfff1a8], [0xff9a5a, 0xffffff]];
  const umbrellaSpots: Array<[number, number]> = [[-12, -3], [-3, 2], [5, -4], [14, -6], [22, 4], [-4, 10]];
  umbrellaSpots.forEach(([ux, uz], i) => {
    const [c1, c2] = umbrellaColors[i % umbrellaColors.length];
    place(group, unitCylinder, mat(0xf7f2e6), [ux, 1.25, uz], [0.06, 2.5, 0.06], { shadow: true });
    for (let k = 0; k < 8; k++) {
      const wedge = new THREE.Mesh(new THREE.ConeGeometry(1.9, 0.8, 8, 1, true, (k / 8) * Math.PI * 2, Math.PI / 4), mat(k % 2 ? c1 : c2, 0.7));
      wedge.position.set(ux, 2.55, uz);
      wedge.castShadow = true;
      (wedge.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
      group.add(wedge);
    }
    place(group, unitBox, mat(i % 2 ? 0x5ab0ff : 0xff8fb1, 0.9), [ux + 1.2, 0.03, uz + 0.9], [1, 0.04, 2], { ry: 0.3, receive: true });
    const chair = new THREE.Group();
    chair.position.set(ux - 1.3, 0, uz + 0.6);
    chair.rotation.y = -0.2;
    place(chair, unitBox, mat(c1, 0.7), [0, 0.35, 0], [0.7, 0.08, 1.2], { shadow: true });
    place(chair, unitBox, mat(c1, 0.7), [0, 0.7, -0.6], [0.7, 0.08, 0.8], { rx: 1.0, shadow: true });
    group.add(chair);
    umbrellas.push([ux, uz]);
    block(ux, uz, 0.5, 2.4);
  });

  // 인명구조 망루
  const tower = new THREE.Group();
  tower.position.set(-16, 0, -6);
  for (const [lx, lz] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) place(tower, unitBox, mat(0xffffff, 0.7), [lx, 1.3, lz], [0.16, 2.6, 0.16], { shadow: true });
  place(tower, unitBox, mat(0xff6b6b, 0.7), [0, 2.9, 0], [2.4, 1.2, 2.2], { shadow: true });
  place(tower, roofGeometry(2.9, 0.9, 2.7), mat(0xffffff, 0.7), [0, 3.5, 0], [1, 1, 1], { ry: Math.PI / 2, shadow: true });
  place(tower, unitBox, mat(0xfff1a8, 0.7), [0, 2.9, 1.11], [1.6, 0.5, 0.04]);
  for (let i = 0; i < 6; i++) place(tower, unitBox, mat(0xffffff, 0.7), [0, 0.3 + i * 0.4, 1.6 - i * 0.12], [0.9, 0.06, 0.25]);
  group.add(tower);
  block(-16, -6, 1.8);

  // 비치발리볼 네트
  for (const nx of [3, 11]) place(group, unitCylinder, mat(0xf7f2e6), [nx, 1.2, 9], [0.08, 2.4, 0.08], { shadow: true });
  place(group, unitBox, new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 }), [7, 1.9, 9], [8, 0.9, 0.04]);
  block(3, 9, 0.4, 1);
  block(11, 9, 0.4, 1);
  place(group, unitSphere, mat(0xffd84a, 0.5), [9, 0.3, 11], [0.3, 0.3, 0.3], { shadow: true });

  // 모래성
  for (const [cx, cz] of [[0, -8], [-8, 6], [18, -1]] as Array<[number, number]>) {
    place(group, unitCylinder, mat(0xe2c27c, 1), [cx, 0.3, cz], [0.9, 0.6, 0.9], { shadow: true });
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2;
      place(group, unitCylinder, mat(0xe2c27c, 1), [cx + Math.cos(a) * 0.75, 0.55, cz + Math.sin(a) * 0.75], [0.25, 1.1, 0.25], { shadow: true });
      place(group, unitCone, mat(0xd9b46a, 1), [cx + Math.cos(a) * 0.75, 1.3, cz + Math.sin(a) * 0.75], [0.3, 0.4, 0.3]);
    }
    place(group, unitBox, mat(0xff6b6b, 0.7), [cx, 1.1, cz], [0.02, 0.5, 0.02]);
    block(cx, cz, 1.1, 1.6);
  }

  // 서쪽 갯바위(청소 대상인 회색 돌과 구분되도록 큼직한 사암색)
  const cliffMat = mat(0xc9a27a, 1, true);
  for (const [rx, rz, s] of [[-31, -6, 2.4], [-33, 4, 3], [-30, 14, 2.2], [-36, -12, 3.4], [-28, -12, 1.6]] as Array<[number, number, number]>) {
    place(group, unitIco, cliffMat, [rx, s * 0.35, rz], [s, s * 0.8, s * 1.1], { shadow: true, receive: true });
  }
  colliders.push([-31, -6, 2.2], [-33, 4, 2.8], [-30, 14, 2]);
  spawnAvoid.push([-31, -6, 2.8], [-33, 4, 3.4], [-30, 14, 2.6]);
  const tidePool = new THREE.Mesh(new THREE.CircleGeometry(1.6, 20), new THREE.MeshStandardMaterial({ color: 0x6fd0ee, roughness: 0.2 }));
  tidePool.rotation.x = -Math.PI / 2;
  tidePool.position.set(-24, 0.02, -2);
  group.add(tidePool);
  spawnAvoid.push([-24, -2, 1.8]);

  // 바깥: 모래 언덕 + 해변 집 + 곶의 등대 + 섬 + 돛단배
  const duneMat = mat(0xe9d08c, 1, true);
  for (let i = 0; i < (low ? 12 : 22); i++) {
    const x = -60 + rand() * 120;
    const z = 27 + rand() * 14;
    place(group, lowSphere, duneMat, [x, -0.6, z], [4 + rand() * 4, 1.6 + rand() * 1.2, 3 + rand() * 2]);
    if (rand() < 0.6) place(group, unitCone, mat(0x9bbf5a, 1, true), [x + rand(), 0.8, z - 1.5], [0.3, 1, 0.3]);
  }
  for (const side of [-1, 1]) {
    for (let z = -8; z <= 26; z += 8) place(group, lowSphere, duneMat, [side * (36 + rand() * 6), -0.6, z], [5, 2 + rand(), 4]);
  }
  for (let x = -48; x <= 48; x += 12) {
    const house = toyHouse(group, x + (rand() - 0.5) * 3, 48 + rand() * 4, Math.PI, 1);
    house.position.y = 0.8;
    for (const [lx, lz] of [[-2.5, -2], [2.5, -2], [-2.5, 2], [2.5, 2]]) place(house, unitCylinder, mat(0x8a5a33), [lx, -0.4, lz], [0.15, 0.8, 0.15]);
  }
  for (let i = 0; i < (low ? 8 : 16); i++) {
    const x = -70 + rand() * 140;
    const z = 60 + rand() * 20;
    pineTree(group, x, z, 1.4 + rand(), 0x3d7d3a);
  }
  // 오른쪽 곶 + 등대
  place(group, lowSphere, mat(0x9a8f7a, 1, true), [62, -2, -34], [22, 9, 16]);
  place(group, lowSphere, mat(0x6fae4a, 1, true), [62, 3.2, -34], [17, 4, 12]);
  const lighthouse = new THREE.Group();
  lighthouse.position.set(60, 6, -36);
  for (let i = 0; i < 4; i++) place(lighthouse, unitCylinder, mat(i % 2 ? 0xff6b6b : 0xffffff, 0.7), [0, 1.5 + i * 3, 0], [1.6 - i * 0.18, 3, 1.6 - i * 0.18]);
  place(lighthouse, unitCylinder, new THREE.MeshStandardMaterial({ color: 0xfff3c4, emissive: 0xffe08a, emissiveIntensity: 0.8 }), [0, 13.5, 0], [0.9, 1.6, 0.9]);
  place(lighthouse, unitCone, mat(0xff6b6b, 0.7), [0, 15.1, 0], [1.2, 1.6, 1.2]);
  group.add(lighthouse);
  // 먼 섬
  for (const [ix, iz, s] of [[-70, -120, 1.2], [40, -150, 0.9], [-10, -170, 1.5]] as Array<[number, number, number]>) {
    place(group, lowSphere, mat(0xe9d08c, 1, true), [ix, -1, iz], [16 * s, 3 * s, 10 * s]);
    place(group, lowSphere, mat(0x5fa83a, 1, true), [ix, 1, iz], [11 * s, 6 * s, 7 * s]);
  }
  const boats: THREE.Group[] = [];
  for (const [bx, bz] of [[-30, -55], [15, -80], [45, -62]] as Array<[number, number]>) {
    const boat = new THREE.Group();
    boat.position.set(bx, 0, bz);
    place(boat, unitBox, mat(0xffffff, 0.6), [0, 0.4, 0], [4, 0.8, 1.4]);
    place(boat, unitBox, mat(0x5b8bd9, 0.6), [0, 0.1, 0], [4.2, 0.3, 1.5]);
    place(boat, unitCylinder, mat(0x8a5a33), [0, 2.6, 0], [0.08, 4, 0.08]);
    const sail = new THREE.Mesh(new THREE.ConeGeometry(1.4, 3.6, 3), mat(pick([0xff6b6b, 0xfff1a8, 0xffffff]), 0.8));
    sail.position.set(0.7, 2.6, 0);
    sail.scale.set(1, 1, 0.1);
    boat.add(sail);
    group.add(boat);
    boats.push(boat);
  }

  function update(time: number) {
    foams.forEach((foam, i) => {
      foam.position.z = (i === 0 ? -13.2 : -15.6) + Math.sin(time * 0.9 + i * 1.3) * 0.45;
    });
    foamMaterial.opacity = 0.6 + Math.sin(time * 0.9) * 0.25;
    boats.forEach((boat, i) => {
      boat.position.y = Math.sin(time * 1.3 + i) * 0.12;
      boat.rotation.z = Math.sin(time * 1.1 + i * 2) * 0.05;
    });
  }
  kitCommit(group);
  return { group, colliders, spawnAvoid, anchors: { umbrellas }, update };
}
