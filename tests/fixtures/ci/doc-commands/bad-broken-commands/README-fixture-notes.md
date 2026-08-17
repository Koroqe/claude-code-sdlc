# Seeded fixture: bad-broken-commands

Falsify control for `scripts/ci/validate-doc-commands.js`. Three defects, each a real class:

1. **`curl ... | bash` with no non-interactive flag** — this is the bug that actually shipped. The
   installer asks for confirmation, a piped shell has no terminal, and the documented headline
   command aborted with `/dev/tty: Device not configured` having installed nothing. It survived
   review because the verification run had switched to a downloaded file with `--yes` — a
   near-neighbour of the documented command, whose success was read as evidence for a command
   nobody had actually run.
2. **`install.sh --autoconfirm`** — flag drift. The installer parses no such flag, ignores it, and
   proceeds to do something other than what the reader believes they asked for.
3. **`claude plugin marketplace register`** — a subcommand that does not exist (`add` does).

The four valid commands in the same file must NOT be flagged, proving the check discriminates
rather than objecting to every documented command.

## Expected result

`node scripts/ci/validate-doc-commands.js --root tests/fixtures/ci/doc-commands/bad-broken-commands --min 1`
MUST fail with **exactly three** problems.
