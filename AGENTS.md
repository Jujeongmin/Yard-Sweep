# Verse8 Project — Agent Instructions

> Read this file in full at session start. It is installed by verse8-mcp
> (`verse8_attach`) and also serves as the attachment marker. Do not delete.

## 🚨 First action rule (before anything else)

At the **START of every turn** — even bug fixes, UI tweaks, performance
tuning, "just change this number" — call
`verse8_bootstrap({userRequest: "<user's verbatim message>"})` BEFORE
any Edit / Write / Bash / build command. It is a cheap (~10ms, no
network) classifier that returns:

- `workflow.nextAction === "ready"` → this is an attached Verse8
  project; proceed with the user's request and follow the TOP RULES
  below (use `verse8_checkpoint` / `verse8_preview` for commits &
  previews, NEVER raw `git commit` or `bun run dev`).
- `workflow.nextAction === "attach"` → call `verse8_attach` first,
  then re-call bootstrap.
- `workflow.nextAction === "login"` → call `verse8_login_start` first,
  then re-call bootstrap.
- `workflow.nextAction === "not_verse_project"` → this cwd is NOT a
  Verse8 workspace; proceed with your usual tools.

Never infer workflow state from filesystem inspection. The bootstrap
tool is the single source of truth.

## 🚨 TOP RULES (violating these will break the project)

1. **Never run `bun run dev` / `vite` via Bash.** The `verse8_preview` MCP
   tool exists exactly to launch the dev server. It bundles a V8-format
   commit with the spawn so "what the user sees" matches "what is in git".
   If you call `bun run dev` via Bash you will produce an uncommitted
   preview — the user will approve state that was never saved.
2. **Never run `git commit` via Bash.** Use `verse8_checkpoint` (or
   `verse8_preview`, which calls it internally). The installed
   `commit-msg` git hook rejects non-V8 messages with exit code 1.
3. **Never pass `--no-verify` to git.** It bypasses the commit-msg hook
   and produces commits the web/container stack cannot parse.
4. **Preview-delta rule**: any change the user would see in the next
   preview (asset swap, UI tweak, gameplay change, bug fix) ends the turn
   with `verse8_preview`. One user turn → one `verse8_preview` call →
   one commit → optional running dev server.

If you think you need Bash for `git commit` or `bun run dev`, stop and
use the MCP tool instead. The only exception is `VERSE8_ALLOW_NONCOMPLIANT=1 git commit -m "..."` for a deliberate, user-approved one-off fix.

## 🚨 Deploy only through `verse8_deploy`

When the user asks to deploy / publish / ship / 배포 / 출시 / 게시:

1. Call `verse8_deploy` with `dryRun: true`. It resolves whether this is
   the **first deploy** or an **update** of the project's verse and returns
   the publish body it would send.
2. The same fields as the web publish dialog are required. First deploy:
   `title` (4–50 chars), `tags` (1–5), a cover image (`thumbnailPath` —
   a local png/jpg/gif/webp ≤4 MB, e.g. made with `image_asset_generate` —
   or `imageUrl`) and a release note. Every deploy (first and update):
   `releaseNoteTitle` + `releaseNoteTypes` + `releaseNoteDescription`.
   Updates keep the current title / image / visibility / tags unless you
   pass new ones.
3. When dryRun returns `invalid_input` with `missing`, draft EVERY
   missing value yourself — never ask the user for them one by one:
   title / tags / description from the game, release note from the
   returned `suggestedReleaseNote` (edit it so it reads like a release
   note, not a commit log), cover via `image_asset_generate` from the
   game's theme (pass the generated URL as `imageUrl`, or download it
   and pass `thumbnailPath`). Values the user already gave are used
   as-is. Then re-run dryRun.
4. **First deploy**: show the user that one dryRun result (mode +
   publishBody, cover URL included) and run `verse8_deploy` without
   `dryRun` only after they approve or correct it — title, tags, cover
   and visibility go public here. Skip the confirmation only when the
   user explicitly said to deploy without asking.
   **Update**: deploy right away — the live title / cover / tags /
   visibility are kept and only the release note is new — then report
   the playUrl and the release note you published. Confirm first only
   if the user asked to see it before publishing or the dryRun returns
   `warnings`.
5. Do NOT run `@agent8/deploy --prod`, a build + upload, or any deploy
   command via Bash. `verse8_checkpoint` / `verse8_preview` only commit
   + push to gitlab.verse8.io; they do not publish.
6. The verse id (`VITE_AGENT8_VERSE`) is the game's identity — VX Shop
   products and gameserver state are keyed by it. Never edit it to "fix" a
   deploy error.
7. **A push deploys nothing here.** Some vendored skills (e.g.
   `gameserver-sdk`) say pushing builds and deploys the game server —
   that describes the Agent8 web editor, which deploys a preview after
   each turn. Through this MCP, `verse8_checkpoint` and a push to
   gitlab.verse8.io build and deploy nothing: run `verse8_preview` to
   build + deploy the server for testing, `verse8_deploy` to publish.
   This rule overrides any skill text.

## You are operating inside a Verse8 project

Origin: `gitlab.verse8.io`. Project marker: `.verse8/project.json`.
Runtime: **Vite + Bun**. The dev server is `bun run dev` (default port 5173).

The `@verse8/mcp` MCP server is attached and provides the tools you
MUST use for state-changing operations:

| Intent | Use | Do NOT use |
|--------|-----|------------|
| Log in to Verse8 | `verse8_login_start` → `verse8_login_complete` | `bash scripts/verse8-login.sh` unless MCP is unavailable |
| Check current profile / token | `verse8_status` | — |
| Commit + push changes | **`verse8_checkpoint`** | Native `git commit` via Bash |
| **Commit + launch preview for the user** | **`verse8_preview`** | Separate `bun run dev` via Bash without committing first |
| Generate game images | `image_asset_generate` / `image_variation_generate` | External image APIs |
| **Deploy / publish to production** | **`verse8_deploy`** (`dryRun: true` first, then confirm) | Any deploy / build+upload command via Bash |
| Upload a verse cover image / preview video | `verse8_upload_thumbnail` (or `thumbnailPath` on `verse8_deploy`) | `verse8_upload_asset` (that is for in-game assets) |

## Preview policy — the "see it = commit it" rule

verse8 is a **Vite + Bun** project. After any change the user should visually
verify (new feature, asset swap, UI tweak, gameplay logic, bug fix), run
`verse8_preview` — **not** a bare `bun run dev`. `verse8_preview`:

1. Runs `verse8_checkpoint` first (V8 commit + push)
2. **Preflight** — sync deps via `installCommand` (default `bun update`).
   If this is a GameServer project (`server.ts`, `server.js`, or a
   `server/` directory present), additionally runs
   `npx -y @agent8/gameserver-node build` and
   `npx -y @agent8/deploy --preview` so the local client has a freshly
   deployed server to call. Each step is blocking; failure aborts before
   the dev server starts and returns `preflight_failed` with the
   failing step + stderr tail.
3. Launches `bun run dev` detached on port 5173
4. Returns the preview URL (`http://localhost:5173`) for you to relay

This bundling is deliberate: the state the user previews is guaranteed to be
the state that was just committed. Never start the dev server without first
committing — if you do, the user might approve a preview that no longer
exists on disk.

Situations that warrant calling `verse8_preview`:

- Added / replaced a game asset (sprites, backgrounds, UI icons)
- Changed gameplay logic that affects rendered behavior
- Modified any screen the user described in this session's prompt
- User explicitly asked to "run", "preview", "show me", "확인해보자"

If `verse8_preview` reports `preview.status = "already_running"`, the server
is already up — just tell the user the URL. If it reports `"started"`,
relay the URL + PID.

**Always surface BOTH links** when the response includes `webEditor.url`:

- Preview     : `http://localhost:5173`  (local)
- Web Editor  : `<webEditor.url>`         (continue editing from the browser)

The web editor link is `https://create.verse8.io/creator/editor?chat=<projectPath>`
when `git remote origin` is a gitlab.verse8.io repo. If `webEditor` is `null`,
omit that line (the project isn't hosted on gitlab.verse8.io).

Use `startOnly: true` only when the user specifically asks to reopen the
preview with no new changes.

## Commit policy (critical)

Principle: **preview-delta commits**. If the user would see a visible change
in the next preview, call `verse8_checkpoint` before moving on. One user
turn → one checkpoint → one commit.

When calling `verse8_checkpoint`, always pass:

- `userPrompt` — the user's message this turn, verbatim
- `model` — your model identifier (e.g. `claude-opus-4-7`)
- `provider` — e.g. `anthropic`
- `mcpServers` — names of MCP servers used (optional)
- `problemStatement` — **REQUIRED for history continuity**. 1–3 sentences
  describing how you interpreted the user's request this turn: what they
  want + the constraints you're working under. A future agent reading
  `git log` depends on this to reconstruct why you made the changes.
- `workSummary` — **REQUIRED for history continuity**. 1–5 sentences
  describing what you actually did at a higher level than `reasoning`
  (which is about thought process) or `toolCalls` (which are raw
  payloads). Good example: "Replaced the stubbed verse8_new_project with
  a 2-tool start/confirm split, added agent8-backend client + mock,
  documented the flow in AGENTS.md."
- `toolCalls` — brief list of host tools you used (name + status minimum).
  Omit to let the MCP auto-fill from its observation log — but that log only
  covers verse8-mcp tools; your host tools (Read/Write/Bash) will be missing
  unless you pass them.

The MCP server assembles the V8 format commit message deterministically.
A `commit-msg` git hook validates the result — **you will see warnings on
stderr if your commit drifts from the format or is missing narrative**.
Fix them next turn: if the hook warns about missing `<problemStatement>` or
`<workSummary>` inside `<V8AssistantMessage>`, that means you didn't pass
`problemStatement` / `workSummary` and the next agent loses the reasoning
for this change.

Where narrative lands in the commit: the MCP writes `<problemStatement>`
and `<workSummary>` tags **inside `<V8AssistantMessage>`** (alongside
`<reasoning>` and `<toolCall>`), and also duplicates both as plain strings
in the `V8AgentMessage` JSON for programmatic parsers. Do NOT try to format
the narrative as markdown headings yourself — just pass the prose through
the tool fields and the MCP builds the correct XML.

**Do not use `git commit` via Bash in this project.** The installed
`commit-msg` hook **rejects non-V8 commits with exit code 1** — any
Bash-driven commit that skips `verse8_checkpoint` will fail unless the
subject is a git-auto message (Merge / Revert) or the user explicitly
exports `VERSE8_ALLOW_NONCOMPLIANT=1`. Also, do NOT pass `--no-verify` to
`git commit` — that bypasses the hook and produces commits the web /
container stack cannot parse.

## MCP proxy services (9 total)

verse8-mcp proxies 9 upstream Verse8 services. They appear in `tools/list`
whenever the user is logged in. Call `verse8_status` to see which are
currently enabled and why.

| Service | Tools | When to use |
|---------|-------|-------------|
| `image` | `image_asset_generate`, `image_variation_generate`, `asset_wait` | 2D game assets (characters, items, backgrounds, UI icons) |
| `spritesheet` | `spritesheet_generate`, `spritesheet_variation_generate` | Animated sprite sheets |
| `cinematic` | `cinematic_asset_generate`, `cinematic_asset_result`, `cinematic_status` | Text-to-cutscene video |
| `audio` | `music_generate`, `sfx_generate`, `audio_status`, `audio_result` | BGM / SFX |
| `skybox` | `skybox_generate`, `skybox_status`, `skybox_styles` | 360° environments |
| `ui` | `ui_theme_list`, `ui_theme_style` | CSS UI themes |
| `claythis` | `claythis_3d_generate`, `claythis_3d_status` | 2D → 3D conversion |
| `crossramp` | `crossramp_deploy`, `crossramp_deploy_status`, `crossramp_active_project` | Testnet deploy, ERC20 |
| `vectorsearch` | `search_codebase_vectordb_items`, `read_codebase_vectordb_items`, `search_resources_vectordb_items` | Codebase vector search |

### Enabling / disabling proxies

Users may disable unused proxies — check `verse8_status → project.mcpProxies`
first to see current enabled set. If a tool is missing because the user has
disabled that service, do not invent a workaround; suggest the user re-enable:

- `VERSE8_MCP_PROXIES=image,audio,spritesheet` — opt-in allow-list
- `VERSE8_MCP_PROXIES_DISABLED=crossramp,vectorsearch` — block-list
- `.verse8/project.json`: `{ "disabledMcpProxies": ["claythis"] }` — persistent per-project

Per-service URL overrides (`VERSE8_<NAME>_MCP_URL`) exist for staging /
local dev; rarely relevant during normal feature work.

## Creating a new Verse8 project

Use the two-step flow — NEVER just one tool. The split exists so the user
can approve the proposed template before any GitLab repo is created.

### Step 1 — propose

Call `verse8_new_project_start({userRequest})` with the user's verbatim
message. The MCP calls `/api/startcall` on agent8-backend and returns:

- `template`: full template metadata (name, label, description, tags)
- `templateName`, `repo`, `path`: exact identifiers used by the backend
- `suggestedTitle`, `suggestedProjectRepo`: backend-inferred defaults
- `nextActionSuggestion`: short "first thing you should do" prompt
- `startCallId`: opaque correlation id — hold onto it for step 2

Show the user the template label + description + nextActionSuggestion.
Ask whether to proceed, and whether to override `title` or `projectRepo`.

### Step 2 — confirm

On user confirmation, call `verse8_new_project_confirm` with:

- `templateName`, `repo`, `path`: verbatim from step 1 — NEVER invent these
- `title`, `projectRepo`: from step 1 unless the user explicitly overrode
- `startCallId`: verbatim from step 1 — this is a guardrail that catches
  `templateName` drift (mismatch → `template_mismatch`, zero HTTP calls)
- `targetDir`: optional parent directory for the clone (default: cwd)

The MCP will:
1. POST /api/select-template (creates the GitLab project)
2. GET /api/gitlab/project-access-token (check existing PAT)
3. POST /api/gitlab/project-access-token (grant a 30-day PAT if needed)
4. `git clone -b develop <oauth2-embedded URL>` into `<targetDir>/<slug>`
5. Install git hooks + AGENTS.md + `.verse8/project.json` (attach)

On success the response includes `nextCallRequires.projectDir`. **From that
point on, you MUST pass `projectDir` on every subsequent tool call** —
specifically every `verse8_checkpoint`, `verse8_preview`, and image-proxy
tool call in this session. The MCP server's own cwd is still the parent
directory, so without `projectDir` those tools will target the wrong path.

### Retry after a transient failure

If `confirm` returns `token_grant_failed`, `clone_failed`,
`clone_parse_failed`, or `attach_failed`, the error envelope includes
`projectPath`. Re-call `confirm` with that `projectPath` to skip
`selectTemplate` and resume from token-grant — this avoids orphaning a
duplicate timestamped GitLab repo.

### MCP server restarted mid-flow

If the MCP host restarted between Step 1 and Step 2, the in-process
`startCallId` memo is lost. Calling `verse8_new_project_confirm` with a
stale `startCallId` returns `template_mismatch`. Recovery: re-run
`verse8_new_project_start` and pass the freshly-issued identifiers verbatim
to `verse8_new_project_confirm`. A persistent store is a 0.4.x follow-up.

### Rules

- NEVER call `verse8_new_project_confirm` without first running
  `verse8_new_project_start`.
- NEVER fabricate `templateName` / `repo` / `path` — always echo the
  values from the start response.
- NEVER embed the GitLab PAT in `.verse8/project.json` (it's stored safely
  inside `.git/config` via the clone URL only).
- After confirm returns, pass `projectDir` on every subsequent tool call
  until the user restarts the MCP host from inside the new directory.

## 3D engine: Incanto by default

A project that depends on `vibe-starter-3d`, `vibe-starter-3d-environment`,
`@react-three/fiber` or `incanto` gets that stack's skills and rules
below (`verse8_attach` installs them from `package.json`). Keep using that
stack — never add a second 3D engine next to it.

When the user wants a **3D** game and `package.json` depends on none of
those packages (nor on `three`), use **Incanto**:

1. Before the first edit, read `verse8://skill/incanto-on-agent8/SKILL.md`
   and `verse8://skill/incanto-your-first-game/SKILL.md` via MCP
   `resources/read` — they are not installed in this project yet.
2. Add the engine with `bun add incanto three`, then re-run
   `verse8_attach` with `overwriteAgentsDoc: true` so the Incanto skills
   and rules are installed and listed here.

A 2D game stays on the 2D stack (Phaser) unless the user asks for Incanto.

## Available Verse8 skills

The MCP server discovers skills from `skills/` (verse8 core) and
`skills-vendor/agent8-skills/` (vendored upstream). Only the skills
that apply to this project are listed: a plugin that declares
`requiresPackage` is included only when `package.json` depends on one
of those packages. After adding such a dependency, re-run
`verse8_attach` (with `overwriteAgentsDoc: true` to refresh this file).
If you're running on Claude Code, the matching
`.claude/skills/<name>/SKILL.md` files are installed in this project by
`verse8_attach` and auto-load. On other hosts, fetch the content via
MCP `resources/read`.

| Skill | Purpose | MCP URI |
|-------|---------|---------|
| `ads-impl` | The implementation details related to Verse8 Ads (rewarded video and interstitial ads) should unconditionally refer to this document. Verse8 Ads is the platfor… | `verse8://skill/ads-impl/SKILL.md` |
| `gameserver-sdk-crossramp` | CROSS Mini Hub (crossramp) integration for Agent8 games: opening the hub where players exchange game items, coins, and CROSS, via the SDK built-in server.getCr… | `verse8://skill/gameserver-sdk-crossramp/SKILL.md` |
| `gameserver-sdk-v1` | Frozen reference for Agent8 GameServer SDK 1.x (@agent8/gameserver 1.x). Read it to understand, maintain or extend server code in a project that stays on 1.x:… | `verse8://skill/gameserver-sdk-v1/SKILL.md` |
| `gameserver-sdk` | Agent8 GameServer SDK 2.x (@agent8/gameserver 2.x), the default server documentation. Any logic related to the server must refer to this document: writing serv… | `verse8://skill/gameserver-sdk/SKILL.md` |
| `leaderboard-impl` | A method to implement leaderboards and rankings in a game. Explain how to store on a server and display it on a client (using `gameserver-sdk` skill). | `verse8://skill/leaderboard-impl/SKILL.md` |
| `local-cache-impl` | How to cache large, regenerable data on the player's device with `@verse8/local-cache` so it is restored quickly instead of recomputed or re-downloaded. Read t… | `verse8://skill/local-cache-impl/SKILL.md` |
| `localization-proofread` | Use when the builder asks to check or clean up the game's text — proofreading, typos, spelling, spacing, wording, tone, or whether the translations are any goo… | `verse8://skill/localization-proofread/SKILL.md` |
| `localization` | Use when the builder asks to add a language, translate the game, support English/Korean/Japanese, add a language switcher, or make the game playable for anothe… | `verse8://skill/localization/SKILL.md` |
| `verse8-auth-impl` | The implementation details related to Verse8 auth helpers — reading and verifying the signed-in user — should unconditionally refer to this document. The `Vers… | `verse8://skill/verse8-auth-impl/SKILL.md` |
| `verse8-commit` | How to commit in Verse8 projects. Use when the host LLM is about to call `verse8_checkpoint`, or whenever the user asks to "save", "commit", or "push" changes… | `verse8://skill/verse8-commit/SKILL.md` |
| `verse8-login` | Log in to Verse8 via RFC 8628 device flow, check identity, and log out. Use when the user asks to "verse8 login", "verse8 logout", "verse8 status", "내 verse8 프… | `verse8://skill/verse8-login/SKILL.md` |
| `vx-shop-impl` | The implementation details related to VX or VX shop should unconditionally refer to this document. Additionally, you must read the `gameserver-sdk` skill toget… | `verse8://skill/vx-shop-impl/SKILL.md` |

<!-- Composed into AGENTS.md whenever this plugin is staged. It is deliberately not package-scoped: a project that has no server yet is exactly the one that needs these rules, and every template already depends on @agent8/gameserver, so a gate would add nothing but a missed first session. Every line here costs prompt budget on every message. -->

## Server Logic & GameServer SDK Skills

CRITICAL:
You MUST read and follow the GameServer SDK skills BEFORE writing or modifying any server-related code. Skipping this step and writing server code from memory or assumptions is strictly forbidden.

You MUST read them in ANY of these situations:

1. **Modifying server files**: any change to a root `server.js` or to files under `server/`
2. **Creating new server logic**: a project needs server-side functionality for the first time
3. **Online/multiplayer requests**: online or multiplayer play, real-time sync, leaderboards, matchmaking, rooms, chat, or anything else that needs server-client communication — read the skills and use them to build the feature
4. **Debugging server issues**: server errors, connection issues, or state synchronization problems

### Skills

- **`gameserver-sdk`**: SDK 2.x, the default. Covers the structured project (`server/src/server.ts`) and an existing root `server.js`, and holds the full 1.x → 2.0 upgrade checklist
- **`gameserver-sdk-v1`**: frozen SDK 1.x reference, for projects that stay on 1.x
- **`gameserver-sdk-crossramp`**: CROSS Mini Hub integration, only when crossramp/CROSS keywords appear

### Which SDK version

A 1.x client talks to the 1.x game server and a 2.x client to the 2.x one, so the version in the root `package.json` (`@agent8/gameserver`) decides which API the server code runs against. Decide from it and from whether server code already exists (a root `server.js` or a `server/` directory):

- **Not installed, or 2.x** → follow `gameserver-sdk`
- **1.x, no server code yet** (templates ship the 1.x dependency) → run `bun add @agent8/gameserver@latest`, then follow `gameserver-sdk`
- **1.x with existing server code** → read `gameserver-sdk-v1` and extend the code only with the 1.x APIs it lists. Upgrade to 2.x when the task touches rooms or collections, needs a 2.x-only API, or the user asks — follow the upgrade section of `gameserver-sdk`, starting with its package bump

2.x is mostly compatible with 1.x. Every client hook keeps its name and return shape, and global/user state, remote functions, global messaging, `$asset` and `$lock` work as before; what 2.0 adds is additive. What breaks:

- Throws: `$global.joinRoom`/`leaveRoom` and `$room.join`/`leave` (the server returns a `roomId`, the client calls `joinRoom(roomId)` from `useGameServer()`); `remoteFunction('joinRoom' | 'leaveRoom')` on the client, so a server function with either name must be renamed; the `$global` room-state methods (use `$room.*`); `currentRoomId()` (use `$sender.roomId`, see below — the local test runner still answers it, so only the deployed server throws); `initializeAsset` (use `$asset.clear([id])` then `$asset.mint`), `loadUserState`, `printThis` and the CROSS helpers on `$global`; `getCollectionItem` on a missing item (1.x returned `{}`)
- Silent: room UI and every room subscription (`server.subscribeRoom*`, `onRoomMessage`, `onRoomUserJoin`/`Leave`) must wait for `rsConnected`, not `connected` — issued earlier they are dropped; `$sender.roomId` is the truthy `'__no_room__'` outside a room; item ids go in `addCollectionItem(cid, item, { id })`, `item.__id` is ignored, and the upsert replaces the whole item; `$global.updateCollectionItem` creates a missing item when deployed (`$room.updateCollectionItem` and the local test runner throw); global collection writes are buffered ~2s and `countCollectionItems` lags them; a dropped or left room user has a 30s grace period; `destroyRoom` clears membership only; a lobby cannot read other rooms' custom state; `$sender.isSubscriber` no longer checks expiry

### Rules

- P0 (MANDATORY): Read `gameserver-sdk` before creating new server logic (`gameserver-sdk-v1` in a project that stays on 1.x). Never mix versions: `joinRoom`/`leaveRoom`/`rsConnected` from `useGameServer()` do not exist in 1.x, and 1.x room calls throw on 2.x
- P0 (MANDATORY): Do NOT write server code from assumptions or general knowledge — the Agent8 GameServer SDK has specific conventions (e.g., `$global`, `$room`, `$sender`, `$asset`, no `setInterval`/`setTimeout`, export rules) that MUST be followed exactly
- P0 (MANDATORY): When the user requests any online/multiplayer game feature, treat it as a server task and read the server skills before implementation
- P1 (RECOMMENDED): Read `gameserver-sdk-crossramp` only when CROSS/crossramp keywords are explicitly mentioned

<!-- Composed into AGENTS.md whenever this plugin is staged. Every line here costs prompt budget on every message — keep only what a later refactor cannot recover. -->

## Localization-Ready Text

CRITICAL:
Player-visible text is data, not code. It lives in one locale file from the very first build, so that adding a language later means adding a file — not hunting string literals through canvas calls, template strings, and conditionals.

The file is `src/locales/<language-code>.json`, named for the language the game's own text is written in — `en.json` for an English game, `ko.json` for a Korean one. There is no `strings.json`. A single-language game reads it directly, exactly like `assets.json`:

```js
import Text from './locales/en.json'
<button>{Text.ui.start}</button>
```

### Rules

- P0 (MANDATORY): Every string a player can see comes from the locale file — UI labels, dialogue, button text, tooltips, win/lose messages, and text drawn to canvas or Phaser. No display-string literals in code
- P0 (MANDATORY): Never assemble a sentence with `+`. Put a placeholder in the locale value (`"score": "Score: {n}"`) and substitute where it is used. A sentence carrying a grammatical particle (Korean 을/를, 이/가) lives in the value as one whole sentence, never assembled from fragments
- P0 (MANDATORY): When renaming a locale key, grep for every reference BEFORE changing it and update them all in the same response — the same rule `assets.json` keys already follow
- P0 (MANDATORY): Read the `localization` skill BEFORE adding a second language, translating existing text, or adding a language switcher, and `localization-proofread` before checking or cleaning up the game's wording
- P1 (RECOMMENDED): Group keys by where they appear (`ui.*`, `dialogue.*`, `hud.*`), and reuse one key wherever the same text appears — shared keys are what keep one item from being called three different things on three screens

### Not localized — leave these as they are

`console.log` and other dev-only logs, `DebugPanel.define` labels (builder-facing; players never see them), code identifiers, and `assets.json` keys.


## If you are not sure this project is attached

Call `verse8_status`. If `project.attached` is false, call
`verse8_attach` — it is idempotent.
