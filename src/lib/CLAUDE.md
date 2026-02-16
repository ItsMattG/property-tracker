# Lib Directory Reference

> Loaded when working in `src/lib/`. For component patterns see `src/components/CLAUDE.md`. For server patterns see `src/server/CLAUDE.md`.

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/trpc/client.ts` | Frontend tRPC: `createTRPCReact<AppRouter>()` |
| `src/lib/trpc/Provider.tsx` | TRPCProvider + QueryClient config (staleTime 30s, gcTime 5min) |
| `src/lib/trpc/server.ts` | Server-side caller: `getServerTRPC()` |
| `src/lib/utils.ts` | Date formatting, currency, `cn()` class merging |
| `src/lib/errors.ts` | `getErrorMessage(error)` — handles TRPCClientError, Error, string, unknown |
| `src/lib/supabase/client.ts` | Supabase client (lazy proxy init) |
| `src/lib/auth-client.ts` | BetterAuth client (`authClient`) |

## Date Formatting (`src/lib/utils.ts`)

| Function | Output | Example |
|----------|--------|---------|
| `formatDate(date)` | "15 Jan 2024" | Long format |
| `formatDateShort(date)` | "15/01/24" | Short AU format |
| `formatDateISO(date)` | "2024-01-15" | ISO format |
| `formatRelativeDate(date)` | "Today" / "3 days ago" | Relative |

All accept `Date | string`, use Australian locale (`en-AU`).

## Currency (`src/lib/utils.ts`)

```tsx
import { formatCurrency } from "@/lib/utils";
formatCurrency(1234) // "$1,234" (AUD, no decimals)
```

## Class Merging (`src/lib/utils.ts`)

```tsx
import { cn } from "@/lib/utils";
cn("base", isActive && "active", className) // twMerge + clsx
```

## Error Messages (`src/lib/errors.ts`)

```tsx
import { getErrorMessage } from "@/lib/errors";
// Handles TRPCClientError, Error, string, unknown → returns string
```

## Auth Client (`src/lib/auth-client.ts`)

```tsx
import { authClient } from "@/lib/auth-client";

await authClient.signOut();
const session = authClient.useSession(); // React hook
```

## Supabase Client (`src/lib/supabase/client.ts`)

```tsx
import { getSupabase } from "@/lib/supabase/client";
```

Lazy proxy init — prevents crashes when env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) are missing locally. Only initializes on first method call.

## File Uploads

**Stack:** `react-dropzone` + Supabase Storage (signed URLs).

**Flow:**
1. User drops file via `useDropzone` (accepts JPEG, PNG, HEIC, PDF; max 10MB)
2. `trpc.documents.getUploadUrl.useMutation()` → signed URL + storage path + token
3. Upload to Supabase: `supabase.storage.from("documents").uploadToSignedUrl(storagePath, token, file)`
4. Create record: `trpc.documents.create.useMutation()`

## Export Patterns

### CSV Export
```tsx
const response = await fetch(`/api/export/csv?type=transactions&propertyId=${id}`);
const blob = await response.blob();
const url = URL.createObjectURL(blob);
const a = document.createElement("a");
a.href = url;
a.download = "transactions.csv";
a.click();
URL.revokeObjectURL(url);
```

### PDF/Excel
```tsx
import { generateTaxReportPDF, generateTransactionsExcel } from "@/lib/export-utils";
const blob = await generateTaxReportPDF(data);
```

## Logging (`src/lib/logger.ts`)

| Method | When |
|--------|------|
| `logger.debug(msg, ctx)` | Dev-only detail, stripped in production |
| `logger.info(msg, ctx)` | Business events (user signed up, property created) |
| `logger.warn(msg, ctx)` | Recoverable issues (rate limit hit, retry succeeded) |
| `logger.error(msg, error, ctx)` | Failures requiring investigation |
| `logger.child({ domain })` | Scoped logger for a router/service |

All logs auto-ship to Axiom in production via `@/lib/axiom`.

**Never use `console.log/warn/error` in server code** — the `check-anti-patterns` hook will flag it.
