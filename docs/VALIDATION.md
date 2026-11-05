# Validation evidence

Recorded 5 November 2026 in the managed development environment. These are local results, not a claim that GitHub Actions has already completed.

## Baseline

- Node.js v24.22.1
- Playwright 1.64.1 (resolved in the committed lockfile)
- Chromium: system `/usr/bin/chromium`, selected with `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`
- Three workers; no retries in the local run
- `npm run check`: passed
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm test`: **24 passed**, 0 failed, 0 skipped, 0 flaky; approximately 8.8 seconds in this environment
- 18 API tests and 6 browser tests

Runtime is an observation, not a performance benchmark or guarantee. CI installs the browser version matched to Playwright rather than relying on this machine's system browser.

## Fault experiments

`npm run test:faults` completed successfully after confirming two intentional invariant-test failures:

| Seeded fault | Expected response | Faulty response | Result |
|---|---:|---:|---|
| Missing active-slot uniqueness | 409 | 201 | Conflict assertion detected fault |
| Missing cancellation ownership check | 404 | 204 | Ownership assertion detected fault |

These failures are isolated from the passing baseline report. Individual fault test runs exit 1 by design; the harness exits 0 only when their reports match the intended assertion failures. They are neither skipped tests nor unresolved baseline failures.

## Findings during development

1. **Real accessibility defect:** the brand link's accessible name omitted visible label content. Axe reported `label-content-name-mismatch`. Removing the overriding label and marking the decorative initial as hidden corrected the accessible name; both accessibility checks then passed.
2. **Test-isolation defect:** supposedly anonymous API clients inherited the suite's authenticated storage state. Explicit empty cookie/origin state fixed the test setup. This was not an application authentication bypass.
3. **Journey expectation:** reloading resets the selected coach to the default. The test now explicitly reselects the booked coach before asserting that cancellation releases that coach's slot.

## Reproduce

```sh
npm ci
npx playwright install --with-deps chromium
npm run check
npm test
npm run test:faults
```

Reports are regenerated under ignored `playwright-report/` and `test-results/`. The committed screenshots come from `npm run demo:capture`, which starts a separate temporary database and removes it afterward.

## Not verified

Firefox/WebKit, complete screen-reader accessibility, load/performance thresholds, public hosting, and a GitHub-hosted CI execution. See the test strategy for scope boundaries.
