# Test strategy

## Product and risk

Slotwise books coaching sessions for synthetic members. The highest risks are losing ownership boundaries and promising the same provider/time to two people. A pretty UI is not evidence that these invariants hold.

| Risk | Primary check | Why this layer |
|---|---|---|
| Double booking | Sequential and concurrent API requests across two accounts | Exercises the SQLite unique constraint through real HTTP requests |
| Cross-account cancellation | Account B attempts to cancel account A's record, then owner reads it | Verifies authorization and unchanged state |
| Cancelled time stays unavailable | Cancel, reject repeat cancellation, rebook as another account | Exercises state transition and slot release |
| Auth bypass or role escalation | Anonymous requests, forged role, member/admin checks, logged-out cookie replay | Tests server enforcement independently of UI visibility |
| Invalid scheduling data | Invalid, past, impossible and distant dates | Checks rejected requests do not create appointments |
| Broken user journey | Book, reload, cancel through semantic locators | Covers browser rendering, session integration and persistence |
| Stale availability | Another client takes the displayed time before submission | Checks understandable conflict feedback |
| Accessibility barriers | Axe WCAG A/AA scans, keyboard skip link, narrow viewport | Automated checks provide partial evidence, not certification |

## Data and isolation

Each server run uses a fresh temporary SQLite database. Each test account has a random email; tests never share a signed-in member. UI authentication uses a storage-state fixture instead of repeating login on every test. API scheduling fixtures allocate worker-specific future dates outside the UI's next-seven-day window. No application reset endpoint is exposed.

Three workers provide parallel execution without oversubscribing the local machine. Browser tests use Chromium for this first release. CI allows one retry and retains evidence; retries do not establish that an intermittent test is healthy. Inspect the JSON report for flaky outcomes.

## Evidence and failure handling

Playwright retains traces and screenshots for failed browser tests. HTML and JSON reports are generated on every run. CI uploads reports with a seven-day retention period, including on failure. There are no fixed sleeps in the tests; assertions wait for observable state.

`npm run test:faults` starts two separate test-mode servers with fresh databases. One deliberately omits the active-slot uniqueness constraint; the other deliberately omits the ownership check. The relevant invariant test must fail with the expected/actual HTTP status mismatch. The harness rejects missing reports, wrong test counts, setup failures and unexpected exit codes. Neither fault can be enabled outside `NODE_ENV=test`. Do not deploy a test-mode server.

## Deliberate limits

This is a portfolio lab, not a production service. There is no email verification, password reset, distributed session store, multi-process deployment, payment flow, monitoring or backup automation. The auth throttle is per-process; it is not an Internet-scale abuse defence. Sessions expire but do not refresh. Slots are UTC on whole hours, 09–11 and 14–16, for all seven days; no weekends/holidays policy is modelled. Cancellation history is retained. SQLite is appropriate for the single-process lab.

Current automated coverage does not establish complete accessibility, load capacity, exhaustive security, or Firefox/WebKit compatibility. Manual screen-reader review and broader browser coverage are future work, not claimed results.
