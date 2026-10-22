export type ObjectKind = 'leaf' | 'can' | 'grass' | 'stone' | 'goldCan' | 'goldChest' | 'gemChest' | 'goldStone'
  | 'trashBag' | 'bottle' | 'bush' | 'seaweed' | 'boulder';
export type ToolId = 'basicBroom' | 'wideBroom' | 'vacuum' | 'copperSickle' | 'metalSickle' | 'pickaxe' | 'neonSickle' | 'neonPickaxe';

// 인벤토리는 3개 카테고리 슬롯으로 구성된다. 각 카테고리마다 장착(equip)한 도구 1개만 활성.
// 1 = 낙엽/캔 청소, 2 = 잔디, 3 = 돌
export type CategoryId = 1 | 2 | 3;

export interface ToolDefinition {
  id: ToolId;
  slot: number;
  category: CategoryId;
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
  basicBroom: { id: 'basicBroom', slot: 1, category: 1, name: 'tool.basicBroom', radius: 2.15, speed: 1, canMoveWhileCleaning: false, validTargets: ['leaf', 'can', 'goldCan', 'goldChest', 'gemChest', 'trashBag', 'bottle'] },
  wideBroom: { id: 'wideBroom', slot: 2, category: 1, name: 'tool.wideBroom', radius: 3.1, speed: 1.15, canMoveWhileCleaning: true, validTargets: ['leaf', 'can', 'goldCan', 'goldChest', 'gemChest', 'trashBag', 'bottle'] },
  vacuum: { id: 'vacuum', slot: 3, category: 1, name: 'tool.vacuum', radius: 2.65, speed: 2.1, canMoveWhileCleaning: true, validTargets: ['leaf', 'can', 'goldCan', 'goldChest', 'gemChest', 'trashBag', 'bottle'], model: '/assets/Vacuum.glb' },
  copperSickle: { id: 'copperSickle', slot: 4, category: 2, name: 'tool.copperSickle', radius: 2.35, speed: 1.25, canMoveWhileCleaning: true, validTargets: ['grass', 'goldChest', 'gemChest', 'bush', 'seaweed'] },
  metalSickle: { id: 'metalSickle', slot: 5, category: 2, name: 'tool.metalSickle', radius: 3.15, speed: 1.8, canMoveWhileCleaning: true, validTargets: ['grass', 'goldChest', 'gemChest', 'bush', 'seaweed'] },
  pickaxe: { id: 'pickaxe', slot: 6, category: 3, name: 'tool.pickaxe', radius: 1.65, speed: 1, canMoveWhileCleaning: false, validTargets: ['stone', 'goldStone', 'goldChest', 'gemChest', 'boulder'] },
  neonSickle: { id: 'neonSickle', slot: 7, category: 2, name: 'tool.neonSickle', radius: 3.45, speed: 2.15, canMoveWhileCleaning: true, validTargets: ['grass', 'goldChest', 'gemChest', 'bush', 'seaweed'], model: '/assets/SickleSkin.glb' },
  neonPickaxe: { id: 'neonPickaxe', slot: 8, category: 3, name: 'tool.neonPickaxe', radius: 2.15, speed: 1.55, canMoveWhileCleaning: true, validTargets: ['stone', 'goldStone', 'goldChest', 'gemChest', 'boulder'], model: '/assets/PickSkin.glb' },
};

export interface CategoryDefinition {
  id: CategoryId;
  name: string; // i18n key
  icon: string; // CSS icon name
  tools: ToolId[]; // 하위 정렬 순서(구매/장착 목록에 이 순서로 노출)
}

export const categories: Record<CategoryId, CategoryDefinition> = {
  1: { id: 1, name: 'category.cleaning', icon: 'broom', tools: ['basicBroom', 'wideBroom', 'vacuum'] },
  2: { id: 2, name: 'category.grass', icon: 'grass', tools: ['copperSickle', 'metalSickle', 'neonSickle'] },
  3: { id: 3, name: 'category.stone', icon: 'stone', tools: ['pickaxe', 'neonPickaxe'] },
};

export const categoryOrder: CategoryId[] = [1, 2, 3];

export const objects: Record<ObjectKind, ObjectDefinition> = {
  leaf: { label: 'object.leaf', cleanTime: 0.45, reward: 1 },
  can: { label: 'object.can', cleanTime: 0.8, reward: 3 },
  grass: { label: 'object.grass', cleanTime: 1.2, reward: 2 },
  stone: { label: 'object.stone', cleanTime: 1.6, reward: 5 },
  goldCan: { label: 'object.goldCan', cleanTime: 1.1, reward: 15 },
  goldChest: { label: 'object.goldChest', cleanTime: 2.2, reward: 40 },
  gemChest: { label: 'object.gemChest', cleanTime: 2.2, reward: 0, gemReward: 10 },
  goldStone: { label: 'object.goldStone', cleanTime: 2.4, reward: 50, gemReward: 5 },
  // 공원·해변 전용. 기존 장비 카테고리로 치우지만 더 오래 걸리고 보상이 크다(강화 수요를 만든다).
  trashBag: { label: 'object.trashBag', cleanTime: 1.6, reward: 8 },
  bottle: { label: 'object.bottle', cleanTime: 0.9, reward: 4 },
  bush: { label: 'object.bush', cleanTime: 2.2, reward: 7 },
  seaweed: { label: 'object.seaweed', cleanTime: 1.3, reward: 4 },
  boulder: { label: 'object.boulder', cleanTime: 3.2, reward: 14 },
};

export const toolOrder: ToolId[] = ['basicBroom', 'wideBroom', 'vacuum', 'copperSickle', 'metalSickle', 'pickaxe', 'neonSickle', 'neonPickaxe'];

export type RegionId = 1 | 2 | 3 | 4 | 5;
export const regionIds: RegionId[] = [1, 2, 3, 4, 5];
export const MAX_REGION: RegionId = 5;

export interface RegionDefinition {
  id: RegionId;
  name: string;
  objectCounts: Record<ObjectKind, number>;
}

const noObjects: Record<ObjectKind, number> = {
  leaf: 0, can: 0, grass: 0, stone: 0, goldCan: 0, goldChest: 0, gemChest: 0, goldStone: 0,
  trashBag: 0, bottle: 0, bush: 0, seaweed: 0, boulder: 0,
};

export const regions: Record<RegionId, RegionDefinition> = {
  1: { id: 1, name: 'region.1', objectCounts: { ...noObjects, leaf: 100, can: 30 } },
  2: { id: 2, name: 'region.2', objectCounts: { ...noObjects, leaf: 100, can: 30, grass: 50 } },
  3: { id: 3, name: 'region.3', objectCounts: { ...noObjects, leaf: 100, can: 30, grass: 50, stone: 30 } },
  // 공원: 마당보다 약 2.5배 넓다. 연못 둘레 큰 바위, 가장자리 덤불, 벤치 옆 쓰레기봉투.
  4: { id: 4, name: 'region.4', objectCounts: { ...noObjects, leaf: 130, can: 35, grass: 55, stone: 20, trashBag: 18, bush: 24, boulder: 10 } },
  // 해변: 물가 해초, 모래사장 유리병, 서쪽 갯바위 돌·큰 바위.
  5: { id: 5, name: 'region.5', objectCounts: { ...noObjects, leaf: 40, can: 40, stone: 25, trashBag: 16, bottle: 45, seaweed: 50, boulder: 14 } },
};

export const regionCompletionRewards: Record<RegionId, { coins: number; gems: number }> = {
  1: { coins: 30, gems: 0 },
  2: { coins: 60, gems: 2 },
  3: { coins: 120, gems: 5 },
  4: { coins: 260, gems: 8 },
  5: { coins: 420, gems: 12 },
};

export interface RewardAmount { coins: number; gems: number }

export type MissionId = 'leaf100' | 'can30' | 'regionClear' | 'fastClear5min' | 'grass50' | 'stone20' | 'bigTrash15' | 'combo30';

export interface MissionDefinition {
  id: MissionId;
  label: string;
  target: number;
  trackKinds?: ObjectKind[];
  trackType?: 'regionClear' | 'fastClear' | 'combo';
  reward: RewardAmount;
}

export const missionPool: MissionDefinition[] = [
  { id: 'leaf100', label: 'mission.leaf100', target: 100, trackKinds: ['leaf'], reward: { coins: 50, gems: 0 } },
  { id: 'can30', label: 'mission.can30', target: 30, trackKinds: ['can'], reward: { coins: 40, gems: 0 } },
  { id: 'regionClear', label: 'mission.regionClear', target: 1, trackType: 'regionClear', reward: { coins: 60, gems: 2 } },
  { id: 'fastClear5min', label: 'mission.fastClear5min', target: 1, trackType: 'fastClear', reward: { coins: 0, gems: 5 } },
  { id: 'grass50', label: 'mission.grass50', target: 50, trackKinds: ['grass'], reward: { coins: 80, gems: 0 } },
  { id: 'stone20', label: 'mission.stone20', target: 20, trackKinds: ['stone'], reward: { coins: 90, gems: 1 } },
  { id: 'bigTrash15', label: 'mission.bigTrash15', target: 15, trackKinds: ['trashBag', 'bush', 'boulder'], reward: { coins: 150, gems: 2 } },
  { id: 'combo30', label: 'mission.combo30', target: 30, trackType: 'combo', reward: { coins: 0, gems: 4 } },
];

export type AchievementId = 'firstClean' | 'coins1000' | 'allRegions' | 'leaf10000'
  | 'regions10' | 'cleaned5000' | 'coins20000' | 'combo50' | 'boulder100';

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
  regions10: { id: 'regions10', label: 'achievement.regions10', target: 10, reward: { coins: 300, gems: 10 } },
  cleaned5000: { id: 'cleaned5000', label: 'achievement.cleaned5000', target: 5000, reward: { coins: 0, gems: 40 } },
  coins20000: { id: 'coins20000', label: 'achievement.coins20000', target: 20000, reward: { coins: 0, gems: 30 } },
  combo50: { id: 'combo50', label: 'achievement.combo50', target: 50, reward: { coins: 0, gems: 20 } },
  boulder100: { id: 'boulder100', label: 'achievement.boulder100', target: 100, reward: { coins: 500, gems: 15 } },
};
