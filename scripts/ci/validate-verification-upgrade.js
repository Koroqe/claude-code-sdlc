#!/usr/bin/env node
'use strict';

/**
 * Validates the 24 STATIC-category test cases in
 * `docs/qa/verification-review-upgrade_test_cases.md` (PRD Section 9, FR-11) —
 * the only test cases in that document runnable in CI without an agent
 * invocation. Every one of the 98 documented test cases is either STATIC
 * (asserted here), FIXTURE (requires a single live agent invocation against a
 * committed fixture — not automatable here), or BEHAVIORAL (requires driving
 * an orchestrating skill through a live, multi-agent run — not automatable
 * here either). See PRD FR-11.1.
 *
 * Coverage (24/24 STATIC test cases):
 *   TC-1.8, TC-2.1, TC-2.3, TC-2.5, TC-3.8, TC-4.19, TC-5.3, TC-5.4, TC-5.5,
 *   TC-5.6, TC-6.1, TC-6.2, TC-6.5, TC-6.6, TC-6.13, TC-6.16, TC-7.7, TC-9.1,
 *   TC-9.5, TC-9.7, TC-10.6, TC-10.7
 *   — asserted directly below (22 test cases).
 *   TC-6.3, TC-6.4 — "run `node scripts/ci/validate-agents.js` [against a
 *   14-agent tree / malformed variants] and check its exit code" IS the test
 *   case; `scripts/ci/validate-agents.js` already performs exactly this
 *   check on every CI run (its `MIN_AGENTS` floor is already 13, i.e. it
 *   already accepts 14) and is invoked separately in the same CI job. FR-11.1
 *   itself draws this boundary ("not merely the agent-frontmatter shape
 *   checks `scripts/ci/validate-agents.js` already performs") — this
 *   validator does not re-implement what that validator already proves.
 *
 * FR-11.4 (anti-vacuity): every check below depends on a fixed set of
 * `CORE_FILES` that must exist for the assertions to mean anything. Fewer
 * than all of them present (including an empty/absent tree) fails the
 * validator outright, via `Validator.requireMinimum` — the same pattern
 * `validate-agents.js` uses for its own floor.
 *
 * IMPORTANT — what this file is NOT (TC-10.7): FR-9.5 requires the wave-file
 * write-surface disjointness check to remain orchestrator prose inside
 * `skills/develop-feature/SKILL.md`, never a separate runtime script.
 * `checkNoWaveDisjointnessScript` below only confirms that no OTHER file
 * under `scripts/` or `hooks/` performs that check — it greps for the
 * *absence* of such a script. It does not compute wave-file disjointness
 * itself anywhere in this file, for any wave, ever. Do not read the presence
 * of the words "wave" or "disjoint" in this file's own comments (here, and
 * in that function) as evidence to the contrary.
 */

const fs = require('fs');
const path = require('path');
const core = require('./lib/validate-core.js');

/**
 * Every file a full validator run opens for a positive-content assertion.
 * FR-11.3's seeded-bad fixtures are each a complete, passing mirror of this
 * exact list, with exactly one deliberate defect — that is what proves a
 * failing falsify run fired the specific assertion it targets, not merely
 * that some unrelated file was missing.
 */
const CORE_FILES = [
  'agents/plan-critic.md',
  'agents/verifier.md',
  'agents/planner.md',
  'agents/code-reviewer.md',
  'agents/security-auditor.md',
  'skills/merge-ready/SKILL.md',
  'skills/bootstrap-feature/SKILL.md',
  'skills/develop-feature/SKILL.md',
  'skills/implement-slice/SKILL.md',
  'src/claude.md',
  'README.md',
  'install.sh',
  '.claude-plugin/plugin.json',
  '.claude-plugin/marketplace.json',
];

function tryRead(root, rel) {
  try {
    return fs.readFileSync(path.join(root, rel), 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

/**
 * Extracts the lines from the first line matching `startRe` up to (not
 * including) the next line matching `endRe`, treating fenced code blocks
 * (```...```) as opaque — a `## `-looking line of *example output* inside a
 * fence (verifier.md's Output Format template literally contains one) must
 * never be mistaken for the next real heading.
 */
function section(text, startRe, endRe) {
  const lines = text.split(/\r?\n/);
  let start = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (startRe.test(lines[i])) {
      start = i;
      break;
    }
  }
  if (start === -1) return null;

  let end = lines.length;
  let inFence = false;
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (endRe.test(line)) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join('\n');
}

function flatten(text) {
  return text.replace(/\s+/g, ' ');
}

function toolsExactly(tools, expected) {
  return tools.length === expected.length && expected.every((t) => tools.includes(t));
}

// ---------------------------------------------------------------------------
// agents/plan-critic.md — TC-6.1, TC-6.2, FR-5.1
// ---------------------------------------------------------------------------
function checkPlanCritic(v, text) {
  const rel = 'agents/plan-critic.md';
  const parsed = core.parseFrontmatter(text);
  if (!parsed.ok) {
    v.error(rel, `TC-6.1: frontmatter does not parse — ${parsed.error}`);
    return;
  }
  if (parsed.data.name !== 'plan-critic') {
    v.error(rel, `TC-6.1: frontmatter \`name\` must be \`plan-critic\`, found \`${parsed.data.name}\``);
  }
  if (!parsed.data.description) v.error(rel, 'TC-6.1: frontmatter is missing a non-empty `description`');
  if (!parsed.data.model) v.error(rel, 'TC-6.1: frontmatter is missing a non-empty `model`');

  const tools = core.parseList(parsed.data.tools);
  if (tools.length === 0) v.error(rel, 'TC-6.1: frontmatter `tools` list is missing or empty');
  if (tools.includes('Write')) {
    v.error(rel, 'TC-6.2 / FR-5.1: `tools` list includes `Write` — plan-critic critiques plans, it MUST NOT edit them');
  }
  if (tools.includes('Edit')) {
    v.error(rel, 'TC-6.2 / FR-5.1: `tools` list includes `Edit` — plan-critic must stay structurally read-only');
  }
}

// ---------------------------------------------------------------------------
// agents/verifier.md — TC-4.19, TC-5.3, TC-5.4, FR-2.1, FR-2.2, FR-1.1
// ---------------------------------------------------------------------------
function checkVerifier(v, text) {
  const rel = 'agents/verifier.md';
  const parsed = core.parseFrontmatter(text);
  if (!parsed.ok) {
    v.error(rel, `frontmatter does not parse — ${parsed.error}`);
    return;
  }

  const tools = core.parseList(parsed.data.tools);
  const expected = ['Read', 'Glob', 'Grep', 'Write'];
  if (!toolsExactly(tools, expected)) {
    v.error(rel, `TC-5.3 / FR-2.1: \`tools\` must be exactly Read, Glob, Grep, Write — found [${tools.join(', ')}]`);
  }
  if (tools.includes('Edit')) v.error(rel, 'TC-5.3 / FR-2.1: `tools` must not include `Edit`');
  if (tools.includes('Bash')) v.error(rel, 'TC-5.3 / FR-2.1: `tools` must not include `Bash`');

  const constraints = section(text, /^## Constraints/, /^## /);
  if (!constraints) {
    v.error(rel, 'TC-5.4: no `## Constraints` section found');
  } else {
    const flat = flatten(constraints);
    if (!flat.includes('MUST NOT Write to any path other than')) {
      v.error(rel, 'TC-5.4 / FR-2.2: Constraints section is missing the deny-by-default prohibition ("MUST NOT Write to any path other than ...")');
    }
    if (!flat.includes('docs/verification/<feature-slug>.md')) {
      v.error(rel, 'TC-5.4 / FR-2.2: Constraints section does not name `docs/verification/<feature-slug>.md` as the sole write target');
    }
    if (!flat.includes('MUST NOT Edit any file')) {
      v.error(rel, 'TC-5.4 / FR-2.2: Constraints section is missing "MUST NOT Edit any file"');
    }
    if (flat.includes('MAY Write only to')) {
      v.error(rel, 'TC-5.4 / FR-2.2: Constraints must be phrased as a prohibition ("MUST NOT Write to any path other than"), not a scope grant ("MAY Write only to")');
    }
  }
  if (text.includes('Read-only: you MUST NOT modify any files')) {
    v.error(rel, 'TC-5.4 / FR-2.2: the old unqualified "Read-only: you MUST NOT modify any files" line is still present — it must be replaced by the deny-by-default prohibition');
  }

  const outputFormat = section(text, /^## Output Format/, /^## /);
  const verdictTokens = ['VERIFIED', 'PRESENT_BEHAVIOR_UNVERIFIED', 'FAILED', 'UNCERTAIN'];
  if (!outputFormat) {
    v.error(rel, 'FR-1.1: no `## Output Format` section found');
  } else {
    for (const token of verdictTokens) {
      if (!outputFormat.includes(token)) {
        v.error(rel, `FR-1.1: Output Format section is missing the verdict token \`${token}\``);
      }
    }
    if (outputFormat.includes('Overall: PASS / FAIL / WARN')) {
      v.error(rel, 'FR-1.1: Output Format still states the old three-verdict `Overall: PASS / FAIL / WARN` line');
    }
  }

  const level2 = section(text, /^## Level 2/, /^## /);
  if (!level2) {
    v.error(rel, 'TC-4.19: no `## Level 2` section found');
  } else {
    const markers = [
      'TBD', 'TODO', 'FIXME', 'XXX', 'HACK', 'placeholder', 'stub',
      'not implemented', "throw new Error('Not implemented')",
      'raise NotImplementedError', 'pass  # TODO',
    ];
    for (const marker of markers) {
      if (!level2.includes(marker)) {
        v.error(rel, `TC-4.19 / FR-4.1: Level 2 section does not document the \`${marker}\` marker`);
      }
    }
    if (!level2.includes('BLOCKER')) v.error(rel, 'TC-4.19 / FR-4.1: Level 2 section does not document the BLOCKER tier');
    if (!level2.includes('WARNING')) v.error(rel, 'TC-4.19 / FR-4.1: Level 2 section does not document the WARNING tier');
    if (!/issue reference/i.test(level2)) v.error(rel, 'TC-4.19 / FR-4.2: Level 2 section does not document the same-line issue-reference downgrade rule');
    if (!/exception/i.test(level2)) v.error(rel, 'TC-4.19 / FR-4.4: Level 2 section does not document the `pass  # TODO` compound exception');
    if (!/test files|\*\.test\.\*/.test(level2)) v.error(rel, 'TC-4.19: Level 2 section does not document the existing test-file exclusion list');
  }
}

// ---------------------------------------------------------------------------
// agents/planner.md — TC-3.8, TC-9.1, FR-8.1, FR-8.2, FR-9.1, AC-22
// ---------------------------------------------------------------------------
function checkPlanner(v, text) {
  const rel = 'agents/planner.md';
  const parsed = core.parseFrontmatter(text);
  if (!parsed.ok) {
    v.error(rel, `frontmatter does not parse — ${parsed.error}`);
  } else {
    const tools = core.parseList(parsed.data.tools);
    const expected = ['Read', 'Glob', 'Grep', 'WebSearch', 'WebFetch'];
    if (!toolsExactly(tools, expected)) {
      v.error(rel, `TC-3.8 / AC-22: \`tools\` must be exactly Read, Glob, Grep, WebSearch, WebFetch — found [${tools.join(', ')}]`);
    }
    if (tools.includes('Write') || tools.includes('Edit')) {
      v.error(rel, 'TC-3.8 / AC-22: `tools` must not include `Write` or `Edit` — planner stays read-only, it returns replan slices rather than writing them');
    }
  }

  if (!text.includes('**Tracer:** yes')) {
    v.error(rel, 'TC-9.1 / FR-8.2: does not document the `**Tracer:** yes` marker syntax');
  }
  if (!/vertical tracer/i.test(text)) {
    v.error(rel, 'TC-9.1 / FR-8.1: does not document the vertical-tracer requirement for Slice 1');
  }
  if (!text.includes('Verify:')) {
    v.error(rel, 'TC-9.1 / FR-8.1: does not document a `Verify:` condition');
  }
  if (!text.includes('Files (union)')) {
    v.error(rel, 'FR-9.1: wave summary table format does not document a `Files (union)` column');
  }
}

// ---------------------------------------------------------------------------
// agents/code-reviewer.md — TC-7.7, FR-6.3, FR-7.1
// ---------------------------------------------------------------------------
// agents/security-auditor.md — FR-6 (Gate 3's own suppression rules)
//
// This agent now filters its own findings at >80% confidence, so the CRITICAL
// carve-out is the only thing between that filter and a silently muted security
// gate. Each string below was a real review finding, so freeze all of them:
// drop any one and Gate 3 quietly stops reporting something it used to catch.
// ---------------------------------------------------------------------------
function checkSecurityAuditor(v, text) {
  const rel = 'agents/security-auditor.md';
  const required = [
    ['80%', 'FR-6.1: the confidence threshold is not stated'],
    ['regardless of confidence', 'FR-6.2: the CRITICAL carve-out is missing'],
    ['Classification is pinned', 'a borderline CRITICAL could be filed as HIGH and then dropped by the confidence filter'],
    ['only when you were given one', 'diff-scoping must not apply when no diff was supplied — this agent has no Bash and cannot derive one'],
  ];
  for (var i = 0; i < required.length; i += 1) {
    if (text.indexOf(required[i][0]) === -1) {
      v.error(rel, required[i][1] + ' (expected to find "' + required[i][0] + '")');
    }
  }
}

// ---------------------------------------------------------------------------
function checkCodeReviewer(v, text) {
  const rel = 'agents/code-reviewer.md';
  const outputFormat = section(text, /^## Output Format/, /^## /);
  const tiers = ['**CRITICAL**', '**HIGH**', '**MEDIUM**', '**LOW**'];
  if (!outputFormat) {
    v.error(rel, 'TC-7.7 / FR-6.3: no `## Output Format` section found');
  } else {
    for (const tier of tiers) {
      if (!outputFormat.includes(tier)) {
        v.error(rel, `TC-7.7 / FR-6.3: Output Format section is missing the \`${tier}\` severity tier`);
      }
    }
  }

  if (!text.includes('Silent Failures')) {
    v.error(rel, 'FR-7.1: no "Silent Failures" category in the Review Checklist');
  }
  const flat = flatten(text);
  if (!flat.includes('catch {}')) {
    v.error(rel, 'FR-7.1: Silent Failures category does not mention empty `catch {}` blocks');
  }
}

// ---------------------------------------------------------------------------
// skills/merge-ready/SKILL.md — TC-1.8, TC-2.1, TC-2.3, TC-2.5, TC-5.6,
// FR-1.4, FR-1.5, FR-3.3, FR-2.7, FR-10.5, NFR-3
// ---------------------------------------------------------------------------
function checkMergeReady(v, text) {
  const rel = 'skills/merge-ready/SKILL.md';
  const flat = flatten(text);

  if (flat.includes('WARN = Level 4 advisory only')) {
    v.error(rel, 'FR-1.5: the old "WARN = Level 4 advisory only" note is still present — it must be replaced with wording reflecting the four-verdict scheme');
  }

  if (!text.includes('VERIFIED/PRESENT_BEHAVIOR_UNVERIFIED/FAILED/UNCERTAIN')) {
    v.error(rel, 'TC-1.8 / FR-1.4: Gate 6 Status column does not render the four verdicts verbatim (`VERIFIED/PRESENT_BEHAVIOR_UNVERIFIED/FAILED/UNCERTAIN`)');
  }

  const malformed = 'FAILED (malformed report: passed:true with non-empty human_verification_required)';
  if (!text.includes(malformed)) {
    v.error(rel, `TC-2.1 / FR-3.3: exact malformed-report Status string is missing: "${malformed}"`);
  }
  if (!flat.includes("never take `verifier`'s own prose claim about its verdict")) {
    v.error(rel, "TC-2.1 / FR-3.3: Gate 6 does not state that it reads the report's frontmatter directly rather than trusting verifier's prose claim");
  }

  if (!flat.includes('no `verdict:` field at all')) {
    v.error(rel, 'TC-2.3 / NFR-3: Gate 6 does not state the no-`verdict:`-field legacy-report rule');
  }
  if (!flat.includes('fresh `verifier` run')) {
    v.error(rel, 'TC-2.3 / NFR-3: Gate 6 does not state that a legacy report triggers a fresh `verifier` run');
  }

  if (!text.includes('missing one of its four required fields')) {
    v.error(rel, 'TC-2.5 / FR-2.5: Gate 6 does not state that a `gaps` entry missing a required field is malformed');
  }
  if (!text.includes('array index')) {
    v.error(rel, 'TC-2.5 / FR-2.5: Gate 6 does not state naming the incomplete `gaps` entry by `location` or array index');
  }

  if (!text.includes("date -u +'%Y-%m-%d %H:%M'")) {
    v.error(rel, "TC-5.6 / FR-2.7: Gate 6 does not state obtaining the UTC timestamp via `date -u +'%Y-%m-%d %H:%M'`");
  }
  if (!flat.includes('feature slug')) {
    v.error(rel, 'TC-5.6 / FR-2.7: Gate 6 does not state supplying the feature slug verbatim to `verifier`');
  }
  if (!text.includes('generated_at')) {
    v.error(rel, 'TC-5.6 / FR-2.7: Gate 6 does not state supplying `generated_at` verbatim to `verifier`');
  }

  if (!text.includes('Gate 6 attempts: N/3')) {
    v.error(rel, 'FR-10.5: Gate 6 does not state writing the `Gate 6 attempts: N/3` counter line to `.claude/scratchpad.md`');
  }
}

// ---------------------------------------------------------------------------
// skills/bootstrap-feature/SKILL.md — TC-6.5, FR-5.9
// ---------------------------------------------------------------------------
function checkBootstrapFeature(v, text) {
  const rel = 'skills/bootstrap-feature/SKILL.md';
  const step6Idx = text.indexOf('### Step 6: Git Setup');
  const invokeIdx = text.indexOf('`plan-critic`');
  if (step6Idx === -1) {
    v.error(rel, 'TC-6.5: no "### Step 6: Git Setup" heading found');
    return;
  }
  if (invokeIdx === -1) {
    v.error(rel, 'TC-6.5 / FR-5.9: no `plan-critic` invocation found');
    return;
  }
  if (invokeIdx > step6Idx) {
    v.error(rel, 'TC-6.5 / FR-5.9: the `plan-critic` invocation must precede Step 6 (Git Setup), not follow it');
  }
}

// ---------------------------------------------------------------------------
// skills/develop-feature/SKILL.md — TC-9.5, TC-10.6, FR-8.6, FR-9.2, NFR-3
// ---------------------------------------------------------------------------
function checkDevelopFeature(v, text) {
  const rel = 'skills/develop-feature/SKILL.md';
  const notice = 'tracer gate inactive — no **Tracer:** yes marker found; treating as pre-F3 plan.';
  if (!text.includes(notice)) {
    v.error(rel, `TC-9.5 / FR-8.6: exact fallback notice string is missing: "${notice}"`);
  }
  const flat = flatten(text);
  if (!flat.includes('no tracer-gate applied')) {
    v.error(rel, 'TC-9.5 / NFR-3: does not state the legacy-plan (no-marker) fallback rule');
  }
  if (!flat.includes('single-slice wave requires no check')) {
    v.error(rel, 'TC-10.6 / FR-9.2: does not state that a single-slice wave requires no disjointness check');
  }
}

// ---------------------------------------------------------------------------
// skills/implement-slice/SKILL.md — TC-9.7, FR-8.3
// ---------------------------------------------------------------------------
function checkImplementSlice(v, text) {
  const rel = 'skills/implement-slice/SKILL.md';
  const flat = flatten(text);
  if (!flat.includes('Tracer gate:')) {
    v.error(rel, 'TC-9.7 / FR-8.3: no "Tracer gate:" pre-flight check found');
  }
  if (!text.includes('REFUSE')) {
    v.error(rel, 'TC-9.7 / FR-8.3: pre-flight tracer-gating check does not state a REFUSE outcome');
  }
  if (!text.includes('**Tracer:** yes')) {
    v.error(rel, 'TC-9.7 / FR-8.3: pre-flight tracer-gating check does not reference the `**Tracer:** yes` marker');
  }
}

// ---------------------------------------------------------------------------
// src/claude.md — TC-6.13, TC-6.16, FR-5.6, FR-5.8
// ---------------------------------------------------------------------------
function checkClaudeMd(v, text) {
  const rel = 'src/claude.md';
  const flat = flatten(text);

  // Freeze the row's substance, not its punctuation. FR-5.8 quotes the row
  // without backticks around the agent name; the table's other rows use them.
  // Either spelling satisfies the requirement, so match on content and let the
  // cosmetic choice be a style question rather than a CI failure.
  const agencyRow = '| Plan Critic | plan-critic | Adversarial plan review — BLOCKER/WARNING/INFO findings before implementation begins |';
  const agencyRowRe = /\|\s*Plan Critic\s*\|\s*`?plan-critic`?\s*\|\s*Adversarial plan review\s*—\s*BLOCKER\/WARNING\/INFO findings before implementation begins\s*\|/;
  if (!agencyRowRe.test(text)) {
    v.error(rel, `TC-6.16 / FR-5.8: Agency Roles table is missing the exact plan-critic row: "${agencyRow}"`);
  }

  if (text.includes('You are a Plan Critic. Your job is to find problems in this plan, NOT to praise it.')) {
    v.error(rel, 'FR-5.6: the inlined Plan Critic prompt is still present in src/claude.md — it must be extracted to agents/plan-critic.md, leaving this file a delegation stub');
  }

  if (!flat.includes('naming `plan-critic` explicitly as unresolvable')) {
    v.error(rel, 'TC-6.13 / FR-5.6: Plan Critic Pass Step 1 does not state the visible-warning fallback naming `plan-critic` as unresolvable');
  }
  if (!flat.includes('Never skip the critic pass silently')) {
    v.error(rel, 'TC-6.13 / FR-5.6: Plan Critic Pass Step 1 does not state that the critic pass must never be skipped silently');
  }
}

// ---------------------------------------------------------------------------
// Agent-count consistency — TC-6.6, FR-5.11
// ---------------------------------------------------------------------------
function checkAgentCountConsistency(v, root, contents) {
  const readmeText = contents['README.md'];
  const installText = contents['install.sh'];
  const pluginText = contents['.claude-plugin/plugin.json'];
  const marketplaceText = contents['.claude-plugin/marketplace.json'];

  const values = {};

  if (readmeText) {
    const opening = readmeText.match(/(\d+)\s+specialized AI agents\./);
    if (!opening) {
      v.error('README.md', 'TC-6.6 / FR-5.11: opening description does not state "<N> specialized AI agents."');
    } else {
      values['README.md opening description'] = Number(opening[1]);
    }

    const heading = readmeText.match(/^## The (\d+) Agents$/m);
    if (!heading) {
      v.error('README.md', 'TC-6.6 / FR-5.11: no "## The <N> Agents" heading found');
    } else {
      values['README.md "## The N Agents" heading'] = Number(heading[1]);
    }

    if (!readmeText.includes('the 13 agent files and 5 command files')) {
      v.error('README.md', 'FR-5.11 named exception: the historical "removes the 13 agent files" sentence must stay at 13 — it describes what v3.x installed, never the live agent count. (This validator deliberately does not scan this sentence as a live-count source.)');
    }

    if (!readmeText.includes('plan-critic')) {
      v.error('README.md', 'TC-6.6: agent list does not mention `plan-critic`');
    }
  }

  if (installText) {
    const banner = installText.match(/agents\/\s+(\d+)\s+specialized agents/);
    if (!banner) {
      v.error('install.sh', 'TC-6.6 / FR-5.11: install banner does not state "agents/  <N> specialized agents"');
    } else {
      values['install.sh banner'] = Number(banner[1]);
    }
  }

  if (pluginText) {
    try {
      const parsed = JSON.parse(pluginText);
      const m = String(parsed.description || '').match(/(\d+)\s+specialized agents/);
      if (!m) {
        v.error('.claude-plugin/plugin.json', 'TC-6.6 / FR-5.11: `description` field does not state "<N> specialized agents"');
      } else {
        values['.claude-plugin/plugin.json description'] = Number(m[1]);
      }
    } catch (err) {
      v.error('.claude-plugin/plugin.json', `invalid JSON — ${err.message}`);
    }
  }

  if (marketplaceText) {
    try {
      const parsed = JSON.parse(marketplaceText);
      const plugins = Array.isArray(parsed.plugins) ? parsed.plugins : [];
      const desc = plugins.length > 0 ? String(plugins[0].description || '') : '';
      const m = desc.match(/(\d+)\s+specialized agents/);
      if (!m) {
        v.error('.claude-plugin/marketplace.json', 'TC-6.6 / FR-5.11: plugin entry `description` does not state "<N> specialized agents"');
      } else {
        values['.claude-plugin/marketplace.json description'] = Number(m[1]);
      }
    } catch (err) {
      v.error('.claude-plugin/marketplace.json', `invalid JSON — ${err.message}`);
    }
  }

  const actualCount = core.listFiles(path.join(root, 'agents'), (n) => n.endsWith('.md')).length;
  values['actual agents/*.md count'] = actualCount;

  const distinct = new Set(Object.values(values));
  if (distinct.size > 1) {
    const detail = Object.entries(values).map(([k, val]) => `${k}=${val}`).join(', ');
    v.error('(agent count)', `TC-6.6 / FR-5.11: agent count is inconsistent across live locations and the actual agents/*.md count — ${detail}`);
  }
}

// ---------------------------------------------------------------------------
// TC-5.5 — no mechanical restriction scopes verifier's Write calls
// (a documented limitation, not a guarantee this feature closes — see
// PRD Design Decision 11 and UC-5-EC1)
// ---------------------------------------------------------------------------
function checkWriteScopeNotMechanicallyRestricted(v, root) {
  const settingsText = tryRead(root, 'templates/settings.json');
  if (settingsText) {
    try {
      const settings = JSON.parse(settingsText);
      const deny = settings.permissions && Array.isArray(settings.permissions.deny)
        ? settings.permissions.deny
        : [];
      if (deny.some((entry) => String(entry).includes('docs/verification'))) {
        v.error(
          'templates/settings.json',
          "TC-5.5: a `permissions.deny` entry now scopes `docs/verification/` — this test case's " +
          "recorded expectation is that no mechanical restriction exists; if one was added intentionally, " +
          'update TC-5.5\'s expected result in the QA doc rather than leaving this assertion stale.'
        );
      }
    } catch (err) {
      v.error('templates/settings.json', `invalid JSON — ${err.message}`);
    }
  }

  const hookFiles = core.walkFiles(path.join(root, 'hooks'), { test: () => true });
  for (const file of hookFiles) {
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes('docs/verification')) {
      v.error(
        path.relative(root, file),
        "TC-5.5: a hook now references `docs/verification` — this test case's recorded expectation is " +
        "that no hook mechanically scopes verifier's Write calls; if one was added intentionally, update " +
        "TC-5.5's expected result in the QA doc rather than leaving this assertion stale."
      );
    }
  }
}

// ---------------------------------------------------------------------------
// TC-10.7 — no separate script performs wave-file disjointness checking.
//
// This function proves an ABSENCE: it greps `scripts/` and `hooks/` for a
// file that looks like it implements the FR-9.2 disjointness check, and
// fails if one is found. FR-9.5 requires that check to live only as prose in
// `skills/develop-feature/SKILL.md`. This function never computes
// disjointness for any wave, any plan, or any file list — it only confirms
// no runtime script exists that could.
// ---------------------------------------------------------------------------
function checkNoWaveDisjointnessScript(v, root) {
  const selfPath = path.resolve(__filename);
  const dirs = [path.join(root, 'scripts'), path.join(root, 'hooks')];
  for (const dir of dirs) {
    const jsFiles = core.walkFiles(dir, {
      test: (name, full) => name.endsWith('.js') && path.resolve(full) !== selfPath,
    });
    for (const file of jsFiles) {
      const content = fs.readFileSync(file, 'utf8').toLowerCase();
      if (content.includes('wave') && content.includes('disjoint')) {
        v.error(
          path.relative(root, file),
          'TC-10.7 / FR-9.5: this file mentions both "wave" and "disjoint" — a new runtime script appears ' +
          'to perform wave-file disjointness checking, which FR-9.5 requires to remain orchestrator prose ' +
          'in skills/develop-feature/SKILL.md, never a separate script.'
        );
      }
    }
  }
}

core.run('validate-verification-upgrade', (v, args) => {
  const root = args.root;

  const contents = {};
  let presentCount = 0;
  for (const rel of CORE_FILES) {
    const text = tryRead(root, rel);
    if (text !== null) {
      presentCount += 1;
      contents[rel] = text;
    }
  }

  const minimum = args.min === null ? CORE_FILES.length : args.min;
  if (!v.requireMinimum(presentCount, minimum, 'required source files for the verification-review-upgrade contract (agents/plan-critic.md, agents/verifier.md, and the rest of CORE_FILES)')) {
    return;
  }

  if (contents['agents/plan-critic.md']) checkPlanCritic(v, contents['agents/plan-critic.md']);
  if (contents['agents/verifier.md']) checkVerifier(v, contents['agents/verifier.md']);
  if (contents['agents/planner.md']) checkPlanner(v, contents['agents/planner.md']);
  if (contents['agents/code-reviewer.md']) checkCodeReviewer(v, contents['agents/code-reviewer.md']);
  if (contents['agents/security-auditor.md']) checkSecurityAuditor(v, contents['agents/security-auditor.md']);
  if (contents['skills/merge-ready/SKILL.md']) checkMergeReady(v, contents['skills/merge-ready/SKILL.md']);
  if (contents['skills/bootstrap-feature/SKILL.md']) checkBootstrapFeature(v, contents['skills/bootstrap-feature/SKILL.md']);
  if (contents['skills/develop-feature/SKILL.md']) checkDevelopFeature(v, contents['skills/develop-feature/SKILL.md']);
  if (contents['skills/implement-slice/SKILL.md']) checkImplementSlice(v, contents['skills/implement-slice/SKILL.md']);
  if (contents['src/claude.md']) checkClaudeMd(v, contents['src/claude.md']);

  checkAgentCountConsistency(v, root, contents);
  checkWriteScopeNotMechanicallyRestricted(v, root);
  checkNoWaveDisjointnessScript(v, root);
});
