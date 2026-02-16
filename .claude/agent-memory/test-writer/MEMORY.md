# Test Writer Memory

## Mock Patterns
- `createMockUow()` provides all 23 repository mocks
- Each repo mock has vi.fn() for every method
- Use `.mockResolvedValue()` for async methods
- Use `.mockReturnValue()` for sync methods

## E2E Patterns
- Auth handled by storageState in `e2e/authenticated/` directory
- Free plan limit: 1 property — always clean up
- Use `safeGoto` from `e2e/fixtures/test-helpers.ts` for navigation
- Always capture page errors: `page.on("pageerror", ...)`

## Domain Knowledge
- 23 repositories: property, transaction, bankAccount, loan, document, etc.
- Procedure types: public, protected, write, member, bank, pro, team
- Portfolio context: ownerId, role, canWrite, canManageMembers, etc.

## Learned Preferences
- Test behavior over implementation details
- Descriptive test names: "returns null when property not found"
- Nested describe blocks grouped by method/feature
- Always test error/edge cases, not just happy path
- Repositories: test query filters, empty results, null returns
- Routers: test authorization (wrong user = FORBIDDEN), validation (bad input = BAD_REQUEST)
- Arrange-Act-Assert pattern with blank line separation
