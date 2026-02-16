# Code Reviewer Memory

## Project Conventions
- Repository layer: 23 typed repos with interfaces in `src/server/repositories/`
- UnitOfWork (`ctx.uow`) on all `protectedProcedure`+ contexts
- `publicProcedure` does NOT have `ctx.uow`
- `writeProcedure` for mutations, `protectedProcedure` for reads

## Approved Exceptions
(none yet — add as user approves items during reviews)

## Common Patterns Found
(populated during reviews)

## Review History
(populated during reviews)
