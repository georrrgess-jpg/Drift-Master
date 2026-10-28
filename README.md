# Drift Master

An endless one-button drifting game in a single HTML file. It runs offline in any modern browser on desktop or mobile.

**Play:** download [`drift-master.html`](drift-master.html) and open it. No install or server needed.

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
- Eight road themes with striped and checkered surfaces, and six sky "zones" that blend into each other as your score climbs.
- Skid marks, tyre smoke, coin sparkles, body roll, wheel spin and steering, plus camera shake when you fall.
- **25 original cars**, all modelled in code, across six rarity tiers. The lineup includes a hatchback, a cab, a patrol car, a medic van, an ice-cream van, a fire engine, a school bus, a monster truck, an open-wheel racer and a gold car.
- **Boosters**: Double Score, Insurance, Coin Rush and Head Start.
- **Upgrades**: Traction and Coin Magnet.
- **Lucky Spin**: a free spin every 4 hours, or a paid spin with coins.
- A revive offer when you fall, a game-over screen with a score count-up, and confetti for a new best.
- Synthesised engine and skid sounds, sound effects and an original chiptune loop, all made with WebAudio.
- Progress is saved in `localStorage`.

## Development
The source is in `src/`. `build.js` inlines the CSS, the game code and three.js into the single distributable file:

```
node build.js   # writes drift-master.html
```

## Credits
Rendering uses [three.js](https://threejs.org) r149 (MIT licence), bundled in `vendor/`. Every model, texture, sound and piece of music is generated in code for this project.
