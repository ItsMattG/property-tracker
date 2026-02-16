# Anti-Patterns

## General Principles

**Existing codebase patterns are NOT automatically correct.** This codebase is mid-refactor and contains known anti-patterns. Before implementing anything:

1. **Query context7** for the current API of every library you touch
2. **Check this file** for known DON'Ts
3. **If existing code contradicts this file or context7 docs, the existing code is wrong** — fix it, don't replicate it
4. **Every file you touch is an opportunity to fix** — if you're editing a file and notice anti-patterns in surrounding code, fix them

## Cross-Cutting Anti-Patterns

| DO | DON'T |
|----|-------|
| Use specific schema types (`Property`, `Transaction`, `Partial<Scenario>`) | `Record<string, unknown>` or `any` for DB update payloads |
| Top-level static imports | Dynamic `await import(...)` for project modules |
| `db: DB` (from `repositories/base`) | `db: any` |
| `sql<number>\`COUNT(*)::int\`` | `sql\`COUNT(*)\`` (returns string) |
| Explicit named re-exports in barrels | `export *` (breaks tree-shaking, hides API surface) |
| Import server-only code from barrel in server files only | Import barrel containing DB code in `"use client"` components |
| `Promise.all([q1, q2])` for independent queries | Sequential `await` for independent queries |
| Repository methods with typed return values | Raw Drizzle queries scattered across routers |

# Version-Specific Anti-Patterns

## Next.js 16 / React 19

| DO | DON'T |
|----|-------|
| `React.ComponentProps<"div">` | `React.forwardRef<HTMLDivElement, Props>` |
| `const result = await auth()` | `const { userId } = auth()` (v6 is async) |
| `export const dynamic = "force-dynamic"` on dashboard pages | Use `getServerSideProps` (doesn't exist in App Router) |
| `"use client"` for any page with hooks/interactivity | Assume all components are server components |
| Plain function components | Class components (except ErrorBoundary) |

## tRPC v11 / React Query v5

| DO | DON'T |
|----|-------|
| `trpc.useUtils()` | `trpc.useContext()` (deprecated in v11) |
| `utils.property.list.invalidate()` | `queryClient.invalidateQueries()` directly |
| `utils.property.get.setData({ id }, data)` after create+redirect | Rely on refetch after redirect (race condition) |
| `await utils.transaction.list.cancel()` before optimistic update | Skip cancel (stale queries overwrite optimistic) |
| Import `trpc` from `@/lib/trpc/client` | Create new tRPC client instances |

## Drizzle ORM v0.45

| DO | DON'T |
|----|-------|
| `ctx.db.query.properties.findMany({ where, with })` | Raw SQL for simple queries |
| `.returning()` on insert/update | Separate select after insert |
| `inArray(col, ids)` for bulk operations | Loop with individual queries |
| `Promise.all([query1, query2])` for parallel queries | Sequential await for independent queries |
| `sql<number>\`count(*)::int\`` for aggregations | `sql\`count(*)\`` (returns string without cast) |
| `eq(properties.userId, ctx.portfolio.ownerId)` (always scope by user) | Query without user ID filter |

## Repository Layer

| DO | DON'T |
|----|-------|
| `Partial<SchemaType>` for update data params | `Record<string, unknown>` (bypasses type safety) |
| Typed return values (`Promise<User \| null>`) | `Promise<unknown>` or `Promise<any>` |
| Proper relation types (`Property \| null`) | `unknown` for relation fields in interfaces |
| `ctx.uow.repo.method()` in routers | Direct `ctx.db` when a repo method exists |
| Comment explaining why for cross-domain `ctx.db` | Mixing `ctx.uow` and `ctx.db` without explanation |

## BetterAuth v1

| DO | DON'T |
|----|-------|
| `const session = await getAuthSession()` | `const session = getAuthSession()` (must await) |
| `await authClient.signOut()` | Manual session deletion |
| `authClient.useSession()` hook for client state | Direct cookie access |

## Tailwind CSS v4

| DO | DON'T |
|----|-------|
| `@theme inline { }` in CSS for config | `tailwind.config.ts` (doesn't exist, v4 is CSS-first) |
| CSS variables: `var(--color-primary)` | Hardcoded colors in components |
| `cn("base", conditional && "extra", className)` | String concatenation for classes |

## Zod v4

| DO | DON'T |
|----|-------|
| `z.enum([...], { error: "message" })` | `z.enum([...]).describe("message")` |
| `z.string().min(1, "Required")` | `z.string().nonempty()` |
| Define schema next to form component | Separate schema files for forms |
| `z.infer<typeof schema>` for types | Manually duplicate types |

## Sonner v2

| DO | DON'T |
|----|-------|
| `toast.success("Done")` | `toast("Done", { type: "success" })` |
| `toast.error(getErrorMessage(error))` | `toast.error(error.message)` (may throw) |
| Use `action: { label, onClick }` for CTA toasts | Custom toast components |

## Stripe v20

| DO | DON'T |
|----|-------|
| Verify webhooks with `stripe.webhooks.constructEvent()` | Trust webhook payloads without verification |
| Use idempotency keys for mutations | Retry without idempotency |
| Check `event.type` exhaustively | Assume webhook event structure |

## Recharts v3

| DO | DON'T |
|----|-------|
| Always wrap in `<ResponsiveContainer>` | Set fixed width/height on chart |
| Use CSS variable chart colors from globals.css | Hardcode hex colors |

## Playwright

| DO | DON'T |
|----|-------|
| `page.getByRole("button", { name: "Save" })` | `page.locator("#save-btn")` |
| `await expect(page.getByText("Success")).toBeVisible()` | `await page.waitForSelector(".success")` |
| `page.on('pageerror', ...)` to catch uncaught exceptions | Ignore page errors in tests |
| Use `authenticatedPage` fixture from `e2e/fixtures/auth.ts` | Manual login in each test |

## Sentry v10

| DO | DON'T |
|----|-------|
| `Sentry.captureException(error)` for unexpected errors | `console.error` for production error tracking |
| `Sentry.setUser({ id })` in auth context | Log PII (email, name) in Sentry breadcrumbs |
| `Sentry.withScope(scope => { scope.setTag(...) })` for context | Capture expected/handled errors (404, validation) |
| Use `global-error.tsx` for React error boundary reporting | Silent swallowing of errors in catch blocks |

## Structured Logging / Axiom

| DO | DON'T |
|----|-------|
| `logger.info("message", { context })` from `@/lib/logger` | `console.log` in server code |
| `logger.error("message", error, { context })` | `console.error(error)` without structured context |
| `logger.child({ domain: "banking" })` for domain-scoped logs | Create custom logger instances |
| Include `requestId`, `userId` in log context | Log sensitive data (passwords, tokens, card numbers) |

## Upstash Rate Limiting

| DO | DON'T |
|----|-------|
| Use middleware from `src/server/middleware/rate-limit.ts` | Build custom rate limiting |
| Apply to public/expensive endpoints (AI, bulk exports, auth) | Rate limit every tRPC procedure (overhead) |
| Return TRPCError code `TOO_MANY_REQUESTS` | Silently drop rate-limited requests |
| Sliding window algorithm | Fixed window (burst-prone) |

## Error Boundaries

| DO | DON'T |
|----|-------|
| `error.tsx` per route segment for granular recovery | Single global error boundary only |
| Show "retry" action in error UI | Show raw error messages to users |
| Report to Sentry in error boundary | Swallow errors silently |
| `<ErrorBoundary>` component for client-side granular recovery | Let all errors bubble to global handler |

## Security

| DO | DON'T |
|----|-------|
| Always scope queries by `ctx.portfolio.ownerId` | Trust client-sent user IDs |
| `stripe.webhooks.constructEvent()` for webhook verification | Process unverified webhook payloads |
| Validate file uploads server-side (type, size, extension) | Trust client-side validation alone |
| `writeProcedure` for mutations | `protectedProcedure` for state-changing ops without `canWrite` |
| Sanitize AI-generated content before rendering | `dangerouslySetInnerHTML` with unsanitized content |
| Use env vars for all secrets/keys | Hardcode API keys, tokens, or passwords |
