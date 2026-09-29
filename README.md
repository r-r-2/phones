# My Phone Showroom

Every phone I've owned, standing on a round showroom table. Orbit around the table, pick a phone up, turn it around, and open it up to see inside.

Five personal phones (Motorola SLVR L7e → iPhone 13 mini), an empty stand for the next one, and the four work phones on a small table in the background.

Live at **https://phones.rr2.dev** (GitHub Pages).

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dist/
npm run preview    # serve dist/ locally
```

## Using it

| | |
|---|---|
| Next / previous phone | arrow buttons, ← →, scroll wheel, swipe, or click a phone / a year in the list |
| Pick up | "Pick it up", or click the phone in front |
| Turn it around | drag anywhere (360° in every direction, with a little inertia) |
| Open it up | "Open it up" → the cover slides off to show the insides |
| Battery out | "Lift the battery" |
| Put it back | "Close it up" → "Put it back", or Esc |
| Whole table | "View from above" after the last phone |
| Work table | the list on the left, or "Work table" from the overhead view |

## Project layout

```
index.html
src/
  main.js              scene, camera orbit, pick-up / rotate / teardown, UI wiring
  specs.js             spec rows: before → now bars (linear), jump badges
  logos.js             maker / OS marks from Simple Icons
  analytics.js         GA4, cookieless
  config.js            GA4 measurement ID
  styles.css
  data/phones.json     everything about the phones (the main file to edit for content)
  scene/showroom.js    room, tables, stands, lighting
  scene/phone.js       procedural phone exteriors (per-design front/back details)
  scene/interior.js    procedural teardown interiors (per-design layouts)
public/CNAME           custom domain for GitHub Pages
```

### Adding a phone

1. Add an entry to `personal` in `src/data/phones.json` (`dimensionsMm`, `specs`, `look`, `teardown`, `details`).
2. Give it a `look.backLayout` and add that layout to `BEZELS` / `CORNER` / `addFrontDetails` / `buildBackDetails` / `addButtons` in `scene/phone.js`, and to `buildDetailedInterior` in `scene/interior.js`.
3. Teardown `parts` positions are fractions of the interior as you look at the opened side (`u`, `v` from the bottom-left, `w`, `h`).

Teardown interiors are modelled in code, using iFixit teardown photos only as a layout reference (the photos are not part of the site).

## Analytics (GA4, cookieless)

Paste your measurement ID into `src/config.js`. Until then nothing is loaded and events are printed to the browser console.

- **No cookies, no local storage** (`client_storage: 'none'`). A random ID lives in memory for one visit only, so events within a visit link up but visits don't. GA will count each visit as a new user — that's the trade-off for no cookies and no banner.
- Google signals and ad personalisation are off.
- Check events in GA4 → Admin → DebugView or Realtime.

Events sent:

| Event | When | Params |
|---|---|---|
| `page_view` | automatic | |
| `view_phone` | camera arrives at a phone | `phone_id`, `phone_name`, `source` (start / button / key / scroll / swipe / click / directory) |
| `pick_up_phone` | phone picked up | `phone_id`, `phone_name` |
| `rotate_phone` | first drag-rotate per phone and view | `phone_id`, `view` (held / open) |
| `open_teardown` | phone opened | `phone_id`, `phone_name` |
| `teardown_step` | battery lifted / put back | `phone_id`, `step` |
| `overhead_view` | "View from above" | |
| `work_table_view` | first visit to the work table | `source` |
| `view_work_phone` | a work phone in front | `phone_id`, `phone_name` |
| `open_specs_mobile` | specs expanded on a phone screen | |

To report on `phone_id`, `part` etc., register them as custom dimensions in GA4 (Admin → Custom definitions).

## Hosting

GitHub Pages via GitHub Actions (`.github/workflows/deploy.yml`): every push to `main` builds with Vite and publishes `dist/`.

One-time setup:

1. Repo → Settings → Pages → **Source: GitHub Actions**.
2. DNS: add a `CNAME` record `phones` → `r-r-2.github.io`.
3. Settings → Pages → Custom domain `phones.rr2.dev` (already set by `public/CNAME`), then tick **Enforce HTTPS** once the certificate is issued.
