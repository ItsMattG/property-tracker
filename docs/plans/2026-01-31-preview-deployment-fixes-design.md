# Preview Deployment Fixes Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix two issues affecting stakeholder demos: raw database errors exposed to frontend, and missing demo data.

**Architecture:** Add tRPC error sanitization handler; create pre-seeded demo account in Clerk.

**Tech Stack:** tRPC onError handler, Axiom logging, Clerk user management, existing seed scripts.

---

## Problem Statement

1. **Raw database errors exposed to frontend** - Errors like `"Failed query: select ... from users"` leak SQL structure and provide poor UX for stakeholders.

2. **No demo data for stakeholders** - Preview deployments show empty dashboards because the seed endpoint is blocked in production mode.

## Solution Overview

### Fix 1: Error Sanitization

Add an `onError` handler to the tRPC route that:
- Catches unhandled errors before they reach the client
- Generates an 8-character error ID for debugging
- Logs full error details to Axiom
- Returns sanitized message: `"Something went wrong (Error ID: abc123de)"`
- Passes through intentional TRPCErrors unchanged (NOT_FOUND, UNAUTHORIZED, etc.)

**File:** `src/app/api/trpc/[trpc]/route.ts`

```typescript
onError: ({ error, path }) => {
  // TRPCErrors are intentional - let them through
  if (error instanceof TRPCError) {
    return;
  }

  // Database/unknown errors - log and sanitize
  const errorId = randomUUID().slice(0, 8);
  logger.error("Unhandled API error", {
    errorId,
    path,
    error: error.message,
    stack: error.stack,
  });

  // Replace error message with sanitized version
  error.message = `Something went wrong (Error ID: ${errorId})`;
}
```

### Fix 2: Demo Account Setup

Create a dedicated demo account for stakeholder demos:

1. **Create Clerk user:** `demo@propertytracker.com.au` with known password
2. **Seed demo data:** Run existing seed script with demo Clerk ID
3. **Document credentials:** Store securely for sharing

**Data seeded (via existing demo profile):**
- 3 investment properties (NSW, VIC, QLD)
- 5 years of transaction history
- Active loans with realistic terms
- Compliance records
- Sample anomaly alerts

## Implementation Tasks

| Task | Type | Files |
|------|------|-------|
| Add tRPC error sanitization | Code | `src/app/api/trpc/[trpc]/route.ts` |
| Create Clerk demo user | Manual | Clerk dashboard |
| Seed demo data | Manual | CLI command |
| Test error handling | Manual | Verify in browser |
| Test demo login | Manual | Verify in browser |

## Testing

1. **Error sanitization:**
   - Trigger a database error (e.g., invalid query)
   - Verify frontend shows `"Something went wrong (Error ID: xxx)"`
   - Verify Axiom logs contain full error details with matching ID
   - Verify TRPCErrors still show correct messages (e.g., "Property not found")

2. **Demo account:**
   - Log in with demo credentials on production/preview
   - Verify dashboard shows properties, transactions, charts
   - Verify all features work with demo data

## Security Considerations

- Error IDs are random UUIDs, not sequential
- Full error details only in server logs (Axiom)
- Demo account has no special privileges
- Demo data is clearly fake (not real addresses)
