export type Locale = 'ko' | 'en';

type Dict = Record<string, string>;

const ko: Dict = {
  'tool.basicBroom': '기본 빗자루',
  'tool.wideBroom': '더 큰 빗자루',
  'tool.vacuum': '송풍기',
  'tool.copperSickle': '구리 낫',
  'tool.metalSickle': '금속 낫',
  'tool.pickaxe': '곡괭이',
  'tool.neonSickle': '네온 낫',
  'tool.neonPickaxe': '네온 곡괭이',

  'object.leaf': '낙엽',
  'object.can': '빈 캔',
  'object.grass': '잔디',
  'object.stone': '돌',
  'object.goldCan': '금 캔',
  'object.goldChest': '골드 상자',
  'object.gemChest': '보석 상자',
  'object.goldStone': '황금 돌',

  'region.1': '앞 마당',
  'region.2': '정원',
  'region.3': '돌 정원',

  'mission.leaf100': '낙엽 100개 청소',
  'mission.can30': '빈 캔 30개 수거',
  'mission.regionClear': '마당 100% 청소',
  'mission.fastClear5min': '5분 안에 지역 완료',

  'achievement.firstClean': '첫 청소 완료',
  'achievement.coins1000': '코인 1,000개 획득',
  'achievement.allRegions': '모든 지역 해금',
  'achievement.leaf10000': '낙엽 10,000개 제거',

  'label.level': '레벨',
  'label.currentRegion': '현재 지역',
  'label.inventory': '장비 인벤토리',
  'label.cleaningInProgress': '청소 중',
  'label.cleaningItem': '{label} 청소 중',

  'aria.shop': '상점',
  'aria.fullscreen': '전체화면',
  'aria.settings': '설정',
  'aria.shopClose': '상점 닫기',
  'aria.settingsClose': '설정 닫기',
  'aria.rotateScreen': '가로 화면 안내',

  'hint.initial': '빗자루로 낙엽과 캔을 청소하세요',
  'hint.toolTargets': '{tool} · {targets} 청소 가능',

  'controls.move': '이동',
  'controls.view': '시점',
  'controls.clean': '청소',

  'start.title': '청소 시작!',
  'start.subtitle': '클릭하여 마우스를 연결하세요',

  'mobile.holdToClean': '길게 눌러 청소',

  'shop.title': '마당 상점',
  'shop.owned': '보유 중',
  'shop.locked': '잠김',
  'shop.currentRegion': '현재 지역',
  'shop.move': '이동',
  'shop.claimed': '완료',
  'shop.footerPc': 'PC: ',
  'shop.footerToggle': '으로 열기/닫기 · 구매 내용은 자동 저장됩니다',

  'tab.tools': '장비',
  'tab.upgrades': '강화',
  'tab.regions': '지역',
  'tab.missions': '미션',
  'tab.achievements': '업적',
  'tab.ranking': '랭킹',
  'tab.premium': '프리미엄',

  'toolDesc.wideBroom': '넓은 범위',
  'toolDesc.vacuum': '청소 속도 2.1배',
  'toolDesc.copperSickle': '잔디 전용 장비',
  'toolDesc.metalSickle': '더 넓고 빠른 잔디 장비',
  'toolDesc.pickaxe': '돌 전용 장비',
  'shop.vacuumTitle': '진공 청소기',

  'upgrade.cleanSpeed.title': '청소 속도',
  'upgrade.cleanSpeed.desc': '모든 장비 청소 시간 감소',
  'upgrade.moveSpeed.title': '이동 속도',
  'upgrade.moveSpeed.desc': '이동 속도 10% 증가',
  'upgrade.coinBonus.title': '코인 획득량',
  'upgrade.coinBonus.desc': '코인 보상 20% 증가',
  'upgrade.radius.title': '청소 범위',
  'upgrade.radius.desc': '청소 범위 8% 증가',

  'toolDesc.neonSickle': '넓고 빠른 프리미엄 잔디 장비',
  'toolDesc.neonPickaxe': '이동 가능한 프리미엄 돌 장비',
  'premium.coinBoost.title': '코인 부스터',
  'premium.coinBoost.desc': '30분간 코인 획득 +100%',
  'premium.robotVacuum.title': '로봇청소기',
  'premium.robotVacuum.desc': '보유 시 주변 오브젝트를 자동으로 청소 (5초/개)',

  'region.lockedHint': '이전 지역 완료 시 해금',
  'region.progressLabel': '진행도 {pct}%',
  'region.completeTitle': '{region} 청소 완료!{reward}',
  'region.allCompleteTitle': '모든 지역 청소 완료!{reward}',
  'region.moveTo': '{region}(으)로 이동',
  'region.replayFrom': '{region}부터 다시 플레이',

  'ranking.myLevel': '내 레벨',
  'ranking.note': '플랫폼 랭킹은 배포 후 연동됩니다.',

  'settings.title': '설정',
  'settings.language': '언어',
  'settings.bgmVolume': 'BGM 볼륨',
  'settings.sfxVolume': '효과음 볼륨',
  'settings.sensitivity': '마우스 감도',
  'settings.vibration': '진동',
  'settings.vibrationLabel': '청소 완료 시 진동',
  'settings.footer': '설정은 자동 저장됩니다',

  'rotate.title': '기기를 가로로 돌려주세요',
  'rotate.body': 'Yard Sweep은 가로 화면에서 가장 편하게 플레이할 수 있어요.',
  'rotate.fullscreenStart': '⛶ 전체화면으로 시작',

  'unit.coinGain': '+{n} 코인',
  'unit.gemGain': '+{n} 💎',

  'notice.rotateDevice': '기기를 직접 가로로 돌려주세요',
  'notice.missionClaimed': '{label} 보상 수령!',
  'notice.achievementUnlocked': '{label} 달성!',
  'notice.toolLocked': '{name} 장비가 잠겨 있습니다',
  'notice.notEnoughCoins': '코인이 부족합니다',
  'notice.notEnoughGems': '프리미엄 재화가 부족합니다',
  'notice.toolUnlocked': '{name} 해금!',
  'notice.upgradeComplete': '업그레이드 완료!',
  'notice.coinBoostActivated': '코인 부스터 발동! (30분간 코인 +100%)',
  'notice.robotVacuumAcquired': '로봇청소기 획득!',
};

const en: Dict = {
  'tool.basicBroom': 'Basic Broom',
  'tool.wideBroom': 'Wide Broom',
  'tool.vacuum': 'Leaf Blower',
  'tool.copperSickle': 'Copper Sickle',
  'tool.metalSickle': 'Steel Sickle',
  'tool.pickaxe': 'Pickaxe',
  'tool.neonSickle': 'Neon Sickle',
  'tool.neonPickaxe': 'Neon Pickaxe',

  'object.leaf': 'Leaf',
  'object.can': 'Can',
  'object.grass': 'Grass',
  'object.stone': 'Stone',
  'object.goldCan': 'Gold Can',
  'object.goldChest': 'Gold Chest',
  'object.gemChest': 'Gem Chest',
  'object.goldStone': 'Gold Stone',

  'region.1': 'Front Yard',
  'region.2': 'Garden',
  'region.3': 'Stone Garden',

  'mission.leaf100': 'Clean 100 leaves',
  'mission.can30': 'Collect 30 cans',
  'mission.regionClear': 'Clean a yard 100%',
  'mission.fastClear5min': 'Clear a region within 5 minutes',

  'achievement.firstClean': 'First clean',
  'achievement.coins1000': 'Earn 1,000 coins',
  'achievement.allRegions': 'Unlock all regions',
  'achievement.leaf10000': 'Remove 10,000 leaves',

  'label.level': 'Level',
  'label.currentRegion': 'Current region',
  'label.inventory': 'Tool inventory',
  'label.cleaningInProgress': 'Cleaning',
  'label.cleaningItem': 'Cleaning {label}',

  'aria.shop': 'Shop',
  'aria.fullscreen': 'Fullscreen',
  'aria.settings': 'Settings',
  'aria.shopClose': 'Close shop',
  'aria.settingsClose': 'Close settings',
  'aria.rotateScreen': 'Rotate screen notice',

  'hint.initial': 'Use the broom to clean leaves and cans',
  'hint.toolTargets': '{tool} · Can clean {targets}',

  'controls.move': 'Move',
  'controls.view': 'Look',
  'controls.clean': 'Clean',

  'start.title': 'Start cleaning!',
  'start.subtitle': 'Click to enable mouse look',

  'mobile.holdToClean': 'Hold to clean',

  'shop.title': 'Yard Shop',
  'shop.owned': 'Owned',
  'shop.locked': 'Locked',
  'shop.currentRegion': 'Current',
  'shop.move': 'Go',
  'shop.claimed': 'Done',
  'shop.footerPc': 'PC: ',
  'shop.footerToggle': ' to open/close · Purchases save automatically',

  'tab.tools': 'Tools',
  'tab.upgrades': 'Upgrades',
  'tab.regions': 'Regions',
  'tab.missions': 'Missions',
  'tab.achievements': 'Achievements',
  'tab.ranking': 'Ranking',
  'tab.premium': 'Premium',

  'toolDesc.wideBroom': 'Wide radius',
  'toolDesc.vacuum': '2.1x clean speed',
  'toolDesc.copperSickle': 'Grass-only tool',
  'toolDesc.metalSickle': 'Wider, faster grass tool',
  'toolDesc.pickaxe': 'Stone-only tool',
  'shop.vacuumTitle': 'Leaf Blower',

  'upgrade.cleanSpeed.title': 'Clean Speed',
  'upgrade.cleanSpeed.desc': 'Reduces clean time for all tools',
  'upgrade.moveSpeed.title': 'Move Speed',
  'upgrade.moveSpeed.desc': '+10% move speed',
  'upgrade.coinBonus.title': 'Coin Bonus',
  'upgrade.coinBonus.desc': '+20% coin rewards',
  'upgrade.radius.title': 'Clean Radius',
  'upgrade.radius.desc': '+8% clean radius',

  'toolDesc.neonSickle': 'Wide, fast premium grass tool',
  'toolDesc.neonPickaxe': 'Premium stone tool, usable while moving',
  'premium.coinBoost.title': 'Coin Booster',
  'premium.coinBoost.desc': '+100% coins for 30 minutes',
  'premium.robotVacuum.title': 'Robot Vacuum',
  'premium.robotVacuum.desc': 'Autonomously cleans nearby objects while owned (5s/item)',

  'region.lockedHint': 'Unlocks after the previous region',
  'region.progressLabel': '{pct}% complete',
  'region.completeTitle': '{region} cleared!{reward}',
  'region.allCompleteTitle': 'All regions cleared!{reward}',
  'region.moveTo': 'Move to {region}',
  'region.replayFrom': 'Replay from {region}',

  'ranking.myLevel': 'My Level',
  'ranking.note': 'Platform ranking will be connected after release.',

  'settings.title': 'Settings',
  'settings.language': 'Language',
  'settings.bgmVolume': 'BGM Volume',
  'settings.sfxVolume': 'SFX Volume',
  'settings.sensitivity': 'Mouse Sensitivity',
  'settings.vibration': 'Vibration',
  'settings.vibrationLabel': 'Vibrate on clean complete',
  'settings.footer': 'Settings are saved automatically',

  'rotate.title': 'Please rotate your device',
  'rotate.body': 'Yard Sweep plays best in landscape mode.',
  'rotate.fullscreenStart': '⛶ Start in fullscreen',

  'unit.coinGain': '+{n} coins',
  'unit.gemGain': '+{n} 💎',

  'notice.rotateDevice': 'Please rotate your device to landscape',
  'notice.missionClaimed': '{label} reward claimed!',
  'notice.achievementUnlocked': '{label} achieved!',
  'notice.toolLocked': '{name} is locked',
  'notice.notEnoughCoins': 'Not enough coins',
  'notice.notEnoughGems': 'Not enough gems',
  'notice.toolUnlocked': '{name} unlocked!',
  'notice.upgradeComplete': 'Upgrade complete!',
  'notice.coinBoostActivated': 'Coin Booster activated! (+100% coins for 30 min)',
  'notice.robotVacuumAcquired': 'Robot Vacuum acquired!',
};

const translations: Record<Locale, Dict> = { ko, en };

let locale: Locale = 'ko';

export function setLocale(next: Locale) {
  locale = next;
}

export function getLocale(): Locale {
  return locale;
}

export function t(key: string, vars?: Record<string, string | number>): string {
  const template = translations[locale][key] ?? translations.ko[key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name) => (name in vars ? String(vars[name]) : ''));
}
