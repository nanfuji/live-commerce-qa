# Live Commerce QA · Playwright + TypeScript

Automated QA for the parts of live commerce that break under real conditions: a **live order feed** (polling, loading, empty, error, offline) and **drop scheduling** (calendars, time windows, countdown-style relative dates, timezones).

**Target (public practice site):** [Network Mocking Playground](https://app.thetestingacademy.com/playwright/network-mock.html), [Date & Time Traps](https://app.thetestingacademy.com/playwright/date-traps.html) and the [TTACart login](https://app.thetestingacademy.com/playwright/ttacart/index.html), by The Testing Academy.

## Scope · 36 test cases

| Area | Spec | Highlights |
|---|---|---|
| Order feed | `order-feed.spec.ts` (OF-01…15) | Deterministic wire control with `page.route()`: loading skeletons via a gated response, 500s, dropped connections with recovery, empty state, non-JSON 200s, polling driven by `page.clock`, offline mode, request-log assertions, plus two contract tests against the real API |
| Drop scheduling | `drop-scheduling.spec.ts` (DT-01…18) | Frozen time (`page.clock`) in **Asia/Manila**; weekend/past rules checked across a whole month; year-end and leap-day windows; "tomorrow becomes today at midnight"; one UTC instant verified in UTC, India and Philippine time |
| Shop entry | `ttacart-login.spec.ts` (TC-01…03) | Static login contract |

## Findings surfaced by the tests

- **Stored-XSS risk (OF-13):** the order table is built with `innerHTML` from API fields. The test is written as an *expected failure* (`test.fail`): green while the defect exists, red the day it is fixed.
- Amounts use a hard-coded ₹ and en-IN grouping regardless of locale (OF-01), which would be wrong for Philippine campaigns.

## What I did not test, and why

Stock races, idempotent payments and checkout concurrency need a backend with shared inventory; the practice site has none, and hammering a third-party host with concurrent purchases would be bad practice. Those scenarios are best tested against an owned staging environment.

## Test strategy

Everything time-based uses a controlled clock instead of sleeps; everything network-based is mocked for determinism, with a small number of clearly labelled `LIVE` tests that guard the real API contract. Page Objects (`OrdersFeedPage`, `DropSchedulerPage`) isolate selectors. Full case list: `QA-Test-Cases.xlsx`.

## Run it

```bash
npm install
npx playwright install
npm test                 # all projects (desktop Chromium, Pixel 7, iPhone 14 / WebKit)
npm run test:chromium    # quickest: Chromium desktop + Android emulation
npm run test:ui          # Playwright UI mode (time-travel debugger)
npm run report           # open the HTML report
```

**In VS Code:** install the *Playwright Test for VS Code* extension, open this folder, then use the Testing panel (beaker icon) to run, debug and record tests.

Point the suite somewhere else with `BASE_URL=https://your-host npm test`.

## CI & report

`.github/workflows/playwright.yml` runs the suite on every push and PR, **weekly on a schedule** (to catch the third-party site changing under the tests), and on demand. The HTML report is published to GitHub Pages: enable *Settings → Pages → Source: GitHub Actions*; the report appears at `https://nanfuji.github.io/<repo>/`.

## Being a good guest

The target is a free, public practice site run by a third party. The suite keeps parallelism low, blocks the site's analytics beacons, never sends load, and **never calls the site's AI backend**: model traffic is mocked at the network layer.

## How these tests were verified

The build environment had no internet access, so each spec was run on desktop Chromium and Pixel 7 emulation against a local replica made from saved copies of the real pages (served at the same URL paths). Every suite also passed 3 consecutive repeat runs with no flakes, and `tsc --noEmit` is clean. **They have not yet been run against the live host or in WebKit**: run `npm test` once and check the report.
