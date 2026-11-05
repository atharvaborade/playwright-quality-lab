# Explain the project in an interview

## Two-minute demo

1. Run `npm start`, create a synthetic member and choose a coach.
2. Book a time, reload to demonstrate persistence, then cancel it.
3. Run `npm test` and open the HTML report with `npm run report`.
4. Show the ownership API test: a different account must not cancel someone else's record.
5. Run `npm run test:faults`. The individual test failures are intentional; the harness succeeds only after verifying both defects were detected.

## Decisions to understand

- Why test ownership through HTTP instead of checking whether a cancel button is hidden?
- Why does a database unique index matter when two requests arrive together?
- Why create accounts through an API fixture for most browser tests, but still test form registration and login separately?
- Why use independent accounts and future slots instead of relying on test order or resetting shared data?
- What does an automated accessibility scan miss?
- What evidence would you inspect if a test passes only on retry?
- What would need to change for multiple app instances, time-zone scheduling and a public deployment?

## Honest portfolio description

“Built a local appointment-booking application and a Playwright quality engineering lab covering API invariants, browser journeys, accessibility and authorization. Added isolated test data, CI reports and targeted fault experiments to verify test effectiveness.”

Present it as an independent portfolio project. Read and run the implementation before claiming ownership of its design decisions. Do not claim production scale or employer outcomes.
