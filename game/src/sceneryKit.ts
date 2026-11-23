import * as THREE from 'three';

// Blender 풍경 키트(tools/blender/build_scenery.py → Yardsweep-Scenery.glb)를 InstancedMesh로 그린다.
//
// 쓰는 법: kitAdd(parent, 'treeRound_1', [x, 0, z], rotY, scale)로 배치를 기록하고, 다 넣은 뒤 kitCommit(parent).
// - kitAdd는 parent에 빈 앵커(Object3D)를 붙여 돌려준다. 나중에 앵커를 옮겨도(해변 집을 띄우는 등)
//   빌드 시점의 앵커 위치가 쓰인다.
// - 키트가 아직 로드 전이면 커밋된 묶음은 대기했다가 setSceneryKit() 때 한꺼번에 만들어진다.
// - 키트 로드가 실패하면 같은 이름의 단순 도형 키트(fallbackKit)로 똑같이 만든다.
// - geometry·material은 키트 원본 것을 그대로 공유한다. 지울 때 InstancedMesh.dispose()만 하고
//   geometry/material은 절대 dispose하지 않는다(kitClear).
// 같은 parent 안에서 이름(+그림자 여부)이 같은 배치는 draw call 1번(재질 수만큼)으로 그려진다.

interface Entry { name: string; anchor: THREE.Object3D; shadow: boolean; tint?: THREE.Color }
interface Batch { entries: Entry[]; built: THREE.InstancedMesh[]; committed: boolean }

let kit: Map<string, THREE.Object3D> | null = null;
const batches = new Map<THREE.Object3D, Batch>();

export interface KitOptions { shadow?: boolean; tint?: number | THREE.Color }

export function kitAdd(
  parent: THREE.Object3D, name: string, pos: [number, number, number], rotY = 0,
  scale: number | [number, number, number] = 1, opts: KitOptions = {},
) {
  let batch = batches.get(parent);
  if (!batch) {
    batch = { entries: [], built: [], committed: false };
    batches.set(parent, batch);
  }
  const anchor = new THREE.Object3D();
  anchor.name = `kit:${name}`;
  anchor.position.set(...pos);
  anchor.rotation.y = rotY;
  if (typeof scale === 'number') anchor.scale.setScalar(scale);
  else anchor.scale.set(...scale);
  parent.add(anchor);
  const tint = opts.tint === undefined ? undefined : new THREE.Color(opts.tint);
  batch.entries.push({ name, anchor, shadow: opts.shadow ?? false, tint });
  return anchor;
}

export function kitCommit(parent: THREE.Object3D) {
  const batch = batches.get(parent);
  if (!batch) return;
  batch.committed = true;
  if (kit) buildBatch(parent, batch);
}

// 묶음을 비운다(품질 변경으로 다시 깔 때). 공유 geometry/material은 건드리지 않는다.
export function kitClear(parent: THREE.Object3D) {
  const batch = batches.get(parent);
  if (!batch) return;
  for (const mesh of batch.built) {
    mesh.removeFromParent();
    mesh.dispose(); // instanceMatrix/instanceColor 버퍼만 해제
  }
  for (const entry of batch.entries) entry.anchor.removeFromParent();
  batches.delete(parent);
}

// 같은 묶음의 모든 인스턴스 색을 한 번에 바꾼다(지역 테마별 수관 색 등). 키트 원래 색에 곱해진다.
export function kitTintAll(parent: THREE.Object3D, color: number | THREE.Color) {
  const batch = batches.get(parent);
  if (!batch) return;
  const c = new THREE.Color(color);
  for (const entry of batch.entries) entry.tint = c.clone();
  for (const mesh of batch.built) {
    for (let i = 0; i < mesh.count; i++) mesh.setColorAt(i, c);
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
}

export function kitNames(prefix: string) {
  return [...(kit ?? fallbackNames).keys()].filter((n) => n.startsWith(`${prefix}_`));
}

export function setSceneryKit(root: THREE.Object3D | null) {
  kit = root ? indexKit(root) : buildFallbackKit();
  for (const [parent, batch] of batches) if (batch.committed && batch.built.length === 0) buildBatch(parent, batch);
}

export function sceneryKitReady() { return kit !== null; }

function indexKit(root: THREE.Object3D) {
  const map = new Map<string, THREE.Object3D>();
  for (const child of root.children) {
    child.position.set(0, 0, 0);
    map.set(child.name, child);
  }
  return map;
}

const tmpParentInv = new THREE.Matrix4();
const tmpMatrix = new THREE.Matrix4();
const white = new THREE.Color(1, 1, 1);

function buildBatch(parent: THREE.Object3D, batch: Batch) {
  if (!kit) return;
  parent.updateMatrixWorld(true);
  tmpParentInv.copy(parent.matrixWorld).invert();
  const groups = new Map<string, Entry[]>();
  for (const entry of batch.entries) {
    const key = `${entry.name}|${entry.shadow ? 1 : 0}`;
    const list = groups.get(key) ?? [];
    list.push(entry);
    groups.set(key, list);
  }
  for (const [key, entries] of groups) {
    const name = key.split('|')[0];
    const source = kit.get(name);
    if (!source) {
      console.warn(`[sceneryKit] missing kit item ${name}`);
      continue;
    }
    source.updateMatrixWorld(true);
    const sourceInv = new THREE.Matrix4().copy(source.matrixWorld).invert();
    const hasTint = entries.some((e) => e.tint);
    source.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const local = new THREE.Matrix4().multiplyMatrices(sourceInv, child.matrixWorld);
      const mesh = new THREE.InstancedMesh(child.geometry, child.material, entries.length);
      entries.forEach((entry, i) => {
        tmpMatrix.multiplyMatrices(tmpParentInv, entry.anchor.matrixWorld).multiply(local);
        mesh.setMatrixAt(i, tmpMatrix);
        if (hasTint) mesh.setColorAt(i, entry.tint ?? white);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      mesh.castShadow = entries[0].shadow;
      mesh.receiveShadow = entries[0].shadow;
      mesh.name = `kit-instanced:${name}`;
      parent.add(mesh);
      batch.built.push(mesh);
    });
  }
}

// ── 키트 로드 실패 시 폴백: 같은 이름의 단순 도형(공유 geometry/material) ──────────────
const fallbackNames = new Map<string, true>([
  ...['treeRound_0', 'treeRound_1', 'treeRound_2', 'treePine_0', 'treePine_1', 'treeBlossom_0', 'palm_0',
    'hedge_0', 'shrub_0', 'flowers_0', 'flowers_1', 'flowers_2', 'flowers_3', 'slab_0', 'slab_1',
    'cloud_0', 'cloud_1', 'cloud_2'].map((n) => [n, true] as [string, true]),
  ...[0, 1, 2].flatMap((s) => [0, 1, 2, 3].map((p) => [`house_${s}${p}`, true] as [string, true])),
]);

function buildFallbackKit() {
  const map = new Map<string, THREE.Object3D>();
  const m = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true });
  const trunk = m(0x85532f);
  const leaves = m(0x5fa83a);
  const pine = m(0x3d7d3a);
  const cloudWhite = m(0xffffff);
  const wall = m(0xffd6a5);
  const roof = m(0xe76f51);
  const stone = m(0x9a9188);
  const cyl = new THREE.CylinderGeometry(1, 1, 1, 7).translate(0, 0.5, 0);
  const cone = new THREE.ConeGeometry(1, 1, 8).translate(0, 0.5, 0);
  const ico = new THREE.IcosahedronGeometry(1, 1);
  const box = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const part = (g: THREE.BufferGeometry, mat: THREE.Material, pos: [number, number, number], s: [number, number, number]) => {
    const mesh = new THREE.Mesh(g, mat);
    mesh.position.set(...pos);
    mesh.scale.set(...s);
    return mesh;
  };
  for (const name of fallbackNames.keys()) {
    const g = new THREE.Group();
    g.name = name;
    if (name.startsWith('treeRound') || name.startsWith('treeBlossom')) {
      g.add(part(cyl, trunk, [0, 0, 0], [0.3, 2.8, 0.3]), part(ico, leaves, [0, 3.6, 0], [1.8, 1.6, 1.8]));
    } else if (name.startsWith('treePine')) {
      g.add(part(cyl, trunk, [0, 0, 0], [0.25, 1.6, 0.25]), part(cone, pine, [0, 1.2, 0], [1.5, 3.8, 1.5]));
    } else if (name.startsWith('palm')) {
      g.add(part(cyl, trunk, [0, 0, 0], [0.22, 4.9, 0.22]), part(ico, leaves, [0, 5, 0], [1.6, 0.4, 1.6]));
    } else if (name.startsWith('hedge') || name.startsWith('shrub')) {
      g.add(part(ico, pine, [0, 0.5, 0], [0.7, 0.5, 0.5]));
    } else if (name.startsWith('flowers')) {
      g.add(part(ico, roof, [0, 0.4, 0], [0.2, 0.15, 0.2]));
    } else if (name.startsWith('slab')) {
      g.add(part(cyl, stone, [0, 0, 0], [0.55, 0.12, 0.4]));
    } else if (name.startsWith('cloud')) {
      g.add(part(ico, cloudWhite, [0, 1.6, 0], [2.2, 1.2, 1.4]));
    } else if (name.startsWith('house')) {
      g.add(part(box, wall, [0, 0, 0], [6.4, 3.6, 5.2]), part(cone, roof, [0, 3.6, 0], [4.6, 2, 4.6]));
      g.children[1].rotation.y = Math.PI / 4;
    }
    map.set(name, g);
  }
  return map;
}
