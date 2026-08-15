'use strict';

/**
 * stop:changelog-guard — Stop.
 *
 * When CHANGELOG.md changed during a response, checks the entry's shape and
 * that it is not a duplicate under today's date.
 *
 * What it deliberately does NOT check: whether the timestamp is recent. A hook
 * can only compare against now, and an entry written forty minutes into a long
 * session is perfectly legitimate. Asserting freshness would refuse correct
 * work, which is worse than the malformed entry it would catch.
 *
 * Blocking is bounded. After two consecutive blocks the guard downgrades to a
 * warning and lets the response end — a Stop hook that can refuse forever is a
 * way to wedge a session, and no rule about changelog formatting is worth
 * that.
 *
 * Backstop: merge-ready finalization, which writes and re-checks the entry.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const accumulator = require('../lib/accumulator.js');
const sanitize = require('../lib/sanitize.js');

const ESCAPE = 'SDLC_ALLOW_CHANGELOG_SHAPE';
const MAX_BYTES = 256 * 1024;
const MAX_LINES = 10000;
const MAX_LINE = 1000;
const MAX_DETAILS = 500;
const MAX_BLOCKS = 2;
const COUNTER_SUFFIX = '.clog';

/** Did CHANGELOG.md change this response? */
function changelogChanged(cwd) {
  const result = spawnSync(
    'git',
    // `-c core.fsmonitor=` stops a repository's own config from running code;
    // `git status` is the canonical trigger for that.
    ['-c', 'core.fsmonitor=', 'status', '--porcelain', '--', 'CHANGELOG.md'],
    {
      cwd,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 5000,
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
  // Any failure — not a repo, timeout, git missing — means "do not know", and
  // a guard that does not know must not block.
  if (result.status !== 0) return false;
  return String(result.stdout || '').trim().length > 0;
}

/** Read a bounded prefix; the newest day sits at the top by format. */
function readHead(file) {
  try {
    const stat = fs.lstatSync(file);
    if (stat.isSymbolicLink() || !stat.isFile()) return null;
    const fd = fs.openSync(file, 'r');
    const buf = Buffer.alloc(Math.min(MAX_BYTES, stat.size));
    const read = fs.readSync(fd, buf, 0, buf.length, 0);
    fs.closeSync(fd);
    return buf.slice(0, read).toString('utf8');
  } catch (err) {
    return null;
  }
}

function todayUtc() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
}

function counterPath(root, sessionId) {
  const dir = accumulator.accumulatorDir(root);
  const file = path.resolve(dir, accumulator.sanitizeSessionId(sessionId) + COUNTER_SUFFIX);
  const prefix = dir.endsWith(path.sep) ? dir : dir + path.sep;
  return file.indexOf(prefix) === 0 ? file : null;
}

function readCounter(root, sessionId) {
  if (!accumulator.pathIsSafe(root)) return 0;
  const file = counterPath(root, sessionId);
  if (!file) return 0;
  try {
    const stat = fs.lstatSync(file);
    if (stat.isSymbolicLink() || !stat.isFile() || stat.size > 64) return 0;
    const text = fs.readFileSync(file, 'utf8').trim();
    return /^\d{1,2}$/.test(text) ? parseInt(text, 10) : 0;
  } catch (err) {
    return 0;
  }
}

/** Returns false when the counter cannot be persisted. */
function writeCounter(root, sessionId, value) {
  if (!accumulator.pathIsSafe(root)) return false;
  const file = counterPath(root, sessionId);
  if (!file) return false;
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, String(value) + '\n', 'utf8');
    return true;
  } catch (err) {
    return false;
  }
}

/** Check the newest entry under today's heading. Returns a defect or ''. */
function findDefect(text) {
  const lines = text.split('\n').slice(0, MAX_LINES);
  const today = todayUtc();

  let i = lines.findIndex((l) => l.trim() === '## ' + today);
  if (i === -1) {
    return 'there is no `## ' + today + '` heading at the top of the file — ' +
      'today\'s entries belong under today\'s date, newest day first';
  }

  const names = [];
  let firstEntry = -1;
  for (let j = i + 1; j < lines.length; j += 1) {
    const line = lines[j];
    if (line.length > MAX_LINE) continue;
    if (/^## /.test(line)) break;                 // next day
    const m = /^### (.+?) — (\d{2}:\d{2}) UTC\s*$/.exec(line);
    if (m) {
      if (firstEntry === -1) firstEntry = j;
      names.push(m[1].trim().toLowerCase());
      continue;
    }
    if (/^### /.test(line) && firstEntry === -1) {
      return 'the first entry heading under ' + today + ' is not in the form ' +
        '`### <name> — HH:MM UTC`: ' + sanitize.quoteForDisplay(line.trim(), 80);
    }
  }

  if (firstEntry === -1) {
    return 'the `## ' + today + '` heading has no `### <name> — HH:MM UTC` entry under it';
  }

  const seen = Object.create(null);
  for (const name of names) {
    if (seen[name]) {
      return 'two entries under ' + today + ' share the name ' +
        sanitize.quoteForDisplay(name, 60) + ' — update the existing entry in ' +
        'place rather than adding a second';
    }
    seen[name] = true;
  }

  const body = lines.slice(firstEntry + 1, firstEntry + 8);
  const summary = body.find((l) => /^\*\*Summary:\*\*/.test(l));
  if (!summary) return 'the newest entry has no `**Summary:**` line';
  const details = body.find((l) => /^\*\*Details:\*\*/.test(l));
  if (!details) return 'the newest entry has no `**Details:**` line';

  const detailsText = details.replace(/^\*\*Details:\*\*\s*/, '');
  if (detailsText.length > MAX_DETAILS) {
    return 'the newest entry\'s Details field is ' + detailsText.length +
      ' characters, over the ' + MAX_DETAILS + '-character cap';
  }

  return '';
}

module.exports = function changelogGuard(input) {
  const event = (input && input.hook_event_name) || '';
  if (event !== 'Stop') return null;

  const root = path.resolve((input && input.cwd) || process.cwd());
  const sessionId = input && input.session_id;

  if (!changelogChanged(root)) return null;

  const text = readHead(path.join(root, 'CHANGELOG.md'));
  if (text === null) return null;

  const defect = findDefect(text);
  if (!defect) {
    writeCounter(root, sessionId, 0);
    return null;
  }

  if (process.env[ESCAPE] === '1') {
    return { systemMessage: 'changelog-guard bypassed via ' + ESCAPE + ': ' + defect };
  }

  const blocks = readCounter(root, sessionId);
  if (blocks >= MAX_BLOCKS) {
    return {
      systemMessage:
        'changelog-guard: ' + defect + '. Already asked twice, so letting this ' +
        'response end rather than looping — merge-ready re-checks the entry.',
    };
  }

  // If the counter cannot be persisted, warn instead of blocking: an
  // unpersistable count would re-block every Stop forever.
  if (!writeCounter(root, sessionId, blocks + 1)) {
    return { systemMessage: 'changelog-guard: ' + defect + ' (unable to track retries; not blocking)' };
  }

  return {
    deny: {
      reason:
        'The changelog entry needs fixing before this response ends: ' + defect +
        '. The format is `### <name> — HH:MM UTC` under a `## YYYY-MM-DD` ' +
        'heading, followed by a `**Summary:**` line a non-engineer can read and ' +
        'a `**Details:**` line of at most ' + MAX_DETAILS + ' characters. ' +
        'Override with ' + ESCAPE + '=1. ' +
        '[deviation: rule-1 — fix the named field, free]',
    },
  };
};
