import { GameServer } from '@agent8/gameserver';

let server: GameServer | null = null;
let connected = false;
let nickname: string | null = null;
let lastLevel = 0;
let lastExp = 0;

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
  if (!server || !connected) return '서버 연결 안됨';
  try {
    await server.remoteFunction('setNickname', [value.trim()]);
    nickname = value.trim();
    updateNicknameUI();
    return null;
  } catch (e: any) {
    return e?.message || '저장 실패';
  }
}

export async function resetAllData(): Promise<string | null> {
  if (!server || !connected) return '서버 연결 안됨';
  try {
    await server.remoteFunction('resetAllData');
    nickname = null;
    updateNicknameUI();
    return null;
  } catch (e: any) {
    return e?.message || '초기화 실패';
  }
}

export async function syncStats(level: number, exp: number) {
  if (!server || !connected) return;
  if (level === lastLevel && exp === lastExp) return;
  lastLevel = level;
  lastExp = exp;
  try {
    await server.remoteFunction('updatePlayerStats', [level, exp]);
  } catch {
    // silently fail
  }
}

export async function loadRankings() {
  const listEl = document.querySelector('#ranking-list')!;
  const myRankEl = document.querySelector('#ranking-my-rank')!;
  const loadingEl = document.querySelector('#ranking-loading')!;
  const emptyEl = document.querySelector('#ranking-empty')!;

  if (!server || !connected) {
    loadingEl.textContent = '서버에 연결되지 않았습니다.';
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
    loadingEl.textContent = '랭킹을 불러오지 못했습니다.';
  } finally {
    loadingEl.classList.add('hidden');
  }
}

function updateNicknameUI() {
  const input = document.querySelector<HTMLInputElement>('#nickname-input')!;
  const status = document.querySelector('#nickname-status')!;
  if (nickname) {
    input.value = nickname;
    status.textContent = `현재: ${nickname}`;
  } else {
    input.value = '';
    status.textContent = '닉네임을 설정하면 랭킹에 등록됩니다.';
  }
}

function escapeHTML(str: string) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
