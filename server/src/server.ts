function normalizeCollectionCount(result: unknown): number {
  if (typeof result === 'number' && Number.isFinite(result)) return result;

  // 배열이나 { items: [...] } 형태로 돌려주는 런타임도 있어 길이를 세어 받는다.
  if (Array.isArray(result)) return result.length;

  if (result && typeof result === 'object') {
    const items = (result as { items?: unknown }).items;
    if (Array.isArray(items)) return items.length;
  }

  if (result && typeof result === 'object') {
    const record = result as { count?: unknown; data?: unknown };
    const directCount = Number(record.count);
    if (Number.isFinite(directCount)) return directCount;

    const data = typeof record.data === 'function'
      ? (record.data as () => unknown)()
      : record.data;
    if (data && typeof data === 'object') {
      const nestedCount = Number((data as { count?: unknown }).count);
      if (Number.isFinite(nestedCount)) return nestedCount;
    }
  }

  throw new Error('Invalid collection count response.');
}

// ── 랭킹 규칙 ──────────────────────────────────────────────────────────────────
// 경험치는 청소한 오브젝트 1개당 1(main.ts getLevelInfo). 여러 개를 동시에 치우는 도구·로봇청소기를
// 다 써도 초당 10개를 넘기 어렵다. 오프라인으로 쌓인 몫은 시간이 지나며 따라잡도록 여유를 둔다.
const MAX_LEVEL = 9999;
const SCORE_PER_SECOND = 10;
const SCORE_BURST = 400;
const NICKNAME_MAX = 15;
const TOP_LIMIT = 20;
const RANK_SCAN_LIMIT = 100;
const rankingLockKey = (account: string) => `ranking:${account}`;

interface RankingEntry {
  __id: string;
  account: string;
  nickname: string;
  level: number;
  exp: number;
  score: number;
  updatedAt: number;
  createdAt: number;
}
interface PublicRankingEntry { nickname: string; level: number; exp: number; score: number; isMe: boolean }

export class Server {
  private ALLOWED_PRODUCTS: Record<string, (state: any, qty: number) => any> = {
    'gems-100': (state, qty) => ({ crystals: (Number(state.crystals) || 0) + 100 * qty }),
    'gems-550': (state, qty) => ({ crystals: (Number(state.crystals) || 0) + 550 * qty }),
    'gems-1200': (state, qty) => ({ crystals: (Number(state.crystals) || 0) + 1200 * qty }),
    'ad-removal': () => ({ adRemoved: true }),
  };

  async $onItemPurchased({
    account,
    purchaseId,
    productId,
    quantity,
  }: {
    account: string;
    purchaseId: number;
    productId: string;
    quantity: number;
  }): Promise<{ success: boolean }> {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return { success: false };
    }
    if (quantity > 100) {
      return { success: false };
    }

    const productHandler = this.ALLOWED_PRODUCTS[productId];
    if (!productHandler) {
      return { success: false };
    }

    const userState = await $global.getUserState(account);

    const processedPurchases: number[] = userState.vxProcessedPurchases || [];
    if (processedPurchases.includes(purchaseId)) {
      return { success: true };
    }

    const patch = productHandler(userState, quantity);

    await $global.updateUserState(account, {
      ...patch,
      vxProcessedPurchases: [...processedPurchases, purchaseId],
    });

    return { success: true };
  }

  // ── 리워드 광고 서버 검증 (docs.verse8.io/ko/docs/ads/intro) ──
  // 지급량은 반드시 이 테이블에서만 나온다. 클라이언트나 verifier 응답의 값을 쓰지 않는다.
  // region-double-reward의 코인/보석 2배는 지역 완료 자체가 클라이언트 판정이라
  // 서버가 액수를 알 수 없다. 여기서는 "광고를 실제로 봤는가"만 검증하고(gems: 0),
  // 배수 적용은 클라이언트가 한다.
  private AD_PLACEMENTS: Record<string, { gems: number }> = {
    'gem-reward-30': { gems: 30 },
    'region-double-reward': { gems: 0 },
  };

  private async isAdVerified(requestId: string, attempts = 4): Promise<boolean> {
    for (let i = 0; i < attempts; i++) {
      let res: Response;
      try {
        res = await fetch(
          `https://ads-verifier.verse8.io/ads/status?requestId=${encodeURIComponent(requestId)}`,
        );
      } catch {
        return false;
      }
      if (!res.ok && res.status !== 202) return false;
      const body = await res.json() as { status?: string };
      if (body.status === 'verified') return true;
      if (body.status === 'pending') {
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      return false; // dismissed | failed
    }
    return false; // 재시도 예산 소진
  }

  async claimAdReward(
    placementId: string,
    requestId: string,
  ): Promise<{ granted: boolean; gems: number; reason?: string }> {
    if (typeof requestId !== 'string' || !requestId) {
      return { granted: false, gems: 0, reason: 'missing_requestId' };
    }
    const reward = this.AD_PLACEMENTS[placementId];
    if (!reward) {
      return { granted: false, gems: 0, reason: 'unknown_placement' };
    }

    // 이미 지급된 requestId면 광고 검증을 다시 호출하지 않고 즉시 차단.
    const state = await $global.getMyState();
    const claimed: string[] = state.adClaimedRequests || [];
    if (claimed.includes(requestId)) {
      return { granted: false, gems: 0, reason: 'already_granted' };
    }
    if (placementId === 'gem-reward-30') {
      const cooldown = 30 * 60 * 1000;
      const retryAfterMs = cooldown - (Date.now() - (Number(state.lastGemRewardAt) || 0));
      if (retryAfterMs > 0) {
        return { granted: false, gems: 0, reason: 'cooldown' };
      }
    }

    if (!(await this.isAdVerified(requestId))) {
      return { granted: false, gems: 0, reason: 'verification_failed' };
    }

    // 검증 대기 중 다른 요청이 먼저 지급했을 수 있으므로 상태를 다시 읽는다.
    const fresh = await $global.getMyState();
    const freshClaimed: string[] = fresh.adClaimedRequests || [];
    if (freshClaimed.includes(requestId)) {
      return { granted: false, gems: 0, reason: 'already_granted' };
    }

    const crystals = (Number(fresh.crystals) || 0) + reward.gems;
    // 무한 증가를 막기 위해 최근 200건만 보관한다.
    const nextClaimed = [...freshClaimed, requestId].slice(-200);
    await $global.updateMyState({
      crystals,
      adClaimedRequests: nextClaimed,
      ...(placementId === 'gem-reward-30' ? { lastGemRewardAt: Date.now() } : {}),
    });

    return { granted: true, gems: reward.gems };
  }

  async claimAdFreeGemReward(): Promise<{
    granted: boolean;
    gems: number;
    retryAfterMs?: number;
    reason?: string;
  }> {
    const state = await $global.getMyState();
    if (!state.adRemoved) {
      return { granted: false, gems: 0, reason: 'ad_removal_required' };
    }

    const cooldown = 30 * 60 * 1000;
    const now = Date.now();
    const lastClaimedAt = Number(state.lastGemRewardAt) || 0;
    const retryAfterMs = cooldown - (now - lastClaimedAt);
    if (retryAfterMs > 0) {
      return { granted: false, gems: 0, retryAfterMs, reason: 'cooldown' };
    }

    const gems = 30;
    const crystals = (Number(state.crystals) || 0) + gems;
    await $global.updateMyState({ crystals, lastGemRewardAt: now });
    return { granted: true, gems };
  }

  async getVxState(): Promise<{ crystals: number; adRemoved: boolean }> {
    const state = await $global.getMyState();
    return {
      crystals: Number(state.crystals) || 0,
      adRemoved: Boolean(state.adRemoved),
    };
  }

  async syncVxState(clientGems: number, clientAdRemoved: boolean): Promise<{ gems: number; adsRemoved: boolean }> {
    const serverState = await $global.getMyState();
    const serverCrystals = Number(serverState.crystals) || 0;
    const serverAdRemoved = Boolean(serverState.adRemoved);
    return {
      gems: Math.max(clientGems, serverCrystals),
      adsRemoved: clientAdRemoved || serverAdRemoved,
    };
  }

  async ping(): Promise<string> {
    return 'pong';
  }

  async getMyAccount(): Promise<string> {
    return $sender.account;
  }

  async setNickname(nickname: string): Promise<string> {
    // 공백만 넣은 이름이 빈 이름으로 저장되지 않도록 다듬은 뒤에 길이를 잰다.
    const trimmed = typeof nickname === 'string' ? nickname.trim() : '';
    if (trimmed.length < 1 || trimmed.length > NICKNAME_MAX) {
      throw new Error(`Nickname must be between 1 and ${NICKNAME_MAX} characters.`);
    }
    const state = await $global.getMyState();
    // 첫 등록 점수 상한(updatePlayerStats)의 기준 시각. 이름을 바꿔도 처음 값을 유지한다.
    await $global.updateMyState({ nickname: trimmed, rankingSince: Number(state.rankingSince) || Date.now() });
    // 랭킹 행의 이름도 바로 바꾼다. 예전엔 다음 레벨업(오브젝트 100개)까지 옛 이름이 남았다.
    await $lock(rankingLockKey($sender.account), async () => {
      const rows = await this.myRankingRows();
      for (const row of rows) {
        await $global.updateCollectionItem('rankings', { ...row, nickname: trimmed });
      }
    });
    return trimmed;
  }

  async getMyNickname(): Promise<string | null> {
    const state = await $global.getMyState();
    return state.nickname || null;
  }

  // 랭킹 점수 등록. 클라이언트가 보낸 값은 믿지 않는다:
  //  - level/exp는 정수, level 1~MAX_LEVEL, exp 0~99만 받는다.
  //  - 점수는 직전 기록 시점부터 흐른 시간만큼만 오를 수 있다(SCORE_PER_SECOND, 여유 SCORE_BURST).
  //    더 높게 보내면 거절하지 않고 허용치까지만 올린다. 정상 플레이어는 다음 전송 때 따라잡는다.
  //  - 읽고-비교하고-쓰는 구간을 $lock으로 묶어, 두 탭/기기가 동시에 보내도 행이 하나만 생긴다.
  async updatePlayerStats(level: number, exp: number): Promise<RankingEntry> {
    if (!Number.isInteger(level) || level < 1 || level > MAX_LEVEL) {
      throw new Error(`Level must be an integer between 1 and ${MAX_LEVEL}.`);
    }
    if (!Number.isInteger(exp) || exp < 0 || exp >= 100) {
      throw new Error('Exp must be an integer between 0 and 99.');
    }
    const myState = await $global.getMyState();
    const nickname = myState.nickname;
    if (!nickname) {
      throw new Error('Please set your nickname first.');
    }
    const account = $sender.account;
    return $lock(rankingLockKey(account), async () => {
      const now = Date.now();
      const rows = await this.myRankingRows();
      // 예전 버그(잠금 없음)로 생긴 중복 행은 최고 점수 하나만 남기고 지운다.
      rows.sort((x, y) => (Number(y.score) || 0) - (Number(x.score) || 0));
      const existing = rows[0];
      for (const duplicate of rows.slice(1)) await $global.deleteCollectionItem('rankings', duplicate.__id);

      const claimed = (level - 1) * 100 + exp;
      const previousScore = existing ? Number(existing.score) || 0 : 0;
      // 첫 등록은 닉네임을 정한 시점부터 잰다(기록이 없으면 지금 → 허용치는 SCORE_BURST).
      const since = existing ? Number(existing.updatedAt) || now : Number(myState.rankingSince) || now;
      const allowed = previousScore + SCORE_BURST + (Math.max(0, now - since) / 1000) * SCORE_PER_SECOND;
      // 오래된 클라이언트가 더 낮은 점수를 보내도 최고 기록은 유지한다.
      const score = Math.max(previousScore, Math.min(claimed, Math.floor(allowed)));
      const entry: RankingEntry = {
        __id: existing?.__id ?? account,
        account,
        nickname,
        level: Math.floor(score / 100) + 1,
        exp: score % 100,
        score,
        updatedAt: now,
        createdAt: Number(existing?.createdAt) || now,
      };
      if (existing) {
        await $global.updateCollectionItem('rankings', entry);
      } else {
        // __id를 계정으로 고정해 실서버(1.x)에서는 같은 계정이 행 하나로 upsert된다.
        const created = await $global.addCollectionItem('rankings', entry);
        entry.__id = (created as { __id?: string } | null)?.__id ?? entry.__id;
      }
      return entry;
    });
  }

  private async myRankingRows(): Promise<RankingEntry[]> {
    const rows = await $global.getCollectionItems('rankings', {
      filters: [{ field: 'account', operator: '==', value: $sender.account }],
    });
    return Array.isArray(rows) ? (rows as RankingEntry[]) : [];
  }

  // 게임 진행 세이브를 계정 상태($global.getMyState)에 통째로 저장한다.
  // 충돌 해결은 클라이언트가 세이브 안의 savedAt(밀리초)을 비교해서 처리.
  async saveGameData(data: Record<string, unknown>): Promise<{ savedAt: number }> {
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      throw new Error('Invalid save data.');
    }
    const json = JSON.stringify(data);
    if (json.length > 200000) {
      throw new Error('Save data too large.');
    }
    const savedAt = typeof data.savedAt === 'number' ? data.savedAt : Date.now();
    await $global.updateMyState({ gameSave: json, gameSaveAt: savedAt });
    return { savedAt };
  }

  async loadGameData(): Promise<{ data: Record<string, unknown> | null; savedAt: number }> {
    const state = await $global.getMyState();
    if (!state.gameSave) {
      return { data: null, savedAt: 0 };
    }
    try {
      return { data: JSON.parse(state.gameSave), savedAt: state.gameSaveAt || 0 };
    } catch {
      return { data: null, savedAt: 0 };
    }
  }

  async resetAllData(): Promise<{ success: boolean }> {
    const myRankings = await $global.getCollectionItems('rankings', {
      filters: [{ field: 'account', operator: '==', value: $sender.account }],
    });
    for (const entry of myRankings) {
      await $global.deleteCollectionItem('rankings', entry.__id);
    }
    await $global.updateMyState({ nickname: null, rankingSince: null, gameSave: null, gameSaveAt: null, crystals: null, adRemoved: null, vxProcessedPurchases: null, adClaimedRequests: null, lastGemRewardAt: null });
    return { success: true };
  }

  // 나보다 점수가 높은 행 수. countCollectionItems 응답 형태가 런타임마다 달라 파싱이 실패할 때가 있어
  // ("Invalid collection count response."), 그때는 상위 100행을 받아 직접 센다.
  // getCollectionItems는 한 번에 최대 100행이라, 100위 밖이면 정확한 순위 대신 "100위 밖"으로 알린다.
  private async countHigherScores(myScore: number): Promise<{ higher: number; lowerBound: boolean }> {
    try {
      const count = normalizeCollectionCount(
        await $global.countCollectionItems('rankings', { filters: [{ field: 'score', operator: '>', value: myScore }] }),
      );
      return { higher: count, lowerBound: false };
    } catch {
      const top = await $global.getCollectionItems('rankings', {
        orderBy: [{ field: 'score', direction: 'desc' }],
        limit: RANK_SCAN_LIMIT,
      });
      const list = Array.isArray(top) ? top : [];
      const higher = list.filter((row: any) => (Number(row.score) || 0) > myScore).length;
      return { higher, lowerBound: higher >= RANK_SCAN_LIMIT };
    }
  }

  // 공개 목록에는 다른 플레이어의 계정 ID를 싣지 않는다. 내 행인지는 isMe로만 알린다.
  async getTopRankings(): Promise<PublicRankingEntry[]> {
    const rows = await $global.getCollectionItems('rankings', {
      orderBy: [{ field: 'score', direction: 'desc' }],
      limit: TOP_LIMIT,
    });
    return (Array.isArray(rows) ? rows : []).map((row: any) => ({
      nickname: String(row.nickname ?? ''),
      level: Number(row.level) || 1,
      exp: Number(row.exp) || 0,
      score: Number(row.score) || 0,
      isMe: row.account === $sender.account,
    }));
  }

  // 순위 = 나보다 점수가 높은 사람 수 + 1(동점은 같은 순위). 클라이언트 목록도 같은 규칙으로 매긴다.
  async getMyRank(): Promise<{ entry: RankingEntry | null; rank: number; rankIsLowerBound?: boolean }> {
    const rows = await this.myRankingRows();
    if (rows.length === 0) {
      return { entry: null, rank: -1 };
    }
    const myEntry = rows.reduce((best, row) => ((Number(row.score) || 0) > (Number(best.score) || 0) ? row : best));
    const myScore = Number(myEntry.score) || 0;
    const { higher, lowerBound } = await this.countHigherScores(myScore);
    return { entry: myEntry, rank: higher + 1, rankIsLowerBound: lowerBound };
  }
}
