# Pothole Dash

A mobile-first browser game in low-poly 3D. Dodge potholes in an auto-rickshaw, then drive Raj's family 500 km out of a zombie-struck Mumbai.

**Version 1.0**

- **Free Run:** an endless drive across Mumbai, Thane, Bangalore, New York and London. Each city has its own traffic, weather and music. Coins buy seven vehicles and unlock maps. Points carry over to Story Mode.
- **Story Mode:** Raj (a cab driver), Tanvi (a mechanic), their daughter Lara and Sheru the dog have 72 hours to reach a survivor camp.
  - Comic scenes, and an on-foot escape from their building.
  - A choice of three camps, each its own road on a route map that shows km to go:
    - via Kasara Ghat and Nashik
    - via Bhor Ghat and Pune
    - down the Konkan coast
  - Drives through city, highway, ghat and coast roads.
  - Stops along the way:
    - fuel pump and supermarket runs on foot
    - Tanvi's workshop, with 8 SUV upgrades and paint
    - survivors you can take along
  - The radio goes silent, the camp gates are under siege, and there are two endings.
  - Zombies stagger and fade, with no blood.
- **Offline:** install the game to your home screen; after the first visit it plays without a network.

## Play locally

```bash
npm install
npm run dev      # open the printed URL, also works from your phone on the same Wi-Fi
```

## Controls

| | Phone | Desktop |
|---|---|---|
| Change lane | Swipe, or tap the left/right half | ← → or A / D |
| Boost / brake | Hold the Boost / Brake pedals | ↑ / ↓ or W / S |
| Walk (on foot) | Drag anywhere on the left | WASD or arrows |
| Swing (on foot) | Swing button | Space, J or K |
| Story scenes | Tap to continue | Enter or → |
| Pause | Pause button (auto-pauses when the tab is hidden) | P or Esc |

## Scripts

- `npm test` runs the unit tests: spawner fairness, collision, save data and migrations, bot runs on every map, Story rules, on-foot levels and the campaign.
- `npm run build` builds the static site and service worker into `dist/` (deploy to Cloudflare Pages: build command `npm run build`, output `dist`).
- `npm run build:single` builds one self-contained HTML file into `dist-single/` for quick previews (no offline cache).

## Stack

TypeScript (strict), Vite, Three.js, Web Audio, Vitest. There are no image or sound files besides the app icons: every model, scene, map and tune is drawn or generated in code.
