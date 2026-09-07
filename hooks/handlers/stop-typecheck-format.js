'use strict';

/**
 * stop:typecheck-format — Stop.
 *
 * Runs the project's declared format and typecheck commands ONCE over
 * everything edited during the response, instead of once per edit. On a slice
 * touching a dozen files that is one typecheck rather than twelve.
 *
 * ---------------------------------------------------------------------------
 * THREAT MODEL — this hook can execute a command declared by the repository.
 *
 * It is spawned by the hook engine, so that execution is NOT mediated by the
 * permission system: the deny list in settings.json does not apply here.
 * Cloning a hostile repo and letting one response finish would otherwise be
 * enough to run its chosen command.
 *
 * So execution is gated on a MACHINE-LOCAL, OUT-OF-REPO trust registry:
 *
 *   ~/.claude/sdlc-trusted-projects   one absolute project root per line
 *
 * A project-local marker would be worthless — a hostile repo would simply
 * commit one; a marker inside the repository is indistinguishable from
 * attacker consent. A command-shape allowlist is also insufficient on its own:
 * `npm run typecheck` is a "safe shape" whose meaning is a project-controlled
 * package.json script, and `cargo check` runs build.rs. Shape gates syntax,
 * never semantics.
 *
 * All three gates are local reads. Nothing prompts and nothing waits, so an
 * unattended run is never stalled in either direction: a trusted project runs
 * its checks automatically, an untrusted one gets a non-blocking report.
 *
 * When any gate fails the command is REPORTED, never run — and the hook still
 * exits 0.
 * ---------------------------------------------------------------------------
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const accumulator = require('../lib/accumulator.js');
const sanitize = require('../lib/sanitize.js');

const MAX_CLAUDE_MD = 128 * 1024;
const MAX_LINE = 500;
const MAX_REGISTRY = 64 * 1024;
const MAX_OUTPUT = 32 * 1024;
const CHILD_TIMEOUT_MS = 90 * 1000;

/* Printable ASCII, single spaces, no shell metacharacters of any kind. */
const COMMAND_RE = /^[A-Za-z0-9][A-Za-z0-9 ._:@/=+-]{0,199}$/;
/* No path separators in argv[0]: `npm`/`tsc` pass, `./scripts/x.sh` does not. */
const ARGV0_RE = /^[A-Za-z0-9._-]{1,64}$/;

function realpathOrNull(p) {
  try {
    return fs.realpathSync(p);
  } catch (err) {
    return null;
  }
}

/** Read a capped prefix, refusing symlinks and non-files. */
function readCapped(file, maxBytes) {
  let stat;
  try {
    stat = fs.lstatSync(file);
  } catch (err) {
    return null;
  }
  if (stat.isSymbolicLink() || !stat.isFile()) return null;
  try {
    const fd = fs.openSync(file, 'r');
    const buf = Buffer.alloc(Math.min(maxBytes, stat.size));
    const read = fs.readSync(fd, buf, 0, buf.length, 0);
    fs.closeSync(fd);
    return buf.slice(0, read).toString('utf8');
  } catch (err) {
    return null;
  }
}

/**
 * Extract declared commands from CLAUDE.md's `## Commands` section.
 *
 * Fence tracking is the point: without it, a hostile repo could hide a
 * `## Commands` heading inside a code block in another section and have it
 * treated as the real one. Only the FIRST out-of-fence `## Commands` counts;
 * a second is ignored entirely.
 */
function discoverCommands(projectRoot) {
  const text = readCapped(path.join(projectRoot, 'CLAUDE.md'), MAX_CLAUDE_MD);
  if (!text) return {};

  const lines = text.split('\n');
  let inFence = false;
  let fenceLines = 0;
  let inSection = false;
  let sectionSeen = false;
  const found = {};

  for (const line of lines) {
    if (line.length > MAX_LINE) continue;

    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      fenceLines = 0;
      continue;
    }
    // An unclosed fence would otherwise leave every later section looking like
    // it is still inside Commands.
    if (inFence && ++fenceLines > 200) { inFence = false; inSection = false; }
    if (inFence) {
      if (inSection) collect(line, found);
      continue;
    }

    if (/^##\s+Commands\s*$/.test(line)) {
      if (sectionSeen) { inSection = false; continue; }
      sectionSeen = true;
      inSection = true;
      continue;
    }
    if (inSection && /^#{1,2}\s+/.test(line)) {
      inSection = false;
      continue;
    }
    if (inSection) collect(line, found);
  }
  return found;
}

function collect(line, found) {
  // `npm run check   # TypeScript type checking`
  const stripped = line.split('#')[0].trim();
  if (!stripped) return;
  // Classify on the command itself, never on a trailing comment. Otherwise
  // `rm -rf . # tsc` would be picked up as the typecheck command while a
  // human skimming the file sees only an innocuous tag.
  const lower = stripped.toLowerCase();
  if (!found.typecheck && /(typecheck|type check|type-check|tsc)/.test(lower)) {
    found.typecheck = stripped;
  } else if (!found.format && /(format|prettier|biome fmt|fmt)/.test(lower)) {
    found.format = stripped;
  }
}

/**
 * Where the trust registry lives.
 *
 * Deliberately NOT `process.env.HOME`. The whole point of the registry is that
 * a repository cannot reach it — and if anything a repository controls can set
 * HOME for this process, it could point the lookup at a fake home inside
 * itself containing a registry that trusts the repo. Claude Code's treatment
 * of project-scoped `env` for hook subprocesses is undocumented, so this reads
 * the home directory from the password database, which no environment variable
 * can influence.
 *
 * The one seam is for tests: an explicit override is honoured only when it
 * points inside the OS temp directory, which is outside any clone.
 */
function trustRegistryPath(projectRoot) {
  const override = process.env.SDLC_TRUST_REGISTRY;
  if (override) {
    const resolved = realpathOrNull(override) || path.resolve(override);
    // os.tmpdir() reads TMPDIR, so gating on it alone would leave the seam
    // environment-controlled — a repo could set TMPDIR into its own clone and
    // point the registry at a file it ships. The load-bearing check is
    // therefore the project-root exclusion: the clone is the only location an
    // attacker can write to before execution, so a registry inside it is
    // never honoured, whatever TMPDIR says.
    const root = realpathOrNull(projectRoot);
    const insideProject = root &&
      (resolved === root || resolved.indexOf(root + path.sep) === 0);
    // Both sides must be realpath'd: on macOS os.tmpdir() reports /var/... while
    // the resolved path is /private/var/..., and the prefix test would fail.
    const tmpRoot = realpathOrNull(os.tmpdir()) || path.resolve(os.tmpdir());
    const insideTmp = resolved.indexOf(tmpRoot + path.sep) === 0;
    if (insideTmp && !insideProject) return resolved;
  }
  let home = '';
  try {
    home = os.userInfo().homedir;
  } catch (err) {
    home = os.homedir();
  }
  return path.join(home, '.claude', 'sdlc-trusted-projects');
}

/** Is this project root registered as trusted on this machine? */
function isTrustedProject(projectRoot) {
  const registry = readCapped(trustRegistryPath(projectRoot), MAX_REGISTRY);
  if (!registry) return false;

  const target = realpathOrNull(projectRoot);
  if (!target) return false;
  const normalizedTarget = target.replace(/\/+$/, '');

  for (const line of registry.split('\n')) {
    const entry = line.trim();
    if (!entry || entry.charAt(0) === '#' || entry.charAt(0) !== '/') continue;
    const resolved = realpathOrNull(entry);
    if (!resolved) continue;
    // Exact match only. A monorepo sub-package is not trusted by its parent.
    if (resolved.replace(/\/+$/, '') === normalizedTarget) return true;
  }
  return false;
}

function commandIsSafeShape(command) {
  if (!COMMAND_RE.test(command)) return false;
  return ARGV0_RE.test(command.split(' ')[0]);
}

/** Run a vetted argv array (never a shell) with a scrubbed environment. */
function runCommand(argv, cwd) {
  const [exe, ...args] = argv;
  if (!exe || !ARGV0_RE.test(exe)) {
    return { ok: false, timedOut: false, output: 'unsafe executable rejected' };
  }
  const env = {};
  // Allowlist, not a blocklist. NODE_OPTIONS alone would inject code into
  // every child Node process, and DYLD_/LD_ preloads do the same natively.
  for (const key of ['PATH', 'HOME', 'LANG', 'LC_ALL', 'TMPDIR']) {
    if (process.env[key]) env[key] = process.env[key];
  }

  const result = spawnSync(exe, args, {
    cwd,
    env,
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: CHILD_TIMEOUT_MS,
    killSignal: 'SIGKILL',
    maxBuffer: MAX_OUTPUT,
    encoding: 'utf8',
  });

  const combined = String(result.stdout || '') + String(result.stderr || '');
  return {
    ok: result.status === 0,
    timedOut: result.error && result.error.code === 'ETIMEDOUT',
    output: sanitize.sanitizeField(combined.slice(-2000), 1500),
  };
}

module.exports = function stopTypecheckFormat(input) {
  const cwdRaw = (input && typeof input.cwd === 'string' && input.cwd) ? input.cwd : process.cwd();
  const projectRoot = realpathOrNull(cwdRaw) || cwdRaw;
  const sessionId = input && input.session_id;

  // Refuse to touch the accumulator through a symlink — a hostile repo can
  // commit `.claude/tmp -> ~/.ssh`, and age-based GC through it would delete
  // the adopter's files.
  const messages = [];
  const tmpDir = accumulator.accumulatorDir(projectRoot);
  let tmpSafe = true;
  for (const dir of [path.join(projectRoot, '.claude'), tmpDir]) {
    try {
      const st = fs.lstatSync(dir);
      if (st.isSymbolicLink() || !st.isDirectory()) tmpSafe = false;
    } catch (err) {
      /* absent is fine */
    }
  }

  const edited = tmpSafe ? accumulator.readPaths(projectRoot, sessionId) : [];

  const declared = discoverCommands(projectRoot);
  const commands = [];
  if (declared.format) commands.push({ kind: 'format', cmdStr: declared.format });
  if (declared.typecheck) commands.push({ kind: 'typecheck', cmdStr: declared.typecheck });

  if (commands.length === 0) {
    // The everyday path in a repo like this one, which has no package.json.
    // Say so visibly, and never block Stop on a command that cannot exist.
    if (tmpSafe) {
      accumulator.clear(projectRoot, sessionId);
      accumulator.collectGarbage(projectRoot, sessionId);
    }
    return {
      systemMessage: 'no typecheck command configured — skipped (' + edited.length + ' file(s) edited)',
    };
  }

  if (edited.length === 0) {
    if (tmpSafe) accumulator.collectGarbage(projectRoot, sessionId);
    return { systemMessage: 'no files edited this response — checks skipped' };
  }

  const disabled = process.env.SDLC_EXEC_PROJECT_COMMANDS === '0';
  const trusted = isTrustedProject(projectRoot);

  for (const entry of commands) {
    let reason = '';
    if (disabled) reason = 'disabled';
    else if (!trusted) reason = 'untrusted-project';
    else if (!commandIsSafeShape(entry.cmdStr)) reason = 'unsafe-command-shape';

    if (reason) {
      // Report, never run. The raw value goes through JSON encoding so control
      // bytes arrive as visible backslash text rather than live escapes.
      messages.push(
        'declared ' + entry.kind + ' command NOT executed (' + reason + '): ' +
        sanitize.quoteForDisplay(entry.cmdStr, 200) +
        (reason === 'untrusted-project'
          ? ' — run `bash install.sh --trust-project` in this project to enable it'
          : '')
      );
      continue;
    }

    messages.push('running ' + entry.kind + ': "' + entry.cmdStr + '"');
    const safeArgv = entry.cmdStr.split(' ').filter(Boolean);
    const result = runCommand(safeArgv, projectRoot);
    if (result.timedOut) {
      messages.push(entry.kind + ' timed out — reported, not blocking');
    } else if (!result.ok) {
      messages.push(entry.kind + ' FAILED: ' + result.output);
    } else {
      messages.push(entry.kind + ' passed');
    }
  }

  if (tmpSafe) {
    accumulator.clear(projectRoot, sessionId);
    accumulator.collectGarbage(projectRoot, sessionId);
  }

  return { systemMessage: messages.join(' | ') };
};
