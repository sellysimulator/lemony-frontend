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
  knob; the "why" behind the rules, rendered with live examples.
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
  anything not newer than `lastSeq`. `game_created` resets it.
- **Client-side maths is display only.** `src/game/timeline.ts` (pure playback positions
  from events + sim clock), `costing.ts` (plan preview of FIFO costing), `configMath.ts`
  (config-help illustrations). None of it decides an outcome.
- **Backend wake-up.** `BackendStatusContext` polls `src/api/health.ts` (requires body
  `{status:"ok"}` so an HTML 200 doesn't count) and `BackendWakeUp` covers Render cold
  starts.

## Commands

```bash
nvm use                  # Node 20.19 (.nvmrc; engines >=20.19)
npm ci
npm run dev              # :5173, proxies /api + /socket.io to :8080
npm run build            # tsc -b && vite build — this is the typecheck
npm run lint
npm run test:run         # vitest + jsdom, src/__tests__/
```

Verify with build, lint and tests. Visual checks (screenshots, headless browsers) are the
user's job — don't run them unless asked.

## Contracts that span both repos

Change these together, backend first, and ship both halves in the same window:

| What | Frontend | Backend |
|---|---|---|
| Socket events & payloads | `src/api/socketHandlers.ts`, `src/types/game.ts` | `app/sockets/handlers/game.py`, `connection.py` |
| REST shapes | `src/api/rest.ts` | `app/schemas/user.py`, `app/api/v1/*` |
| Engine output (`GameState`, `DayRecord`, summary) | `src/types/game.ts` (hand-written, no codegen) | `app/core/engine.py` |
| Money rounding | `src/utils/money.ts` `roundCents` | `app/core/money.py` `round_cents` |
| Rounding fixture | `src/__tests__/fixtures/rounding_cases.json` | `tests/fixtures/rounding_cases.json` (byte-identical) |
| Pack price, purchase cost | `src/game/configMath.ts` `packPrice`, `src/game/costing.ts` | `core/config_model.py`, `core/engine.py` |
| Demand/perish maths | `src/game/configMath.ts` | `core/demand.py`, `people.py`, `ingredients.py`, `weather.py` |
| Vocabulary constants | `src/types/game.ts` | `core/defaults.py` |

**Rounding rule:** `Number((v*100).toPrecision(12))`, round half away from zero, `/100`,
`+0` to drop `-0`. `utils/format.ts` `money()` rounds before display so the client never
disagrees with the server by a cent. Game formulas belong to the user: keep them, and flag
a suspected bug as an explicit before/after proposal instead of rewriting it.

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
  theme only, reduced motion honoured. Use token classes, not raw colours.
- Charts: register parts and palettes in `charts/chartSetup.ts`; every chart goes in
  `ChartBox` with a `table={head, rows}` "Show table" fallback (accessibility).

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
- **Test coverage** is pure logic only (money, costing, configMath, timeline, sceneModel,
  gameStore). Components, socket handlers and `api/` are untested.

## Deploy

Firebase project `lemony-89f41` (site expected at `lemonysim.web.app`, per the backend's
CORS). `.github/workflows/firebase-hosting-merge.yml` builds and deploys `dist` on push to
`main`; `firebase-hosting-pull-request.yml` does preview channels. Both run lint, tests,
then build with `REQUIRE_BACKEND_ENV=1` and `VITE_*` from GitHub **repository variables**
(`vars.VITE_API_BASE_URL`, `vars.VITE_SOCKET_URL`, optional `vars.VITE_BOARD_VIEW`). The
`vite.config.ts` guard fails the build if a backend URL is empty or points at a Hosting
origin. Preview-channel origins are not in the backend's `CORS_ORIGINS`, so previews
render but can't reach the backend.

Known gap — verify before relying on it:
- **`firebase.json` has no SPA rewrite**, so a hard load of a deep link like `/play` 404s on
  Hosting; `health.ts`'s comment assumes a `**` rewrite exists.
