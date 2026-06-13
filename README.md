# Pixel Office Live

A public, view-only pixel-art office showing OpenClaw agents at work, hosted on
GitHub Pages: **https://onelif2.github.io/pixel-office-live/**

## How it works

```text
private machine                          GitHub                      visitors
────────────────                         ──────────────────────      ────────
snapshot exporter (path + cron)  ──push──▶  data branch: state.json
sanitized facts only                        main branch: this app ──▶ Pages (static)
                                                                      fetches state.json
                                                                      every 20 s
```

- The page is a **static export** (`next build`, `output: 'export'`). There are
  no API routes, no server, and no connection to any private infrastructure.
- Facts (who is working/idle, seat, subagent count) come from `state.json` on
  the `data` branch — a single, amended commit written by an exporter that
  projects private state through an allow-list sanitizer. Schema v1 fields:
  `v, ts, staleAfterMs, agents.{n,e,s,ls,sub,seat}, pets[].{kind,name}`.
- The browser polls raw GitHub every 20 seconds and the GitHub Contents API
  every 4th cycle as the fresher source.
- The refresh button forces an immediate poll, including the GitHub Contents
  API freshness source.
- Everything else (characters wandering, pets, weather, animations) runs
  client-side in your browser between snapshots.
- If snapshots stop, the page stays up and shows a stale badge.
- Weather selection is per-visitor (localStorage only).

## Development

```bash
npm install
npm run dev        # http://localhost:3100/pixel-office-live/ (uses mock-state.json)
npm run build      # static export to out/
npm run check-static  # assert the build contains no /api references
```

`lib/pixel-office/` (engine) and `public/assets/pixel-office/` are vendored
from a private workspace via `npm run sync-engine`; edit them there, not here.

## Data scrub procedure

The `data` branch keeps exactly one commit (`--amend` + force push). If a bad
snapshot is ever published: force-push an amended clean commit (history is
gone for new clones immediately), contact GitHub support to purge cached
views if needed, and rotate any credential that leaked regardless.
