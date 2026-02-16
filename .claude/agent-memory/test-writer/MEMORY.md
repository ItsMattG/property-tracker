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

## Domain Knowledge
- 23 repositories: property, transaction, bankAccount, loan, document, etc.
- Procedure types: public, protected, write, member, bank, pro, team
- Portfolio context: ownerId, role, canWrite, canManageMembers, etc.

## Learned Preferences
(populated during test writing sessions)
