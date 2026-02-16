# Workflow Optimization — Maximum (Approach C)

**Date:** 2026-02-16
**Status:** Approved

## Problem

Four workflow friction points identified:
1. **Context management** — context runs out mid-task, manual subtask splitting
2. **Plan-to-code gap** — plans are good but implementation drifts
3. **Quality gates** — bugs slip through, tests get skipped, linting issues caught late
4. **Repetitive setup** — boilerplate per task (worktree, env, test scaffold, PR)

## Design

### 1. Hook Scripts (`.claude/hooks/`)

| Script | Hook Event | Matcher | Purpose |
|--------|-----------|---------|---------|
| `lint-changed.sh` | PostToolUse | `Edit\|Write` | ESLint on changed file, errors as context feedback |
| `block-destructive.sh` | PreToolUse | `Bash` | Block `rm -rf`, `git reset --hard`, `DROP`, `TRUNCATE`, force-push to main |
| `save-progress.sh` | PreCompact | — | Auto-output reminder of what to preserve during compaction |

**Quality gate:** Stop prompt hook checks if tests were written when code changed. Non-blocking feedback.

**Hook config location:** `.claude/settings.json` (project-level, committable).

### 2. Skills (`.claude/skills/`)

**Extracted from CLAUDE.md:**

| Skill | Source | Invocation |
|-------|--------|------------|
| `tdd-workflow` | "Development Workflow" section | `/tdd-workflow` (manual) |
| `env-spinup` | "Environment Spin-Up" section | `/env-spinup` (manual) |
| `task-complete` | "Task Completion Workflow" section | `/task-complete` (manual) |
| `document-continue` | New — context handoff pattern | `/document-continue` (manual) |

**New runbook skills:**

| Skill | Purpose |
|-------|---------|
| `new-router` | Scaffold tRPC router + repository + interface + tests + barrel export |
| `new-component` | Create React component following project conventions |
| `new-e2e-test` | Create Playwright E2E test with auth fixture, cleanup, accessibility |

All skills use `disable-model-invocation: true` — manual invocation only.

### 3. CLAUDE.md Slimming (~150 lines)

**Stays:**
- Stack declaration
- Scoped guidance table
- Anti-Pattern Zero Tolerance (principle only, examples stay in rules/)
- Token Efficiency + Context Hygiene (new)
- Worktree Requirement
- MCP Plugins table
- Beads commands table
- Staging/Production info
- Notifications pattern

**Moves to skills:**
- Development Workflow (TDD) → `tdd-workflow`
- Environment Spin-Up → `env-spinup`
- Task Completion Workflow → `task-complete`

**Rules files unchanged:**
- `.claude/rules/conventions.md` — stays (always loaded)
- `.claude/rules/anti-patterns.md` — stays (always loaded, risk too high to make on-demand)

### 4. Context Management

**CLAUDE.md additions:**
```
## Context Hygiene
- /clear between unrelated tasks
- For investigation requiring 3+ file reads, delegate to Task subagent
- Before /clear mid-task, invoke /document-continue
- When compacting, preserve: beads task ID, modified files, plan path, test commands
```

**document-continue skill:**
1. Write progress to `docs/plans/PROGRESS-<task-id>.md`
2. Include: modified files, failing tests, next steps, current plan path
3. User /clear and starts fresh reading that file

**PreCompact hook:** Outputs preservation reminders.

### 5. Agent Teams (documentation only)

Add note to CLAUDE.md about `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` availability. Not enabled by default (experimental, 5x token cost).

### 6. Writer/Reviewer Workflow (process documentation)

Added to `tdd-workflow` skill: after implementation, open second session for `/code-review` with fresh context.

## Files to Create/Modify

| Action | File |
|--------|------|
| Create | `.claude/hooks/lint-changed.sh` |
| Create | `.claude/hooks/block-destructive.sh` |
| Create | `.claude/hooks/save-progress.sh` |
| Create | `.claude/skills/tdd-workflow/SKILL.md` |
| Create | `.claude/skills/env-spinup/SKILL.md` |
| Create | `.claude/skills/task-complete/SKILL.md` |
| Create | `.claude/skills/document-continue/SKILL.md` |
| Create | `.claude/skills/new-router/SKILL.md` |
| Create | `.claude/skills/new-component/SKILL.md` |
| Create | `.claude/skills/new-e2e-test/SKILL.md` |
| Modify | `CLAUDE.md` (slim to ~150 lines) |
| Modify | `.claude/settings.json` (add hook configs) |

## Tech Notes (context7)

- Hook events: PostToolUse, PreToolUse, PreCompact, Stop — all confirmed available
- Hook types: command (shell), prompt (LLM judgment), agent (multi-turn) — all confirmed
- Exit codes: 0=allow+stdout-to-context, 2=block+stderr-as-feedback
- Skill format: SKILL.md with frontmatter (name, description, disable-model-invocation)
- `.claude/rules/` files auto-loaded with same priority as CLAUDE.md
- `async: true` on hooks runs them in background
- Hook timeout max: 10 minutes (v2.1.3+)

## Not Doing

- Custom agents (`.claude/agents/`) — existing plugins cover needs, revisit in 1 week
- Agent Teams default — experimental, document availability only
- Splitting anti-patterns.md into always/on-demand — risk too high
