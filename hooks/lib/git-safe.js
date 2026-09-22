'use strict';

/**
 * Hardened git spawn — the single home of the child-process shape the trust
 * and spine paths use to ask git a question.
 *
 * WHY IT LIVES IN lib/. Like `repetition.js`, a module here costs nothing
 * against the 12-hook ceiling that `tests/hooks/test-guards-cross.js` pins by
 * counting `.js` files under `hooks/handlers/`.
 *
 * THE SHAPE mirrors `hooks/handlers/stop-changelog-guard.js`'s spawn: the
 * child env is constructed FRESH as an allowlist — never assigned over
 * `process.env` — so a hostile `GIT_CONFIG_COUNT`/`GIT_CONFIG_PARAMETERS`
 * pair or an alternate-object-directory variable sitting in the parent can
 * never reach the child. Global and system config are routed to /dev/null,
 * prompts and optional locks are off, `-c core.fsmonitor=` rides argv so a
 * repository's own config cannot run code, there is no shell, the child is
 * bounded by a timeout with SIGKILL, stdio is piped and output is capped.
 * `tests/hooks/test-git-safe.js` asserts all of this from the child's own
 * observed env, and `test-guards-cross.js` asserts the literal shape here —
 * the one spawn site — while consumers are held to delegation only.
 *
 * FAIL-OPEN BY VALUE. Every failure — git missing, not a repository, a
 * timeout, a non-zero exit, an unexpected result shape — returns the
 * UNKNOWN sentinel. Nothing here ever throws; callers treat UNKNOWN as
 * "do not know" and degrade, never block. (A branch literally named
 * "unknown" collides with the sentinel and reads as a failure — fail-open,
 * accepted.)
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

/** Non-throwing failure sentinel. Callers compare with `===`. */
const UNKNOWN = 'unknown';

/**
 * Run one git query in `cwd`. Returns trimmed stdout on exit 0, UNKNOWN on
 * any failure. `args` is argv, never a shell string.
 */
function runGit(cwd, args) {
  try {
    const result = spawnSync(
      'git',
      // `-c core.fsmonitor=` stops a repository's own config from running
      // code, on every invocation regardless of what `args` asks for.
      ['-c', 'core.fsmonitor='].concat(args),
      {
        cwd,
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 2000,
        killSignal: 'SIGKILL',
        maxBuffer: 64 * 1024,
        encoding: 'utf8',
        env: {
          PATH: process.env.PATH || '',
          LANG: process.env.LANG || '',
          LC_ALL: process.env.LC_ALL || '',
          GIT_CONFIG_GLOBAL: '/dev/null',
          GIT_CONFIG_SYSTEM: '/dev/null',
          GIT_CONFIG_NOSYSTEM: '1',
          GIT_TERMINAL_PROMPT: '0',
          GIT_OPTIONAL_LOCKS: '0',
        },
      }
    );
    if (result.error || result.status !== 0) return UNKNOWN;
    return String(result.stdout || '').trim();
  } catch (err) {
    return UNKNOWN;
  }
}

/**
 * The main checkout root for `cwd`, resolved through `--git-common-dir` so a
 * linked worktree resolves to the repository it belongs to. This is what the
 * spine's stale-install compare uses to recognize worktrees, and what
 * `stop-typecheck-format`'s trust check consumes in Wave 3.
 *
 * Plain `rev-parse --git-common-dir` with no output-format flag (that flag
 * would raise the Git floor to >= 2.31). A relative result resolves against
 * the queried `cwd`; the result is realpathed; `path.dirname` applies ONLY
 * when the realpathed basename is `.git`. Any other shape — a bare repo, a
 * submodule's `.git/modules/<name>` — is UNKNOWN, and so is any git failure.
 */
function commonDirRoot(cwd) {
  const out = runGit(cwd, ['rev-parse', '--git-common-dir']);
  if (out === UNKNOWN || out === '') return UNKNOWN;
  try {
    const real = fs.realpathSync(path.resolve(cwd, out));
    if (path.basename(real) !== '.git') return UNKNOWN;
    return path.dirname(real);
  } catch (err) {
    return UNKNOWN;
  }
}

module.exports = { UNKNOWN, runGit, commonDirRoot };
