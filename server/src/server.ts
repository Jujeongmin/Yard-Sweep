export class Server {
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

  async resetAllData(): Promise<{ success: boolean }> {
    await $global.deleteCollection('rankings');
    await $global.updateMyState({ nickname: null });
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
