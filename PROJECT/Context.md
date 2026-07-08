# Context — basic-vite-react

## Project Overview

React + TypeScript game project with a ranking/leaderboard system. Player stats (level, exp) are stored via Agent8 GameServer SDK.

## Tech Stack

- **Framework**: React, React DOM
- **Build / Lang**: Vite, TypeScript
- **Styling**: Tailwind CSS, PostCSS (autoprefixer)
- **Icons**: `lucide-react`
- **Multiplayer / Server**: `@agent8/gameserver` (client), `@agent8/gameserver-node` (server)

## Critical Memory

- Server code is in `server/src/server.ts` (Structured Project, uses `export class Server`)
- Client communicates via `server.remoteFunction('functionName', [args])`
- Rankings use Global Collection (`$global.addCollectionItem`, `$global.getCollectionItems`)
