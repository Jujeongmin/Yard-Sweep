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

// `name`/`label` fields below are i18n keys (see src/i18n.ts), not display text — resolve with t().
export const tools: Record<ToolId, ToolDefinition> = {
  basicBroom: { id: 'basicBroom', slot: 1, name: 'tool.basicBroom', radius: 2.15, speed: 1, canMoveWhileCleaning: false, validTargets: ['leaf', 'can', 'goldCan', 'goldChest', 'gemChest'] },
  wideBroom: { id: 'wideBroom', slot: 2, name: 'tool.wideBroom', radius: 3.1, speed: 1.15, canMoveWhileCleaning: true, validTargets: ['leaf', 'can', 'goldCan', 'goldChest', 'gemChest'] },
  vacuum: { id: 'vacuum', slot: 3, name: 'tool.vacuum', radius: 2.65, speed: 2.1, canMoveWhileCleaning: true, validTargets: ['leaf', 'can', 'goldCan', 'goldChest', 'gemChest'], model: '/assets/Vacuum.glb' },
  copperSickle: { id: 'copperSickle', slot: 4, name: 'tool.copperSickle', radius: 2.35, speed: 1.25, canMoveWhileCleaning: true, validTargets: ['grass', 'goldChest', 'gemChest'] },
  metalSickle: { id: 'metalSickle', slot: 5, name: 'tool.metalSickle', radius: 3.15, speed: 1.8, canMoveWhileCleaning: true, validTargets: ['grass', 'goldChest', 'gemChest'] },
  pickaxe: { id: 'pickaxe', slot: 6, name: 'tool.pickaxe', radius: 1.65, speed: 1, canMoveWhileCleaning: false, validTargets: ['stone', 'goldStone', 'goldChest', 'gemChest'] },
  neonSickle: { id: 'neonSickle', slot: 7, name: 'tool.neonSickle', radius: 3.45, speed: 2.15, canMoveWhileCleaning: true, validTargets: ['grass', 'goldChest', 'gemChest'], model: '/assets/SickleSkin.glb' },
  neonPickaxe: { id: 'neonPickaxe', slot: 8, name: 'tool.neonPickaxe', radius: 2.15, speed: 1.55, canMoveWhileCleaning: true, validTargets: ['stone', 'goldStone', 'goldChest', 'gemChest'], model: '/assets/PickSkin.glb' },
};

export const objects: Record<ObjectKind, ObjectDefinition> = {
  leaf: { label: 'object.leaf', cleanTime: 0.45, reward: 1 },
  can: { label: 'object.can', cleanTime: 0.8, reward: 3 },
  grass: { label: 'object.grass', cleanTime: 1.2, reward: 2 },
  stone: { label: 'object.stone', cleanTime: 1.6, reward: 5 },
  goldCan: { label: 'object.goldCan', cleanTime: 1.1, reward: 15 },
  goldChest: { label: 'object.goldChest', cleanTime: 2.2, reward: 40 },
  gemChest: { label: 'object.gemChest', cleanTime: 2.2, reward: 0, gemReward: 10 },
  goldStone: { label: 'object.goldStone', cleanTime: 2.4, reward: 50, gemReward: 5 },
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
    name: 'region.1',
    objectCounts: { leaf: 100, can: 30, grass: 0, stone: 0, goldCan: 0, goldChest: 0, gemChest: 0, goldStone: 0 },
  },
  2: {
    id: 2,
    name: 'region.2',
    objectCounts: { leaf: 100, can: 30, grass: 50, stone: 0, goldCan: 0, goldChest: 0, gemChest: 0, goldStone: 0 },
  },
  3: {
    id: 3,
    name: 'region.3',
    objectCounts: { leaf: 100, can: 30, grass: 50, stone: 30, goldCan: 0, goldChest: 0, gemChest: 0, goldStone: 0 },
  },
};

export const regionCompletionRewards: Record<RegionId, { coins: number; gems: number }> = {
  1: { coins: 30, gems: 0 },
  2: { coins: 60, gems: 2 },
  3: { coins: 120, gems: 5 },
};

export interface RewardAmount { coins: number; gems: number }

export type MissionId = 'leaf100' | 'can30' | 'regionClear' | 'fastClear5min';

export interface MissionDefinition {
  id: MissionId;
  label: string;
  target: number;
  trackKind?: ObjectKind;
  trackType?: 'regionClear' | 'fastClear';
  reward: RewardAmount;
}

export const missionPool: MissionDefinition[] = [
  { id: 'leaf100', label: 'mission.leaf100', target: 100, trackKind: 'leaf', reward: { coins: 50, gems: 0 } },
  { id: 'can30', label: 'mission.can30', target: 30, trackKind: 'can', reward: { coins: 40, gems: 0 } },
  { id: 'regionClear', label: 'mission.regionClear', target: 1, trackType: 'regionClear', reward: { coins: 60, gems: 2 } },
  { id: 'fastClear5min', label: 'mission.fastClear5min', target: 1, trackType: 'fastClear', reward: { coins: 0, gems: 5 } },
];

export type AchievementId = 'firstClean' | 'coins1000' | 'allRegions' | 'leaf10000';

export interface AchievementDefinition {
  id: AchievementId;
  label: string;
  target: number;
  reward: RewardAmount;
}

export const achievements: Record<AchievementId, AchievementDefinition> = {
  firstClean: { id: 'firstClean', label: 'achievement.firstClean', target: 1, reward: { coins: 10, gems: 0 } },
  coins1000: { id: 'coins1000', label: 'achievement.coins1000', target: 1000, reward: { coins: 100, gems: 0 } },
  allRegions: { id: 'allRegions', label: 'achievement.allRegions', target: 1, reward: { coins: 0, gems: 20 } },
  leaf10000: { id: 'leaf10000', label: 'achievement.leaf10000', target: 10000, reward: { coins: 0, gems: 30 } },
};
