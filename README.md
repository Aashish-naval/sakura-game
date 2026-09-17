# Sakura Village — The Fading Spring

A browser-based 3D adventure game built with Three.js and vanilla JavaScript. Walk a Japanese village, gather charms, befriend villagers, catch fish, race Kenta around the plaza, and help the Great Sakura bloom again.

![GitHub Pages](https://img.shields.io/badge/GitHub_Pages-blue?logo=github)

## Play

Open `index.html` directly in a modern browser — no server needed. The game loads three.js from a CDN and auto-saves progress to `localStorage`.

## How to Run

```text
index.html
sv-world.js
sv-entities.js
sv-systems.js
sv-ui.js
sv-main.js
```

Keep all six files in the same folder and open `index.html`. The boot screen shows each loading step.

## Controls

| Key | Action |
|-----|--------|
| W A S D | Move |
| Shift | Run |
| Space | Jump |
| E | Interact / advance dialogue |
| L | Toggle lantern |
| Mouse | Look |
| Wheel | Zoom |
| Escape | Pause |

## Story

Three Sakura Charms have scattered. The Great Sakura on the mountain is fading. Help Hana, Genji, Kenta, Aki, and Mizuki restore the valley's spring before it leaves forever.

## Chapter Structure

1. The Charms of Spring — gather the three charms and offer them at the old shrine.
2. The Fading Spring — speak with Genji to learn what the valley has forgotten.
3. The Four Sigils — collect the Grove, Field, River, and Dusk sigils.
4. The Fox's Path — light your lantern at night and follow the white fox to the summit.
5. Epilogue — ring the Great Bell and bring spring back to the valley.

## Side Quests

- **Kenta's Kite** — climb the red rocks in the bamboo grove to retrieve it, then race Kenta around the village.
- **Aki's Crows** — scare all five crows off the rice terraces.
- **Mizuki's River Test** — catch four kinds of fish from the dock.
- **The Dusk Jar** — catch seven fireflies in the bamboo at night.
- **Yuzu's Naps** — find all three sleeping spots for the village cat.

## Save Data

Progress auto-saves to `localStorage`. Use the Restart button in the pause menu to clear it.

## Tech

- Three.js r160
- Instanced meshes for trees, grass, petals, rain
- Custom collider grid for physics and ray-camera blocking
- Synthesized audio via Web Audio API (no external samples)
