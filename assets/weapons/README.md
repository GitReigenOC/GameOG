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
