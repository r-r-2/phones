# Day 2 — 2026-09-29

## Starting point
- Five personal phones + empty stand live at https://phones.rr2.dev
- Planned for today: make it more realistic; redo the spec sheet (Rahul isn't happy with it)

## Log
<!-- newest last: time — what changed — why — screenshot -->
- 00:30 — Work phones got the full treatment: iPhone 6 Plus, 7 Plus, 11 and 13 now have their own exteriors (6 Plus antenna bands + home button, 7 Plus dual-camera pill, 11 square camera bump, 13 diagonal cameras in Midnight), teardown interiors laid out from iFixit guides (6/7 Plus: board down the right, big battery left, aluminium rear case; 11/13: board left, battery right, Taptic Engine), full specs and "before → now" comparisons against the previous company phone. They can be picked up and opened like the personal ones. — shots: work-6plus-back, work-7plus-back, work-11-open, work-13-back
- 00:40 — Footer: "Built by Rahul · rr2.dev". — shot: footer
- 00:50 — Mobile pass: phone list is a single swipeable strip with a "Work phones" chip at the end; specs are a bottom sheet (collapsed by default) that no longer covers the controls; buttons keep their labels (only prev/next are icon-only); steps and hints moved to the top; tapping a part dot shows its name as a toast instead of a tooltip that went off-screen. — shots: mobile-browse, mobile-open, mobile-work
- 01:00 — First-load note: "Welcome to the showroom" with three lines on how to get around (swipe/tap wording on touch, arrows/click on desktop); leaves after a few seconds or on the first tap/key. — shot: intro
- 09:45 — Fix pass on branch `fix/day2-visual-fixes`:
  - Battery "merging" into the back cover on the phones that open from the back (SLVR, Karbonn, Moto E, Redmi): the cover and the battery were sliding out to the same side. The cover now always slides to the right and the battery lifts out to the left.
  - Karbonn A7 rebuilt after the real phone (it's an HTC-Desire-style design): grey glass front with a white chin and a silver pill button, silver side band, white back with the red camera ring, flash beside it, red "Karbonn" wordmark and a two-slot speaker.
  - Thickness check: every frame now measures exactly its listed size (the bevel was adding ~1 mm to width and height). Cameras on phones with near-flush lenses (Redmi, Moto E, SLVR, Karbonn) no longer stick out 1 mm; 7 Plus bump lowered.
  - Work iPhones "edges popping out at the corners": interior parts were square-cornered and poked through the big rounded corners. Every interior part is now trimmed to the frame's rounded opening, and the mid-plate follows the corner radius. Also toned down the glass-edge glare that drew a grey rim round dark phones.

## Screenshots to use
- devlog/shots/day-2/ (work phones, mobile, intro)

## Open questions / next
