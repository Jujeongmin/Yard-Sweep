import { GameServer } from '@agent8/gameserver';
import { init as initVxShopApi, buyItem, getItem, refresh, onClose } from '@verse8/platform';
import { t } from './i18n';

let server: GameServer | null = null;
let connected = false;
let nickname: string | null = null;
let pendingLevel = 0;
let pendingExp = 0;
let hasPendingStats = false;
let syncInFlight = false;
let syncTimer: ReturnType<typeof setTimeout> | null = null;
let vxShopReady = false;

export async function initRanking() {
  try {
    server = GameServer.getInstance();
    connected = await server.connect();
    if (connected) {
      const nick = await server.remoteFunction('getMyNickname');
      nickname = (nick as string) || null;
      updateNicknameUI();
      initVxShop();
    }
  } catch {
    connected = false;
  }
}

function initVxShop() {
  if (!server || !connected) return;
  try {
    initVxShopApi({ account: server.account, autoRefresh: true });
    vxShopReady = true;
  } catch {
    vxShopReady = false;
  }
}

export { buyItem, getItem, refresh, onClose };
export function isVxShopReady() { return vxShopReady; }

export async function fetchVxServerState(): Promise<{ crystals: number; adRemoved: boolean } | null> {
  if (!server || !connected) return null;
  try {
    return await server.remoteFunction('getVxState') as { crystals: number; adRemoved: boolean };
  } catch {
    return null;
  }
}

// 리워드 광고 서버 검증. 지급 여부·지급량은 전적으로 서버가 정한다.
// 서버 미연결이면 granted:false — 검증 없이 지급하지 않는다.
export async function claimAdReward(
  placementId: string,
  requestId: string,
): Promise<{ granted: boolean; gems: number; reason?: string }> {
  if (!server || !connected) return { granted: false, gems: 0, reason: 'not_connected' };
  try {
    return await server.remoteFunction('claimAdReward', [placementId, requestId]) as
      { granted: boolean; gems: number; reason?: string };
  } catch (e: any) {
    return { granted: false, gems: 0, reason: e?.message || 'error' };
  }
}

export async function claimAdFreeGemReward(): Promise<{
  granted: boolean;
  gems: number;
  retryAfterMs?: number;
  reason?: string;
}> {
  if (!server || !connected) return { granted: false, gems: 0, reason: 'not_connected' };
  try {
    return await server.remoteFunction('claimAdFreeGemReward') as {
      granted: boolean;
      gems: number;
      retryAfterMs?: number;
      reason?: string;
    };
  } catch (e: any) {
    return { granted: false, gems: 0, reason: e?.message || 'error' };
  }
}

export function isConnected() {
  return connected;
}

export function getNickname() {
  return nickname;
}

export async function setNickname(value: string) {
  if (!server || !connected) return t('ranking.serverNotConnected');
  try {
    await server.remoteFunction('setNickname', [value.trim()]);
    nickname = value.trim();
    updateNicknameUI();
    // 닉네임이 없어서 서버가 거절했던 점수가 남아 있으면 지금 바로 올린다.
    if (syncTimer) { clearTimeout(syncTimer); syncTimer = null; }
    await flushPendingStats();
    return null;
  } catch (e: any) {
    return e?.message || t('settings.nicknameFail');
  }
}

export async function resetAllData(): Promise<string | null> {
  if (!server || !connected) return t('ranking.serverNotConnected');
  try {
    // 초기화 직후 디바운스 타이머가 옛 세이브를 다시 올리지 않도록 먼저 취소
    pendingCloudSave = null;
    if (cloudSaveTimer) { clearTimeout(cloudSaveTimer); cloudSaveTimer = null; }
    await server.remoteFunction('resetAllData');
    nickname = null;
    updateNicknameUI();
    return null;
  } catch (e: any) {
    return e?.message || 'Reset failed';
  }
}

// ── 클라우드 세이브: 게임 진행 전체를 계정 상태(서버)에 저장해 다른 기기에서 이어하기 ──
const CLOUD_SAVE_DEBOUNCE = 5000;
let cloudSaveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingCloudSave: Record<string, unknown> | null = null;

export function scheduleCloudSave(data: Record<string, unknown>) {
  pendingCloudSave = data;
  if (!server || !connected || cloudSaveTimer) return;
  cloudSaveTimer = setTimeout(() => {
    cloudSaveTimer = null;
    flushCloudSave();
  }, CLOUD_SAVE_DEBOUNCE);
}

export function flushCloudSave() {
  if (cloudSaveTimer) { clearTimeout(cloudSaveTimer); cloudSaveTimer = null; }
  if (!server || !connected || !pendingCloudSave) return;
  const payload = pendingCloudSave;
  pendingCloudSave = null;
  server.remoteFunction('saveGameData', [payload]).catch(() => {});
}

export async function loadCloudSave(): Promise<Record<string, unknown> | null> {
  if (!server || !connected) return null;
  try {
    const result = (await server.remoteFunction('loadGameData')) as { data: Record<string, unknown> | null };
    return result?.data ?? null;
  } catch {
    return null;
  }
}

// 호출부(main.ts)가 레벨이 바뀔 때만 부르므로 스로틀 없이 바로 보낸다.
// 레벨업은 오브젝트 100개당 1회라 호출 빈도가 낮고, 즉시 보내야 랭킹이 곧바로 갱신된다.
export async function syncStats(level: number, exp: number) {
  if (!server || !connected) return;
  pendingLevel = level;
  pendingExp = exp;
  hasPendingStats = true;
  await flushPendingStats();
}

function scheduleStatsSync(delay: number) {
  if (syncTimer) return;
  syncTimer = setTimeout(() => {
    syncTimer = null;
    void flushPendingStats();
  }, delay);
}

async function flushPendingStats() {
  if (!server || !connected || !hasPendingStats || syncInFlight) return;
  syncInFlight = true;
  const level = pendingLevel;
  const exp = pendingExp;
  try {
    await server.remoteFunction('updatePlayerStats', [level, exp]);
    if (pendingLevel === level && pendingExp === exp) hasPendingStats = false;
  } catch {
    // Keep the latest score pending and retry instead of silently losing it.
    scheduleStatsSync(30000);
  } finally {
    syncInFlight = false;
    // 전송 중에 레벨이 또 올라 값이 갱신됐다면 곧바로 한 번 더 보낸다.
    if (hasPendingStats && !syncTimer) scheduleStatsSync(0);
  }
}

export async function loadRankings() {
  const listEl = document.querySelector('#ranking-list')!;
  const myRankEl = document.querySelector('#ranking-my-rank')!;
  const loadingEl = document.querySelector('#ranking-loading')!;
  const emptyEl = document.querySelector('#ranking-empty')!;

  if (!server || !connected) {
    loadingEl.textContent = t('ranking.noConnection');
    return;
  }

  loadingEl.classList.remove('hidden');
  emptyEl.classList.add('hidden');

  try {
    const [top, mine] = await Promise.all([
      server.remoteFunction('getTopRankings'),
      server.remoteFunction('getMyRank'),
    ]);

    const topRanks = top as any[];
    const myRank = mine as { entry: any | null; rank: number };

    if (myRank.entry) {
      myRankEl.textContent = `#${myRank.rank} · Lv.${myRank.entry.level} · ${myRank.entry.exp.toLocaleString()}/100 XP`;
    } else {
      myRankEl.textContent = '-';
    }

    listEl.innerHTML = topRanks
      .map(
        (entry, i) =>
          `<article class="ranking-row${entry.account === server?.account ? ' me' : ''}">
            <span class="ranking-rank">#${i + 1}</span>
            <div>
              <h3>${escapeHTML(entry.nickname)}</h3>
              <p>Lv.${entry.level} · ${entry.exp.toLocaleString()}/100 XP</p>
            </div>
          </article>`,
      )
      .join('');

    if (topRanks.length === 0) {
      emptyEl.classList.remove('hidden');
    }
  } catch {
    loadingEl.textContent = t('ranking.loadError');
  } finally {
    loadingEl.classList.add('hidden');
  }
}

function updateNicknameUI() {
  const input = document.querySelector<HTMLInputElement>('#nickname-input')!;
  const status = document.querySelector('#nickname-status')!;
  if (nickname) {
    input.value = nickname;
    status.textContent = `${nickname}`;
  } else {
    input.value = '';
    status.textContent = t('settings.nicknameHint');
  }
}

function escapeHTML(str: string) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
