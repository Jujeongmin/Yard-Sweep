export type ObjectKind = 'leaf' | 'can' | 'grass' | 'stone';
export type ToolId = 'basicBroom' | 'wideBroom' | 'vacuum' | 'copperSickle' | 'metalSickle' | 'pickaxe';

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
}

export const tools: Record<ToolId, ToolDefinition> = {
  basicBroom: { id: 'basicBroom', slot: 1, name: '기본 빗자루', radius: 2.15, speed: 1, canMoveWhileCleaning: false, validTargets: ['leaf', 'can'], model: '/assets/Broom_2.glb' },
  wideBroom: { id: 'wideBroom', slot: 2, name: '더 큰 빗자루', radius: 3.1, speed: 1.15, canMoveWhileCleaning: true, validTargets: ['leaf', 'can'] },
  vacuum: { id: 'vacuum', slot: 3, name: '진공 청소기', radius: 2.65, speed: 2.1, canMoveWhileCleaning: true, validTargets: ['leaf', 'can'], model: '/assets/vacuum_cleaner.glb' },
  copperSickle: { id: 'copperSickle', slot: 4, name: '구리 낫', radius: 2.35, speed: 1.25, canMoveWhileCleaning: true, validTargets: ['grass'], model: '/assets/Sickle_1.glb' },
  metalSickle: { id: 'metalSickle', slot: 5, name: '금속 낫', radius: 3.15, speed: 1.8, canMoveWhileCleaning: true, validTargets: ['grass'], model: '/assets/Sickle_0.glb' },
  pickaxe: { id: 'pickaxe', slot: 6, name: '곡괭이', radius: 1.65, speed: 1, canMoveWhileCleaning: false, validTargets: ['stone'] },
};

export const objects: Record<ObjectKind, ObjectDefinition> = {
  leaf: { label: '낙엽', cleanTime: 0.45, reward: 1 },
  can: { label: '빈 캔', cleanTime: 0.8, reward: 3 },
  grass: { label: '잔디', cleanTime: 1.2, reward: 2 },
  stone: { label: '돌', cleanTime: 1.6, reward: 5 },
};

export const toolOrder: ToolId[] = ['basicBroom', 'wideBroom', 'vacuum', 'copperSickle', 'metalSickle', 'pickaxe'];

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
    objectCounts: { leaf: 100, can: 30, grass: 0, stone: 0 },
  },
  2: {
    id: 2,
    name: '정원',
    objectCounts: { leaf: 100, can: 30, grass: 50, stone: 0 },
  },
  3: {
    id: 3,
    name: '돌 정원',
    objectCounts: { leaf: 100, can: 30, grass: 50, stone: 30 },
  },
};
