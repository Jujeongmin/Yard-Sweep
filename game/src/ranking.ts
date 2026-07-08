import { GameServer } from '@agent8/gameserver';
import { t } from './i18n';

let server: GameServer | null = null;
let connected = false;
let nickname: string | null = null;
let lastSyncTime = 0;
let pendingLevel = 0;
let pendingExp = 0;
let syncTimer: ReturnType<typeof setTimeout> | null = null;

export async function initRanking() {
  try {
    server = GameServer.getInstance();
    connected = await server.connect();
    if (connected) {
      const nick = await server.remoteFunction('getMyNickname');
      nickname = (nick as string) || null;
      updateNicknameUI();
    }
  } catch {
    connected = false;
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
    return null;
  } catch (e: any) {
    return e?.message || t('settings.nicknameFail');
  }
}

export async function resetAllData(): Promise<string | null> {
  if (!server || !connected) return t('ranking.serverNotConnected');
  try {
    await server.remoteFunction('resetAllData');
    nickname = null;
    updateNicknameUI();
    return null;
  } catch (e: any) {
    return e?.message || 'Reset failed';
  }
}

export async function syncStats(level: number, exp: number) {
  if (!server || !connected) return;
  pendingLevel = level;
  pendingExp = exp;
  const now = Date.now();
  if (now - lastSyncTime >= 600000) {
    lastSyncTime = now;
    server.remoteFunction('updatePlayerStats', [level, exp]).catch(() => {});
    if (syncTimer) { clearTimeout(syncTimer); syncTimer = null; }
  } else if (!syncTimer) {
    syncTimer = setTimeout(() => {
      lastSyncTime = Date.now();
      server!.remoteFunction('updatePlayerStats', [pendingLevel, pendingExp]).catch(() => {});
      syncTimer = null;
    }, 600000 - (now - lastSyncTime));
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
      myRankEl.textContent = `#${myRank.rank} · Lv.${myRank.entry.level} · ${myRank.entry.exp.toLocaleString()} XP`;
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
              <p>Lv.${entry.level} · ${entry.exp.toLocaleString()} XP</p>
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
