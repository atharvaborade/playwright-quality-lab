# Explain the project in an interview

## A short demo

1. Run `npm start`, open the local application and create a synthetic member.
2. Choose a coach, book a time, reload to show persistence and cancel the appointment. The cancelled record remains in the member's history and the time becomes available again.
3. Open a Gherkin feature under `features/` and show its JavaScript step definitions. Explain which behaviour is checked through HTTP and which needs a browser.
4. Run `npm test`. Show that Cucumber executes independent scenarios in parallel, then open the generated Allure report.
5. Open one scenario's Playwright trace. Select an action and inspect its DOM snapshot, request/response details, console and screenshots. Explain that this recorded replay does not undo the booking in the database.
6. Show the ownership and competing-booking scenarios. Run `npm run test:faults` to demonstrate that those checks detect the two deliberate test-only defects.

See the root [README](../README.md) for the exact report, headed execution and trace commands. [VALIDATION.md](VALIDATION.md) records the checks actually run; do not present a local result as proof of a remote CI run.

## Decisions to understand

- Why test ownership through HTTP instead of checking whether a cancel button is hidden?
- Why is a database unique index necessary when two requests arrive together?
- What do Gherkin, Cucumber, Playwright and Allure each do in this framework?
- Why share a browser process within a worker while creating fresh contexts for each scenario and account?
- Why create accounts through the API for focused browser checks, but still test registration and sign-in through the forms?
- How do unique accounts and slots make parallel execution reliable?
- What is visible in a trace that a screenshot alone cannot explain?
- Why can a trace inspect a past DOM snapshot without reversing a real database action?
- What does an automated accessibility scan miss?
- Which current application capabilities are covered, and which product features have not been built?
- What would need to change for multiple app instances, configurable time zones and a public deployment?

## Honest portfolio description

“Built Slotwise, a local appointment-booking application, and a JavaScript BDD automation framework using Cucumber and Playwright. Added API authorization and concurrency checks, browser journeys, isolated parallel execution, Allure reports, per-scenario traces, and targeted fault experiments.”

Present it as an independent portfolio project. Be ready to run the suite, read a scenario and explain the implementation. Do not claim production scale, complete test coverage, accessibility certification or employer outcomes.
