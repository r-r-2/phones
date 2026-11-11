# Day 3 — 11 Nov 2026

Branches: `feat/iphone-17-pro` → `feat/ring-table` (stacked). Shots in `devlog/shots/day-3/` (git-ignored).

- Rahul got a Deep Blue iPhone 17 Pro (256 GB). It takes the stand that was waiting; the empty stand is on hold (`next: null`).
- First attempt used a CC BY 4.0 Sketchfab model (PikkmeStudios) as downloaded. Rahul: "i hate the pasting photo thing" —
  the model's texture was Apple's product photos. Kept only the shape; `iphone17pro.js` paints our own finish onto its UVs
  (Deep Blue aluminium, glass panel, Simple Icons mark, our lock screen). Prepare script strips the texture. Credit in the footer.
- Camera rings were blotchy (bad exported normals) → recomputed; camera glass z-fought the rings → thin sheen instead of
  transmission; apple mark was 25% small → 16 × 20 mm measured on the model; plateau paint re-read from the model's vertices.
- Ring table: brought in the 5 Oct commit from Rahul's Mac. Opens on the oldest phone, wraps both ways, "From above" is a
  chip top-left (the empty stand that carried it is gone).
- Moto E traced from GSMArena's front/back/side (3.5 px/mm, the only straight-on photos available). The point is the
  curved back: a radial height-map over the rounded-rect footprint, 12.3 mm in the middle rolling off to the edges,
  with the Motorola dimple cut into the surface and the batwing lying in it. Insides moved up behind the seam.
  Shots: motoe-traced

## Next
- Trace Redmi Note 3 and iPhone 13 mini; Blender pilot still pending.
