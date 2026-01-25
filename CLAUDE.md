# Claude Code Rules

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
1. **Brainstorm**: Use `superpowers:brainstorming` for design
2. **Plan**: Use `superpowers:writing-plans` for implementation plan
3. **Execute**: Use `superpowers:executing-plans` (batch execution - more token efficient than subagent-driven)

Always pick the token-efficient execution approach - batch execution without subagent overhead.

## Notifications
When waiting for user input/approval, send:
- macOS desktop notification (with sound)
- Push notification to `ntfy.sh/property-tracker-claude`
