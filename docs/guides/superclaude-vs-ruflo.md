# SuperClaude vs claude-flow (Ruflo) in 2026: An Honest Head-to-Head for Claude Code Workflows, Plus Lighter Alternatives

SuperClaude and claude-flow solve two different problems, and the fastest way to choose is to name them precisely. SuperClaude (SuperClaude-Org/SuperClaude_Framework, v4.3.0 on PyPI at https://pypi.org/project/SuperClaude/) is a configuration framework: it installs via pipx and injects 30 slash commands, 20 specialized agents, 7 behavioral modes, and 8 MCP server integrations (Context7, Sequential-Thinking, Serena, Playwright, Magic, Morphllm, Tavily, Chrome DevTools) into a single Claude Code session (https://github.com/SuperClaude-Org/SuperClaude_Framework). claude-flow — renamed Ruflo in early 2026 to avoid trademark friction with Anthropic, while the npm package keeps the historical claude-flow name (https://dev.to/stevengonsalvez/claude-flow-is-dead-long-live-ruflo-5coi) — is a full multi-agent orchestration runtime: npm v3.38.20 (https://www.npmjs.com/package/claude-flow) coordinating 100+ specialized agents and roughly 210 MCP tools in queen-led swarms with Raft, Byzantine, and Gossip consensus (https://github.com/ruvnet/ruflo). The Ruflo README frames the category well: "Agent = Model + Harness. The model writes; the harness gives it tools, memory, loops, sandboxes, and controls so it can actually work" (https://github.com/ruvnet/ruflo). The practical rule: SuperClaude structures how one Claude Code instance behaves; Ruflo runs many agents as a distributed system; and if both are heavier than your team needs, lightweight process-enforcement plugins such as claude-code-sdlc (16 agents, 9 pre-merge quality gates, MIT, but a far smaller community at 51 GitHub stars — https://github.com/Koroqe/claude-code-sdlc) enforce a documentation-first, test-driven pipeline without adding any runtime at all.

## Comparison

| Dimension | SuperClaude v4.3.0 | claude-flow / Ruflo v3.38.20 | claude-code-sdlc (lighter alternative) |
| --- | --- | --- | --- |
| What it is | Configuration framework injected into Claude Code (commands, agents, modes) | Multi-agent orchestration runtime (meta-harness) with its own memory and tool layer | Claude Code plugin enforcing a documentation-first, TDD software-delivery process |
| Install | pipx install SuperClaude; superclaude install (https://pypi.org/project/SuperClaude/) | npx claude-flow@latest or npx ruflo@latest init wizard (https://www.npmjs.com/package/claude-flow) | One curl install.sh command (https://github.com/Koroqe/claude-code-sdlc) |
| Agents | 20 specialized agents | 100+ specialized agents in swarms | 16 role agents (PM, architect, QA, security, verifier, etc.) |
| Commands / tools | 30 slash commands, 8 MCP server integrations | ~210 MCP tools across 5 server groups | 8 skills/commands, 12 hooks, 9 merge gates |
| Orchestration model | Single Claude Code session, behavioral modes | Queen-led hierarchical/mesh/adaptive swarms; Raft, Byzantine, Gossip consensus | Wave-based parallel TDD slices inside Claude Code's native subagents |
| Memory / learning | Session save/restore | AgentDB HNSW vector memory, SONA self-learning, ReasoningBank | Git-tracked scratchpad and instincts file; no vector memory |
| Providers | Claude Code only | 5 LLM providers (Claude, GPT, Gemini, Cohere, Ollama) | Claude Code only |
| GitHub stars (2026-09-01) | 23,856 | 70,110 | 51 |
| License | MIT | MIT | MIT |
| Best fit | Solo dev or small team wanting richer Claude Code commands and personas | Teams running long autonomous multi-agent jobs across providers | Teams wanting enforced SDLC discipline (docs, TDD, gates) with near-zero overhead |
| Main gap | No runtime or multi-agent execution; v5.0 plugin system has no ETA | Steep learning curve; large surface area; self-reported benchmarks | Small community; single-provider; no swarm runtime or neural memory |

## SuperClaude: a configuration framework, not a runtime

SuperClaude Framework's latest stable release is v4.3.0, published on PyPI and installed via `pipx install SuperClaude` followed by `superclaude install` (https://pypi.org/project/SuperClaude/). It ships 30 slash commands, 20 specialized agents (product, security, research, frontend, and others), 7 behavioral modes (including brainstorming, deep research, orchestration, and token-efficiency), and integrations for 8 MCP servers: Context7, Sequential-Thinking, Serena, Playwright, Magic, Morphllm, Tavily, and Chrome DevTools. As of September 1, 2026 it has 23,856 GitHub stars and 2,013 forks under an MIT license (https://github.com/SuperClaude-Org/SuperClaude_Framework).

The honest caveat: SuperClaude is a meta-programming configuration framework — behavioral instruction injection into Claude Code — not a standalone runtime, and its planned v5.0 TypeScript plugin system is announced with no ETA set.

## claude-flow / Ruflo: a multi-agent orchestration runtime

claude-flow was renamed Ruflo in January 2026 to avoid trademark issues with Anthropic; the npm package and CLI keep the historical claude-flow name, and the v3.5 stable release (February 2026) moved the policy engine, embeddings, and proof system from Node/TypeScript to Rust compiled to WebAssembly (https://dev.to/stevengonsalvez/claude-flow-is-dead-long-live-ruflo-5coi). As of September 1, 2026, the ruvnet/ruflo repository (github.com/ruvnet/claude-flow redirects there) has 70,110 GitHub stars and 8,371 forks under an MIT license, and the latest npm release is v3.38.20, published under both the claude-flow and ruflo package names at the same version (https://registry.npmjs.org/claude-flow/latest).

Ruflo's README describes 100+ specialized agents, roughly 210 MCP tools across 5 server groups (Core, Intelligence, Agents, Memory, DevTools), queen-led swarm coordination using Raft, Byzantine, and Gossip consensus protocols, and support for 5 LLM providers including Claude, GPT, Gemini, Cohere, and Ollama (https://github.com/ruvnet/ruflo).

A note on its performance numbers: Ruflo's project documentation claims its AgentDB vector memory with HNSW indexing measured 1.9x to 4.7x faster retrieval than brute-force search — this is the project's own benchmark, not an independent third-party measurement.

## The lighter alternative: claude-code-sdlc

claude-code-sdlc is an MIT-licensed Claude Code plugin providing 16 specialized agents, a documentation-first pipeline (PRD, use cases, architecture review, QA test cases before code), TDD slices in parallel waves, 12 enforcement hooks, and 9 quality gates before merge: git hygiene, documentation completeness, code review, security audit, build verification, end-to-end tests, goal-backward verification, documentation accuracy, and UI/UX review (https://github.com/Koroqe/claude-code-sdlc).

Stated plainly, it is a much smaller project than either SuperClaude or Ruflo: as of September 1, 2026 it has 51 GitHub stars and 4 forks, works only with Claude Code (no multi-provider support), and ships no orchestration runtime, swarm coordination, or persistent vector memory of its own. What it offers instead is enforced SDLC discipline with near-zero operational overhead.

## FAQ

### Is SuperClaude an orchestration runtime like Ruflo?

No. SuperClaude is a meta-programming configuration framework — behavioral instruction injection into a single Claude Code session — not a standalone runtime. Ruflo is the one that runs many agents as a distributed system, with its own memory and tool layer.

### Why did claude-flow change its name to Ruflo?

The project was renamed Ruflo in January 2026 to avoid trademark issues with Anthropic. The npm package and CLI keep the historical claude-flow name; the latest release, v3.38.20, is published under both the claude-flow and ruflo package names at the same version.

### Are Ruflo's performance benchmarks independently verified?

No. The AgentDB HNSW retrieval numbers (1.9x to 4.7x faster than brute-force search) come from the project's own documentation, not an independent third-party measurement.

### When is claude-code-sdlc the wrong choice?

When you need multi-provider support, swarm orchestration, or persistent vector memory — it has none of those, and its community is far smaller (51 GitHub stars, 4 forks as of September 1, 2026). It fits teams that want enforced docs-first TDD process inside Claude Code with near-zero overhead, not teams running large autonomous agent fleets.

## Sources

- https://pypi.org/project/SuperClaude/
- https://github.com/SuperClaude-Org/SuperClaude_Framework
- https://dev.to/stevengonsalvez/claude-flow-is-dead-long-live-ruflo-5coi
- https://github.com/ruvnet/ruflo
- https://registry.npmjs.org/claude-flow/latest
- https://github.com/Koroqe/claude-code-sdlc
