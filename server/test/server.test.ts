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
        await server.updatePlayerStats(5, 20);
      } catch (e: any) {
        error = e;
      }
      expect(error).toBeTruthy();
    });

    test('updatePlayerStats creates new entry with stored nickname', async (server) => {
      server.connect({ account: 'player1' });
      await server.setNickname('Hero');
      const entry = await server.updatePlayerStats(4, 20);
      expect(entry.account).toBe('player1');
      expect(entry.nickname).toBe('Hero');
      expect(entry.level).toBe(4);
      expect(entry.exp).toBe(20);
      expect(entry.score).toBe(320);
    });

    test('updatePlayerStats caps a jump beyond what elapsed time allows', async (server) => {
      server.connect({ account: 'cheater' });
      await server.setNickname('Cheater');
      // Right after the first registration the allowance is SCORE_BURST (400) only.
      const entry = await server.updatePlayerStats(9999, 99);
      expect(entry.score).toBeLessThan(450);
      expect(entry.level).toBe(Math.floor(entry.score / 100) + 1);
      const again = await server.updatePlayerStats(9999, 99);
      expect(again.score).toBeLessThan(900);
    });

    test('updatePlayerStats keeps climbing toward the claimed score across calls', async (server) => {
      server.connect({ account: 'player2' });
      await server.setNickname('Warrior');
      await server.updatePlayerStats(3, 50); // 250
      const updated = await server.updatePlayerStats(8, 30); // claims 730, allowed 250 + 400
      expect(updated.score).toBeGreaterThanOrEqual(650);
      expect(updated.score).toBeLessThanOrEqual(730);
    });

    test('updatePlayerStats rejects invalid level', async (server) => {
      server.connect({ account: 'player4' });
      await server.setNickname('Hero');
      let error: any = null;
      try {
        await server.updatePlayerStats(0, 10);
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

    test('updatePlayerStats rejects non-integer and out-of-range values', async (server) => {
      server.connect({ account: 'player6' });
      await server.setNickname('Hero');
      for (const [level, exp] of [[2.5, 10], [2, 10.5], [100000, 0], [2, 100]]) {
        let error: any = null;
        try {
          await server.updatePlayerStats(level, exp);
        } catch (e: any) {
          error = e;
        }
        expect(error).toBeTruthy();
      }
    });

    test('setNickname rejects whitespace-only names', async (server) => {
      server.connect({ account: 'blank' });
      let error: any = null;
      try {
        await server.setNickname('    ');
      } catch (e: any) {
        error = e;
      }
      expect(error).toBeTruthy();
    });

    test('setNickname renames the existing ranking row immediately', async (server) => {
      server.connect({ account: 'renamer' });
      await server.setNickname('OldName');
      await server.updatePlayerStats(2, 10);
      await server.setNickname('NewName');
      const mine = await server.getMyRank();
      expect(mine.entry.nickname).toBe('NewName');
      const top = await server.getTopRankings();
      expect(top.some((row: any) => row.nickname === 'NewName')).toBe(true);
      expect(top.some((row: any) => row.nickname === 'OldName')).toBe(false);
    });

    test('getTopRankings sorts by score and hides account ids', async (server) => {
      server.connect({ account: 'alpha' });
      await server.setNickname('Alpha');
      await server.updatePlayerStats(3, 50);

      server.connect({ account: 'beta' });
      await server.setNickname('Beta');
      await server.updatePlayerStats(3, 80);

      server.connect({ account: 'gamma' });
      await server.setNickname('Gamma');
      await server.updatePlayerStats(4, 10);

      server.connect({ account: 'delta' });
      await server.setNickname('Delta');
      await server.updatePlayerStats(2, 90);

      const top = await server.getTopRankings();
      expect(top.length).toBeGreaterThanOrEqual(4);
      expect(top[0].nickname).toBe('Gamma');
      expect(top[1].nickname).toBe('Beta');
      expect(top[2].nickname).toBe('Alpha');
      expect(top.every((row: any) => row.account === undefined)).toBe(true);
      expect(top.filter((row: any) => row.isMe).length).toBe(1);
      expect(top.find((row: any) => row.isMe).nickname).toBe('Delta');
    });

    test('getMyRank returns correct rank', async (server) => {
      server.connect({ account: 'rank1' });
      await server.setNickname('First');
      await server.updatePlayerStats(4, 99);

      server.connect({ account: 'rank2' });
      await server.setNickname('Second');
      await server.updatePlayerStats(3, 50);

      server.connect({ account: 'rank3' });
      await server.setNickname('Third');
      await server.updatePlayerStats(2, 20);

      const myRank = await server.getMyRank();
      expect(myRank.rank).toBe(3);
      expect(myRank.entry.nickname).toBe('Third');
    });

    test('tied scores share the same rank', async (server) => {
      server.connect({ account: 'tie-a' });
      await server.setNickname('TieA');
      await server.updatePlayerStats(3, 30);

      server.connect({ account: 'tie-b' });
      await server.setNickname('TieB');
      await server.updatePlayerStats(3, 30);

      const b = await server.getMyRank();
      server.connect({ account: 'tie-a' });
      const a = await server.getMyRank();
      expect(a.rank).toBe(b.rank);
    });

    test('resetAllData deletes only the current player ranking', async (server) => {
      server.connect({ account: 'keep-player' });
      await server.setNickname('Keeper');
      await server.updatePlayerStats(3, 20);

      server.connect({ account: 'reset-player' });
      await server.setNickname('Resetter');
      await server.updatePlayerStats(4, 30);
      await server.resetAllData();

      const resetRank = await server.getMyRank();
      expect(resetRank.entry).toBeNull();

      server.connect({ account: 'keep-player' });
      const keptRank = await server.getMyRank();
      expect(keptRank.entry.nickname).toBe('Keeper');
    });

    test('updatePlayerStats does not replace a higher score with stale progress', async (server) => {
      server.connect({ account: 'steady-player' });
      await server.setNickname('Steady');
      await server.updatePlayerStats(4, 40);
      const entry = await server.updatePlayerStats(2, 10);
      expect(entry.level).toBe(4);
      expect(entry.exp).toBe(40);
      expect(entry.score).toBe(340);
    });

    test('concurrent submissions leave a single ranking row', async (server) => {
      server.connect({ account: 'two-tabs' });
      await server.setNickname('TwoTabs');
      await Promise.all([server.updatePlayerStats(2, 10), server.updatePlayerStats(2, 20), server.updatePlayerStats(2, 30)]);
      const top = await server.getTopRankings();
      expect(top.filter((row: any) => row.nickname === 'TwoTabs').length).toBe(1);
    });
  });

  describe('VX Shop', () => {
    test('gems-100 grants 100 crystals', async (server) => {
      server.connect({ account: 'vxbuyer1' });
      await server.$onItemPurchased({ account: 'vxbuyer1', purchaseId: 1, productId: 'gems-100', quantity: 1 });
      const state = await server.getVxState();
      expect(state.crystals).toBe(100);
    });

    test('gems-550 grants 550 crystals', async (server) => {
      server.connect({ account: 'vxbuyer2' });
      await server.$onItemPurchased({ account: 'vxbuyer2', purchaseId: 2, productId: 'gems-550', quantity: 1 });
      const state = await server.getVxState();
      expect(state.crystals).toBe(550);
    });

    test('gems-1200 grants 1200 crystals', async (server) => {
      server.connect({ account: 'vxbuyer3' });
      await server.$onItemPurchased({ account: 'vxbuyer3', purchaseId: 3, productId: 'gems-1200', quantity: 1 });
      const state = await server.getVxState();
      expect(state.crystals).toBe(1200);
    });

    test('ad-removal sets adRemoved flag', async (server) => {
      server.connect({ account: 'vxbuyer4' });
      await server.$onItemPurchased({ account: 'vxbuyer4', purchaseId: 4, productId: 'ad-removal', quantity: 1 });
      const state = await server.getVxState();
      expect(state.adRemoved).toBe(true);
    });

    test('ad-free gem reward requires ad removal', async (server) => {
      server.connect({ account: 'ad-free-denied' });
      const result = await server.claimAdFreeGemReward();
      expect(result.granted).toBe(false);
      expect(result.reason).toBe('ad_removal_required');
    });

    test('ad-removal owner receives instant gems once per cooldown', async (server) => {
      server.connect({ account: 'ad-free-owner' });
      await server.$onItemPurchased({ account: 'ad-free-owner', purchaseId: 5, productId: 'ad-removal', quantity: 1 });

      const first = await server.claimAdFreeGemReward();
      expect(first.granted).toBe(true);
      expect(first.gems).toBe(30);

      const second = await server.claimAdFreeGemReward();
      expect(second.granted).toBe(false);
      expect(second.reason).toBe('cooldown');
      expect(second.retryAfterMs).toBeGreaterThan(0);

      const state = await server.getVxState();
      expect(state.crystals).toBe(30);
    });

    test('duplicate purchaseId does not double-grant', async (server) => {
      server.connect({ account: 'vxbuyer6' });
      await server.$onItemPurchased({ account: 'vxbuyer6', purchaseId: 10, productId: 'gems-100', quantity: 1 });
      await server.$onItemPurchased({ account: 'vxbuyer6', purchaseId: 10, productId: 'gems-100', quantity: 1 });
      const state = await server.getVxState();
      expect(state.crystals).toBe(100);
    });

    test('quantity 0 is rejected', async (server) => {
      server.connect({ account: 'vxbuyer7' });
      const result = await server.$onItemPurchased({ account: 'vxbuyer7', purchaseId: 11, productId: 'gems-100', quantity: 0 });
      expect(result.success).toBe(false);
    });

    test('negative quantity is rejected', async (server) => {
      server.connect({ account: 'vxbuyer8' });
      const result = await server.$onItemPurchased({ account: 'vxbuyer8', purchaseId: 12, productId: 'gems-100', quantity: -1 });
      expect(result.success).toBe(false);
    });

    test('quantity over 100 is rejected', async (server) => {
      server.connect({ account: 'vxbuyer9' });
      const result = await server.$onItemPurchased({ account: 'vxbuyer9', purchaseId: 13, productId: 'gems-100', quantity: 101 });
      expect(result.success).toBe(false);
    });

    test('unknown productId does not grant anything', async (server) => {
      server.connect({ account: 'vxbuyer10' });
      const result = await server.$onItemPurchased({ account: 'vxbuyer10', purchaseId: 14, productId: 'hacked-item', quantity: 1 });
      expect(result.success).toBe(false);
    });

    test('multiple valid purchases accumulate crystals', async (server) => {
      server.connect({ account: 'vxbuyer11' });
      await server.$onItemPurchased({ account: 'vxbuyer11', purchaseId: 20, productId: 'gems-100', quantity: 1 });
      await server.$onItemPurchased({ account: 'vxbuyer11', purchaseId: 21, productId: 'gems-550', quantity: 1 });
      const state = await server.getVxState();
      expect(state.crystals).toBe(100 + 550);
    });

    test('getVxState returns defaults for fresh user', async (server) => {
      server.connect({ account: 'vxfresh' });
      const state = await server.getVxState();
      expect(state.crystals).toBe(0);
      expect(state.adRemoved).toBe(false);
    });

    test('resetAllData clears VX state', async (server) => {
      server.connect({ account: 'vxreset' });
      await server.$onItemPurchased({ account: 'vxreset', purchaseId: 30, productId: 'gems-100', quantity: 1 });
      await server.$onItemPurchased({ account: 'vxreset', purchaseId: 31, productId: 'ad-removal', quantity: 1 });
      await server.resetAllData();
      const state = await server.getVxState();
      expect(state.crystals).toBe(0);
      expect(state.adRemoved).toBe(false);
    });
  });
});
