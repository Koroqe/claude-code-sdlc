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
 * Some hooks DO refuse — the guards added in PRD Section 8. They refuse by
 * returning `{ deny: { reason } }`, which this file alone turns into a
 * decision. Exit code 2 is never used anywhere in the harness: one signalling
 * mechanism, so "refused on purpose" and "broke by accident" can never be
 * confused. CI asserts no exit(2) exists under hooks/.
 *
 * ---------------------------------------------------------------------------
 * WHAT THE TIMEOUT BELOW CAN AND CANNOT DO — do not mistake one for the other.
 *
 * SDLC_HOOK_TIMEOUT_MS schedules a JS timer. Node is single-threaded, so that
 * timer can only fire between turns of the event loop. It therefore bounds an
 * ASYNCHRONOUS handler, and nothing else. A handler that blocks synchronously
 * — a busy loop, a huge readFileSync, a spawnSync on a hanging child — cannot
 * be interrupted by it, and the timer will not fire until the handler has
 * already returned.
 *
 * The real backstop for a synchronous hang is the `timeout` field on each
 * entry in hooks/hooks.json, which Claude Code enforces by killing the
 * process from outside. That is the mechanism keeping a wedged hook from
 * stalling a session, and it is why every entry there carries an explicit
 * timeout. Keep them set.
 * ---------------------------------------------------------------------------
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
  // Reads a finished wave subagent's own transcript and records what it
  // actually did, so post-wave collection can cross-check the subagent's
  // self-report instead of trusting it. Never blocks.
  'subagent:stop:wave-record': {
    handler: 'subagent-stop-wave-record.js',
    timeoutMs: 5000,
    profiles: ['minimal', 'standard', 'strict']
  },
  // Diagnostic only. Records what PreCompact carries so the compaction
  // feature can be designed against an observed schema rather than a
  // documented one. Never blocks, never injects.
  'pre:compact:probe': {
    handler: 'pre-compact-probe.js',
    timeoutMs: 5000,
    profiles: ['minimal', 'standard', 'strict']
  },
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
  },
  'pre:bash:git-guard': {
    handler: 'pre-bash-git-guard.js',
    timeoutMs: 10000,
    profiles: ['standard', 'strict']
  },
  'pre:write:shrink-guard': {
    handler: 'pre-write-shrink-guard.js',
    timeoutMs: 5000,
    profiles: ['standard', 'strict']
  },
  'pre:edit:read-guard': {
    handler: 'pre-edit-read-guard.js',
    timeoutMs: 5000,
    profiles: ['standard', 'strict']
  },
  'pre:edit:config-protection': {
    handler: 'pre-edit-config-protection.js',
    timeoutMs: 5000,
    profiles: ['standard', 'strict']
  },
  'pre:agent:isolation-guard': {
    handler: 'pre-agent-isolation-guard.js',
    timeoutMs: 5000,
    profiles: ['standard', 'strict']
  },
  'stop:changelog-guard': {
    handler: 'stop-changelog-guard.js',
    timeoutMs: 15000,
    profiles: ['standard', 'strict']
  }
};

/* ------------------------------------------------------------------ output */

/* Emit and exit 0. This is the only exit path in the file. */
var emitted = false;

function emit(payload) {
  var out;
  emitted = true;
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

var MAX_REASON = 2000;

/**
 * Validate a handler's deny and return its sanitized reason, or '' if the
 * deny is not well-formed. Strict on purpose:
 *
 *   - `reason` must already BE a string. No coercion: String({}) yields
 *     "[object Object]", which is non-empty, so a coercing check would happily
 *     serialize garbage as an authoritative refusal reason.
 *   - It is read exactly once, so a getter cannot return something benign to
 *     the validator and something else to the emitter.
 *   - Sanitization happens before the emptiness test, so a reason made only of
 *     control characters is dropped rather than emitted blank.
 *   - The reason is capped: a handler bug should not push megabytes into the
 *     model's context.
 */
function validatedDenyReason(result) {
  var deny = result.deny;
  if (!deny || typeof deny !== 'object') { return ''; }
  if (Object.prototype.toString.call(deny) !== '[object Object]') { return ''; }

  var raw = deny.reason;
  if (typeof raw !== 'string') { return ''; }

  // Trim before the emptiness test: sanitizeMessage turns newlines and tabs
  // into spaces, so a reason made only of whitespace would otherwise survive
  // as a blank but non-empty refusal.
  var clean = sanitizeMessage(raw).replace(/^\s+|\s+$/g, '');
  if (!clean) { return ''; }
  if (clean.length > MAX_REASON) {
    clean = clean.slice(0, MAX_REASON) + ' [truncated]';
  }
  return clean;
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

  /* Handler directory.
   *
   * The override exists for tests, and it feeds require() — so it is confined
   * to the plugin root. Without that, anything able to set this variable in
   * the hook's environment could point it at a module of its choosing and get
   * arbitrary code execution inside the hook process, bypassing every gate
   * downstream: the trust registry, the command shape check, the sanitizer.
   * A project cannot write inside the installed plugin, so containment there
   * is the boundary. */
  var defaultHandlers = path.join(root, 'hooks', 'handlers');
  var handlersDir = defaultHandlers;
  var override = process.env.SDLC_HOOK_HANDLERS_DIR;
  if (override) {
    var resolvedRoot = path.resolve(root);
    var resolvedOverride = path.resolve(override);
    if (resolvedOverride === resolvedRoot ||
        resolvedOverride.indexOf(resolvedRoot + path.sep) === 0) {
      handlersDir = resolvedOverride;
    } else {
      emitNote(hookId, 'handler directory override outside the plugin root was ignored — run continues');
      return;
    }
  }
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

      /* THE DENY CHANNEL — the single construction site in this file.
       *
       * A guard signals refusal by returning { deny: { reason } }. Only this
       * function turns that into a decision, and it does so event-aware:
       * PreToolUse can refuse a tool call, Stop can force a corrective turn,
       * and every other event — PostToolUse included — cannot refuse anything,
       * so the deny is dropped.
       *
       * That last part is load-bearing. One handler (the read-guard) is
       * registered under both PostToolUse and PreToolUse; dropping denies for
       * the wrong event makes its recorder half structurally incapable of
       * refusing, rather than merely careful not to.
       *
       * Everything that can go wrong elsewhere — an exception, a timeout, a
       * missing handler — routes through emitNote(), which builds a closed
       * object from two strings and never sees a `result`. Those paths are
       * type-incapable of carrying a decision, which is why the fail-open
       * contract survives the arrival of blocking.
       *
       * Known residual: if Claude Code ever renames these event strings, the
       * comparisons below stop matching and every guard silently allows while
       * still appearing installed. Fixtures craft their own stdin and cannot
       * catch that; only an end-to-end run against the real harness can. */
      var denyReason = validatedDenyReason(result);
      var event = typeof input.hook_event_name === 'string' ? input.hook_event_name : '';

      if (denyReason && event === 'PreToolUse') {
        payload.hookSpecificOutput = {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: denyReason
        };
        emit(payload);
        return;
      }
      if (denyReason && event === 'Stop') {
        // Never `continue: false` — that ends the session. A blocked Stop must
        // force a corrective turn, not wedge the run.
        payload.decision = 'block';
        payload.reason = denyReason;
        emit(payload);
        return;
      }

      if (result.additionalContext) {
        payload.hookSpecificOutput = {
          hookEventName: event,
          additionalContext: String(result.additionalContext)
        };
      }
      emit(payload);
    }

    /* finish() itself can throw — a result whose toString explodes reaches
     * sanitizeMessage. On the synchronous path the surrounding try/catch
     * covers that; on the promise path there is no surrounding catch, so an
     * exception here would become an unhandled rejection and exit non-zero.
     * That is precisely the failure this contract forbids, so both paths call
     * through this guard. */
    function finishGuarded(result) {
      try {
        finish(result);
      } catch (err) {
        if (settled && !emitted) {
          // finish() failed after claiming the slot; force a clean exit.
          emitSilent();
          return;
        }
        if (settled) { return; }
        settled = true;
        clearTimeout(timer);
        emitNote(hookId, 'exception building output: ' +
          (err && err.message ? err.message : 'unknown') + ' — run continues');
      }
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
        result.then(finishGuarded, function (err) {
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
