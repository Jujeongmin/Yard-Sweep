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

// 접속 시도가 끝났다는 신호. 랭킹 탭을 접속 완료 전에 열어도 곧바로 "서버 미연결"을
// 띄우지 않고 이걸 기다렸다가 판단한다.
let resolveConnectAttempt: () => void = () => {};
const connectAttempted = new Promise<void>((resolve) => { resolveConnectAttempt = resolve; });

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
  } finally {
    resolveConnectAttempt();
    // 접속 전에 쌓인 점수가 있으면 지금 올린다. 예전엔 syncStats()가 미연결이면
    // 조용히 버려서, 게임 시작 직후의 첫 보고가 늘 사라졌다.
    void flushPendingStats();
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
  // 미연결이어도 버리지 않고 대기열에 넣는다 — 접속이 끝나면 initRanking()이 흘려보낸다.
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
  } catch (e: any) {
    // 닉네임이 없어서 거절당한 거라면 재시도해봐야 똑같이 거절당한다.
    // 값은 대기열에 남겨두고, setNickname()이 등록 직후 직접 흘려보낸다.
    const reason = String(e?.message ?? '');
    if (!/nickname/i.test(reason)) {
      // Keep the latest score pending and retry instead of silently losing it.
      scheduleStatsSync(30000);
    }
  } finally {
    syncInFlight = false;
    // 전송 중에 레벨이 또 올라 값이 갱신됐다면 곧바로 한 번 더 보낸다.
    if (hasPendingStats && !syncTimer) scheduleStatsSync(0);
  }
}

// ── 랭킹 캐시 ──
// 로비에서 미리 받아두고, 탭을 열면 캐시를 즉시 그린다(로딩 표시 없음).
// 그린 뒤 백그라운드로 다시 받아 조용히 최신값으로 바꾼다(stale-while-revalidate).
interface RankingSnapshot {
  top: any[];
  mine: { entry: any | null; rank: number };
}
let rankingCache: RankingSnapshot | null = null;
let rankingFetchInFlight: Promise<RankingSnapshot | null> | null = null;

async function fetchRankings(): Promise<RankingSnapshot | null> {
  if (!server || !connected) return null;
  // 동시에 여러 번 부르면 요청이 겹치므로 진행 중인 것을 재사용한다.
  if (rankingFetchInFlight) return rankingFetchInFlight;
  rankingFetchInFlight = (async () => {
    try {
      // 둘을 Promise.all로 묶으면 한쪽만 실패해도 전체가 무너져 목록이 통째로
      // 안 떴다. 실제로 서버의 getMyRank가 던지는 동안 상위 목록까지 사라졌다.
      const [topResult, mineResult] = await Promise.allSettled([
        server!.remoteFunction('getTopRankings'),
        server!.remoteFunction('getMyRank'),
      ]);
      const top = topResult.status === 'fulfilled' ? (topResult.value as any[]) : null;
      const mine = mineResult.status === 'fulfilled'
        ? (mineResult.value as { entry: any | null; rank: number })
        : { entry: null, rank: -1 };
      // 상위 목록마저 못 받았으면 캐시를 건드리지 않고 실패로 처리한다.
      if (!top) return null;
      const snapshot: RankingSnapshot = { top, mine };
      rankingCache = snapshot;
      return snapshot;
    } catch {
      return null;
    } finally {
      rankingFetchInFlight = null;
    }
  })();
  return rankingFetchInFlight;
}

/** 로비/초기화 단계에서 미리 받아둔다. 실패해도 조용히 넘어간다. */
export function prefetchRankings() {
  void fetchRankings().then((snapshot) => {
    // 탭이 닫혀 있어도 미리 그려둔다. 그래야 "내 순위" 칸이 탭을 한 번도 열지 않은
    // 상태에서도 채워져 있고, 탭을 열었을 때 깜빡임 없이 곧바로 보인다.
    if (snapshot) renderRankings(snapshot);
  });
}

function renderRankings(snapshot: RankingSnapshot) {
  const listEl = document.querySelector('#ranking-list')!;
  const myRankEl = document.querySelector('#ranking-my-rank')!;
  const emptyEl = document.querySelector('#ranking-empty')!;
  // 프리페치가 먼저 그린 경우에도 로딩 문구가 남지 않도록 여기서 걷는다.
  document.querySelector('#ranking-loading')!.classList.add('hidden');

  const { top: topRanks, mine: myRank } = snapshot;

  // getMyRank가 실패했더라도 상위 목록 안에 내가 있으면 거기서 순위를 읽어 채운다.
  const myAccount = server?.account;
  const fallbackIndex = myAccount ? topRanks.findIndex((e) => e.account === myAccount) : -1;
  const entry = myRank.entry ?? (fallbackIndex >= 0 ? topRanks[fallbackIndex] : null);
  const rank = myRank.entry ? myRank.rank : fallbackIndex + 1;

  myRankEl.textContent = entry
    ? `#${rank} · Lv.${entry.level} · ${Number(entry.exp).toLocaleString()}/100 XP`
    : '-';

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

  emptyEl.classList.toggle('hidden', topRanks.length > 0);
}

export async function loadRankings() {
  const loadingEl = document.querySelector('#ranking-loading')!;
  const emptyEl = document.querySelector('#ranking-empty')!;

  // 아직 접속 시도가 끝나지 않았으면 기다린다. 예전에는 여기서 곧바로 "서버 미연결"을
  // 띄웠고, 접속이 나중에 성공해도 그 문구가 그대로 남아 탭을 다시 열기 전까지
  // 랭킹이 안 뜨는 것처럼 보였다. 로딩이 오래 걸리는 기기에서 특히 잦았다.
  if (!connected) {
    loadingEl.classList.remove('hidden');
    loadingEl.textContent = t('ranking.loading');
    emptyEl.classList.add('hidden');
    await connectAttempted;
  }

  if (!server || !connected) {
    loadingEl.classList.remove('hidden');
    loadingEl.textContent = t('ranking.noConnection');
    return;
  }

  // 캐시가 있으면 기다리지 않고 바로 보여준 뒤, 뒤에서 새로 받아 조용히 교체한다.
  if (rankingCache) {
    loadingEl.classList.add('hidden');
    renderRankings(rankingCache);
    void fetchRankings().then((fresh) => {
      // 사용자가 탭을 떠났어도 DOM만 갱신하는 것이라 부작용은 없다.
      if (fresh) renderRankings(fresh);
    });
    return;
  }

  // 캐시가 없을 때만 로딩 표시를 띄운다(첫 진입/프리페치 실패).
  loadingEl.classList.remove('hidden');
  loadingEl.textContent = t('ranking.loading');
  emptyEl.classList.add('hidden');
  const snapshot = await fetchRankings();
  if (snapshot) {
    renderRankings(snapshot);
    loadingEl.classList.add('hidden');
  } else {
    // 실패 문구는 남겨둔다. 예전엔 finally가 곧바로 숨겨서 빈 화면만 보였다.
    loadingEl.textContent = t('ranking.loadError');
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
