# Mobile Responsive Landing Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the landing page fully mobile responsive with a hamburger menu and spacing optimizations.

**Architecture:** Add a client-side MobileNav component with dropdown menu for small screens. Adjust Tailwind responsive classes throughout the page.

**Tech Stack:** React, Tailwind CSS, Lucide icons (Menu, X)

---

### Task 1: Create MobileNav Component

**Files:**
- Create: `src/components/landing/MobileNav.tsx`
- Create: `src/components/landing/index.ts` (barrel export)

**Step 1: Create the MobileNav component**

```tsx
// src/components/landing/MobileNav.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  return (
    <div ref={menuRef} className="md:hidden relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 hover:bg-secondary rounded-md"
        aria-label={isOpen ? "Close menu" : "Open menu"}
        aria-expanded={isOpen}
      >
        {isOpen ? (
          <X className="w-6 h-6" />
        ) : (
          <Menu className="w-6 h-6" />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-48 rounded-md border bg-background shadow-lg py-2 z-50">
          <Link
            href="/blog"
            onClick={() => setIsOpen(false)}
            className="block px-4 py-2 text-sm hover:bg-secondary"
          >
            Blog
          </Link>
          <Link
            href="/sign-in"
            onClick={() => setIsOpen(false)}
            className="block px-4 py-2 text-sm hover:bg-secondary"
          >
            Sign In
          </Link>
          <div className="px-4 py-2">
            <Button asChild className="w-full">
              <Link href="/sign-up" onClick={() => setIsOpen(false)}>
                Get Started
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Create barrel export**

```tsx
// src/components/landing/index.ts
export { LifetimeBanner } from "./LifetimeBanner";
export { FaqSection } from "./FaqSection";
export { MobileNav } from "./MobileNav";
```

**Step 3: Verify component renders**

Run: `npm run build`
Expected: Build succeeds without errors

**Step 4: Commit**

```bash
git add src/components/landing/MobileNav.tsx src/components/landing/index.ts
git commit -m "feat(landing): add MobileNav component for mobile hamburger menu

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 2: Update Header with Mobile Navigation

**Files:**
- Modify: `src/app/page.tsx:68-88`

**Step 1: Add MobileNav import and update header**

At the top of the file, update imports:
```tsx
import { MobileNav } from "@/components/landing";
```

Update the header section (lines 68-88):
```tsx
{/* Header */}
<header className="border-b">
  <div className="container mx-auto px-4 py-4 flex items-center justify-between">
    <Link href="/" className="flex items-center gap-2">
      <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
        <Building2 className="w-5 h-5 text-primary-foreground" />
      </div>
      <span className="font-semibold text-lg">PropertyTracker</span>
    </Link>
    {/* Desktop navigation */}
    <div className="hidden md:flex items-center gap-4">
      <Button variant="ghost" asChild>
        <Link href="/blog">Blog</Link>
      </Button>
      <Button variant="ghost" asChild>
        <Link href="/sign-in">Sign In</Link>
      </Button>
      <Button asChild>
        <Link href="/sign-up">Get Started</Link>
      </Button>
    </div>
    {/* Mobile navigation */}
    <MobileNav />
  </div>
</header>
```

**Step 2: Verify mobile nav appears**

Run: `npm run dev`
Expected: On mobile viewport (<768px), hamburger icon visible. On desktop, regular nav buttons visible.

**Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(landing): integrate MobileNav in header

- Hide desktop nav on mobile (md:hidden → hidden md:flex)
- Show hamburger menu on mobile screens

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 3: Optimize Section Spacing for Mobile

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Update Hero section spacing (line 91)**

```tsx
<section className="py-12 md:py-20 px-4">
```

**Step 2: Update Features section spacing (line 145)**

```tsx
<section className="py-12 md:py-20 px-4 bg-secondary">
```

**Step 3: Update Screenshots section spacing (line 186)**

```tsx
<section className="py-12 md:py-20 px-4">
```

Also update the inner spacing (line 195):
```tsx
<div className="space-y-12 md:space-y-16">
```

**Step 4: Update Benefits section spacing (line 272)**

```tsx
<section className="py-12 md:py-20 px-4 bg-secondary">
```

**Step 5: Update Pricing section spacing (line 295)**

```tsx
<section className="py-12 md:py-20 px-4" id="pricing">
```

**Step 6: Update CTA section spacing (line 404)**

```tsx
<section className="py-12 md:py-20 px-4 bg-primary text-primary-foreground">
```

**Step 7: Verify spacing looks good**

Run: `npm run dev`
Expected: Sections have less vertical padding on mobile, more spacious on desktop.

**Step 8: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(landing): optimize section spacing for mobile

- Reduce vertical padding on mobile (py-12)
- Keep full padding on desktop (md:py-20)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 4: Update FaqSection Spacing

**Files:**
- Modify: `src/components/landing/FaqSection.tsx:50`

**Step 1: Update section spacing**

```tsx
<section className="py-12 md:py-20 px-4 bg-secondary">
```

**Step 2: Verify FAQ section spacing**

Run: `npm run dev`
Expected: FAQ section has appropriate mobile spacing.

**Step 3: Commit**

```bash
git add src/components/landing/FaqSection.tsx
git commit -m "feat(landing): optimize FAQ section spacing for mobile

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 5: Update Footer for Mobile

**Files:**
- Modify: `src/app/page.tsx:422-444`

**Step 1: Update footer links container**

```tsx
{/* Footer */}
<footer className="border-t py-8 px-4">
  <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
    <div className="flex items-center gap-2">
      <Building2 className="w-5 h-5 text-primary" />
      <span className="text-sm text-muted-foreground">
        PropertyTracker &copy; {new Date().getFullYear()}
      </span>
    </div>
    <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6 text-sm text-muted-foreground">
      <Link href="/blog" className="hover:text-foreground">
        Blog
      </Link>
      <Link href="/changelog" className="hover:text-foreground">
        Changelog
      </Link>
      <Link href="/privacy" className="hover:text-foreground">
        Privacy Policy
      </Link>
      <Link href="/terms" className="hover:text-foreground">
        Terms of Service
      </Link>
    </div>
  </div>
</footer>
```

**Step 2: Verify footer wraps correctly**

Run: `npm run dev`
Expected: Footer links wrap gracefully on small screens without overflow.

**Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(landing): make footer links mobile-friendly

- Add flex-wrap for graceful wrapping
- Reduce gap on mobile (gap-4 md:gap-6)
- Center links on mobile

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 6: Final Verification and Build

**Files:**
- None (verification only)

**Step 1: Run linter**

Run: `npm run lint`
Expected: No errors

**Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Manual mobile testing**

Run: `npm run dev`
Test at these breakpoints:
- 320px (small phone)
- 375px (iPhone)
- 414px (larger phone)
- 768px (tablet - should switch to desktop nav)

Expected:
- Hamburger menu visible below 768px
- Menu opens/closes correctly
- All links work
- Spacing looks appropriate at all sizes
- No horizontal overflow

**Step 4: Commit any final fixes if needed**

---

### Task 7: Create PR

**Step 1: Push branch and create PR**

```bash
git push -u origin feature/mobile-responsive-landing
gh pr create --title "feat: make landing page mobile responsive" --body "$(cat <<'EOF'
## Summary
- Add hamburger menu for mobile navigation
- Optimize section spacing for mobile viewports
- Make footer links wrap gracefully on small screens

## Test plan
- [ ] View landing page on mobile viewport (<768px)
- [ ] Hamburger menu opens/closes correctly
- [ ] All navigation links work
- [ ] Section spacing looks appropriate
- [ ] Footer doesn't overflow

Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

**Step 2: Wait for CI**

Run: `gh pr checks --watch`
Expected: All checks pass

**Step 3: Notify user**

```bash
curl -s -X POST "https://ntfy.sh/property-tracker-claude" \
  -d "PR ready for review: Mobile responsive landing page" \
  -H "Title: Claude Code" \
  -H "Priority: high"
```
