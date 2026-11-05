# Current use-case coverage

This map describes the current Slotwise application and its Gherkin scenarios. It is a checklist of implemented behaviours and known limits, not a claim that every possible path or security issue is covered. Scenario outlines expand each Examples row into an independent scenario; the runner's generated Cucumber JSON and Allure results provide the count and outcome for a particular run.

The framework is JavaScript throughout. `@cucumber/cucumber` discovers the feature files, JavaScript step definitions execute Playwright actions and assertions, and hooks collect Allure attachments and Playwright traces.

## API capabilities

| Capability | Covered behaviour | Feature |
|---|---|---|
| Public discovery | Health responds `ok`; three distinct coaches expose their specialties without authentication | [api-contract.feature](../features/api-contract.feature), `@api @contract` |
| Anonymous access boundaries | Identity, appointments, slots, admin summary, booking, cancellation and sign-out reject anonymous callers | [authentication.feature](../features/authentication.feature), `@api @authentication` |
| Registration | Creates and signs in a member; trims the name and normalizes email case; does not expose a password | [authentication.feature](../features/authentication.feature) |
| Registration validation | Blank/missing/oversized name; invalid/oversized email; short/oversized password; supplied admin role and unknown fields are rejected | [authentication.feature](../features/authentication.feature) |
| Supported registration boundaries | One- and 80-character names; 12- and 128-character passwords | [authentication.feature](../features/authentication.feature) |
| Email uniqueness | A duplicate differing only by letter case receives 409 and does not gain a session | [authentication.feature](../features/authentication.feature) |
| Sign-in | Mixed-case email works; wrong password, unknown email, malformed email, short password and missing password do not authenticate | [authentication.feature](../features/authentication.feature) |
| Session protection | HttpOnly/SameSite=Strict cookie; fabricated cookie rejection; sign-out invalidates a copied session token | [authentication.feature](../features/authentication.feature) |
| Role boundaries | Member receives 403 for the admin summary; configured administrator receives numeric aggregate totals | [authentication.feature](../features/authentication.feature) |
| Availability | All three coaches expose unique supported UTC times over the next seven days; missing/unknown coach is rejected | [bookings.feature](../features/bookings.feature), `@api @booking` |
| Booking persistence and privacy | Successful booking appears only in its owner's history; history is chronological and retains cancelled records | [bookings.feature](../features/bookings.feature) |
| Provider/time uniqueness | Sequential conflict and simultaneous competing requests produce one reservation; different coaches can use the same time | [bookings.feature](../features/bookings.feature) |
| Cancellation ownership | Another member receives 404 and cannot change the owner's record | [bookings.feature](../features/bookings.feature), `@fault-ownership` |
| Cancellation lifecycle | Owner cancellation succeeds; repeat cancellation receives 409; cancelled time can be booked again | [bookings.feature](../features/bookings.feature) |
| Cancellation validation | Invalid ID syntax receives 400; absent records receive 404 without creating state | [bookings.feature](../features/bookings.feature) |
| Booking validation | Past, malformed, beyond-window, impossible and noncanonical dates; unsupported hours/minutes; missing/unknown coach or time; supplied owner/status fields are rejected | [bookings.feature](../features/bookings.feature) |
| Availability updates | Confirmed time disappears for the chosen coach, stays available for another coach and returns after cancellation | [bookings.feature](../features/bookings.feature) |
| HTTP contracts | Unknown routes return JSON 404; malformed JSON returns 400; oversized JSON returns 413; API cache and browser security headers are checked | [api-contract.feature](../features/api-contract.feature) |
| Cross-origin protection | Registration, sign-in, sign-out, booking and cancellation reject foreign-origin writes without changing the protected session or appointment | [api-contract.feature](../features/api-contract.feature) |

The `@fault-double-booking` scenario targets the occupied provider/time invariant. The `@fault-ownership` scenario targets cancellation authorization. The fault harness runs those tags against the corresponding deliberate test-only defect and verifies their expected failure.

## Browser capabilities

All browser scenarios are in [browser-journeys.feature](../features/browser-journeys.feature), tagged `@ui @browser`.

| Capability | Covered behaviour |
|---|---|
| Registration and session persistence | Create account through the form, display the member name/workspace, reload, sign out and sign back in |
| Authentication recovery | Explain wrong-password and duplicate-registration errors, allow resubmission and recover through sign-in |
| Native field validation | Required name, invalid email and too-short password keep the visitor signed out |
| Authentication mode switch | Name visibility/requirement and password autocomplete change between registration and sign-in |
| Coach selection | Each coach updates the pressed state, label and available times |
| Booking lifecycle | Choose a time, confirm, reload, cancel, retain the cancelled record without a cancel button and see the released time again |
| Stale availability | Another real client takes the displayed time; UI reports the conflict and creates no duplicate booking |
| Account privacy | Another member's appointment does not appear in the current member's browser |
| Response ordering | A deliberately delayed response for the previous coach cannot overwrite the latest selection |
| No availability | An exhausted availability response is explained and confirmation stays disabled |
| Mobile layout | Signed-out and signed-in pages fit the narrow viewport and expose the primary action |
| Accessibility | Signed-out and signed-in automated WCAG A/AA scans; keyboard skip link and form access; keyboard confirmation and cancellation |
| Safe rendering | Markup in a member name displays as literal text |

Network timing and exhausted-availability browser checks use controlled responses to reach these UI states deterministically. Real API scenarios separately verify availability removal and release against SQLite. Chromium is the current browser target.

## Evidence per scenario

Each scenario has fresh contexts and scenario-specific accounts/data. Three Cucumber workers run by default. Its result includes Gherkin steps in Allure, a Playwright trace for each context, scenario metadata and request activity. Browser steps also attach screenshots. API scenarios use context-bound request clients so their HTTP activity can be inspected in traces.

Trace Viewer presents recorded actions, DOM snapshots, screenshots, network and console evidence. It does not undo real database actions. Allure provides the result overview and attachments; it is separate from Trace Viewer. See [TEST-STRATEGY.md](TEST-STRATEGY.md) for isolation and evidence design, and [VALIDATION.md](VALIDATION.md) for observed runs.

## Boundaries and remaining checks

The UI offers the next seven UTC calendar days. The API accepts supported whole-hour slots strictly in the future and less than 90 days away, including valid future times outside the UI listing. This difference is the current product contract. No weekend or holiday exclusions exist.

The suite samples date and input boundaries rather than enumerating every possible value. It does not wait eight hours to test session expiry, exercise the production 30-per-minute authentication throttle, prove precise admin totals under simultaneous activity, or provide exhaustive security, load, accessibility or browser compatibility coverage. Password hashing and server-side token hashing are implementation controls rather than inferred guarantees from a successful browser journey.

Rescheduling, password reset, email verification, payments, custom coaches, local-time preferences and an admin screen are not current capabilities. They are excluded from this map rather than represented by fictitious passing scenarios. A Cypress version is future work and is not part of this repository.
