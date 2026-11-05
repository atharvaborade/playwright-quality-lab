# Test strategy

## Product and risks

Slotwise is a working appointment application used to practise quality engineering. The framework uses JavaScript, Gherkin, `@cucumber/cucumber` and Playwright. Scenarios describe observable behaviour; step definitions exercise the real HTTP API or Chromium UI. Allure presents the results, while Playwright Trace Viewer provides recorded execution detail.

| Risk | Primary check | Why this layer |
|---|---|---|
| Two members receive the same provider/time | Sequential and concurrent booking requests | Exercises the database uniqueness constraint through real HTTP requests |
| One member changes another member's booking | Foreign cancellation attempt followed by the owner's read | Checks server authorization and unchanged state |
| Cancellation does not release availability | Cancel, retain history, reject repeat cancellation and rebook | Verifies the state transition and slot release |
| Authentication or privilege bypass | Anonymous requests, forged session, supplied role, member/admin checks and revoked cookie replay | Checks enforcement independently of visible controls |
| Invalid account or scheduling input | Gherkin examples for boundary values and malformed requests | Confirms rejected requests do not create the requested state |
| Incorrect provider availability | Provider-specific slot checks and UI selection | Verifies that one coach's booking does not occupy another coach's time |
| Broken browser journey | Register, sign in, book, reload, cancel and sign out | Covers rendering, cookies and persisted application state together |
| Stale availability or asynchronous updates | Competing client and controlled browser network timing | Checks conflict feedback and the selected provider's current options |
| Accessibility barriers | Axe WCAG A/AA scans, keyboard navigation and narrow viewport checks | Supplies limited automated evidence, not accessibility certification |

The [coverage map](USE-CASE-COVERAGE.md) connects the current product capabilities to the implemented features. It is a review aid, not a promise that every possible input or execution path has been tested.

## Data and parallel execution

The runner starts a test-mode server with a fresh temporary SQLite database. Each scenario gets fresh browser contexts and separate account data; scenarios do not depend on execution order or a member signed in by another scenario. A Cucumber worker owns a browser process and creates isolated contexts for its scenarios. Three workers run by default. Headed mode makes those browser windows visible; the number of visible windows depends on the scenarios currently running.

API scheduling scenarios use distinct future slots outside the UI's next-seven-day listing. Scenarios that intentionally compete use the same provider/time within their own scenario. Unique data and context isolation prevent unrelated scenarios from producing false conflicts. The application has no public database reset endpoint.

The first browser target is Chromium. Passing this suite does not demonstrate Firefox or WebKit compatibility. Tests wait for observable state rather than fixed sleeps. Cucumber retries are disabled by default. Re-running a failure does not by itself explain or resolve flakiness.

## Reports and recorded evidence

Allure receives Cucumber scenarios and steps, status, timing and attachments. Playwright tracing starts for every scenario context, including API scenarios that use a browser context's request client. Each scenario retains a trace; browser scenarios also retain screenshots. The support layer records browser console and request activity for inspection with the result.

Trace Viewer lets a reviewer select a recorded action and inspect its DOM snapshots, screenshots, action details, network requests and console output. This is the requested time-travel-style debugging experience. It replays recorded evidence: it does not reverse changes already made to SQLite, rerun an earlier action against the past database, or restore live developer tools from a previous moment. Allure and Trace Viewer have different roles; an Allure report is not itself the interactive trace viewer.

CI runs the same JavaScript Cucumber suite and uploads its generated evidence. Local validation and a remote GitHub Actions run are separate observations; the current evidence is recorded in [VALIDATION.md](VALIDATION.md).

## Test effectiveness

`npm run test:faults` runs targeted scenarios against two separate temporary test-mode servers. One deliberately omits the active provider/time uniqueness constraint; the other deliberately omits the cancellation ownership check. The harness must verify the expected invariant failure rather than accepting any failing process. These experiments demonstrate detection of those two defects, not comprehensive mutation testing. Faults are rejected outside `NODE_ENV=test`.

## Deliberate limits

The application has three fixed coaches, 60-minute UTC slots at 09:00, 10:00, 11:00, 14:00, 15:00 and 16:00, and cancellation history. The UI offers the next seven calendar days; the API accepts valid future slots less than 90 days away. Weekends and holidays have no special rules.

There is no rescheduling, email verification, password reset, payment flow, admin UI, distributed session store, monitoring or backup automation. The authentication throttle is per-process and sessions expire without refresh. The suite does not establish load capacity, exhaustive security or complete accessibility. No Cypress project is included in this repository.
