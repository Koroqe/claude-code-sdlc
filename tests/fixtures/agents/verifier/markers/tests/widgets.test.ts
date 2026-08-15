// TC-4.18: a TODO inside a *.test.ts file, under the standing exclusion
// list (test files, markdown, config). This must not be scanned or
// reported at all — zero level:2 findings for this file.
import { describe, it, expect } from 'some-test-runner';

describe('widgets', () => {
  it('lists widgets for an owner', () => {
    // TODO: add a case for the 404 path
    expect(true).toBe(true);
  });
});
