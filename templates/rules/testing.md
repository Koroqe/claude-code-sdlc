# Testing Rules

## Test Locations

TODO: Define where tests live:
- Unit tests: `tests/unit/` or `src/__tests__/`
- Integration tests: `tests/integration/`
- QA test case docs: `docs/qa/`
- Use case docs: `docs/use-cases/`

## Commands

TODO: Fill in your project's test commands:
- Run tests: `npm test` or `pytest` or etc.
- Typecheck: `npm run check` or `mypy` or etc.
- Build: `npm run build` or etc.

## Requirements

- New API endpoints and business logic MUST have test coverage
- Follow existing test patterns in the codebase
- Test cases MUST be documented in `docs/qa/<feature>_test_cases.md` before writing actual tests
- Use cases MUST be documented in `docs/use-cases/<feature>_use_cases.md` before test cases
- Cover happy path, error cases, edge cases, and auth boundary cases
