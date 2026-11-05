# Delivery plan

1. Build an appointment-booking product: account creation, sign-in, member/admin roles, scheduling and cancellation, persistent SQLite data.
2. Cover business risks through API tests; cover critical journeys and accessibility through browser tests. Isolate data per test and authenticate through fixtures.
3. Demonstrate effectiveness with two deliberate test-only faults: double booking and cross-account cancellation. Require relevant tests to fail against each faulty server.
4. Configure CI, retain failure evidence, write a test strategy and document real execution results.
5. Capture the product and publish to its own GitHub repository.

No paid services, employer code, or real customer data. This is a portfolio lab, not a production medical system.

## Current status

Implementation, local validation, screenshots and documentation are complete:24 baseline checks pass and both fault experiments are detected. Source repository: https://github.com/atharvaborade/playwright-quality-lab. All five delivery steps are complete. Hosted checks passed in [this run](https://github.com/atharvaborade/playwright-quality-lab/actions/runs/42113819326); local and hosted evidence are recorded separately in VALIDATION.md.
