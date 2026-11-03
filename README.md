# Lemony Frontend

This is the React 19 + Vite + TypeScript client for Lemony, built with Tailwind v4, Zustand, Socket.IO, Chart.js and react-three-fiber. The server computes every number. The client renders the state it receives and plays each day back.

## Run

```bash
npm ci
cp .env.example .env        # optional; Firebase web config is committed in firebase.ts
npm run dev                 # http://localhost:5173 — proxies /api and /socket.io to the backend on :8080
npm run build && npm run lint && npm run test:run
```

## How it fits together

| Area | Files |
|---|---|
| Identity | `firebase.ts`, `src/auth/AuthContext.tsx`: Google sign-in or guest. The socket stays disconnected until auth resolves, and every handshake sends a fresh ID token or the guest id. |
| Socket | `src/api/socket.ts` sets up the connection. `src/api/socketHandlers.ts` registers every listener once, before React renders, and re-emits `resume_game` on every connect. That is how a refresh or a dropped connection gets back to the game. |
| Store | `src/store/gameStore.ts` is the single store and is written only by socket handlers. It drops any event whose `seq` is not newer than the last one applied. The exception is `plan_preview`, the request-scoped what-if reply: it has no `seq`, and only the latest `request_id`'s reply is kept. It also remembers a failed save (`game_persist_failed`): the end screen then offers a retry, and "Play again" only once the game is saved. |
| Rules and figures | The server owns them and computes every figure the client shows. Every bound comes as `limits` with the config defaults and every game state. The plan screen's spend, cash after, units, pack prices, cost and margin per cup and what-if curve come from `plan_preview` and the state; the day report, end screen and profile read server fields (success rates, cash at the start of each day, totals); the config screen and its help read `POST /config/preview`. The client copies no formula (`noClientFormulas.test.ts`), and only formats, lays out and charts. |
| Routes | Each file in `src/pages/*` exports `route`, and `routes/registry.ts` discovers them. Pages: `/`, `/home`, `/new` (config), `/play`, `/profile`, `/profile/games/:gameId`, `/credits`. |
| Playback | `src/game/timeline.ts` is pure. An actor's position is a function of the clock and its arrival minute, so changing speed, pausing or skipping needs no extra state. |
| Boards | `components/board2d/Board2D.tsx` is the 2D view. `components/board3d/*` is the 3D view: it is lazy-loaded in its own chunk, has a pure `sceneModel.ts`, uses the GLB models in `public/3dmodels` (CC-BY, see `/credits`), and falls back to 2D on any WebGL failure. |
| Charts | `components/charts/*` is the chart kit: the validated dataviz palette, `ChartBox`, a DOM `Legend`, a crosshair shared across a group of charts, and reference rules drawn without being datasets. Every chart has a single y-axis, an x-axis title and a table view. The end screen's charts are in `components/charts/endgame/`. The morning plan's what-if curve (`components/plan/WhatIfChart.tsx`) is drawn from the server's `plan_preview` reply. |
