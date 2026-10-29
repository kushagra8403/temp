# Build a Billion-Dollar Company

A single-file, browser-based business simulator. Found a startup, play quarter by quarter, and try to reach an IPO, a great acquisition, or simply survive before the clock runs out.

**Play:** open `billion-dollar-company.html` in any browser. It is fully self-contained; the only external resource is Google Fonts.

## Layout

- `billion-dollar-company.html` is the built game (generated; don't edit by hand).
- `src/` holds the source: `00-head.html` (markup and styles), `01-data.js` (tables), `02-engine.js` (simulation), `03-mascots.js` (SVG characters), `04-ui.js` (screens and tabs), `05-app.js` (modals, advisor, newsroom, report, actions).
- `build.js` inlines `src/` into the single HTML file: `node build.js`.

## Tests

The tests run headless Chromium via Playwright.

- `node tests/matrix.test.js [seedsPerCombo]` plays every industry × difficulty × horizon with a heuristic bot. Each quarter it checks for thrown errors and NaNs, that per-market totals match global totals, that the P&L and cash reconcile, that the cap table sums to 100%, and that Advance is locked while a modal is open. At game end it checks that the report is shown, scrolled to the top, and free of leftover modals.
- `node tests/trace.js saas standard 10 1010` prints a quarter-by-quarter economic trace of one game, which is useful for balance tuning.
