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
    await $global.updateMyState({ nickname: null, gameSave: null, gameSaveAt: null, crystals: null, adRemoved: null, vxProcessedPurchases: null });
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
