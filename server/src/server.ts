function normalizeCollectionCount(result: unknown): number {
  if (typeof result === 'number' && Number.isFinite(result)) return result;

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
    if (typeof nickname !== 'string' || nickname.length < 1 || nickname.length > 15) {
      throw new Error('Nickname must be between 1 and 15 characters.');
    }
    await $global.updateMyState({ nickname: nickname.trim() });
    return nickname.trim();
  }

  async getMyNickname(): Promise<string | null> {
    const state = await $global.getMyState();
    return state.nickname || null;
  }

  async updatePlayerStats(
    level: number,
    exp: number,
  ): Promise<{ __id: string; account: string; nickname: string; level: number; exp: number; score: number }> {
    const myState = await $global.getMyState();
    const nickname = myState.nickname;
    if (!nickname) {
      throw new Error('Please set your nickname first.');
    }
    if (typeof level !== 'number' || level < 1) {
      throw new Error('Level must be at least 1.');
    }
    if (typeof exp !== 'number' || exp < 0 || exp >= 100) {
      throw new Error('Exp must be between 0 and 99.');
    }

    const score = (level - 1) * 100 + exp;

    const existingEntries = await $global.getCollectionItems('rankings', {
      filters: [{ field: 'account', operator: '==', value: $sender.account }],
    });

    const entry = {
      account: $sender.account,
      nickname,
      level,
      exp,
      score,
      updatedAt: Date.now(),
    };

    if (existingEntries.length > 0) {
      const existing = existingEntries[0];
      // A stale client must not overwrite a player's higher leaderboard score.
      const bestEntry = Number(existing.score) > score
        ? { level: existing.level, exp: existing.exp, score: existing.score }
        : { level, exp, score };
      const updated = await $global.updateCollectionItem(
        'rankings',
        { ...entry, ...bestEntry, __id: existing.__id },
      );
      return updated as any;
    } else {
      const created = await $global.addCollectionItem('rankings', {
        ...entry,
        createdAt: Date.now(),
      });
      return created as any;
    }
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
    await $global.updateMyState({ nickname: null, gameSave: null, gameSaveAt: null, crystals: null, adRemoved: null, vxProcessedPurchases: null, adClaimedRequests: null, lastGemRewardAt: null });
    return { success: true };
  }

  async getTopRankings(): Promise<any[]> {
    return await $global.getCollectionItems('rankings', {
      orderBy: [{ field: 'score', direction: 'desc' }],
      limit: 20,
    });
  }

  async getMyRank(): Promise<{
    entry: any | null;
    rank: number;
  }> {
    const myEntries = await $global.getCollectionItems('rankings', {
      filters: [{ field: 'account', operator: '==', value: $sender.account }],
    });

    if (myEntries.length === 0) {
      return { entry: null, rank: -1 };
    }

    const myEntry = myEntries[0];

    const [higherLevelCount, higherExpAtSameLevelCount] = await Promise.all([
      $global.countCollectionItems('rankings', {
        filters: [{ field: 'level', operator: '>', value: myEntry.level }],
      }),
      $global.countCollectionItems('rankings', {
        filters: [
          { field: 'level', operator: '==', value: myEntry.level },
          { field: 'exp', operator: '>', value: myEntry.exp },
        ],
      }),
    ]);
    const rank = normalizeCollectionCount(higherLevelCount)
      + normalizeCollectionCount(higherExpAtSameLevelCount)
      + 1;
    return { entry: myEntry, rank };
  }
}
