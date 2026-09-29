# AGENTS.md

Guidance for AI coding agents (Claude Code, Codex, Cursor, Copilot, Gemini, …) working on this repo.
Human-facing docs live in `README.md`.

## What this is

**My Phone Showroom** — a static 3D site (https://phones.rr2.dev) showing every phone the owner has had,
standing on a round showroom table. Visitors orbit the table, pick a phone up, rotate it 360°, open it
up (teardown view) and compare specs with the previous phone.

Stack: **Vite 8 + Three.js r186 + GSAP**, plain ES modules, no framework, no TypeScript. Node ≥ 20.19 (see `.nvmrc`).

## Commands

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # → dist/  (must pass before committing)
npm run preview   # serve dist/ on :4173
```

There is no test suite. Verify changes by running `npm run build`, then checking the page in a browser
(or headless Playwright/Chromium with `--enable-unsafe-swiftshader`). `window.__showroom` exposes
`goTo(i)`, `pickUp()`, `openUp()`, `toggleBattery()`, `closeUp()`, `putBack()`, `goOverhead()`, `goWork()`
and `state` for scripted checks. Look at screenshots of any visual change — colours and lighting are easy to get wrong.

## Map

| File | Role |
|---|---|
| `src/data/phones.json` | All content: `personal` phones (in order), `work` phones (same shape, compared with each other), `next` (empty stand). |
| `src/main.js` | Renderer, environment maps, stands/slots, camera rig, state machine (`browse → moving → held → open`, `overhead`), UI panels, input, analytics calls. |
| `src/scene/phone.js` | Procedural phone exteriors. Per-design tables: `BEZELS`, `CORNER`; functions `addFrontDetails`, `buildBackDetails`, `addButtons`. Exports shared helpers (`MM`, `slab`, `lens`, `logoMesh`, `mats`). |
| `src/scene/interior.js` | Procedural teardown interiors, one branch per `look.backLayout`, built in "viewer space". |
| `src/scene/showroom.js` | Room (wood floor/walls), marble tables, stands, lights. |
| `src/specs.js` | Spec comparison rows (linear bars vs previous phone, ▲/▼ jump badges). |
| `src/logos.js` | Maker/OS marks from Simple Icons. |
| `src/analytics.js`, `src/config.js` | Cookieless GA4 (placeholder ID logs to console). |
| `public/CNAME` | GitHub Pages custom domain — keep it. |
| `.github/workflows/deploy.yml` | Build + deploy to Pages on push to `main`. |

## Conventions

- Units: 1 scene unit = 1 metre; use `MM` (0.001) for phone dimensions. Phone local axes: +x right, +y up, +z out of the screen.
- Phones are built from real dimensions (`dimensionsMm`) so relative sizes are true — don't scale them for looks.
  `window.__showroom.THREE` / `items` / `workItems` are exposed so you can measure models (Box3) in a script.
- Interior rectangles go through `R()`, which trims them to the frame's rounded opening — keep using it so nothing pokes through big iPhone corners.
- Teardown parts: `u`, `v`, `w`, `h` are fractions of the interior seen from the opened side, `u`/`v` from the bottom-left.
  They only position modelled parts; the part-dots/hotspot feature was removed on purpose — don't bring it back unasked.
- Interiors are modelled in code. iFixit photos may be used as a *layout reference* only; don't ship them in `public/`
  (keep references in the git-ignored `reference/` folder).
- Canvas textures are drawn procedurally. Don't copy real product artwork; printed labels use our own wording.
- Brand marks come only from Simple Icons (`simple-icons` package).
- Colour accuracy: phone glass/plastic uses the neutral `metalEnv` (see `neutralMetals` in `main.js`) so the wooden room
  doesn't tint the phones. Use `material.userData.envScale` / `keepEnv` rather than per-phone hacks.
- 2-space indent, semicolons, single quotes, small focused functions. Keep comments short and about *why*.

## Product rules (from the owner — don't change without asking)

- Personal phones are the focus; work phones sit on a separate small table, labelled only as company/work phones
  (they can be picked up and opened too). **Never name the employer.**
- Specs are neutral numbers — no marketing prose or headlines. Unknown values show "not published".
- Year sits on the left of the phone list. No boot-screen sequence, no dotted "company era" line, no blog link.
- Full 360° rotation when held and in the teardown view (drag only).
- Arrow keys while holding a phone: first press shows a toast, second press (same direction, within 3 s) puts it back and moves on.
- Analytics stays cookieless (no banner, `client_storage: 'none'`).
- An empty stand after the newest phone is intentional (for the next phone).
- Footer shows "Built by Rahul · rr2.dev". A short how-to-navigate note appears on first load and leaves by itself.
- Mobile (≤ 900 px): phone list is one scrollable strip (with a "Work phones" chip), specs are a collapsible bottom sheet.

## Adding a phone

1. Add it to `personal` in `phones.json` (order = timeline order). Include `dimensionsMm`, `specs`, `look` (incl. a new
   `backLayout`), `teardown` (`openFrom`, `parts`), `details`, `source`, `logos`.
2. Add the layout to `BEZELS`/`CORNER` and the three detail functions in `phone.js`, and a branch in `buildDetailedInterior`.
3. Stands and slots are laid out automatically (`SLOTS = personal.length + 1`).
4. Build, screenshot browse / held (front + back) / open / battery-out views, fix, commit.

## Commits & PRs

Use [Conventional Commits](https://www.conventionalcommits.org/) for every commit message and PR title:
`type(scope): summary` in the imperative mood, lower-case summary, no trailing period.

- Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`.
- Scope is optional but preferred — the area touched, e.g. `phone`, `interior`, `showroom`, `specs`, `analytics`, `deploy`.
- Breaking change: add `!` after the type/scope (`feat(main)!: …`) and explain in the body.

Examples: `feat(phone): add Pixel 8 exterior`, `fix(analytics): use real GA4 id`, `chore: remove redundant root CNAME`.

## Deploy

Push to `main` → GitHub Actions builds and publishes `dist/` to Pages at `phones.rr2.dev`.
