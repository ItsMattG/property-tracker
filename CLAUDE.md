# Claude Code Rules

## Project Status (as of 2026-01-26)
The v0.2 roadmap and post-extraction roadmap are **complete**. See `docs/plans/2026-01-25-post-extraction-roadmap.md` for full status.

**Completed features:**
- Property Manager Integrations (PropertyMe OAuth)
- React Native Mobile App with Detox E2E tests
- Scenario Simulator (what-if modeling)
- Portfolio Share
- Compliance Calendar
- Equity Milestone Notifications
- Broker Portal
- Climate/Flood Risk
- Trust/SMSF Entity Support (Phase 1 & 2)
- Financial Leak Benchmarking
- Property Performance Benchmarking
- Tax Position Calculator
- Vector DB Similar Properties

**All roadmap items complete.** 🎉

## Token Efficiency
Always pick the token-efficient approach when implementing. Minimize unnecessary exploration and verbose output.

## Task Completion Workflow
After completing each task:
1. Create a PR for it
2. Merge the PR
3. Run `/compact`
4. Begin the next task

## Development Workflow
Always follow this workflow for new features:
1. **Create feature branch**: `git checkout -b feature/<feature-name>` before any code changes
2. **Brainstorm**: Use `superpowers:brainstorming` for design
3. **Plan**: Use `superpowers:writing-plans` for implementation plan
4. **Execute**: Use `superpowers:executing-plans` (batch execution - more token efficient than subagent-driven)
5. **Create PR**: Push branch and create PR with `gh pr create`
6. **Merge PR**: Merge with `gh pr merge`

Always create a feature branch first. Never commit directly to main.

## Notifications
When waiting for user input/approval, send:
- macOS desktop notification (with sound)
- Push notification to `ntfy.sh/property-tracker-claude`
