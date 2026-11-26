# Pothole Dash

A mobile-first browser game: drive an auto-rickshaw down chaotic city roads and dodge the potholes.

**Version 0.2** covers Phase 0 (setup) and Phase 1 (core loop) of the game plan, plus touch-ups: near-miss combos and score, a 3-2-1 countdown, distance milestones, crash slow-motion and spin-out, speed lines, skid marks and a livelier roadside.

## Play locally

```bash
npm install
npm run dev      # open the printed URL, also works from your phone on the same Wi-Fi
```

## Controls

| | Phone | Desktop |
|---|---|---|
| Change lane | Swipe, or tap the left/right half | ← → or A / D |
| Pause | Pause button (auto-pauses when the tab is hidden) | P or Esc |

## Scripts

- `npm test` runs the unit tests (spawner fairness over 10,000 seeds, collision, save data, a bot run)
- `npm run build` builds the static site into `dist/` (deploy to Cloudflare Pages: build command `npm run build`, output `dist`)
- `npm run build:single` builds one self-contained HTML file into `dist-single/`

## Stack

TypeScript (strict), Vite, Canvas 2D, Web Audio, Vitest. No game engine and no image or sound files: everything is drawn and generated in code.
