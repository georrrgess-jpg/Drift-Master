# Drift Master

An endless one-button drifting game in a single HTML file. It runs offline in any modern browser on desktop or mobile.

**Play:** download [`drift-master.html`](drift-master.html) and open it. No install or server needed.

## Game modes
- **Endless**: drive as far as you can. The road speeds up and grows wavy sections the further you get.
- **Levels**: hand-made-feeling (seeded) courses that end at a finish arch. Clear one to unlock the next, and the list never runs out. Each level is a little faster and longer than the one before. Earn up to 3 stars:
  - ★ for finishing,
  - ★★ for collecting half the coins,
  - ★★★ for collecting 80% of the coins without falling.

## Missions & achievements
- **Daily missions:** three a day, picked from a pool covering coins, scores, Perfects, combos, jumps, levels and runs. Each pays coins, you get one swap per day, and finishing all three opens a Daily Chest.
- **Achievements:** 18 permanent milestones with claimable rewards.

## How to play
- **Hold** (mouse, touch or any key such as Space or the arrow keys) to drift **right**.
- **Release** to swing back **left**.
- Time each turn before the corner. If you leave the edge of the floating road, you fall.
- Collect coins to unlock cars, boosters and upgrades.
- Exit a corner close to the centre line to score a **Perfect**. Chain Perfects for combo bonuses.
- `P` / `Esc` pauses.

## Features
- Smooth drift physics: heading turns at a limited rate, velocity trails behind it to create real slides, and the simulation runs at a fixed 120 Hz step.
- A procedurally generated zigzag road that never ends. Segments rise into place ahead of you and fall away behind you. Wavy sections appear later on, and the road gets faster and tighter as you go.
- **Never impossible.** Segment lengths come from a brute-force timing study of the car's exact dynamics (`tools/feasibility.js`). Every corner on the 2.25-wide road leaves at least a 0.14 s window to time the turn, the inside of each corner has a forgiving chamfer, and waves launch the car into the air when taken fast, and the speed is capped at the point where that can still be guaranteed. Two short segments are never placed back to back. Tests drove 600-second endless runs with ±30 ms of random timing error per corner and never fell.
- Eight road themes with striped and checkered surfaces, and six sky "zones" that blend into each other as your score climbs.
- Skid marks, tyre smoke, coin sparkles, body roll, wheel spin and steering, plus camera shake when you fall.
- **43 original cars**, all modelled in code, across six rarity tiers. Every car has suspension bounce, body lean, steering and spinning wheels, drift-reactive brake lights and exhaust puffs. Many also have their own moving parts: a turning cement-mixer drum, a swinging tow hook, cycling disco lights, a rocket flame, glowing hover pads, pumping hot-rod pistons, a hopping lowrider, a nodding rubber duck, a spinning pizza sign and a colour-shifting body.
- Falls tip the car over the edge before it tumbles, with road crumbs and dust. The car drops onto the road with a bounce at the start of a run and after a revive.
- **Shop**: a daily deal, three bundles, five-packs of each booster, and upgrades that preview their next level.
- **Boosters**: Double Score, Insurance, Coin Rush and Head Start.
- **Upgrades**: Traction and Coin Magnet.
- **Lucky Spin**: a free spin every 4 hours, or a paid spin with coins.
- A revive offer when you fall, a game-over screen with a score count-up, and confetti for a new best.
- Synthesised engine and skid sounds, sound effects and an original chiptune loop, all made with WebAudio.
- Progress is saved in `localStorage`.

## Performance
Drift Master targets low-end computers.
- **Graphics presets:** Low, Medium (the default) and High, chosen in Settings.
- **Draw calls:** coins and clouds are instanced, all particles render as two point clouds, and each car's static parts are merged at build time. A busy frame went from about 330 draw calls to about 75.
- **Smooth motion:** physics runs at a fixed 120 Hz and the render interpolates between steps, so movement stays smooth at any frame rate.
- **Road geometry:** the road is built whole, well beyond the fog. Neighbouring segments share edge vertices and leave out buried faces, so there is no pop-in and no cracks.

## Development
`tools/min-length-table.js` regenerates the segment-length safety table for the current road and handling (`HW=1.125 TB=4.8 TK=0.3 GR=9.5 node tools/min-length-table.js 0.14`).

The source is in `src/`. `build.js` inlines the CSS, the game code and three.js into the single distributable file:

```
node build.js   # writes drift-master.html
```

## Credits
Rendering uses [three.js](https://threejs.org) r149 (MIT licence), bundled in `vendor/`. Every model, texture, sound and piece of music is generated in code for this project.
