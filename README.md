# Tickle Struggle

Adult fantasy 2D action game built with Vite + TypeScript + Canvas.

## Run

npm install
npm run dev

Open http://localhost:5173

npm run build
npm run preview

## Controls

- Move: WASD / Arrows
- Melee: J / LMB (~62.5 stamina)
- Projectile: K / RMB (125)
- Dash: L / Shift / Space (125; ungrabbable while dashing)
- Struggle: mash E / Space while grabbed
- Pause: Esc

## Gameplay

- Resolve green max 1500; potions + level clear refill; 0 = defeat then restart from save
- Stamina blue max 500; fast regen
- Struggle yellow while grabbed
- 10x3 missions; Mission 1 tuned; boss unlocks next
- Cheats, Gallery, Save, Autosave

## Architecture

src/game entities systems data ui save

## Cheats

Infinite Resolve/Stamina, Instant Struggle, One-Hit Kill, Unlock All Missions.
