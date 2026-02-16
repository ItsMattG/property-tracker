# Code Reviewer Memory

## Project Conventions
- Repository layer: 23 typed repos with interfaces in `src/server/repositories/`
- UnitOfWork (`ctx.uow`) on all `protectedProcedure`+ contexts
- `publicProcedure` does NOT have `ctx.uow`
- `writeProcedure` for mutations, `protectedProcedure` for reads

## Approved Exceptions
(none yet — add as user approves items during reviews)

## Common Patterns Found
- console.log in server code (should use logger from @/lib/logger)
- Missing error boundaries on route segments
- Sequential awaits for independent queries (should use Promise.all)
- Hardcoded colors instead of CSS variables
- Missing aria-label on icon-only buttons
- toast.error(error.message) instead of toast.error(getErrorMessage(error))
- size={16} on Lucide icons instead of Tailwind w-4 h-4 classes

## Manual Review Checklist
1. New files: has appropriate "use client" directive (or deliberately omits it)?
2. New mutations: uses writeProcedure (not protectedProcedure)?
3. New queries: scoped by ctx.portfolio.ownerId?
4. New components: keyboard-navigable, semantic HTML?
5. New API routes: rate-limited if public/expensive?
6. Error handling: uses getErrorMessage, not raw .message?
7. Logging: uses logger, not console.log in server code?
8. Sequential awaits: independent queries should use Promise.all?
9. Insert/update: uses .returning() if return value needed?
10. Bulk operations: uses inArray, not loop?

## Review History
(populated during reviews)
