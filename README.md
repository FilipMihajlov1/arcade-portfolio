# Arcade Portfolio

A developer portfolio built as an interactive 3D arcade cabinet — not a website with a 3D model bolted on, but a scene you walk up to and play. Everything you'd normally scroll past (projects, skills, about, contact) lives on the cabinet's in-world screen, navigated with the joystick and buttons like an actual arcade machine.

**Live demo:** [https://arcade-portfolio-rosy.vercel.app/]

## Features

- **Hand-modeled cabinet** — built from scratch in Blender, exported as a single `.glb` and loaded with `GLTFLoader`.
- **Real 3D joystick control** — the joystick isn't a 2D hitbox; it's raycast against the actual mesh, dragged, and tilted on two axes with a custom pivot, then snaps back on release.
- **Canvas2D screen, rendered live** — every screen (attract, projects, skills, about, contact, "built with") is hand-drawn with the Canvas2D API onto a texture mapped onto the cabinet's screen mesh, redrawn every frame.
- **Cinematic camera intro** — the camera dollies in from a fogged-out distance to resting position on page load, eased with a cubic-out curve.
- **"Insert coin" boot sequence** — a click-to-enter overlay (with a full controls legend) gates the experience behind a real user gesture, which also unlocks browser autoplay for audio/video. From there a short "game over" video clip plays on the in-world screen before the attract screen takes over.
- **Room + atmosphere** — fog, a two-wall corner, floor sheen, and `UnrealBloomPass` post-processing for glow on the neon-lit cabinet.
- **Sound design** — button clicks, section-switch sounds, and an "insert coin" cue, all played through the Web Audio API.
- **Keyboard + mouse input** — every button and the joystick can be driven by mouse/click or by keyboard (`Z` / `X` / `A` / `S` + joystick drag), matching the on-screen controls guide.

## Tech stack

- [Three.js](https://threejs.org/) — scene graph, rendering, raycasting, post-processing
- [Vite](https://vitejs.dev/) — dev server and build
- Blender — cabinet modeling and export
- Canvas2D API — all in-cabinet screen UI, no HTML/CSS UI framework
- Web Audio API — sound effects
- Vanilla JavaScript — no framework, no state library

## Running locally

```bash
npm install
npm run dev
```

Then open the local URL Vite prints (typically `http://localhost:5173`).

To build for production:

```bash
npm run build
npm run preview
```

## Project structure

```
public/
  cabinet.glb        # the hand-modeled arcade cabinet
  sounds/             # click, switch, and insert-coin sound effects
  videos/             # the "game over" intro clip
src/
  main.js             # the entire application — scene setup, input, screens, audio, camera
index.html
```

## Controls

| Input              | Action              |
| ------------------- | -------------------- |
| Joystick / drag      | Navigate highlighted item |
| `Z`                  | Start / confirm       |
| `X`                  | Home                  |
| `A`                  | Settings              |
| `S`                  | Contact               |

## Author

Filip Mihajlov — [linkedin.com/in/filip-mihajlov](www.linkedin.com/in/filip-mihajlov-6061b7269)
