#!/usr/bin/env node
'use strict';

/**
 * Closes the gap that let a completely uninstallable plugin ship.
 *
 * `.claude-plugin/plugin.json` declared its components as directory strings:
 *
 *     "agents": "./agents/",
 *     "skills": "./skills/",
 *
 * `agents` does not accept a directory string. Claude Code's own schema
 * rejects it — `claude plugin install` failed outright with
 * "agents: Invalid input" and refused the plugin. Every agent, skill and hook
 * this repository ships was unreachable to anyone installing it.
 *
 * Nothing caught it, for two compounding reasons:
 *
 *   1. The F1 acceptance criterion was "`claude plugin validate .` exits 0".
 *      Pointed at a directory, that command validates `marketplace.json` and
 *      never opens `plugin.json` at all. It printed "Validation passed" for a
 *      manifest it had not read — a green check asserting nothing, which is
 *      the same vacuity class this repo's --expect-failure and anti-vacuity
 *      rules exist to prevent.
 *   2. That criterion was hand-checked once and never mechanized; no CI step
 *      ran `claude plugin validate` in any form.
 *
 * This validator is the mechanical replacement. It deliberately does NOT
 * shell out to `claude` — CI has no Claude Code binary, and depending on one
 * would make the check silently skip rather than fail. It instead asserts the
 * schema constraints observed empirically against the real binary, plus the
 * on-disk reality the manifest implies.
 *
 * Checks:
 *   1. `plugin.json` parses and carries `name`, `version`, `description`.
 *   2. `agents` and `skills`, IF PRESENT, are arrays of explicit `.md` /
 *      directory file paths — never a bare directory string. This is the
 *      exact defect that broke the install. Omitting the key entirely is
 *      valid and preferred: Claude Code discovers `agents/` and `skills/` by
 *      convention, and a hand-maintained file list is a drift trap that must
 *      be updated on every added agent with nothing to catch a stale one.
 *   3. Any path a component key does name actually exists on disk.
 *   4. The conventional component directories that are relied upon exist and
 *      are non-empty, so convention-based discovery has something to find.
 *   5. `hooks` points at a file that exists and parses as JSON.
 *   6. `version` agrees with the marketplace manifest's entry for this plugin.
 */

const fs = require('fs');
const path = require('path');
const core = require('./lib/validate-core.js');

const PLUGIN_MANIFEST = '.claude-plugin/plugin.json';
const MARKETPLACE_MANIFEST = '.claude-plugin/marketplace.json';

// Keys that REJECT a bare directory string. Established empirically against
// `claude plugin validate` (Claude Code 2.1.9), one key at a time:
//
//   {"agents": "./agents/"}   -> "agents: Invalid input"   FATAL
//   {"skills": "./skills/"}   -> Validation passed
//   {"skills": ["./skills/"]} -> Validation passed
//
// So `agents` is the ONLY key that breaks the install this way. `skills`
// legitimately accepts either shape and must not be flagged — an error
// message asserting more than was measured is exactly the overstatement this
// repo keeps catching elsewhere.
const NO_DIRECTORY_STRING_KEYS = ['agents'];

// Keys whose value may be a string path or an array of paths; whatever they
// name must exist on disk.
const PATH_KEYS = ['agents', 'skills'];

// Directories convention-based discovery relies on when the key is omitted.
const CONVENTION_DIRS = [
  { rel: 'agents', what: 'agent', ext: '.md' },
  { rel: 'skills', what: 'skill', ext: null },
];

function tryRead(root, rel) {
  try {
    return fs.readFileSync(path.join(root, rel), 'utf8');
  } catch (err) {
    return null;
  }
}

// The conventional hooks file, loaded automatically. Naming it in the manifest
// is not redundant-but-harmless: on Claude Code 2.1.237 it is a hard error.
//
//   Status: ✘ failed to load
//   Error: Hook load failed: Duplicate hooks file detected: ./hooks/hooks.json
//          resolves to already-loaded file .../hooks/hooks.json.
//
// The WHOLE plugin fails — every agent, skill and hook — for declaring by path
// something that is discovered by convention. That is the identical mistake
// that made `agents: "./agents/"` uninstallable, one key over, and it survived
// the first fix because only the two keys that had already broken were
// examined. `manifest.hooks` is for ADDITIONAL hook files, never this one.
const CONVENTIONAL_HOOKS = ['./hooks/hooks.json', 'hooks/hooks.json'];

function checkHooksKey(v, manifest) {
  if (!('hooks' in manifest)) return; // omitted is correct — it is auto-loaded
  const values = typeof manifest.hooks === 'string' ? [manifest.hooks] : manifest.hooks;
  if (!Array.isArray(values)) return;
  for (const entry of values) {
    if (typeof entry !== 'string') continue;
    if (CONVENTIONAL_HOOKS.indexOf(entry.trim()) === -1) continue;
    v.error(
      PLUGIN_MANIFEST,
      `\`hooks\` names ${JSON.stringify(entry)}, which Claude Code already loads by ` +
        `convention. Declaring it produces "Duplicate hooks file detected" and the ENTIRE ` +
        `plugin fails to load — every agent, skill and hook becomes unreachable, exactly as ` +
        `a directory string for \`agents\` once made it uninstallable. Omit the \`hooks\` key; ` +
        `it exists only for ADDITIONAL hook files beyond the conventional one.`
    );
  }
}

function checkComponentKeys(v, root, manifest) {
  for (const key of NO_DIRECTORY_STRING_KEYS) {
    if (!(key in manifest)) continue; // omitted is valid and preferred
    if (typeof manifest[key] === 'string') {
      v.error(
        PLUGIN_MANIFEST,
        `\`${key}\` is the string ${JSON.stringify(manifest[key])}. Claude Code's plugin schema ` +
          `rejects a directory string for \`${key}\` — \`claude plugin install\` fails with ` +
          `"${key}: Invalid input" and the whole plugin becomes uninstallable, so every agent, ` +
          `skill and hook it ships is unreachable. Either omit \`${key}\` entirely ` +
          `(convention-based discovery of ${key}/ — preferred, since a hand-maintained file ` +
          `list goes stale the next time an agent is added) or give an array of explicit paths.`
      );
    }
  }

  for (const key of PATH_KEYS) {
    if (!(key in manifest)) continue;
    const value = manifest[key];
    const entries = typeof value === 'string' ? [value] : value;

    if (!Array.isArray(entries)) {
      v.error(
        PLUGIN_MANIFEST,
        `\`${key}\` must be a path string or an array of paths; found ${typeof value}.`
      );
      continue;
    }

    entries.forEach((entry, i) => {
      const where = typeof value === 'string' ? `\`${key}\`` : `\`${key}[${i}]\``;
      if (typeof entry !== 'string') {
        v.error(PLUGIN_MANIFEST, `${where} must be a string path; found ${typeof entry}.`);
        return;
      }
      if (!fs.existsSync(path.join(root, entry))) {
        v.error(
          PLUGIN_MANIFEST,
          `${where} names ${entry}, which does not exist on disk. A manifest that points at a ` +
            `missing path installs a plugin with a silently absent component.`
        );
      }
    });
  }
}

function checkConventionDirs(v, root, manifest) {
  for (const dir of CONVENTION_DIRS) {
    if (dir.rel in manifest) continue; // explicitly listed, checked above
    const abs = path.join(root, dir.rel);
    let entries = null;
    try {
      entries = fs.readdirSync(abs);
    } catch (err) {
      v.error(
        PLUGIN_MANIFEST,
        `\`${dir.rel}\` is omitted from the manifest, so Claude Code discovers ${dir.rel}/ by ` +
          `convention — but ${dir.rel}/ does not exist. Nothing would be installed.`
      );
      continue;
    }
    const found = dir.ext ? entries.filter((e) => e.endsWith(dir.ext)) : entries;
    if (found.length === 0) {
      v.error(
        PLUGIN_MANIFEST,
        `\`${dir.rel}\` is omitted so ${dir.rel}/ is discovered by convention, but ${dir.rel}/ ` +
          `contains no ${dir.what} entries. The plugin would install with zero ${dir.what}s.`
      );
    }
  }
}

function checkHooks(v, root, manifest) {
  if (!('hooks' in manifest)) return;
  const rel = manifest.hooks;
  if (typeof rel !== 'string') {
    v.error(PLUGIN_MANIFEST, `\`hooks\` must be a path string; found ${typeof rel}.`);
    return;
  }
  const text = tryRead(root, rel);
  if (text === null) {
    v.error(PLUGIN_MANIFEST, `\`hooks\` names ${rel}, which does not exist on disk.`);
    return;
  }
  try {
    JSON.parse(text);
  } catch (err) {
    v.error(PLUGIN_MANIFEST, `\`hooks\` names ${rel}, which is not valid JSON: ${err.message}`);
  }
}

function checkVersionAgreement(v, root, manifest) {
  const text = tryRead(root, MARKETPLACE_MANIFEST);
  if (text === null) return; // absence is the marketplace validator's business
  let market = null;
  try {
    market = JSON.parse(text);
  } catch (err) {
    return;
  }
  const plugins = Array.isArray(market.plugins) ? market.plugins : [];
  const entry = plugins.find((p) => p && p.name === manifest.name);
  if (!entry || !entry.version) return; // marketplace may legitimately omit a version
  if (entry.version !== manifest.version) {
    v.error(
      MARKETPLACE_MANIFEST,
      `marketplace lists ${manifest.name} at version ${entry.version}, but ` +
        `${PLUGIN_MANIFEST} declares ${manifest.version}. Installers resolve through the ` +
        `marketplace, so a disagreement installs a version the plugin does not claim to be.`
    );
  }
}

core.run('validate-plugin-manifest', (v, args) => {
  const root = args.root;

  const raw = tryRead(root, PLUGIN_MANIFEST);
  const present = raw === null ? 0 : 1;
  const minimum = args.min === null ? 1 : args.min;
  if (!v.requireMinimum(present, minimum, `plugin manifest (${PLUGIN_MANIFEST})`)) {
    return;
  }
  if (raw === null) return;

  let manifest = null;
  try {
    manifest = JSON.parse(raw);
  } catch (err) {
    v.error(PLUGIN_MANIFEST, `is not valid JSON: ${err.message}`);
    return;
  }

  for (const field of ['name', 'version', 'description']) {
    if (typeof manifest[field] !== 'string' || manifest[field].trim() === '') {
      v.error(PLUGIN_MANIFEST, `missing or empty required field \`${field}\`.`);
    }
  }

  checkComponentKeys(v, root, manifest);

  checkHooksKey(v, manifest);
  checkConventionDirs(v, root, manifest);
  checkHooks(v, root, manifest);
  checkVersionAgreement(v, root, manifest);
});
