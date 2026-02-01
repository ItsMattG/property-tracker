# Landing Page Auth-Aware UX Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make landing page CTAs context-aware based on user authentication and subscription state.

**Architecture:** Server-side auth check with client component islands for interactive CTAs.

**Tech Stack:** Clerk auth, Drizzle ORM, React Server Components

---

## User States

| State | Description |
|-------|-------------|
| `signed-out` | No active session |
| `free` | Signed in, on free plan or trial |
| `paid` | Signed in, active paid subscription |

---

## Component Behavior by State

### Header Navigation

| State | Display |
|-------|---------|
| Signed out | `[Blog] [Sign In] [Get Started]` |
| Signed in | `[Blog] [Open BrickTrack]` |

"Open BrickTrack" links to `/dashboard`.

### Hero Section CTAs

| State | Display |
|-------|---------|
| Signed out | `[Start Free Trial →] [Sign In]` |
| Free/trial | `[Open BrickTrack →] [View Pricing]` |
| Paid | `[Open BrickTrack →]` (centered) |

"View Pricing" scrolls to `#pricing`.

### Pricing Section CTAs

| State | Free Card | Pro Card | Team Card |
|-------|-----------|----------|-----------|
| Signed out | Start Free | Start Free Trial | Start Free Trial |
| Signed in | Open BrickTrack | Open BrickTrack | Open BrickTrack |

All signed-in buttons link to `/dashboard`.

### Bottom CTA Section

| State | Display |
|-------|---------|
| Signed out | `[Get Started Free →]` |
| Signed in | `[Open BrickTrack →]` |

### Mobile Navigation

Same logic as header navigation.

---

## Data Flow

```
src/app/page.tsx (Server Component)
│
├─ auth() → get userId
│
├─ userId exists?
│   ├─ No  → userState = 'signed-out'
│   └─ Yes → query subscription from DB
│            ├─ Active paid subscription → userState = 'paid'
│            └─ Otherwise → userState = 'free'
│
└─ Pass userState to client components as props
```

---

## Files to Create

### `src/components/landing/HeaderNav.tsx`
Client component for desktop header navigation.
- Props: `isSignedIn: boolean`
- Signed out: Blog, Sign In, Get Started buttons
- Signed in: Blog, Open BrickTrack button

### `src/components/landing/HeroCTA.tsx`
Client component for hero section buttons.
- Props: `userState: 'signed-out' | 'free' | 'paid'`
- Renders appropriate button combination

### `src/components/landing/PricingCTA.tsx`
Client component for pricing card buttons.
- Props: `isSignedIn: boolean`, `plan: 'free' | 'pro' | 'team'`
- Renders plan-appropriate CTA

### `src/components/landing/BottomCTA.tsx`
Client component for bottom CTA section button.
- Props: `isSignedIn: boolean`
- Renders appropriate button

---

## Files to Modify

### `src/app/page.tsx`
- Add `auth()` call to get userId
- Query subscription status when signed in
- Determine `userState`
- Pass state to new client components

### `src/components/landing/MobileNav.tsx`
- Add `isSignedIn: boolean` prop
- Conditionally render Sign In/Get Started or Open BrickTrack

### `src/components/landing/index.ts`
- Export new components

---

## Implementation Notes

- Keep page.tsx as Server Component for SEO/performance
- Client components only handle rendering logic, no data fetching
- "Open BrickTrack" always links to `/dashboard`
- Subscription check: Look for active subscription in `subscriptions` table where `status = 'active'` and `currentPeriodEnd > now()`
