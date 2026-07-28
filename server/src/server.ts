export class Server {
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
    const userState = await $global.getUserState(account);
    let save: Record<string, any> = {};
    try { save = JSON.parse(userState.gameSave || '{}'); } catch { /* keep {} */ }

    switch (productId) {
      case 'gems-100':
        save.gems = (Number(save.gems) || 0) + 100 * quantity;
        break;
      case 'gems-550':
        save.gems = (Number(save.gems) || 0) + 550 * quantity;
        break;
      case 'gems-1200':
        save.gems = (Number(save.gems) || 0) + 1200 * quantity;
        break;
      case 'ad-removal':
        save.adsRemoved = true;
        break;
      case 'test-free':
        save.gems = (Number(save.gems) || 0) + 1 * quantity;
        break;
      default:
        throw new Error(`Unknown product: ${productId}`);
    }

    save.savedAt = Date.now();
    await $global.updateUserState(account, {
      gameSave: JSON.stringify(save),
      gameSaveAt: save.savedAt,
    });

    return { success: true };
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
  ): Promise<{ __id: string; account: string; nickname: string; level: number; exp: number }> {
    const myState = await $global.getMyState();
    const nickname = myState.nickname;
    if (!nickname) {
      throw new Error('Please set your nickname first.');
    }
    if (typeof level !== 'number' || level < 1) {
      throw new Error('Level must be at least 1.');
    }
    if (typeof exp !== 'number' || exp < 0) {
      throw new Error('Exp must be 0 or greater.');
    }

    const existingEntries = await $global.getCollectionItems('rankings', {
      filters: [{ field: 'account', operator: '==', value: $sender.account }],
    });

    const entry = {
      account: $sender.account,
      nickname,
      level,
      exp,
      updatedAt: Date.now(),
    };

    if (existingEntries.length > 0) {
      const updated = await $global.updateCollectionItem(
        'rankings',
        { ...entry, __id: existingEntries[0].__id },
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
    await $global.deleteCollection('rankings');
    await $global.updateMyState({ nickname: null, gameSave: null, gameSaveAt: null });
    return { success: true };
  }

  async getTopRankings(): Promise<any[]> {
    const items = await $global.getCollectionItems('rankings', {
      orderBy: [{ field: 'level', direction: 'desc' }],
      limit: 100,
    });

    const sorted = items.sort((a: any, b: any) => {
      if (b.level !== a.level) return b.level - a.level;
      return b.exp - a.exp;
    });

    return sorted.slice(0, 20);
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

    const allItems = await $global.getCollectionItems('rankings', {
      orderBy: [{ field: 'level', direction: 'desc' }],
      limit: 500,
    });

    const sorted = allItems.sort((a: any, b: any) => {
      if (b.level !== a.level) return b.level - a.level;
      return b.exp - a.exp;
    });

    const rank = sorted.findIndex((item: any) => item.__id === myEntry.__id) + 1;

    return { entry: myEntry, rank };
  }
}
