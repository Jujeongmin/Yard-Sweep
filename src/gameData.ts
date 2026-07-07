export type ObjectKind = 'leaf' | 'can' | 'grass' | 'stone' | 'goldCan' | 'goldChest' | 'gemChest' | 'goldStone';
export type ToolId = 'basicBroom' | 'wideBroom' | 'vacuum' | 'copperSickle' | 'metalSickle' | 'pickaxe' | 'neonSickle' | 'neonPickaxe';

export interface ToolDefinition {
  id: ToolId;
  slot: number;
  name: string;
  radius: number;
  speed: number;
  canMoveWhileCleaning: boolean;
  validTargets: ObjectKind[];
  model?: string;
}

export interface ObjectDefinition {
  label: string;
  cleanTime: number;
  reward: number;
  gemReward?: number;
}

export const tools: Record<ToolId, ToolDefinition> = {
  basicBroom: { id: 'basicBroom', slot: 1, name: '기본 빗자루', radius: 2.15, speed: 1, canMoveWhileCleaning: false, validTargets: ['leaf', 'can', 'goldCan', 'goldChest', 'gemChest'], model: '/assets/Broom_2.glb' },
  wideBroom: { id: 'wideBroom', slot: 2, name: '더 큰 빗자루', radius: 3.1, speed: 1.15, canMoveWhileCleaning: true, validTargets: ['leaf', 'can', 'goldCan', 'goldChest', 'gemChest'] },
  vacuum: { id: 'vacuum', slot: 3, name: '진공 청소기', radius: 2.65, speed: 2.1, canMoveWhileCleaning: true, validTargets: ['leaf', 'can', 'goldCan', 'goldChest', 'gemChest'], model: '/assets/Vacuum.glb' },
  copperSickle: { id: 'copperSickle', slot: 4, name: '구리 낫', radius: 2.35, speed: 1.25, canMoveWhileCleaning: true, validTargets: ['grass', 'goldChest', 'gemChest'], model: '/assets/Sickle_0.glb' },
  metalSickle: { id: 'metalSickle', slot: 5, name: '금속 낫', radius: 3.15, speed: 1.8, canMoveWhileCleaning: true, validTargets: ['grass', 'goldChest', 'gemChest'], model: '/assets/Sickle_1.glb' },
  pickaxe: { id: 'pickaxe', slot: 6, name: '곡괭이', radius: 1.65, speed: 1, canMoveWhileCleaning: false, validTargets: ['stone', 'goldStone', 'goldChest', 'gemChest'], model: '/assets/Pick.glb' },
  neonSickle: { id: 'neonSickle', slot: 7, name: '네온 낫', radius: 3.45, speed: 2.15, canMoveWhileCleaning: true, validTargets: ['grass', 'goldChest', 'gemChest'], model: '/assets/SickleSkin.glb' },
  neonPickaxe: { id: 'neonPickaxe', slot: 8, name: '네온 곡괭이', radius: 2.15, speed: 1.55, canMoveWhileCleaning: true, validTargets: ['stone', 'goldStone', 'goldChest', 'gemChest'], model: '/assets/PickSkin.glb' },
};

export const objects: Record<ObjectKind, ObjectDefinition> = {
  leaf: { label: '낙엽', cleanTime: 0.45, reward: 1 },
  can: { label: '빈 캔', cleanTime: 0.8, reward: 3 },
  grass: { label: '잔디', cleanTime: 1.2, reward: 2 },
  stone: { label: '돌', cleanTime: 1.6, reward: 5 },
  goldCan: { label: '금 캔', cleanTime: 1.1, reward: 15 },
  goldChest: { label: '골드 상자', cleanTime: 2.2, reward: 40 },
  gemChest: { label: '보석 상자', cleanTime: 2.2, reward: 0, gemReward: 10 },
  goldStone: { label: '황금 돌', cleanTime: 2.4, reward: 50, gemReward: 5 },
};

export const toolOrder: ToolId[] = ['basicBroom', 'wideBroom', 'vacuum', 'copperSickle', 'metalSickle', 'pickaxe', 'neonSickle', 'neonPickaxe'];

export type RegionId = 1 | 2 | 3;

export interface RegionDefinition {
  id: RegionId;
  name: string;
  objectCounts: Record<ObjectKind, number>;
}

export const regions: Record<RegionId, RegionDefinition> = {
  1: {
    id: 1,
    name: '앞 마당',
    objectCounts: { leaf: 100, can: 30, grass: 0, stone: 0, goldCan: 0, goldChest: 0, gemChest: 0, goldStone: 0 },
  },
  2: {
    id: 2,
    name: '정원',
    objectCounts: { leaf: 100, can: 30, grass: 50, stone: 0, goldCan: 0, goldChest: 0, gemChest: 0, goldStone: 0 },
  },
  3: {
    id: 3,
    name: '돌 정원',
    objectCounts: { leaf: 100, can: 30, grass: 50, stone: 30, goldCan: 0, goldChest: 0, gemChest: 0, goldStone: 0 },
  },
};
