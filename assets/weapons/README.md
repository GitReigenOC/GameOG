# Weapon models

Place the weapon models in this directory using these filenames:

| Weapon slot | Model file |
| --- | --- |
| 1 — Rifle | `rifle.glb` |
| 2 — Sniper | `sniper.glb` |
| 3 — Shotgun | `shotgun.glb` |
| 4 — SMG | `smg.glb` |
| 5 — Knife | `knife.glb` |

The game loads these files with Three.js `GLTFLoader`. The manifest currently uses
`.glb`; to use `.gltf`, change the corresponding path in `game.js` and keep any
external textures or buffers alongside the GLTF file.
Models are attached to the camera for the first-person view and should be authored
facing local negative Z, with their grip near the origin. The loader applies an
initial scale of `0.5` (`0.42` for the knife); adjust the scale in `initializeWeapons`
if an asset uses different dimensions.

Until a model file is present and loads successfully, the corresponding built-in
3D weapon remains visible.

The built-in models use the game's procedural dark composite finish and remain
playable without external assets. The loadout panel supports optic, suppressor,
and foregrip attachments; their meshes are rendered over either the built-in
model or a loaded GLB. The optic adds a modest ADS zoom, the foregrip tightens
spread, and the suppressor lowers the firing volume.

Player and bot characters are currently assembled from articulated procedural
parts in `game.js`; no character rig files are required.
