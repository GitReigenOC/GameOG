# Character model

The game uses an articulated procedural operator when no rigged model is
available. To enable the optional animated enemy rig, place a glTF binary named
`soldier.glb` in this directory. The model should:

- Use meters and face local negative Z.
- Include a right-hand bone named `Hand_R` (preferred), `hand_r`,
  `mixamorigRightHand`, or `Right_Hand`; the loaded weapon model is parented
  directly to that bone. Configure `handPosition`, `handRotation`, and
  `handScale` for assets whose grip does not align with the rig's hand.
- Include an animation clip for locomotion (the first clip is looped).
- Keep a conventional head, chest/spine, and limb skeleton so the game can add
  its transparent hit colliders to those bones.

The procedural articulated model remains the fallback if the rig or required
hand socket is absent.
