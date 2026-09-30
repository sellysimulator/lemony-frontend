# Lemony Frontend

This is the React 19 + Vite + TypeScript client for Lemony, built with Tailwind v4, Zustand, Socket.IO, Chart.js and react-three-fiber. The server computes every number. The client renders the state it receives and plays each day back.

## Run

```bash
npm ci
cp .env.example .env        # optional: VITE_FIREBASE_* enables Google sign-in (guest-only without it)
npm run dev                 # http://localhost:5173 — proxies /api and /socket.io to the backend on :8080
npm run build && npm run lint && npm run test:run
```

## How it fits together

| Area | Files |
|---|---|
| Identity | `firebase.ts`, `src/auth/AuthContext.tsx`: Google sign-in or guest. The socket stays disconnected until auth resolves, and every handshake sends a fresh ID token or the guest id. |
| Socket | `src/api/socket.ts` sets up the connection. `src/api/socketHandlers.ts` registers every listener once, before React renders, and re-emits `resume_game` on every connect. That is how a refresh or a dropped connection gets back to the game. |
| Store | `src/store/gameStore.ts` is the single store and is written only by socket handlers. It drops any event whose `seq` is not newer than the last one applied. |
| Routes | Each file in `src/pages/*` exports `route`, and `routes/registry.ts` discovers them. Pages: `/`, `/home`, `/new` (config), `/play`, `/profile`, `/profile/games/:id`, `/credits`. |
| Playback | `src/game/timeline.ts` is pure. An actor's position is a function of the clock and its arrival minute, so changing speed, pausing or skipping needs no extra state. |
| Boards | `components/board2d/Board2D.tsx` is the 2D view. `components/board3d/*` is the 3D view: it is lazy-loaded in its own chunk, has a pure `sceneModel.ts`, uses the GLB models in `public/3dmodels` (CC-BY, see `/credits`), and falls back to 2D on any WebGL failure. |
| Charts | `components/charts/*` uses the validated dataviz palette. Every chart has a single y-axis and a table view. |
