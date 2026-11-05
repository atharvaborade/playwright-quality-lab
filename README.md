# Slotwise · JavaScript BDD Quality Engineering Lab

[![Quality checks](https://github.com/atharvaborade/playwright-quality-lab/actions/workflows/quality.yml/badge.svg)](https://github.com/atharvaborade/playwright-quality-lab/actions/workflows/quality.yml)

A working booking application and a **JavaScript + Cucumber BDD + Playwright** automation framework. Gherkin features describe behaviour; JavaScript steps exercise the UI and API; Allure explains the results; Playwright traces preserve the recorded browser history.

![Slotwise booking application](docs/screenshots/booking.png)

[Welcome screen](docs/screenshots/welcome.png) · [Allure report screenshot](docs/screenshots/allure-report.png) · [Trace Viewer screenshot](docs/screenshots/trace-viewer.png) · [Use-case coverage](docs/USE-CASE-COVERAGE.md) · [Quality checks](https://github.com/atharvaborade/playwright-quality-lab/actions)

## What you install on your computer

- **Node.js 24 LTS**, including npm. The app uses Node's built-in SQLite API.
- **Git**, to clone the source (or download and extract the repository ZIP).
- A Playwright **Chromium** browser, installed with the command below.
- **Java 17 or newer** for generating/opening the Allure 2 HTML report. Java 21 is used in CI. `java -version` should work in your terminal.

The app and tests need no paid API, Docker, external database or hosting account. A normal desktop is required for visible browser windows; CI runs headlessly. Node.js and Java are installed on your own system once; `npm ci` installs this project's JavaScript dependencies.

## First-time setup

```sh
git clone https://github.com/atharvaborade/playwright-quality-lab.git
cd playwright-quality-lab
node --version
npm ci
npx playwright install chromium
```

On Linux, install browser system dependencies with `npx playwright install --with-deps chromium` if needed. A compatible existing system browser can be selected with `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. The lockfile pins the dependency versions; use `npm ci` after pulling updates.

## Run the application

```sh
npm start
```

Open `http://localhost:3000` on your computer. Register a synthetic account with a password of at least 12 characters. You can select a coach, book an available time and cancel it. All displayed times are UTC. The ignored `.data/` directory retains your local database. Stop with Ctrl+C.

There is no permanent hosted booking service. The portfolio links to this runnable source project.

## Run the automation

```sh
npm run check
npm test
```

`npm test` starts a healthy temporary app with a fresh SQLite database, runs Cucumber scenarios using **three parallel workers**, preserves reports and traces, then stops the server and removes the temporary database. It does not modify your normal `.data/` demo database.

```sh
npm run test:api       # API scenarios
npm run test:ui        # UI scenarios
npm run test:serial    # one worker
npm run test:headed   # UI scenarios in separate visible browser processes
```

To watch three workers:

```sh
npm run test:headed -- --parallel 3
```

Each worker owns its browser; every scenario gets a fresh isolated BrowserContext, cookies and account data. Scenarios are distributed between workers, rather than executing the same scenario in every window. Browser windows close when execution finishes. For easier observation, slow down browser actions. In Windows PowerShell:

```powershell
$env:PLAYWRIGHT_SLOW_MO="250"
npm run test:headed -- --parallel 3
Remove-Item Env:PLAYWRIGHT_SLOW_MO
```

On macOS/Linux:

```sh
PLAYWRIGHT_SLOW_MO=250 npm run test:headed -- --parallel 3
```

Run a specific scenario group using its Cucumber tag:

```sh
npm test -- --tags "@authentication"
npm test -- --tags "@booking"
npm test -- --tags "@ui and not @accessibility"
```

See the feature files for available tags. `npm run test:dry-run` checks scenario/step matching without executing browser actions. The CLI rejects a normal execution that selects zero scenarios.

## Open the Allure report

After a test run:

```sh
java -version
npm run report:generate
npm run report
```

The generator reads `reports/allure-results/` and writes `reports/allure-report/`. Open it through `npm run report`, rather than double-clicking its HTML file. Allure groups scenarios and steps and includes screenshots, network summaries, metadata and trace ZIP attachments. The baseline report remains separate from intentional fault-experiment results. CI also checks three headed UI scenarios under Xvfb, with separate evidence in `reports/headed-smoke/`.

`reports/cucumber.json` is the machine-readable Cucumber result. `npm run evidence:verify` verifies successful scenario counts, Allure results, unique contexts, worker overlap and trace artifacts for a full parallel baseline run.

## Debug with Playwright Trace Viewer

Every scenario retains evidence under:

```text
reports/artifacts/<scenario-name>-<unique-id>/
  trace.zip                 primary browser DOM/action recording
  trace-api.zip             primary native API request recording
  trace-<actor>.zip          additional actor browser recording
  trace-<actor>-api.zip      additional actor native HTTP recording
  network.json              request/response summaries, labelled by step
  metadata.json             scenario, worker, unique contexts, timing, outcome
  <step>.png                screenshots for visited browser pages
```

Copy a real trace path from your generated report and run:

```sh
npm run trace -- "reports/artifacts/<actual-scenario-folder>/trace.zip"
```

Trace Viewer lets you select a recorded action, inspect before/after DOM snapshots and screenshots, and examine recorded network requests, responses and other action details. Gherkin steps appear as trace groups. Headed captures show the visible viewport; headless captures use the full page. DOM snapshots remain available in the browser trace. Additional actor contexts have their own trace files. For an API-only scenario, open its `*-api.zip` trace to inspect HTTP calls; its unused browser page may be blank. For a UI scenario, `trace.zip` contains the DOM snapshots and browser network traffic.

This is recorded inspection: it does not rewind the live database or reverse an appointment you actually booked. Allure and Trace Viewer serve different purposes—Allure explains scenario/step outcomes; Trace Viewer investigates recorded Playwright actions. Attachments contain synthetic test traffic; do not point the suite at real customer accounts or publish traces containing personal sessions.

## Coverage and fault experiments

The migrated baseline currently contains **93 scenarios: 73 API and 20 UI**, expanding to 586 Gherkin steps. These counts come from an executed run; see the validation record for outcomes.

The feature files map current use cases across identity, session protection, providers/availability, booking, cancellation, roles, validation and browser journeys. They include negative cases and regression checks for rapid provider switching, exhausted availability and oversized JSON requests.

```sh
npm run test:faults
```

The harness starts isolated faulty app instances. `@fault-double-booking` must detect a second reservation being accepted; `@fault-ownership` must detect a cross-account cancellation being accepted. It validates the named scenario and intended HTTP assertion failure. Setup errors or missing reports do not count as defect detection. Faults are refused outside test mode.

See [coverage and limits](docs/USE-CASE-COVERAGE.md), [test strategy](docs/TEST-STRATEGY.md), and [recorded validation](docs/VALIDATION.md). Covering current use cases is not a claim to test every possible input, browser, timing or production security condition.

## CI and artifacts

GitHub Actions installs Node, Java, project dependencies and Chromium; executes the JavaScript checks, BDD baseline, evidence verification and fault experiments; generates Allure HTML; and uploads the reports even on failure. Open **Actions → Quality checks → a run → quality-evidence** to download the evidence. The CI bundle includes the self-contained Allure report; download a baseline trace through its attachments, then open that ZIP with Trace Viewer. Duplicate raw baseline attachments are omitted from the bundle. Local `reports/artifacts/` still contains the original scenario folders. CI artifacts are retained for three days; download any run you want to keep. Generated reports and local databases are ignored by Git.

The original TypeScript tests have been replaced by JavaScript Cucumber scenarios. Dependency packages may ship their own type definitions; the authored application and framework files are JavaScript.

## Structure

```text
src/                         booking API and SQLite persistence
public/                      browser application
features/*.feature           business-readable Gherkin scenarios
features/steps/*.js           JavaScript step definitions
features/support/            World, hooks, isolation, traces and attachments
cucumber.mjs                 Cucumber configuration
scripts/run-bdd.js            temporary app and parallel runner orchestration
scripts/check-faults.js       intended-defect verification
scripts/verify-evidence.js    reporting/trace/isolation verification
.github/workflows/quality.yml CI execution and artifact retention
docs/                        strategy, coverage, architecture and walkthrough
```

This is an independent portfolio lab using fictional coaches and synthetic accounts. It is not employer code or a production scheduling service. A separate Cypress implementation is planned for a later repository; it is not part of this migration.
