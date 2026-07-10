describe('Server', () => {
  test('ping returns pong', async (server) => {
    const result = await server.ping();
    expect(result).toBe('pong');
  });

  test('getMyAccount returns account', async (server) => {
    const result = await server.getMyAccount();
    expect(result).toBeTruthy();
  });

  test('connect changes user', async (server) => {
    server.connect({ account: 'user-alice' });
    const account = await server.getMyAccount();
    expect(account).toBe('user-alice');
  });

  test('setNickname stores and getMyNickname retrieves', async (server) => {
    server.connect({ account: 'player1' });
    await server.setNickname('Hero');
    const nick = await server.getMyNickname();
    expect(nick).toBe('Hero');
  });

  test('setNickname rejects empty string', async (server) => {
    server.connect({ account: 'player1' });
    let error: any = null;
    try {
      await server.setNickname('');
    } catch (e: any) {
      error = e;
    }
    expect(error).toBeTruthy();
  });

  test('setNickname rejects too long string', async (server) => {
    server.connect({ account: 'player1' });
    let error: any = null;
    try {
      await server.setNickname('abcdefghijklmnopqrstuvwxyz');
    } catch (e: any) {
      error = e;
    }
    expect(error).toBeTruthy();
  });

  test('getMyNickname returns null when not set', async (server) => {
    server.connect({ account: 'fresh' });
    const nick = await server.getMyNickname();
    expect(nick).toBeNull();
  });

  describe('GameSave', () => {
    test('loadGameData returns null when nothing saved', async (server) => {
      server.connect({ account: 'save-fresh' });
      const result = await server.loadGameData();
      expect(result.data).toBeNull();
      expect(result.savedAt).toBe(0);
    });

    test('saveGameData stores and loadGameData retrieves', async (server) => {
      server.connect({ account: 'save-player' });
      const save = { coins: 120, gems: 3, unlockedTools: ['basicBroom', 'wideBroom'], savedAt: 1700000000000 };
      const saved = await server.saveGameData(save);
      expect(saved.savedAt).toBe(1700000000000);
      const result = await server.loadGameData();
      expect(result.data.coins).toBe(120);
      expect(result.data.unlockedTools.length).toBe(2);
      expect(result.savedAt).toBe(1700000000000);
    });

    test('saveGameData overwrites previous save', async (server) => {
      server.connect({ account: 'save-player2' });
      await server.saveGameData({ coins: 10, savedAt: 1000 });
      await server.saveGameData({ coins: 999, savedAt: 2000 });
      const result = await server.loadGameData();
      expect(result.data.coins).toBe(999);
      expect(result.savedAt).toBe(2000);
    });

    test('saveGameData rejects non-object payload', async (server) => {
      server.connect({ account: 'save-player3' });
      let error: any = null;
      try {
        await server.saveGameData(null as any);
      } catch (e: any) {
        error = e;
      }
      expect(error).toBeTruthy();
    });

    test('resetAllData clears game save', async (server) => {
      server.connect({ account: 'save-player4' });
      await server.saveGameData({ coins: 55, savedAt: 3000 });
      await server.resetAllData();
      const result = await server.loadGameData();
      expect(result.data).toBeNull();
    });
  });

  describe('Rankings', () => {
    test('getMyRank returns -1 when no entry', async (server) => {
      server.connect({ account: 'newbie' });
      const result = await server.getMyRank();
      expect(result.rank).toBe(-1);
      expect(result.entry).toBeNull();
    });

    test('updatePlayerStats rejects without nickname', async (server) => {
      server.connect({ account: 'playerX' });
      let error: any = null;
      try {
        await server.updatePlayerStats(5, 1200);
      } catch (e: any) {
        error = e;
      }
      expect(error).toBeTruthy();
    });

    test('updatePlayerStats creates new entry with stored nickname', async (server) => {
      server.connect({ account: 'player1' });
      await server.setNickname('Hero');
      const entry = await server.updatePlayerStats(5, 1200);
      expect(entry.account).toBe('player1');
      expect(entry.nickname).toBe('Hero');
      expect(entry.level).toBe(5);
      expect(entry.exp).toBe(1200);
    });

    test('updatePlayerStats updates existing entry', async (server) => {
      server.connect({ account: 'player2' });
      await server.setNickname('Warrior');
      await server.updatePlayerStats(3, 500);
      await server.setNickname('WarriorX');
      const updated = await server.updatePlayerStats(8, 3000);
      expect(updated.nickname).toBe('WarriorX');
      expect(updated.level).toBe(8);
      expect(updated.exp).toBe(3000);
    });

    test('updatePlayerStats rejects invalid level', async (server) => {
      server.connect({ account: 'player4' });
      await server.setNickname('Hero');
      let error: any = null;
      try {
        await server.updatePlayerStats(0, 100);
      } catch (e: any) {
        error = e;
      }
      expect(error).toBeTruthy();
    });

    test('updatePlayerStats rejects negative exp', async (server) => {
      server.connect({ account: 'player5' });
      await server.setNickname('Hero');
      let error: any = null;
      try {
        await server.updatePlayerStats(1, -1);
      } catch (e: any) {
        error = e;
      }
      expect(error).toBeTruthy();
    });

    test('getTopRankings returns players sorted by level then exp', async (server) => {
      server.connect({ account: 'alpha' });
      await server.setNickname('Alpha');
      await server.updatePlayerStats(10, 5000);

      server.connect({ account: 'beta' });
      await server.setNickname('Beta');
      await server.updatePlayerStats(10, 8000);

      server.connect({ account: 'gamma' });
      await server.setNickname('Gamma');
      await server.updatePlayerStats(15, 1000);

      server.connect({ account: 'delta' });
      await server.setNickname('Delta');
      await server.updatePlayerStats(5, 9000);

      const top = await server.getTopRankings();
      expect(top.length).toBeGreaterThanOrEqual(4);
      expect(top[0].nickname).toBe('Gamma');
      expect(top[1].level).toBe(10);
      expect(top[1].exp).toBe(8000);
      expect(top[2].level).toBe(10);
      expect(top[2].exp).toBe(5000);
    });

    test('getMyRank returns correct rank', async (server) => {
      server.connect({ account: 'rank1' });
      await server.setNickname('First');
      await server.updatePlayerStats(100, 9999);

      server.connect({ account: 'rank2' });
      await server.setNickname('Second');
      await server.updatePlayerStats(50, 5000);

      server.connect({ account: 'rank3' });
      await server.setNickname('Third');
      await server.updatePlayerStats(20, 2000);

      const myRank = await server.getMyRank();
      expect(myRank.rank).toBe(3);
      expect(myRank.entry.nickname).toBe('Third');
    });
  });
});
