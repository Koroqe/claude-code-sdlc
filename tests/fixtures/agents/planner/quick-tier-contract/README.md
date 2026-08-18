# Fixture: planner / quick-tier-contract  (TC-5.2)

A direct `planner` invocation carrying a plain description string and nothing else — no PRD section,
use-cases file, QA file, or architecture review. This is the whole point of the case: the Quick-Tier
Contract has to produce exactly one slice from a bare description, without the documentation set the
full tier supplies, and without a `**Tracer:** yes` marker.

Expected: exactly one slice returned, no tracer marker, no request for the missing documents.
