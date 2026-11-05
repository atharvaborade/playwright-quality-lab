# JavaScript BDD migration plan

1. Replace the authored TypeScript tests/config with JavaScript Cucumber features, steps, World and hooks.
2. Map current application use cases to positive, negative and browser scenarios; retain meaningful booking/ownership fault experiments.
3. Run scenarios in isolated parallel browser contexts, preserve Allure reports and per-context browser/API traces.
4. Verify real execution, report rendering, trace contents, worker overlap, screenshots and defect detection.
5. Publish the framework, verify GitHub Actions, update the portfolio claims/links and refresh screenshots.

Steps 1–4 are locally validated. Publication and hosted CI are the remaining migration checks. `VALIDATION.md` contains measured local results; the Actions tab will provide hosted evidence.

No paid services, employer code or real customer data are required. A separate Cypress implementation will be considered after this migration is complete.
