# Structure — basic-vite-react

## `src/main.tsx`
Entry point. Mounts `<App />` into `#root`.

## `src/App.tsx`
Root component. Renders `StatsPanel` (update player stats) and `Leaderboard` button/modal.

## `src/StatsPanel.tsx`
Form component for updating nickname, level, exp via `updatePlayerStats` server function.

## `src/Leaderboard.tsx`
Modal component displaying top 20 rankings sorted by level (desc) then exp (desc). Shows user's rank with highlight. Fetches `getTopRankings` and `getMyRank` from server.

## `server/src/server.ts`
Server logic:
- `updatePlayerStats(nickname, level, exp)` — upsert player entry
- `getTopRankings()` — returns top 20 sorted by level desc, exp desc
- `getMyRank()` — returns player's entry and rank

## `server/test/server.test.ts`
Tests for all server functions including ranking logic.
