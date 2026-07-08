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

  describe('Rankings', () => {
    test('getMyRank returns -1 when no entry', async (server) => {
      server.connect({ account: 'newbie' });
      const result = await server.getMyRank();
      expect(result.rank).toBe(-1);
      expect(result.entry).toBeNull();
    });

    test('updatePlayerStats creates new entry', async (server) => {
      server.connect({ account: 'player1' });
      const entry = await server.updatePlayerStats('Hero', 5, 1200);
      expect(entry.account).toBe('player1');
      expect(entry.nickname).toBe('Hero');
      expect(entry.level).toBe(5);
      expect(entry.exp).toBe(1200);
    });

    test('updatePlayerStats updates existing entry', async (server) => {
      server.connect({ account: 'player2' });
      await server.updatePlayerStats('Warrior', 3, 500);
      const updated = await server.updatePlayerStats('WarriorX', 8, 3000);
      expect(updated.nickname).toBe('WarriorX');
      expect(updated.level).toBe(8);
      expect(updated.exp).toBe(3000);
    });

    test('updatePlayerStats rejects invalid nickname', async (server) => {
      server.connect({ account: 'player3' });
      let error: any = null;
      try {
        await server.updatePlayerStats('', 1, 100);
      } catch (e: any) {
        error = e;
      }
      expect(error).toBeTruthy();
    });

    test('updatePlayerStats rejects invalid level', async (server) => {
      server.connect({ account: 'player4' });
      let error: any = null;
      try {
        await server.updatePlayerStats('Hero', 0, 100);
      } catch (e: any) {
        error = e;
      }
      expect(error).toBeTruthy();
    });

    test('updatePlayerStats rejects negative exp', async (server) => {
      server.connect({ account: 'player5' });
      let error: any = null;
      try {
        await server.updatePlayerStats('Hero', 1, -1);
      } catch (e: any) {
        error = e;
      }
      expect(error).toBeTruthy();
    });

    test('getTopRankings returns players sorted by level then exp', async (server) => {
      server.connect({ account: 'alpha' });
      await server.updatePlayerStats('Alpha', 10, 5000);

      server.connect({ account: 'beta' });
      await server.updatePlayerStats('Beta', 10, 8000);

      server.connect({ account: 'gamma' });
      await server.updatePlayerStats('Gamma', 15, 1000);

      server.connect({ account: 'delta' });
      await server.updatePlayerStats('Delta', 5, 9000);

      const top = await server.getTopRankings();
      expect(top.length).toBeGreaterThanOrEqual(4);
      expect(top[0].nickname).toBe('Gamma'); // level 15 highest
      expect(top[1].level).toBe(10);
      expect(top[1].exp).toBe(8000); // Beta: same level, higher exp
      expect(top[2].level).toBe(10);
      expect(top[2].exp).toBe(5000); // Alpha: same level, lower exp
    });

    test('getMyRank returns correct rank', async (server) => {
      server.connect({ account: 'rank1' });
      await server.updatePlayerStats('First', 100, 9999);

      server.connect({ account: 'rank2' });
      await server.updatePlayerStats('Second', 50, 5000);

      server.connect({ account: 'rank3' });
      await server.updatePlayerStats('Third', 20, 2000);

      const myRank = await server.getMyRank();
      expect(myRank.rank).toBe(3);
      expect(myRank.entry.nickname).toBe('Third');
    });
  });
});
