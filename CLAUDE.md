# Lemony_Frontend — agent orientation

## What this app is

**Lemony** is a **single-player** lemonade-stand business sim. A player signs in with
Google (Firebase Auth) or continues as a guest, configures a game, then plays it day by
day: **plan** (buy ingredient packs, set recipe and price) → **day** (watch customers visit
the stand in a 2D or 3D board) → **report** → next day, until **game over** with charts.
Finished games of signed-in players appear on their profile.

This repo is the **frontend**: React 19 + Vite + TypeScript + Tailwind 4 + Zustand +
`socket.io-client` + Firebase Auth, with chart.js and three.js / react-three-fiber. It is a
**thin client: the server computes every number.** The client sends a plan and renders
what comes back.

### Where it sits

```
Novus/
├── game_stack.md            shared template + security invariants (canonical copy)
├── Beery/, Selly/           sibling games built from the same template
└── Lemony/
    ├── game_stack.md        generated copy — never edit in place
    ├── Lemony_Backend/      FastAPI + Socket.IO (github.com/sellysimulator/lemony-backend) → Render
    └── Lemony_Frontend/     ← this repo (github.com/sellysimulator/lemony-frontend) → Firebase Hosting
```

`Lemony/` is not a git repo; each half is its own repo. Backend talk: REST `/api/v1/*` via
axios (Bearer Firebase ID token for signed-in users), Socket.IO at `/socket.io`. In dev,
`vite.config.ts` proxies both to `localhost:8080` — run the backend there. Firebase
Hosting does **not** proxy WebSockets, so production needs `VITE_SOCKET_URL` pointing at
the Render host.

### Deliberate divergences from the template

Single-player: **no rooms, lobby, host view, aliases or `host_secret`.** Everything else is
kept on purpose — Firebase/guest identity, refresh-resumes-the-game, finished games stored
server-side for stats. Don't propose dropping auth, the backend or sockets; simplifying
other template pieces needs the user's explicit OK.

## Read these instead of re-deriving

- **`README.md`** — run commands and "How it fits together". Its Firebase note is stale
  (see Gotchas).
- **`../Lemony_Backend/README.md` "Game rules"** — the de facto game spec; there is no
  separate design doc.
- **`../Lemony_Backend/app/sockets/handlers/game.py` docstring** — socket contract table.
- **`src/components/config/docs/entries.tsx`** — player-facing help for every config
  knob; the "why" behind the rules, rendered with the server's figures for the draft.
- **`../game_stack.md`** — template plumbing and the `[HARD-WON]` lessons referenced in code
  comments.

## Architecture in one pass

- **Routing is auto-discovered.** Each `src/pages/*.tsx` exports `route: RouteDescriptor
  {path, guard, element}`; `src/routes/registry.ts` globs them. Guards: `public | auth |
  backend | auth+backend`. Add a screen by adding a page file; don't edit `App.tsx`. Only
  top-level `pages/*.tsx` is globbed.
- **The game loop is one route** (`/play`, `PlayPage`), switching on `useGameStore().view`
  (`plan | day | report | over`). `viewForState` maps server phases (`planning | played |
  finished`) to views; a refresh mid-day replays the day from `state.last_day_events`.
- **Socket layer.** `src/api/socket.ts` (`autoConnect: false`; `auth` callback sends a
  fresh `{idToken, guestId}` on every connect) and `src/api/socketHandlers.ts` (all
  listeners and emits). `AuthContext` connects only after Firebase restores the session.
  On every `connect` the client emits `resume_game` from localStorage.
- **Store** (`src/store/`): `gameStore` holds server payloads and is written only by socket
  handlers; UI writes presentational flags only. `playback` holds the day-playback clock.
  `alerts` is the toast queue.
- **Sequencing.** Every server event carries a per-game `seq`; `applySequenced` drops
  anything not newer than `lastSeq`. `game_created` resets it. The one exception is
  `plan_preview`, a request-scoped reply: its listener bypasses the gate and never touches
  `lastSeq`; the store keeps only the latest `request_id`'s reply, and a refusal rides
  inside it (`error`) instead of going through the `error` listener.
- **History arrives once.** Only a full `game_state` (`full` true or missing) carries
  `days`, `last_day_events` and `summary`. `day_result` and the `game_state` after
  `ack_day` are daily: the store keeps the history it holds, appends `day_result.record`
  (skipping a day it already has) and takes the summary from `game_finished`. A daily
  event for a game the client doesn't hold sends `request_state` instead.
- **The client copies no formula: the server computes every figure.** What is left is
  display (formatting, `pct`, two-decimal `money()`), layout, chart axes and positions,
  sorting and counting. `src/game/timeline.ts` is pure playback positions from events + sim
  clock (and reads the server's sales/stock per event). Where each figure comes from:
  - Plan screen: `plan_preview` (asked, debounced 250 ms, on every plan or price change)
    gives spend, cash after, units, `can_add` per pack, cost and margin per cup, the price
    verdict (`price_error`) and the what-if curve; the state gives `packs` (prices),
    `popularity_factor` and `suggested_plan`. A server verdict gates a button only once a
    reply exists, so the screen still works if none comes (`submit_day` judges anyway).
  - Day report, end screen, profile: day records are server views (`cash_start`,
    `popularity_factor`, per type/hour `conversion`, `refused` per hour, `cups_open`); the
    summary has `conversion`, `total_perished_value`, `hour_totals`, `neutral_popularity`.
  - Playback: each event's `sales`, `stock`, `cups_left`, and the record's `inventory_open`.
  - Config screen and help: `POST /config/preview` (debounced 400 ms on every edit) gives
    the verdict, each ingredient's packs and spoilage (`ingredients`) and every help figure
    (`help`); `ConfigPage` puts it in `DocsConfigContext`, figures dim while stale, and a doc
    shows "Asking the server…" or the server's reason the config is invalid until it has
    them. `noClientFormulas.test.ts` fails if a removed copy comes back.
- **Limits come from the server.** `GET /config/defaults` and every game state carry
  `limits` (`Limits` in `types/game.ts`); `ConfigPage`, `PacksEditor`, `PlanDay` (packs of
  one size a day, price step) and the help read them. Never hand-copy a bound (not even in
  prose: the home page no longer says "1 to 30 days").
- **Saving a finished game.** `GameOver` offers "Play again" only once the game is saved
  (`publicId`); after `game_persist_failed` (store `persistFailed`) it offers "Try saving
  again" (`retryPersist` → `retry_persist`). The server also refuses a new game while the
  last finished one is unsaved (`UNSAVED_GAME`, toasted).
- **Backend wake-up.** `BackendStatusContext` polls `src/api/health.ts` (requires body
  `{status:"ok"}` so an HTML 200 doesn't count) and `BackendWakeUp` covers Render cold
  starts.

## Commands

```bash
nvm use                  # Node 24.22.1 (.nvmrc; engines ^22.23.4 || ^24.22.1 || >=26.12.1)
npm ci
npm run dev              # :5173, proxies /api + /socket.io to :8080
npm run build            # tsc -b && vite build — this is the typecheck
npm run lint
npm run test:run         # vitest + jsdom, src/__tests__/
```

Verify with build, lint and tests. Visual checks (screenshots, headless browsers) are the
user's job — don't run them unless asked.

## Contracts that span both repos

Change these together, backend first, and ship both halves in the same window. The
exception: when the backend stops sending a field this app reads (as when round events
dropped the history), ship the frontend first, or an open tab on the old frontend crashes
until it is reloaded.

| What | Frontend | Backend |
|---|---|---|
| Socket events & payloads (incl. `retry_persist`, `game_persist_failed`) | `src/api/socketHandlers.ts`, `src/types/game.ts`, `src/store/gameStore.ts` | `app/sockets/handlers/game.py`, `connection.py` |
| Plan preview (`preview_plan` with `price` → `plan_preview`: curve, cost/margin per cup, spend, cash after, units, `can_add`, `price_error`, `at_price`) | `src/api/socketHandlers.ts`, `src/types/game.ts`, `src/store/gameStore.ts`, `src/components/plan/` | `app/core/preview.py`, `app/sockets/handlers/game.py` |
| Config preview (`POST /config/preview`: verdict, `ingredients`, `help`) | `src/api/rest.ts`, `src/types/game.ts` (`ConfigPreview`), `pages/ConfigPage.tsx`, `components/config/PacksEditor.tsx`, `components/config/docs/` | `app/core/config_preview.py`, `plans.py`, `app/api/v1/config.py` |
| Config preview fixture | `src/__tests__/fixtures/config_preview.json` (byte-identical) | `tests/fixtures/config_preview.json` (= its reply for the defaults) |
| Derived record and summary figures (day views, event `sales`/`stock`/`cups_left`, state `packs`/`popularity_factor`/`suggested_plan`, profile `conversion`) | `src/types/game.ts`; shown by `PlanDay`, `DayReport`, `GameOver`, `charts/endgame/`, `day/`, `ProfilePage` | `app/core/engine.py` (`day_view`, `summarize`, `run_day`), `app/services/db_service.py`, `app/api/v1/users.py` |
| Limits (every bound, the price step) | `src/types/game.ts` `Limits`; `ConfigPage`, `PacksEditor`, `PlanDay`, the help | `core/limits.py` `public_limits()` |
| Limits fixture | `src/__tests__/fixtures/limits.json` (byte-identical) | `tests/fixtures/limits.json` |
| Cost per cup (shown, never computed) | `PlanDay`, `DayReport`, the help | `core/engine.py` `cup_cost` |
| REST shapes (incl. `POST /config/preview`) | `src/api/rest.ts` | `app/schemas/user.py`, `app/api/v1/*` |
| Engine output (`GameState`, `DayRecord`, summary) | `src/types/game.ts` (hand-written, no codegen) | `app/core/engine.py` |
| Vocabulary constants (incl. refusal reasons) | `src/types/game.ts`, `src/utils/format.ts` `REASON_TEXT` | `core/defaults.py`, `core/demand.py` |

**Money:** only the server rounds (`core/money.py`); every money figure it sends is already
to the cent, and `utils/format.ts` `money()` just prints two decimals. Game formulas belong
to the user and live on the server: keep them there, and flag a suspected bug as an
explicit before/after proposal instead of rewriting it.

## Conventions

- Strict TS with `verbatimModuleSyntax` (`import type`) and `erasableSyntaxOnly` (no enums
  or parameter properties). Relative imports, no path alias.
- PascalCase components/pages (`*Page.tsx`), camelCase modules, components grouped by
  feature (`board2d`, `board3d`, `charts`, `config`, `day`, `plan`, `report`, `shared`).
- Errors from REST: `errorMessage(err, fallback)` in `src/api/http.ts` (handles FastAPI's
  422 array `detail`). User-visible problems go through `useAlerts().push`.
- **All browser-storage keys live in `src/utils/storage.ts`**, every access wrapped in
  try/catch (`guest_id`, `lemony_game_id`, `lemony_session_token`, `board_view`).
- Styling: Tailwind v4 with tokens in `@theme` in `src/index.css` (`surface*`, `ink*`,
  `brand*`, `border`, `leaf`, `good`, `bad`, `warn`; Nunito). No tailwind config file, light
  theme only, reduced motion honoured. Use token classes, not raw colours. Flat fills only,
  no gradients (`noGradient.test.ts` fails on one), and colour is never the only signal.
  The 2D board's weather skies are the one exception to tokens: raw palette colours, with
  the weather also named in the corner chip.
- Charts: the kit lives in `components/charts/`. `chartSetup.ts` has `registerCharts()`
  (no animation under reduced motion), the palettes, `barStyle`/`lineStyle` and
  `baseOptions({xLabel, yLabel, …})` with the canvas legend off. `ChartBox` takes a title,
  `caption`, `ariaLabel`, `controls`, `legend` and a `table` (a node, or `{head, rows}` via
  `tableFromRows`), and has an error boundary. `Legend` is the DOM legend (swatches, optional
  `role="switch"` toggles). `plugins/crosshairSync` shares one hover/keyboard index across a
  `createCrosshairGroup()`; `plugins/referenceRule` draws labelled horizontal rules from
  `options.plugins.referenceRule`, never as a dataset. Every chart has a single y-axis, an
  x-axis title and a table view (accessibility). End-screen charts are in `charts/endgame/`
  (builders in `config.ts`); the plan's what-if chart is `plan/WhatIfChart.tsx`.

## Gotchas

- **`import './api/socketHandlers'` must stay the first import in `main.tsx`** so
  listeners register once, before render.
- **Never auto-connect the socket at module load** — it would handshake as a guest before
  Firebase restores the session. `[HARD-WON]`
- **`firebase.ts` uses `initializeAuth`, never `getAuth`.** `[HARD-WON]`
- **Firebase web config is committed** in `firebase.ts` (public identifiers, fine). There
  are no `VITE_FIREBASE_*` vars; `firebaseConfigured` is always true.
- **3D board** (`components/board3d/`) is lazy-loaded as its own ~1 MB chunk and falls
  back to 2D on WebGL failure. Skinned models (`child.glb`) must be cloned with
  `SkeletonUtils.clone`. Models have no animation clips (walking is a procedural bob).
  `normalize()` rescales, grounds and strips baked floor meshes. GLBs are large and all
  preloaded. Models are CC-BY — add any new one to `board3d/credits.ts` (shown on
  `/credits`). `public/3dmodels/stand.glb` is unreferenced since the switch to
  `detailed_stand.glb`.
- **`DayView`'s rAF effect disables exhaustive-deps on purpose** (restarts only when the
  watched day changes).
- **Test coverage** (18 files, 190 tests) is mostly pure logic (timeline, sceneModel,
  gameStore, openDayReport, planPreview), plus component and handler tests (`fields`,
  `Select`, `PlanDay`, `playAgain`, `socketHandlers`, `chartKit`, `endgameCharts`,
  `DayReport`, `WhatIfChart` (also the plan screen's server figures), `configLimits`: the
  help and config screen quote the served limits and show only the server's figures, from
  the recorded `config_preview.json`) and source scans (`noGradient` fails on any CSS
  gradient, `noClientFormulas` on any removed formula copy, `firebaseFile` pins the
  `firebase.ts` exports). Most components and `api/` are untested.

## Deploy

Firebase project `lemony-89f41` (site expected at `lemonysim.web.app`, per the backend's
CORS). `.github/workflows/firebase-hosting-merge.yml` builds and deploys `dist` on push to
`main`; `firebase-hosting-pull-request.yml` does preview channels. Both pin Node from
`.nvmrc`, then run lint, tests,
then build with `REQUIRE_BACKEND_ENV=1` and `VITE_*` from GitHub **repository variables**
(`vars.VITE_API_BASE_URL`, `vars.VITE_SOCKET_URL`, optional `vars.VITE_BOARD_VIEW`). The
`vite.config.ts` guard fails the build if a backend URL is empty or points at a Hosting
origin. Preview-channel origins are not in the backend's `CORS_ORIGINS`, so previews
render but can't reach the backend.

`firebase.json` serves site `lemonysim` with a `**` → `/index.html` SPA rewrite (deep
links and `health.ts`'s HTML-200 check rely on it) and caches `/3dmodels/**` for a year as
`immutable`. Model URLs carry no content hash, so **never replace a GLB in place — give the
changed model a new filename** and update `MODEL_URL` in `board3d/models.ts`, or returning
players keep the old one.
