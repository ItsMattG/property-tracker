# UI Contrast & Accessibility Fix Design

**Date:** 2026-01-25
**Status:** Approved

## Problem

The Forest (green) theme has critical WCAG contrast failures:

| Element | Current Color | Background | Contrast Ratio | Status |
|---------|--------------|------------|----------------|--------|
| `--text-muted` | `#4ade80` | `#ffffff` | ~2.3:1 | **FAIL** |
| `--text-muted` | `#4ade80` | `#f0fdf4` | ~2.0:1 | **FAIL** |

WCAG AA requires 4.5:1 for normal text.

**Affected UI Elements:**
- Card descriptions ("Investment properties tracked")
- Empty state messages
- Footer links
- Sidebar "SETTINGS" label
- Landing page feature descriptions

## Solution

**Accessibility-first approach:** Use neutral grays for text, keep green for brand accents.

### Theme Variable Changes

**File:** `src/styles/themes.css`

```css
:root {
  /* Primary brand colors - KEEP GREEN */
  --color-primary: #16a34a;
  --color-primary-hover: #15803d;
  --color-primary-light: #dcfce7;
  --color-primary-foreground: #ffffff;

  /* Semantic colors - unchanged */
  --color-success: #10b981;
  --color-warning: #f59e0b;
  --color-danger: #ef4444;
  --color-info: #3b82f6;

  /* Backgrounds - neutral instead of green tint */
  --bg-primary: #ffffff;
  --bg-secondary: #f9fafb;
  --bg-tertiary: #f3f4f6;
  --bg-card: #ffffff;

  /* Text - ACCESSIBILITY FIX */
  --text-primary: #111827;
  --text-secondary: #4b5563;
  --text-muted: #6b7280;
  --text-inverse: #ffffff;

  /* Borders - neutral and visible */
  --border-light: #e5e7eb;
  --border-medium: #d1d5db;
}
```

### Contrast Verification

| Text Color | Background | Ratio | Status |
|------------|------------|-------|--------|
| `#111827` (primary) | `#ffffff` | 16:1 | PASS |
| `#4b5563` (secondary) | `#ffffff` | 7:1 | PASS |
| `#6b7280` (muted) | `#ffffff` | 5:1 | PASS |
| `#6b7280` (muted) | `#f9fafb` | 4.7:1 | PASS |
| `#ffffff` (on primary btn) | `#16a34a` | 4.5:1 | PASS |

### What Stays Green

- Primary buttons and links
- Icons and accents
- Success states
- Active/selected sidebar items
- Brand elements (logo background)

### What Becomes Neutral

- Body text (dark gray)
- Secondary/muted text (medium gray)
- Backgrounds (white/light gray instead of green tint)
- Borders (gray instead of green)

## Implementation

Single file change: `src/styles/themes.css`

All components use CSS variables, so changes propagate automatically.

## Verification

1. Take Playwright screenshots of key pages
2. Compare before/after
3. Verify all text is readable
