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
