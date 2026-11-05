# JavaScript BDD validation evidence

The current framework is JavaScript, Cucumber 13.3.0 and Playwright 1.64.1 with Allure Cucumber 3.14.0 and Allure CLI 2.46.1. It replaces the earlier TypeScript/Playwright Test suite. Historical counts are not current coverage claims.

## Executed local baseline

- Node.js 24.22.1; Java 21; system Chromium selected with `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.
- JavaScript syntax check passed; no authored `.ts`/`.tsx` files remain.
- Cucumber dry-run resolved **93 scenarios and 586 steps**, without undefined or ambiguous definitions. Dry-run entries are skipped by design and are not counted as execution evidence.
- Full execution: **93 scenarios passed; 586 steps passed**;0 failed/undefined/pending/skipped scenarios; no retries.
- Scenario composition: **73 API + 20 UI**.
- Three workers; approximately 41.5seconds wall time versus 118.3seconds summed scenario execution in this environment. This is a run observation, not a performance benchmark.
- Allure HTML generated successfully. Its summary contains 93 passed,0 failed,0 broken,0 skipped and0 unknown.

## Isolation and recorded evidence

`npm run evidence:verify` inspected the fresh results and artifacts:

| Evidence | Observed |
|---|---:|
| Cucumber workers observed |3 |
| Cross-worker scenario intervals overlap | Yes |
| Unique browser contexts |185 |
| Valid Playwright trace archives |370 |
| Step screenshots |91 |
| Step-labelled network summary entries |407 |
| Native Trace Viewer network records |408 |
| Browser DOM snapshots |750 |
| Allure scenario result files |93 |

Each context has separate browser and native API traces. An API-only scenario can have a blank unused browser page; its `*-api.zip` contains recorded HTTP actions. The verifier checks passing Cucumber/Allure results, fresh scenario metadata, unique context IDs, actual worker overlap, valid grouped traces, DOM snapshots and native network records.

Allure's overview and a booking scenario detail were opened in a real browser. The rendered report showed Gherkin steps and per-step screenshots. Report and Trace Viewer screenshots are under `docs/screenshots/`.

Headed execution is configured for user desktops. This managed machine has no Xvfb/desktop session for a local headed run; parallelism was observed through overlapping headless workers and isolated contexts. Do not describe that as a visually observed headed execution on this machine.

## Seeded defects

Both named BDD fault experiments completed successfully through the harness:

| Defect | Required result | Faulty result | Detection |
|---|---:|---:|---|
| Missing active provider/time uniqueness |409 |201 | Intended HTTP assertion failed |
| Missing cancellation ownership check |404 |204 | Intended HTTP assertion failed |

The fault runs contain one intentionally failed scenario each. They are kept under `reports/faults/`; the baseline Allure report remains green and separate. The harness rejects zero/multiple scenarios, setup errors and wrong assertion failures. No production mode can enable these fault flags.

## Defects fixed during migration

1. **Stale provider response:** a delayed response from a previously selected coach could replace the latest coach's times. Responses are now applied only for the latest selection/request.
2. **Exhausted availability:** generic button cleanup could reenable booking after the final available slot was consumed. Booking enablement now follows actual availability and in-progress state.
3. **Oversized JSON:** requests over the 10kb limit returned 500. They now receive 413 with a client-facing error.

The BDD suite includes deterministic regressions for all three. Browser response interception reaches race/empty-list states deterministically; real API scenarios separately verify SQLite booking and availability rules.

## Reproduce

```sh
npm ci
npx playwright install --with-deps chromium
npm run check
npm run test:dry-run
npm test
npm run evidence:verify
npm run test:faults
npm run report:generate
```

Reports are regenerated per run under ignored `reports/`; generated screenshots can be refreshed with `npm run demo:capture`. Use synthetic accounts only. Trace archives can include synthetic credentials and sessions even though the network summaries redact them.

## Remote verification and limits

The migrated GitHub workflow is configured for the commands above and artifact retention. Its hosted result must be observed after publication; previous CI successes apply to the previous implementation.

See `USE-CASE-COVERAGE.md` for the current capability map and remaining boundaries. This run does not establish every possible input, full WCAG conformance, Firefox/WebKit coverage, load capacity or production suitability. The separate Cypress repository is future work.
