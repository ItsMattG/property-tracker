# Claude Code Rules

## Project Status (as of 2026-01-27)
The v0.2 roadmap and post-extraction roadmap are **complete**. See `docs/plans/2026-01-25-post-extraction-roadmap.md` for full status.

**V0.3 Roadmap:** See `docs/plans/2026-01-27-v03-roadmap-design.md`

**Completed features (v0.1-v0.2):**
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
- Axiom Observability (structured logging, metrics)

**V0.3 Roadmap (Growth & Engagement):**
- Phase 1: User Feedback System (public feature board, private bug reports)
- Phase 2: Changelog & What's New
- Phase 3: Landing Page Overhaul (social proof, pricing, screenshots, FAQ)
- Phase 4: Blog & SEO
- Phase 5: Gmail/Outlook Email Integration (full)
- Phase 6: Task Management (global task list)
- Phase 7: Competitive Parity (AVM integration, guided onboarding, AI chat, shares/crypto)
- Phase 8: TaxTank Features (forecasted tax, MyTax export, referrals)
- Phase 9: Property Accountant Features (email forwarding, audit checks, YoY comparison)

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
