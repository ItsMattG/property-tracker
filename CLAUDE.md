# Claude Code Rules

## Project Status (as of 2026-01-28)
V0.1, v0.2, and v0.3 roadmaps are **complete**. V0.4 is **in progress** (9/15 done).

**V0.4 Roadmap:** See `docs/plans/2026-01-28-v04-roadmap-design.md` for full progress tracker.

**V0.4 completed (PRs #48-#52):**
- Stripe Billing Integration (subscriptions, webhooks, plan-gated middleware, billing page)
- Blog Content Pipeline (5 SEO articles)
- PostHog Analytics (provider, page tracking, user identification)
- Conversion Prompts (UpgradePrompt component)
- Rental Yield Calculator (dashboard widget, gross/net yield)
- Security Hardening (rate limiting middleware, security headers)
- Settlement Statement Capture (AI extraction, post-creation flow, CGT cost base)
- Depreciation Schedules & Sitemap/Robots.txt (pre-existed)

**V0.4 remaining (6 items):**
- 4.2 CI/CD Pipeline (GitHub Actions) — recommended next
- 2.3 Dynamic OG Images (@vercel/og)
- 4.3 Monitoring & Alerting (Checkly uptime, cron health)
- 4.5 Database Backup Verification
- 3.1 PropTrack AVM (blocked on API key)
- 4.1 Gmail/Outlook Integration (highest complexity)

**Earlier roadmaps (all complete):**
- v0.1-v0.2: PropertyMe, Mobile App, Scenarios, Portfolio Share, Compliance, Milestones, Broker Portal, Climate Risk, Trust/SMSF, Benchmarking, Tax Position, Similar Properties, Axiom
- v0.3: Feedback System, Changelog, Landing Page, Blog/SEO, Email Integration, Task Management, Onboarding, AI Chat, TaxTank Features, Audit Checks, YoY Comparison, Support Tickets, Advisor System, Referral Program

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
