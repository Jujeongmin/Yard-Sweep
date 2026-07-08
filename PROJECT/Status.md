# Status — basic-vite-react

## Implemented

- Ranking system with level/exp-based sorting
- Server: `updatePlayerStats`, `getTopRankings`, `getMyRank`
- Client: StatsPanel form, Leaderboard modal
- 11 server tests (all passing)

## Ranking Logic

- Players sorted by level (desc), then exp (desc) as tiebreaker
- One entry per user (updatePlayerStats upserts)
- Top 20 displayed, current user's rank shown even if outside top 20
