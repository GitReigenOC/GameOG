# Weapon models

Place the weapon models in this directory using these filenames:

| Weapon slot | Model file |
| --- | --- |
| 1 — Rifle | `rifle.glb` |
| 2 — Sniper | `sniper.glb` |
| 3 — Shotgun | `shotgun.glb` |
| 4 — SMG | `smg.glb` |
| 5 — Knife | `knife.glb` |

`WeaponAssetLoader.js` loads GLB or GLTF assets with Three.js `GLTFLoader`. It
automatically scales each model to fit the first-person view. Models should face
local negative Z, with the grip near their origin. Give muzzle nodes names such
as `Muzzle`, `BarrelTip`, or `Barrel_End` to place the visual tracer at the
correct location; otherwise configure a local `muzzle` offset.

The default model paths are relative to the site root. To use different freely
licensed assets, set `window.BLACKSITE_WEAPON_ASSETS` before `main.js` loads:

```html
<script>
  window.BLACKSITE_WEAPON_ASSETS = {
    rifle: {
      url: "assets/weapons/my-rifle.gltf",
      rotation: [0, 0, 0],
      position: [0, -0.08, -0.12],
      muzzle: [0, 0.025, -0.62],
      sight: [0, 0.17, -0.04],
      handPosition: [0, 0, 0],
      handRotation: [0, 0, 0],
      handScale: 1
    },
    knife: "assets/weapons/my-tactical-knife.glb"
  };
</script>
```

Each weapon may be configured by its slot name (`rifle`, `sniper`, `shotgun`,
`smg`, `knife`) or slot index (0-4). Supported options are `url`, `scale`,
`position`, `rotation`, `muzzle`, `handPosition`, `handRotation`, and
`handScale`. Set `scale` explicitly when automatic fit is not appropriate.
For true iron-sight ADS alignment, name a node `IronSight`, `ADSSight`, or
`AimPoint`, or set a local `sight` offset in the asset configuration.
GLTF files may reference neighboring texture and buffer files.

The game intentionally does not generate primitive weapon substitutes. If an
asset has not been added yet, that slot has no visible model and the loader logs
the requested path. Models without attachment nodes named `optic`/`scope`,
`suppressor`/`silencer`, or `foregrip`/`vertical_grip` will not display the
corresponding loadout attachment.
