# Market Monitor

Original static Market Desk page. Production data is deliberately **not connected**. The default JSON contains no market observations, and missing data remain unknown. A separate, deterministic 120-row synthetic mode demonstrates score charts, date selection, breadth fields, filters and CSV export. It is never labelled real history or persisted as production data.

## Scope

- 8 public numerical threshold rules; independent implementation, not affiliated with CashMate.
- Three proprietary warning categories remain unknown in every mode. No proprietary trigger rules, subscriber event histories, backtest figures or price-history charts are copied.
- No market API, scheduled scraper, accounts, private holdings or background data collection.
- Only a same-origin JSON request. Existing Market Desk X feed remains separate and unchanged.
- CSV explicitly marks every demo row `synthetic`.

## Validation

Run from repository root:

```
node --test tests/market-monitor/*.test.mjs
npm run build
npm run check-static
npx tsc --noEmit
```

The optional `tests/market-monitor/dom.cjs` harness requires jsdom available to Node. It covers mode switching during pending fetches, reset to unknown, filters, date slider, repeated clicks, and failure/retry. jsdom is not a production dependency.

## Connecting real data later

An audited adapter must have documented public redistribution rights, exchange-calendar/availability logic, provider provenance and exact methods. A `verified` label is a contract, not proof. See `engine.mjs` for per-observation gates. `model.mjs` currently accepts only the verified expected session, intentionally rejecting unreviewed archives. Do not populate historical rows by relaxing freshness checks. Build and test a separate point-in-time archival contract before enabling real history or comparisons.

Public thresholds were manually checked against the original page on 2026-11-07. The half-away-from-zero decimal tie rule is this implementation's choice; raw price adjustments, top-30 membership, 52-week window and volatility conventions are not fully verified. The 0–16 score is descriptive, never a probability or a signal trigger.

Reference: https://www.cashmate.hk/market-monitor
Terms: https://www.cashmate.hk/terms

The source's terms restrict bulk redistribution and systematic scraping. No source dataset or scraper is included. An isolated one-row prior public example exists only in unit tests for arithmetic regression, not in the site's published data.

## Original price-chart increment

`price-model.mjs` and `price-chart.mjs` provide original SPY/QQQ selector UI with candlestick/close-line, log/linear axes, 1/3/5/10-year/all windows, daily bars for 1 year and weekly OHLC aggregation for longer windows, zoom, pan, touch-friendly controls, keyboard selection and original primary/secondary marker styles. The global mode controls score and price demonstrations together.

**There is no production price adapter.** Formal prices and all actual signal states remain unknown. The only bundled OHLC consists of 3,348 deterministic synthetic weekday bars per selector, dated 2013-01-02 through 2025-10-31, plus 29 shared illustrative event dates. These dates are not a verified exchange calendar. Neither the prices nor events describe real SPY/QQQ performance. No returns, false-signal rates, proprietary trigger algorithm, subscriber event history or forward-performance brackets are claimed.

A targeted license check did not establish a ready-to-use consolidated SPY/QQQ source suitable for public redistribution. Twelve Data requires relevant display/redistribution rights, and Alpha Vantage's default terms restrict use. A public GitHub JSON archive may need rights beyond chart display. Synthetic fixtures remain isolated until an approved data source, timing policy and calculation contract are implemented and tested.

Price model tests cover valid OHLC, weekly aggregation, log/linear mapping, calendar windows, shared synthetic events, boundary clamping, and pointer inverse-mapping at desktop and scaled mobile widths. The optional `price-dom.cjs` harness exercises mode isolation, symbol/period/type/scale switches, zoom/pan/reset, keyboard selection and hidden-marker behavior.
