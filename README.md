# Pixel Office Live

A public, view-only pixel-art office showing OpenClaw agents at work, hosted on
GitHub Pages: **https://onelif2.github.io/pixel-office-live/**

## How it works

```text
private machine                          GitHub                      visitors
────────────────                         ──────────────────────      ────────
snapshot exporter (path + cron)  ──push──▶  data branch: state.json
sanitized facts only                        main branch: this app ──▶ Pages (static)
                                                                      realtime stream
                                                                      + state.json fallback
```

- The page is a **static export** (`next build`, `output: 'export'`). There are
  no API routes, no server, and no connection to any private infrastructure.
- Facts (who is working/idle, seat, subagent count) come from `state.json` on
  the `data` branch — a single, amended commit written by an exporter that
  projects private state through an allow-list sanitizer. Schema v1 fields:
  `v, ts, staleAfterMs, agents.{n,e,s,ls,sub,seat}, pets[].{kind,name}`.
- The browser polls raw GitHub every 20 seconds and the GitHub Contents API
  every 4th cycle as the fresher source.
- If `NEXT_PUBLIC_FIREBASE_DATABASE_URL` is set at build time, the browser also
  subscribes to Firebase Realtime Database over Server-Sent Events and keeps
  GitHub polling as a slower fallback.
- The page shows a **total viewed** count at the bottom-right, backed by
  counterapi.dev (anonymous, no account, no backend of our own). There is no
  live/concurrent viewer count. Counting is enabled only on
  `https://onelif2.github.io/pixel-office-live/`; local and Jetson preview URLs
  do not increment it.
- The refresh button forces an immediate poll, including the GitHub Contents
  API freshness source.
- Everything else (characters wandering, pets, weather, animations) runs
  client-side in your browser between snapshots.
- If snapshots stop, the page stays up and shows a stale badge.
- Weather selection is per-visitor (localStorage only).

## Visitor counting scope

Visitor counting is deliberately limited to the public GitHub Pages URL:

```text
https://onelif2.github.io/pixel-office-live/
```

At runtime the visitor counter checks both `window.location.origin` and the
normalized pathname before it calls counterapi.dev. With the default settings,
only this exact public page is counted:

- origin: `https://onelif2.github.io`
- path: `/pixel-office-live`

Local preview, Jetson dashboard, and development URLs such as these do not
increment the total viewed count:

- `http://192.168.1.164:3000`
- `http://localhost:3001`

The allowed URL can be changed at build time with
`NEXT_PUBLIC_VISITOR_ALLOWED_ORIGIN` and `NEXT_PUBLIC_VISITOR_ALLOWED_PATH`, but
those should normally stay on the GitHub Pages defaults.

## Visitor counter

The "total viewed" badge is backed by **counterapi.dev v1**, a free anonymous
counter — no account, API key, or backend of our own. The visitor's browser
calls it directly (CORS is open), so nothing runs on the Jetson:

- increment once per tab session: `GET https://api.counterapi.dev/v1/<namespace>/<name>/up`
- otherwise read the total: `GET https://api.counterapi.dev/v1/<namespace>/<name>/`
- the displayed number is the `count` field of the JSON response

Build-time overrides (all optional — the defaults work with zero setup):

- `NEXT_PUBLIC_COUNTER_NAMESPACE`, default `onelif2-pixel-office-live`
- `NEXT_PUBLIC_COUNTER_NAME`, default `views`
- `NEXT_PUBLIC_COUNTER_BASE_URL`, default `https://api.counterapi.dev/v1`

This is a public, decorative counter: anyone can hit the endpoint, so do not
treat the number as audited analytics. v1 is counterapi.dev's legacy anonymous
tier; if it is ever retired, point the override vars at a replacement that
returns `{ "count": <number> }`.

## Development

```bash
npm install
npm run dev        # http://localhost:3001/pixel-office-live/ (uses mock-state.json)
npm run build      # static export to out/
npm run check-static  # assert the build contains no /api references
```

`lib/pixel-office/` (engine) and `public/assets/pixel-office/` are vendored
from a private workspace via `npm run sync-engine`; edit them there, not here.

## Optional realtime transport

The static page can receive snapshots from Firebase Realtime Database without
adding a frontend dependency (this is for live *state*, separate from the
visitor counter above):

- Build-time GitHub repository variables:
  - `NEXT_PUBLIC_FIREBASE_DATABASE_URL`, for example
    `https://your-project-default-rtdb.firebaseio.com`
  - `NEXT_PUBLIC_FIREBASE_STATE_PATH`, default `pixel-office/live/state`
  - `NEXT_PUBLIC_FIREBASE_STREAM_URL`, optional full `.json` stream URL override
- The database path must allow public read access to the sanitized state only.
  Do not expose private OpenClaw paths or raw session content.

When these variables are not set, the page behaves exactly like the GitHub-only
polling version.

## Data scrub procedure

The `data` branch keeps exactly one commit (`--amend` + force push). If a bad
snapshot is ever published: force-push an amended clean commit (history is
gone for new clones immediately), contact GitHub support to purge cached
views if needed, and rotate any credential that leaked regardless.
