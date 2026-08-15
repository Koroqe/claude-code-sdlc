/*
 * Shared entry point for every claude-code-sdlc hook.
 *
 * ---------------------------------------------------------------------------
 * SYNTAX FLOOR — read before editing.
 *
 * This file must PARSE under the oldest Node an adopter might plausibly
 * resolve. Claude Code may be launched from a GUI or IDE whose PATH finds a
 * years-old /usr/local/bin/node rather than the nvm one an interactive shell
 * would pick. If this file fails to parse, the version gate below never runs,
 * nothing is emitted, and the fail-open contract is silently unfulfillable.
 *
 * So: ES5 syntax only in this file. `var`, function declarations, string
 * concatenation. No arrow functions, template literals, const/let, default
 * parameters, destructuring, optional chaining, or async/await. Handler
 * modules loaded AFTER the gate may use modern syntax freely.
 * ---------------------------------------------------------------------------
 *
 * THE FAIL-OPEN CONTRACT (PRD Section 7, FR-3).
 *
 * Whatever goes wrong here, this process exits 0 and the tool call proceeds.
 * A hook may block only by deciding to block — never by malfunctioning. A
 * crashing hook that halted every tool call would be worse than the prose it
 * replaced, and this harness's defining property is that its pipeline runs
 * unattended.
 *
 * No hook in this feature blocks at all: exit code 2 appears nowhere under
 * hooks/, and CI asserts that.
 */

'use strict';

var fs = require('fs');
var path = require('path');

var MIN_NODE_MAJOR = 18;
var DEFAULT_TIMEOUT_MS = 5000;
var VALID_PROFILES = ['minimal', 'standard', 'strict'];
var DEFAULT_PROFILE = 'standard';

/* id -> { handler, timeoutMs, profiles } */
var HOOKS = {
  'session:start:spine': {
    handler: 'session-start-spine.js',
    timeoutMs: 5000,
    profiles: ['minimal', 'standard', 'strict']
  },
  'post:edit:accumulate': {
    handler: 'post-edit-accumulate.js',
    timeoutMs: 3000,
    profiles: ['standard', 'strict']
  },
  'stop:typecheck-format': {
    handler: 'stop-typecheck-format.js',
    timeoutMs: 120000,
    profiles: ['standard', 'strict']
  }
};

/* ------------------------------------------------------------------ output */

/* Emit and exit 0. This is the only exit path in the file. */
function emit(payload) {
  var out;
  try {
    out = JSON.stringify(payload);
  } catch (err) {
    // Even serialization failed — say nothing rather than emit broken JSON.
    out = '';
  }
  if (out) {
    try {
      process.stdout.write(out + '\n');
    } catch (err2) {
      /* nothing left to do; still exit 0 */
    }
  }
  process.exit(0);
}

function emitSilent() {
  emit({ continue: true });
}

/* Strip control characters so a hostile string cannot rewrite the terminal. */
function sanitizeMessage(text) {
  var s = String(text);
  var out = '';
  var i;
  var code;
  for (i = 0; i < s.length; i += 1) {
    code = s.charCodeAt(i);
    if (code >= 32 && code !== 127) {
      out += s.charAt(i);
    } else if (code === 10 || code === 9) {
      out += ' ';
    }
  }
  return out;
}

function emitNote(hookId, message) {
  emit({
    continue: true,
    systemMessage: sanitizeMessage('[' + hookId + '] ' + message)
  });
}

/* --------------------------------------------------------------- arguments */

function parseHookId(argv) {
  var i;
  for (i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--hook' && argv[i + 1]) {
      return argv[i + 1];
    }
  }
  return '';
}

/* ------------------------------------------------------------------- stdin */

function readStdin(callback) {
  var chunks = '';
  var finished = false;

  function done(value) {
    if (finished) { return; }
    finished = true;
    callback(value);
  }

  try {
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', function (chunk) { chunks += chunk; });
    process.stdin.on('end', function () { done(chunks); });
    process.stdin.on('error', function () { done(''); });
    // Claude Code always provides stdin; if nothing arrives, do not hang.
    setTimeout(function () { done(chunks); }, 2000);
  } catch (err) {
    done('');
  }
}

/* -------------------------------------------------------------------- main */

function main() {
  var hookId = parseHookId(process.argv.slice(2));

  if (!hookId || !HOOKS.hasOwnProperty(hookId)) {
    // Unknown id is a configuration error, not a reason to disturb the run.
    emitSilent();
    return;
  }

  var spec = HOOKS[hookId];

  /* Kill switch. Only the literal string "0" disables. Suppression is silent —
   * deliberately distinguishable from a fail-open note, which always speaks. */
  if (process.env.SDLC_HOOKS_ENABLED === '0') {
    emitSilent();
    return;
  }

  /* Per-id disable list. */
  var disabled = process.env.SDLC_DISABLED_HOOKS || '';
  if (disabled) {
    var parts = disabled.split(',');
    var j;
    for (j = 0; j < parts.length; j += 1) {
      if (parts[j].replace(/^\s+|\s+$/g, '') === hookId) {
        emitSilent();
        return;
      }
    }
  }

  /* Profile gating. An unrecognised value falls back to standard rather than
   * failing — a typo in an env var must not change enforcement silently. */
  var profile = process.env.SDLC_HOOK_PROFILE || DEFAULT_PROFILE;
  if (VALID_PROFILES.indexOf(profile) === -1) {
    profile = DEFAULT_PROFILE;
  }
  if (spec.profiles.indexOf(profile) === -1) {
    emitSilent();
    return;
  }

  /* Node version gate. Everything above this line is ES5 and dependency-free
   * precisely so this check is reachable. */
  var detected = process.versions && process.versions.node ? process.versions.node : '0.0.0';
  var major = parseInt(String(detected).split('.')[0], 10);
  var forced = process.env.SDLC_HOOK_FORCE_NODE_VERSION;
  if (forced) {
    major = parseInt(String(forced).split('.')[0], 10);
    detected = forced;
  }
  if (!isFinite(major) || major < MIN_NODE_MAJOR) {
    emitNote(hookId, 'node-unavailable: requires Node >= ' + MIN_NODE_MAJOR +
      ', found ' + detected + ' — hook skipped, run continues');
    return;
  }

  /* Plugin root. */
  var root = process.env.CLAUDE_PLUGIN_ROOT;
  if (!root) {
    // Fall back to this file's own location: hooks/lib -> plugin root.
    root = path.resolve(__dirname, '..', '..');
  }

  var handlersDir = process.env.SDLC_HOOK_HANDLERS_DIR ||
    path.join(root, 'hooks', 'handlers');
  var handlerPath = path.join(handlersDir, spec.handler);

  var timeoutMs = parseInt(process.env.SDLC_HOOK_TIMEOUT_MS, 10);
  if (!isFinite(timeoutMs) || timeoutMs <= 0) {
    timeoutMs = spec.timeoutMs || DEFAULT_TIMEOUT_MS;
  }

  readStdin(function (raw) {
    var input = {};
    try {
      input = raw ? JSON.parse(raw) : {};
    } catch (err) {
      input = {};
    }

    var settled = false;
    var timer = setTimeout(function () {
      if (settled) { return; }
      settled = true;
      emitNote(hookId, 'timeout after ' + timeoutMs + 'ms — hook skipped, run continues');
    }, timeoutMs);

    function finish(result) {
      if (settled) { return; }
      settled = true;
      clearTimeout(timer);

      if (!result || typeof result !== 'object') {
        emitSilent();
        return;
      }

      var payload = { continue: true };
      if (result.systemMessage) {
        payload.systemMessage = sanitizeMessage(result.systemMessage);
      }
      if (result.additionalContext) {
        payload.hookSpecificOutput = {
          hookEventName: result.hookEventName || '',
          additionalContext: String(result.additionalContext)
        };
      }
      emit(payload);
    }

    var handler;
    try {
      if (!fs.existsSync(handlerPath)) {
        // Expected while the feature branch is mid-build; also the shape a
        // botched install takes. Either way: proceed.
        clearTimeout(timer);
        settled = true;
        emitNote(hookId, 'handler not found — hook skipped, run continues');
        return;
      }
      handler = require(handlerPath);
    } catch (err) {
      clearTimeout(timer);
      settled = true;
      emitNote(hookId, 'exception loading handler: ' +
        (err && err.message ? err.message : 'unknown') + ' — run continues');
      return;
    }

    try {
      var result = typeof handler === 'function' ? handler(input) : handler.run(input);
      if (result && typeof result.then === 'function') {
        result.then(finish, function (err) {
          if (settled) { return; }
          settled = true;
          clearTimeout(timer);
          emitNote(hookId, 'exception: ' +
            (err && err.message ? err.message : 'unknown') + ' — run continues');
        });
      } else {
        finish(result);
      }
    } catch (err) {
      if (settled) { return; }
      settled = true;
      clearTimeout(timer);
      emitNote(hookId, 'exception: ' +
        (err && err.message ? err.message : 'unknown') + ' — run continues');
    }
  });
}

try {
  main();
} catch (err) {
  // Absolute backstop. Nothing above may prevent this process exiting 0.
  try {
    process.stdout.write(JSON.stringify({ continue: true }) + '\n');
  } catch (err2) { /* ignore */ }
  process.exit(0);
}
