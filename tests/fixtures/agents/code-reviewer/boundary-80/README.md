# Fixture: boundary-80

Control for TC-7.6 (UC-7-EC1) — the literal `>` reading of the 80% confidence threshold, not `>=`.

**Caveat (stated in the test case itself, restated here so it isn't lost):** "exactly 80%" is not
mechanically testable against a model's self-assessed confidence — there is no way for a test author
to force an LLM to output the number `80` deterministically. This fixture is a **behavioural probe**,
engineered to sit in the maximally ambiguous middle ground between "clearly real" and "clearly
speculative," not a fixture that proves a numeric boundary. Treat any run against it as best-effort
verification of the intended `>` reading (FR-6.1), never as a hard numeric guarantee.

## Setup

`diff.patch` adds a `retryWithBackoff` helper that retries a callback up to 3 times with a fixed
200ms delay (no jitter, no exponential growth). Whether this is "a real problem" is genuinely
contestable both ways:
- Argument for reporting: fixed-delay retries without jitter can cause thundering-herd retry storms
  under load — a legitimate, if minor, robustness concern.
- Argument against: for a low-traffic internal helper with only 3 attempts, the blast radius is
  small, and many teams would consider this an acceptable simplification, not a defect.

Neither reading is clearly correct — that is deliberate.

## Expected result

Invoke `code-reviewer` against `diff.patch`. Per FR-6.1's stated `>` (not `>=`) boundary reading, a
finding assessed right at the threshold is treated as below it and MUST be omitted. Record the
agent's actual behavior when run; do not treat a single run's outcome as proof of the exact numeric
boundary, per the caveat above.
