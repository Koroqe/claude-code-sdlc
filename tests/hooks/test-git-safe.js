#!/usr/bin/env node
'use strict';

/**
 * hooks/lib/git-safe.js tests (parallel-features §15, TC-4.8, TC-11.6).
 *
 * The helper is the single home of the hardened git spawn for the trust and
 * spine paths. It is a lib module, not a handler, so — unlike the hooks,
 * which are exercised as child processes — requiring it in-process is the
 * point here: the security property under test is what the SPAWNED GIT CHILD
 * observes, and the only honest way to assert that is from the child's own
 * side. A fake `git` placed ahead of the real one on PATH dumps its observed
 * env and argv; the assertions read that dump, never a filesystem
 * side-effect probe.
 *
 * The parent test process deliberately carries hostile
 * GIT_CONFIG_COUNT/GIT_CONFIG_KEY_0/GIT_CONFIG_VALUE_0, GIT_CONFIG_PARAMETERS
 * and GIT_ALTERNATE_OBJECT_DIRECTORIES for the WHOLE run — every later
 * real-git assertion therefore also proves immunity with the hostile vars
 * live, not just the dedicated section.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { tempDir, rimraf, Checks, REPO_ROOT } = require('./harness');

const c = new Checks('hooks/lib/git-safe');
const HELPER = path.join(REPO_ROOT, 'hooks', 'lib', 'git-safe.js');
const scratch = tempDir('sdlc-gitsafe-');

c.ok('hooks/lib/git-safe.js exists', fs.existsSync(HELPER));
let gitSafe = null;
try {
  gitSafe = require(HELPER);
} catch (err) {
  gitSafe = null;
}
c.ok('git-safe.js loads as a module', !!gitSafe);
if (!gitSafe) {
  rimraf(scratch);
  c.finish(); // red phase: nothing below can run without the module
}

c.equal('UNKNOWN is the literal non-throwing sentinel', gitSafe.UNKNOWN, 'unknown');
c.ok('runGit is exported', typeof gitSafe.runGit === 'function');
c.ok('commonDirRoot is exported', typeof gitSafe.commonDirRoot === 'function');

// --- hostile parent env, proven unseen by the child (TC-4.8) --------------
// Seed the hostile variables in the parent BEFORE any helper call. The
// values are attacker-shaped (config injection, code-running fsmonitor,
// alternate object dirs) but point only into the scratch dir.
const REAL_PATH = process.env.PATH || '';
process.env.GIT_CONFIG_COUNT = '1';
process.env.GIT_CONFIG_KEY_0 = 'core.pager';
process.env.GIT_CONFIG_VALUE_0 = 'touch ' + path.join(scratch, 'pwned-by-config-count');
process.env.GIT_CONFIG_PARAMETERS = "'core.fsmonitor=" + path.join(scratch, 'evil-fsmonitor.sh') + "'";
process.env.GIT_ALTERNATE_OBJECT_DIRECTORIES = path.join(scratch, 'alt-objects');

// A fake `git` ahead of the real one on PATH dumps its own env and argv.
const fakeBin = path.join(scratch, 'bin');
fs.mkdirSync(fakeBin, { recursive: true });
fs.writeFileSync(
  path.join(fakeBin, 'git'),
  '#!' + process.execPath + '\n' +
  "process.stdout.write(JSON.stringify({ env: process.env, argv: process.argv.slice(2) }));\n"
);
fs.chmodSync(path.join(fakeBin, 'git'), 0o755);
process.env.PATH = fakeBin + path.delimiter + REAL_PATH;

const dump = gitSafe.runGit(scratch, ['rev-parse', '--abbrev-ref', 'HEAD']);
process.env.PATH = REAL_PATH; // real git for everything below

c.ok('the fake git child ran and its dump came back',
  dump !== gitSafe.UNKNOWN && dump !== '', String(dump).slice(0, 120));
let observed = null;
try {
  observed = JSON.parse(dump);
} catch (err) {
  observed = null;
}
c.ok("the child's own dump parses", !!observed, String(dump).slice(0, 120));

if (observed) {
  const env = observed.env;
  c.ok('child never observes GIT_CONFIG_COUNT', !('GIT_CONFIG_COUNT' in env));
  c.ok('child never observes GIT_CONFIG_KEY_0', !('GIT_CONFIG_KEY_0' in env));
  c.ok('child never observes GIT_CONFIG_VALUE_0', !('GIT_CONFIG_VALUE_0' in env));
  c.ok('child never observes GIT_CONFIG_PARAMETERS', !('GIT_CONFIG_PARAMETERS' in env));
  c.ok('child never observes GIT_ALTERNATE_OBJECT_DIRECTORIES',
    !('GIT_ALTERNATE_OBJECT_DIRECTORIES' in env));

  // Allowlist EQUALITY, not mere absence: the child env is EXACTLY the eight
  // allowlisted keys — anything more would mean env was inherited, not built.
  // One platform artifact is excluded by name: macOS's libSystem injects
  // __CF_USER_TEXT_ENCODING into every process at startup (derived from the
  // uid, never from the parent env), which no JS spawn can suppress.
  const ALLOWLIST = ['GIT_CONFIG_GLOBAL', 'GIT_CONFIG_NOSYSTEM', 'GIT_CONFIG_SYSTEM',
    'GIT_OPTIONAL_LOCKS', 'GIT_TERMINAL_PROMPT', 'LANG', 'LC_ALL', 'PATH'];
  const observedKeys = Object.keys(env)
    .filter((k) => k !== '__CF_USER_TEXT_ENCODING').sort();
  c.equal('child env keys equal the allowlist exactly',
    observedKeys.join(','), ALLOWLIST.join(','));
  c.equal('GIT_CONFIG_GLOBAL pinned to /dev/null', env.GIT_CONFIG_GLOBAL, '/dev/null');
  c.equal('GIT_CONFIG_SYSTEM pinned to /dev/null', env.GIT_CONFIG_SYSTEM, '/dev/null');
  c.equal('GIT_CONFIG_NOSYSTEM pinned to 1', env.GIT_CONFIG_NOSYSTEM, '1');
  c.equal('GIT_TERMINAL_PROMPT pinned to 0', env.GIT_TERMINAL_PROMPT, '0');
  c.equal('GIT_OPTIONAL_LOCKS pinned to 0', env.GIT_OPTIONAL_LOCKS, '0');

  // `-c core.fsmonitor=` on argv, on EVERY invocation — a repository's own
  // config must never be able to run code through the helper.
  const argv = observed.argv;
  const cIdx = argv.indexOf('-c');
  c.ok('-c core.fsmonitor= present on argv',
    cIdx !== -1 && argv[cIdx + 1] === 'core.fsmonitor=', JSON.stringify(argv));
}

// --- spawn-shape literals (TC-4.8: shell/timeout/stdio/maxBuffer) ---------
const src = fs.readFileSync(HELPER, 'utf8');
c.ok('shell:false at the spawn site', /shell:\s*false/.test(src));
c.ok('a bounded numeric timeout at the spawn site', /timeout:\s*\d/.test(src));
c.ok("killSignal: 'SIGKILL' at the spawn site", /killSignal:\s*'SIGKILL'/.test(src));
c.ok("stdio pinned to ['ignore','pipe','pipe']",
  /stdio:\s*\['ignore',\s*'pipe',\s*'pipe'\]/.test(src));
c.ok('a maxBuffer cap at the spawn site', /maxBuffer:\s*\d/.test(src));
c.ok('the child env is never built over process.env (no Object.assign)',
  src.indexOf('Object.assign({}, process.env') === -1);
c.ok('the child env is never built over process.env (no spread)',
  src.indexOf('...process.env') === -1);

// --- every failure is the non-throwing UNKNOWN, never an exception --------
const notARepo = path.join(scratch, 'not-a-repo');
fs.mkdirSync(notARepo, { recursive: true });
c.equal('a non-repo cwd returns UNKNOWN',
  gitSafe.runGit(notARepo, ['rev-parse', '--abbrev-ref', 'HEAD']), gitSafe.UNKNOWN);
c.equal('commonDirRoot on a non-repo returns UNKNOWN',
  gitSafe.commonDirRoot(notARepo), gitSafe.UNKNOWN);
c.equal('a nonexistent cwd returns UNKNOWN',
  gitSafe.runGit(path.join(scratch, 'ghost-dir'), ['rev-parse', 'HEAD']), gitSafe.UNKNOWN);
c.equal('commonDirRoot on a nonexistent cwd returns UNKNOWN',
  gitSafe.commonDirRoot(path.join(scratch, 'ghost-dir')), gitSafe.UNKNOWN);

// --- real-repo resolution: main root, worktree, bare negative -------------
// Repo setup spawns use a scrubbed env of their own (the helper's children
// are hermetic by construction; the SETUP must be too, or a user's global
// config could break the fixtures).
const sandboxHome = path.join(scratch, 'home');
fs.mkdirSync(sandboxHome, { recursive: true });
const GIT_ENV = {
  PATH: REAL_PATH,
  HOME: sandboxHome,
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_SYSTEM: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_TERMINAL_PROMPT: '0',
};
function git(cwd, args) {
  return spawnSync('git', args, { cwd, env: GIT_ENV, stdio: 'ignore' });
}

const mainRepo = path.join(scratch, 'main-repo');
fs.mkdirSync(mainRepo, { recursive: true });
fs.writeFileSync(path.join(mainRepo, 'a.txt'), 'a\n');
git(mainRepo, ['init', '-q']);
git(mainRepo, ['config', 'user.email', 't@e.com']);
git(mainRepo, ['config', 'user.name', 'T']);
git(mainRepo, ['add', '.']);
git(mainRepo, ['commit', '-qm', 'init', '--no-verify']);
git(mainRepo, ['branch', '-M', 'main']);

c.equal('runGit resolves the branch in a real repo',
  gitSafe.runGit(mainRepo, ['rev-parse', '--abbrev-ref', 'HEAD']), 'main');
c.equal('commonDirRoot at the main checkout resolves the root itself',
  gitSafe.commonDirRoot(mainRepo), fs.realpathSync(mainRepo));

const worktree = path.join(scratch, 'linked-worktree');
git(mainRepo, ['worktree', 'add', '-b', 'feat/linked', worktree]);
c.equal('runGit resolves the branch inside the worktree',
  gitSafe.runGit(worktree, ['rev-parse', '--abbrev-ref', 'HEAD']), 'feat/linked');
c.equal('commonDirRoot inside a linked worktree resolves the MAIN root',
  gitSafe.commonDirRoot(worktree), fs.realpathSync(mainRepo));

// Negative: a bare repo's common dir does not end in `.git`, so the dirname
// step must refuse it — UNKNOWN, never a made-up root.
const bareRepo = path.join(scratch, 'bare.git');
fs.mkdirSync(bareRepo, { recursive: true });
git(bareRepo, ['init', '-q', '--bare']);
c.equal('commonDirRoot on a bare repo returns UNKNOWN (dirname only on a .git basename)',
  gitSafe.commonDirRoot(bareRepo), gitSafe.UNKNOWN);

rimraf(scratch);
c.finish();
