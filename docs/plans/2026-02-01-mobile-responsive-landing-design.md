# Mobile Responsive Landing Page Design

**Goal:** Make the landing page fully mobile responsive with a hamburger menu and spacing optimizations.

**Architecture:** Add a client-side MobileNav component with dropdown menu for small screens. Adjust Tailwind responsive classes throughout the page for better mobile spacing.

**Tech Stack:** React, Tailwind CSS, Lucide icons (Menu, X)

---

## Current State

The landing page has partial responsive support:
- Hero buttons stack on mobile (`flex-col sm:flex-row`)
- Social proof uses 2-col on mobile, 4-col on desktop
- Features/pricing grids stack on mobile
- Screenshot panels stack on mobile

## Issues Identified

1. **Header navigation** - No mobile menu. Buttons crowd on small screens.
2. **Section spacing** - `py-20` is too spacious on mobile.
3. **Footer links** - May overflow on very small screens.

## Solution

### 1. MobileNav Component

New client component at `src/components/landing/MobileNav.tsx`:
- Hamburger icon visible on mobile (`md:hidden`)
- Dropdown menu with Blog, Sign In, Get Started
- Closes on link click or outside click
- Smooth open/close animation

### 2. Header Changes

```tsx
// Desktop nav - hidden on mobile
<div className="hidden md:flex items-center gap-4">
  <Button variant="ghost" asChild>
    <Link href="/blog">Blog</Link>
  </Button>
  ...
</div>

// Mobile nav - visible only on mobile
<MobileNav />
```

### 3. Spacing Adjustments

| Section | Current | Updated |
|---------|---------|---------|
| Hero | `py-20` | `py-12 md:py-20` |
| Social Proof | `py-6` | `py-6` (keep) |
| Features | `py-20` | `py-12 md:py-20` |
| Screenshots | `py-20` | `py-12 md:py-20` |
| Benefits | `py-20` | `py-12 md:py-20` |
| Pricing | `py-20` | `py-12 md:py-20` |
| FAQ | `py-20` | `py-12 md:py-20` |
| CTA | `py-20` | `py-12 md:py-20` |

### 4. Footer Updates

- Add `flex-wrap` to links container
- Reduce gap on mobile: `gap-4 md:gap-6`

## Files Changed

- Create: `src/components/landing/MobileNav.tsx`
- Modify: `src/app/page.tsx`
