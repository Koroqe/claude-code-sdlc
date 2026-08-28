'use strict';

/**
 * pre:bash:git-guard — PreToolUse on Bash.
 *
 * Mechanises five prose rules from src/rules/git.md that the pipeline has been
 * trusting the model to remember: work on a feature branch, use conventional
 * commits with an allowed scope, stage named files, never add AI attribution,
 * never push unasked.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS GUARD IS, AND IS NOT.
 *
 * It polices model drift. It is NOT a security boundary against a hostile
 * repository or a determined human, and nothing here should ever be described
 * as one. Every check can be bypassed by a caller who wants to — the escape
 * sentinel is documented in the deny message itself, deliberately, so the
 * pipeline can self-resolve under deviation rule 3 rather than stalling.
 *
 * What it buys is that an unattended run cannot drift into a bad commit by
 * forgetting a rule, and that every bypass is visible in the transcript.
 *
 * Known blind spots, stated so nobody mistakes this for more than it is:
 *   - indirection through `sh -c`, `bash -c`, `eval`, `xargs`
 *   - `$(...)` and backtick subshells
 *   - git aliases, including repo-local ones and `git -c alias.x=commit x`
 *   - variable indirection (`G=git; $G commit`)
 *   - string splicing (`g''it commit`)
 *   - directory tracking (see below) does not follow `pushd`/`popd`, a `cd`
 *     inside `( … )`, or a `cd` that fails at runtime; each of those leaves the
 *     tracked directory stale rather than unknown, so the branch check can read
 *     a repository the command did not target
 *   - a git command quoted as DATA — inside a heredoc, or an argument to
 *     another program — is judged as if it were about to run
 * A model laundering git through those is outside the threat model. The
 * backstop is merge-ready Gate 0, which re-checks git hygiene before merge.
 * ---------------------------------------------------------------------------
 */

const { spawnSync } = require('child_process');
const path = require('path');
const shell = require('../lib/shell-parse.js');
const sanitize = require('../lib/sanitize.js');

const PROTECTED_BRANCHES = ['main', 'master'];
const ALLOWED_TYPES = ['feat', 'fix', 'test', 'chore'];
const ALLOWED_SCOPES = ['api', 'ui', 'db', 'auth', 'core', 'infra'];
const ESCAPE = 'SDLC_ALLOW_GIT_GUARD';

const CONVENTIONAL_RE = new RegExp(
  '^(' + ALLOWED_TYPES.join('|') + ')\\((' + ALLOWED_SCOPES.join('|') + ')\\): .+'
);

/* Attribution markers. Deliberately narrow: a bare /claude/i would deny
 * `fix(core): rename ClaudeConfig to AgentConfig`, which is a legitimate
 * message, and a guard that blocks real work is worse than the rule it
 * enforces. */
const ATTRIBUTION_PATTERNS = [
  /co-authored-by/i,
  /generated\s+(with|by)\s+(claude|an?\s*ai\b|anthropic|copilot|gpt)/i,
  /noreply@anthropic\.com/i,
  /^\s*(co-)?(authored|written|created|generated)[-\s]by\b.*\b(claude|ai|anthropic|copilot|gpt)\b/im,
];

/**
 * Resolve the current branch without letting a repo's own config run code.
 *
 * `pathOpts` are the target-selecting global options lifted verbatim off the
 * command being judged (`-C`, `--git-dir`, `--work-tree`). Replaying them lets
 * git resolve the target itself, rather than this file reimplementing rules it
 * would get subtly wrong. `-c` is deliberately NOT replayed: arbitrary config
 * from the command line is the same code-execution vector `core.fsmonitor=`
 * below exists to close.
 */
function currentBranch(cwd, pathOpts) {
  const result = spawnSync(
    'git',
    // `-c core.fsmonitor=` neutralises the canonical repo-config code-execution
    // vector: a repository can otherwise make almost any git command run a
    // program of its choosing.
    ['-c', 'core.fsmonitor=']
      .concat(pathOpts || [])
      .concat(['rev-parse', '--abbrev-ref', 'HEAD']),
    {
      cwd,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 2000,
      killSignal: 'SIGKILL',
      maxBuffer: 16 * 1024,
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
  if (result.status !== 0 || !result.stdout) return '';
  const name = String(result.stdout).trim();
  return /^[\w./-]+$/.test(name) ? name : '';
}

/**
 * Where a `cd` segment lands, or null when that cannot be known.
 *
 * Returning null is the important half. The alternative to admitting "I don't
 * know" is judging some other repository's branch, which is exactly the defect
 * this function exists to fix — so anything with a variable, a subshell, a
 * glob, or `cd -` gives up rather than guesses.
 */
function cdTarget(args, cwd) {
  const operands = args.filter((a) => !a.startsWith('-'));

  // Bare `cd` is $HOME. Anything with more than one operand is not a plain
  // directory change (`cd a b` is bash's substitution form).
  if (operands.length === 0) return process.env.HOME || null;
  if (operands.length > 1) return null;

  const target = operands[0];

  // `cd -` is the previous directory, which this file does not track.
  if (target === '-') return null;

  // Unexpanded shell metacharacters mean the literal text is not the path.
  // Tokenizing strips quotes, so a `$` surviving to here was genuinely a
  // variable, not the `$` inside a quoted string that shell-parse already
  // resolved.
  if (/[$`*?]/.test(target)) return null;

  if (target === '~') return process.env.HOME || null;
  if (target.startsWith('~/')) {
    return process.env.HOME ? path.resolve(process.env.HOME, target.slice(2)) : null;
  }
  if (target.startsWith('~')) return null; // ~otheruser

  return path.resolve(cwd, target);
}

/**
 * Lift the target-selecting global options off a git command, in order, so
 * `currentBranch` can replay them. Only the three that choose which repository
 * git acts on — never `-c`.
 */
function targetOptions(args) {
  const out = [];
  const PAIRED = ['-C', '--git-dir', '--work-tree'];

  let i = 0;
  while (i < args.length && args[i].startsWith('-')) {
    const a = args[i];

    if (PAIRED.indexOf(a) !== -1) {
      const value = args[i + 1];
      // A value that looks like an option is a malformed command; replaying it
      // would let git reinterpret it as something else entirely.
      if (value !== undefined && !value.startsWith('-')) out.push(a, value);
      i += 2;
      continue;
    }

    if (/^--(git-dir|work-tree)=/.test(a)) {
      out.push(a);
      i += 1;
      continue;
    }

    // `-c` and `--exec-path` are two-token but deliberately not replayed.
    i += (a === '-c' || a === '--namespace' || a === '--exec-path') ? 2 : 1;
  }

  return out;
}

/** Collect every -m / --message value from a commit's arguments. */
function commitMessages(args) {
  const out = [];
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '-m' || a === '--message') {
      if (args[i + 1] !== undefined) { out.push(args[i + 1]); i += 1; }
    } else if (a.startsWith('--message=')) {
      out.push(a.slice('--message='.length));
    } else if (a.startsWith('-m') && a.length > 2) {
      out.push(a.slice(2));
    } else if (/^-[a-zA-Z]*m$/.test(a) && a.length > 2) {
      // A bundled flag ending in m, e.g. `git commit -am "msg"`.
      if (args[i + 1] !== undefined) { out.push(args[i + 1]); i += 1; }
    }
  }
  return out;
}

function deny(reason) { return { deny: { reason } }; }

module.exports = function gitGuard(input) {
  const command = (input && input.tool_input && input.tool_input.command) || '';
  if (!command) return null;

  const envEscaped = process.env[ESCAPE] === '1';
  const notes = [];

  // The cwd the shell is standing in as each segment runs. It starts at the
  // session's directory and moves with every `cd`, because the branch check
  // has to judge the repository git will ACTUALLY act on — not the one the
  // session happens to be rooted in. `null` means "no longer known", which
  // suppresses the branch check rather than pointing it at the wrong repo.
  let cwd = (input && input.cwd) || process.cwd();
  let branchSkipNoted = false;

  for (const segment of shell.splitSegments(command)) {
    const resolved = shell.resolveCommand(segment);

    if (resolved.name === 'cd') {
      cwd = cwd === null ? null : cdTarget(resolved.args, cwd);
      continue;
    }

    if (resolved.name !== 'git') continue;

    // The escape may be set in this process's environment, or written inline
    // as an assignment prefix on the command itself. The inline form is not a
    // convenience: an `export` in an earlier Bash call sets that shell's
    // environment, not this hook process's, so without it the model would have
    // no per-call way to self-resolve — and a guard with no usable escape is a
    // guard that stalls unattended runs.
    const inlineEscaped = resolved.assignments.some((a) => a === ESCAPE + '=1');
    const escaped = envEscaped || inlineEscaped;

    // Skip git's own global options to find the real subcommand.
    const args = resolved.args.slice();
    let i = 0;
    const TWO_TOKEN_OPTS = ['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--exec-path'];
    while (i < args.length && args[i].startsWith('-')) {
      if (TWO_TOKEN_OPTS.indexOf(args[i]) !== -1) i += 2; else i += 1;
    }
    const subcommand = args[i];
    const rest = args.slice(i + 1);

    function refuse(reason) {
      if (escaped) {
        // A silent bypass is indistinguishable from a guard that never fired.
        notes.push('git-guard bypassed via ' + ESCAPE + ': ' + reason.split(' [deviation')[0]);
        return null;
      }
      return deny(reason);
    }

    if (subcommand === 'commit') {
      // Every other check below reads only the command text, so losing track of
      // the directory must not disable them — otherwise this becomes a way to
      // launder a bad commit past the shape and attribution checks.
      const branch = cwd === null ? '' : currentBranch(cwd, targetOptions(args));

      if (cwd === null && !branchSkipNoted) {
        notes.push(
          'git-guard: branch check skipped — could not resolve which repository ' +
          'this `git commit` targets (an unresolved `cd`). Every other check ran.'
        );
        branchSkipNoted = true;
      }

      if (branch && PROTECTED_BRANCHES.indexOf(branch) !== -1) {
        const r = refuse(
          'Refusing to commit on ' + branch + '. Work happens on a feature branch: ' +
          'run `git checkout -b feat/<slug>` (or fix/<slug>) and commit there. ' +
          'Override for this call with ' + ESCAPE + '=1 as a prefix. ' +
          '[deviation: rule-1 — switch to a feature branch, free]'
        );
        if (r) return r;
      }

      // git accepts any unambiguous abbreviation of a long option, so an exact
      // string match is not enough: `--no-verif` genuinely skips the hooks.
      // `--no-v...` is unambiguous for `git commit`.
      const skipsHooks = rest.some((a) => /^--no-v/.test(a)) || rest.indexOf('-n') !== -1;
      if (skipsHooks) {
        const r = refuse(
          'Refusing `git commit --no-verify`: it skips the checks that keep an ' +
          'unattended run honest. Fix what the hook reports instead. ' +
          'Override with ' + ESCAPE + '=1. ' +
          '[deviation: rule-1 — fix the underlying failure, free]'
        );
        if (r) return r;
      }

      const messages = commitMessages(rest);
      if (messages.length === 0) {
        const r = refuse(
          'Refusing a commit whose message cannot be inspected. Pass it inline ' +
          'with -m "type(scope): summary" so the shape and attribution checks ' +
          'can run. [deviation: rule-1 — use -m, free]'
        );
        if (r) return r;
      }

      const joined = messages.join('\n');
      for (const pattern of ATTRIBUTION_PATTERNS) {
        if (pattern.test(joined)) {
          const r = refuse(
            'Refusing a commit message containing AI attribution. Commit ' +
            'messages carry the change description only — no Co-Authored-By, ' +
            'no generated-by line. Rewrite the message. ' +
            '[deviation: rule-1 — remove the attribution line, free]'
          );
          if (r) return r;
          break;
        }
      }

      if (messages.length > 0 && !CONVENTIONAL_RE.test(messages[0].split('\n')[0])) {
        const r = refuse(
          'Refusing a commit message that is not conventional: ' +
          sanitize.quoteForDisplay(messages[0].split('\n')[0], 80) + '. ' +
          'Use type(scope): summary, where type is one of ' + ALLOWED_TYPES.join('|') +
          ' and scope is one of ' + ALLOWED_SCOPES.join('|') + '. ' +
          '[deviation: rule-1 — rewrite the message, free]'
        );
        if (r) return r;
      }
    }

    if (subcommand === 'add') {
      const bulk = rest.filter((a) => !a.startsWith('-'));
      if (bulk.length === 1 && (bulk[0] === '.' || bulk[0] === '-A') ||
          rest.indexOf('-A') !== -1 || rest.indexOf('--all') !== -1) {
        const r = refuse(
          'Refusing a bulk `git add`. Stage the files this slice actually ' +
          'changed, by name, so an unrelated stray file cannot ride along into ' +
          'the commit. Override with ' + ESCAPE + '=1. ' +
          '[deviation: rule-1 — name the files, free]'
        );
        if (r) return r;
      }
    }

    if (subcommand === 'push') {
      const r = refuse(
        'Refusing an unrequested `git push`. Pushing is the developer\'s call, ' +
        'not the pipeline\'s. If a push was actually asked for, re-run with ' +
        ESCAPE + '=1 as a prefix. ' +
        '[deviation: rule-3 — set ' + ESCAPE + '=1 if the push was requested, costs 1 retry]'
      );
      if (r) return r;
    }
  }

  return notes.length ? { systemMessage: notes.join(' | ') } : null;
};
