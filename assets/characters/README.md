# Character model

The game uses an articulated procedural operator when no rigged model is
available. To enable the optional animated enemy rig, place a glTF binary named
`soldier.glb` in this directory. The model should:

- Use meters and face local negative Z.
- Include a named right-hand bone such as `RightHand`, `hand_r`, or
  `mixamorigRightHand`; the weapon is parented directly to that bone.
- Include an animation clip for locomotion (the first clip is looped).
- Keep a conventional head, chest/spine, and limb skeleton so the game can add
  its transparent hit colliders to those bones.

The procedural articulated model remains the fallback if the rig or required
hand socket is absent.
