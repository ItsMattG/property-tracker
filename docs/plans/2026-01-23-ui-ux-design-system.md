# PropertyTracker - UI/UX Design System

**Date:** 2026-01-23
**Version:** 1.0
**Status:** Validated

---

## Executive Summary

PropertyTracker's UI must achieve two goals:
1. **Build trust** - Users are skeptical of apps handling sensitive financial data
2. **Feel powerful** - Spreadsheet users expect data density and control

This document defines a **flexible theming system** that allows A/B testing different visual approaches while maintaining consistent UX patterns.

---

## Competitor Visual Analysis

### TaxTank
- **Style:** Clean, modern, light interface
- **Colors:** Blue primary (#0066CC), white backgrounds
- **Vibe:** Professional, trustworthy, slightly corporate
- **Award:** WeMoney's "Most Innovative Tax Platform 2025" for intuitive design
- **Source:** [TaxTank](https://taxtank.com.au/tax-app/)

### Landlord Studio
- **Style:** Mobile-first, clean, minimal
- **Colors:** Blue primary, white/gray backgrounds
- **Vibe:** Friendly, accessible, simple
- **Praise:** "Extremely user friendly", "clean interface", "intuitively designed"
- **Source:** [Capterra - Landlord Studio](https://www.capterra.com/p/182473/Landlord-Studio/)

### Stessa
- **Style:** Dashboard-focused, card-based layout
- **Colors:** Green primary (#00A67E), white backgrounds
- **Vibe:** Modern, growth-oriented, approachable
- **Praise:** "Clean interface and intuitive workflows", "at-a-glance visualization"
- **Source:** [Stessa](https://www.stessa.com/)

### Common Patterns Across Competitors

| Element | Pattern | Why It Works |
|---------|---------|--------------|
| Background | White/light gray | Clean, professional |
| Primary color | Blue or green | Trust + growth |
| Accent | Single bold color | Focus attention |
| Layout | Card-based | Digestible chunks |
| Typography | Sans-serif | Modern, readable |
| Density | Medium | Balance of data + whitespace |

---

## Color Psychology Research

### Blue: Trust & Security

- Associated with **trustworthiness and dependability**
- Used by major banks (Chase, PayPal, Visa)
- Research: Users react faster to blue contrasts
- Safe choice globally - works across cultures
- Best for: Login screens, account summaries, security features

**Source:** [Inordo - Color Psychology in Fintech](https://inordo.com/shades-of-trust-how-color-psychology-influences-fintech-ui-design/)

### Green: Growth & Prosperity

- Synonymous with **money, growth, success**
- Creates feeling of "go", "safe", "success"
- Second most visually pleasing color (nature association)
- Appears humble and accessible
- Best for: Positive numbers, gains, success states

**Source:** [Billcut - Why Green Rules Fintech](https://www.billcut.com/blogs/color-psychology-in-fintech-ui-why-green-dominates/)

### Red: Caution & Losses

- Universal signal for **danger/warning**
- Use sparingly for negative numbers, alerts
- Never use for primary actions

### Key Statistics

- **90 seconds:** Time for customers to make subconscious product decisions
- **62-90%:** Decisions influenced by color alone
- **10%:** Population is red-green colorblind (test accessibility)

**Source:** [Phoenix Strategy Group - Financial Dashboard Colors](https://www.phoenixstrategy.group/blog/best-color-palettes-for-financial-dashboards)

---

## Theming Architecture

### CSS Custom Properties (Variables)

All themes use the same variable names, making switching trivial:

```css
:root {
  /* Primary brand colors */
  --color-primary: #0066CC;
  --color-primary-hover: #0052A3;
  --color-primary-light: #E6F0FF;

  /* Semantic colors */
  --color-success: #10B981;  /* Green - positive/gains */
  --color-warning: #F59E0B;  /* Amber - caution */
  --color-danger: #EF4444;   /* Red - losses/errors */
  --color-info: #3B82F6;     /* Blue - informational */

  /* Backgrounds */
  --bg-primary: #FFFFFF;
  --bg-secondary: #F9FAFB;
  --bg-tertiary: #F3F4F6;
  --bg-card: #FFFFFF;

  /* Text */
  --text-primary: #111827;
  --text-secondary: #6B7280;
  --text-muted: #9CA3AF;
  --text-inverse: #FFFFFF;

  /* Borders */
  --border-light: #E5E7EB;
  --border-medium: #D1D5DB;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.1);
  --shadow-lg: 0 10px 15px rgba(0,0,0,0.1);

  /* Spacing (consistent across themes) */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;

  /* Border radius */
  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;
  --radius-full: 9999px;

  /* Typography */
  --font-sans: 'Inter', -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
}
```

### Theme Switching

```typescript
// themes/index.ts
export type ThemeName = 'clean' | 'dark' | 'friendly' | 'bold' | 'ocean' | 'forest';

export function setTheme(theme: ThemeName) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
}

export function getTheme(): ThemeName {
  return (localStorage.getItem('theme') as ThemeName) || 'clean';
}
```

```css
/* Apply theme via data attribute */
[data-theme="dark"] {
  --bg-primary: #0F172A;
  --bg-secondary: #1E293B;
  --text-primary: #F8FAFC;
  /* ... etc */
}
```

---

## Theme Options

### Theme 1: Clean & Minimal (Default)

**Inspiration:** Linear, Notion, Vercel

| Property | Value | Reasoning |
|----------|-------|-----------|
| Primary | `#0066CC` (Blue) | Trust, professional |
| Background | `#FFFFFF` | Clean, spacious |
| Accent | `#10B981` (Green) | Growth, positive |
| Radius | `0.5rem` | Modern, not too soft |
| Density | Medium | Balanced |

**Best for:** Users who want professional, no-nonsense interface

```css
[data-theme="clean"] {
  --color-primary: #0066CC;
  --color-primary-hover: #0052A3;
  --color-primary-light: #E6F0FF;
  --bg-primary: #FFFFFF;
  --bg-secondary: #F9FAFB;
  --bg-card: #FFFFFF;
  --text-primary: #111827;
  --radius-md: 0.5rem;
}
```

---

### Theme 2: Dark & Sophisticated

**Inspiration:** Bloomberg Terminal, Robinhood dark mode, Linear dark

| Property | Value | Reasoning |
|----------|-------|-----------|
| Primary | `#3B82F6` (Bright blue) | Visible on dark |
| Background | `#0F172A` (Slate 900) | Premium feel |
| Accent | `#10B981` (Emerald) | Growth pops |
| Radius | `0.5rem` | Sharp, professional |
| Density | High | Data-rich feel |

**Best for:** Power users, night owls, "serious investor" vibe

```css
[data-theme="dark"] {
  --color-primary: #3B82F6;
  --color-primary-hover: #2563EB;
  --color-primary-light: #1E3A5F;
  --bg-primary: #0F172A;
  --bg-secondary: #1E293B;
  --bg-tertiary: #334155;
  --bg-card: #1E293B;
  --text-primary: #F8FAFC;
  --text-secondary: #94A3B8;
  --border-light: #334155;
  --shadow-md: 0 4px 6px rgba(0,0,0,0.4);
}
```

---

### Theme 3: Friendly & Approachable

**Inspiration:** Mint, YNAB, Up Bank

| Property | Value | Reasoning |
|----------|-------|-----------|
| Primary | `#059669` (Emerald) | Growth, money |
| Background | `#FAFAF9` (Warm white) | Soft, inviting |
| Accent | `#0EA5E9` (Sky blue) | Friendly |
| Radius | `1rem` | Rounded, soft |
| Density | Low | Breathing room |

**Best for:** First-time investors, less intimidating feel

```css
[data-theme="friendly"] {
  --color-primary: #059669;
  --color-primary-hover: #047857;
  --color-primary-light: #D1FAE5;
  --bg-primary: #FAFAF9;
  --bg-secondary: #F5F5F4;
  --bg-card: #FFFFFF;
  --text-primary: #1C1917;
  --text-secondary: #78716C;
  --radius-sm: 0.5rem;
  --radius-md: 1rem;
  --radius-lg: 1.5rem;
}
```

---

### Theme 4: Bold & Data-Rich

**Inspiration:** Trading terminals, your spreadsheet aesthetic

| Property | Value | Reasoning |
|----------|-------|-----------|
| Primary | `#1D4ED8` (Indigo) | Bold, confident |
| Background | `#F8FAFC` | Subtle contrast |
| Accent | `#DC2626` (Red) for negative | Clear signals |
| Radius | `0.25rem` | Sharp, precise |
| Density | High | Maximum data |

**Best for:** Spreadsheet power users, data-dense views

```css
[data-theme="bold"] {
  --color-primary: #1D4ED8;
  --color-primary-hover: #1E40AF;
  --color-primary-light: #DBEAFE;
  --bg-primary: #F8FAFC;
  --bg-secondary: #F1F5F9;
  --bg-card: #FFFFFF;
  --text-primary: #0F172A;
  --radius-sm: 0.125rem;
  --radius-md: 0.25rem;
  --radius-lg: 0.375rem;
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.12);
}
```

---

### Theme 5: Ocean (Trust-Focused)

**Inspiration:** Major banks, PayPal, traditional finance

| Property | Value | Reasoning |
|----------|-------|-----------|
| Primary | `#0284C7` (Sky blue) | Maximum trust |
| Background | `#FFFFFF` | Clean, bank-like |
| Accent | `#0891B2` (Cyan) | Calming |
| Radius | `0.375rem` | Conservative |
| Density | Medium | Professional |

**Best for:** Users who need "bank-level trust" feeling

```css
[data-theme="ocean"] {
  --color-primary: #0284C7;
  --color-primary-hover: #0369A1;
  --color-primary-light: #E0F2FE;
  --bg-primary: #FFFFFF;
  --bg-secondary: #F0F9FF;
  --bg-card: #FFFFFF;
  --text-primary: #0C4A6E;
  --text-secondary: #0369A1;
  --border-light: #BAE6FD;
}
```

---

### Theme 6: Forest (Growth-Focused)

**Inspiration:** Wise, Robinhood, growth-oriented fintechs

| Property | Value | Reasoning |
|----------|-------|-----------|
| Primary | `#16A34A` (Green) | Money, growth |
| Background | `#FFFFFF` | Clean contrast |
| Accent | `#22C55E` (Bright green) | Optimistic |
| Radius | `0.5rem` | Modern |
| Density | Medium | Balanced |

**Best for:** Optimistic investors focused on growth/gains

```css
[data-theme="forest"] {
  --color-primary: #16A34A;
  --color-primary-hover: #15803D;
  --color-primary-light: #DCFCE7;
  --bg-primary: #FFFFFF;
  --bg-secondary: #F0FDF4;
  --bg-card: #FFFFFF;
  --text-primary: #14532D;
  --text-secondary: #166534;
  --border-light: #BBF7D0;
}
```

---

## Recommended Default: Forest (Theme 6)

**Why:**
1. Green = money, growth, prosperity - speaks directly to investor mindset
2. Differentiates from competitors (TaxTank, Landlord Studio both use blue)
3. Wise (fintech unicorn) proved bright green works for financial trust
4. Optimistic vibe matches "your investment is working for you" message
5. Still professional with white background - not gimmicky

**A/B Test Plan:**
1. 50% of new users see "Forest" (Theme 6) - default
2. 25% see "Clean" (Theme 1) - traditional trust
3. 25% see "Dark" (Theme 2) - power user appeal
4. Track: Signup completion, 7-day retention, feature engagement

---

## Component Design Patterns

### Cards

```
┌─────────────────────────────────────┐
│ Property Name                    ↗  │
├─────────────────────────────────────┤
│                                     │
│  Value        Loan        Equity    │
│  $670,000     $522,490    $147,510  │
│  ↑ 21.8%      6.32%       ↑ $13,510 │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  Weekly Cash Flow                   │
│  -$255         ███████████░░░░      │
│                                     │
│  Who Pays     16% Tax | 62% Tenant  │
│               22% You               │
│                                     │
└─────────────────────────────────────┘
```

### Data Tables (High Density)

```
┌────────────────┬──────────┬──────────┬──────────┬─────────┐
│ Property       │ Value    │ Loan     │ LVR      │ Cash    │
├────────────────┼──────────┼──────────┼──────────┼─────────┤
│ Kirwan         │ $670,000 │ $522,490 │ 78.0%    │ -$255   │
│ Shepparton     │ $475,000 │ $405,636 │ 85.4%    │ -$227   │
│ North Bendigo  │ $550,000 │ $461,663 │ 83.9%    │ -$250   │
│ Durack         │ $635,000 │ $521,749 │ 82.2%    │ -$93    │
├────────────────┼──────────┼──────────┼──────────┼─────────┤
│ TOTAL          │ $2.97M   │ $2.36M   │ 79.5%    │ -$1,061 │
└────────────────┴──────────┴──────────┴──────────┴─────────┘
```

### Charts

- **Cash flow:** Bar chart (green positive, red negative)
- **Who Pays:** Donut chart (3 segments)
- **Value over time:** Line chart
- **Expense breakdown:** Horizontal bar chart

### Navigation

```
┌──────────────────────────────────────────────────────────┐
│  🏠 PropertyTracker              Dashboard │ Settings ⚙  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────────┐                                         │
│  │ Dashboard   │  ← Current                              │
│  │ Properties  │                                         │
│  │ Transactions│  (3 unreviewed)                         │
│  │ Banking     │                                         │
│  │ Tax         │                                         │
│  │ Reports     │                                         │
│  │ Documents   │                                         │
│  │ Reminders   │  (2 upcoming)                           │
│  └─────────────┘                                         │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## Accessibility Requirements

| Requirement | Standard | Implementation |
|-------------|----------|----------------|
| Color contrast | WCAG AA (4.5:1) | Test all theme combinations |
| Color blindness | Support deuteranopia | Never rely on red/green alone |
| Keyboard nav | Full support | All interactive elements focusable |
| Screen readers | ARIA labels | Semantic HTML + aria-label |
| Font size | Min 14px body | Configurable in settings |
| Reduced motion | Respect preference | `prefers-reduced-motion` |

---

## Implementation Stack

| Tool | Purpose |
|------|---------|
| **Tailwind CSS** | Utility classes + custom theme |
| **CSS Variables** | Runtime theme switching |
| **shadcn/ui** | Pre-built accessible components |
| **Recharts** | Charts and visualizations |
| **Lucide Icons** | Consistent iconography |

### Tailwind Config Extension

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary)',
        'primary-hover': 'var(--color-primary-hover)',
        'primary-light': 'var(--color-primary-light)',
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        danger: 'var(--color-danger)',
      },
      backgroundColor: {
        primary: 'var(--bg-primary)',
        secondary: 'var(--bg-secondary)',
        card: 'var(--bg-card)',
      },
      textColor: {
        primary: 'var(--text-primary)',
        secondary: 'var(--text-secondary)',
        muted: 'var(--text-muted)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
      },
    },
  },
};
```

---

## Landing Page Theme Showcase

When building the landing page, implement a **theme preview section**:

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Choose Your Style                                          │
│                                                             │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │  Clean  │  │  Dark   │  │Friendly │  │  Bold   │        │
│  │  ████   │  │  ████   │  │  ████   │  │  ████   │        │
│  │  ████   │  │  ████   │  │  ████   │  │  ████   │        │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘        │
│       ●            ○            ○            ○              │
│                                                             │
│  [Live preview of dashboard updates as user clicks themes]  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Document History

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2026-01-23 | 1.0 | Matthew Gleeson | Initial UI/UX design system |

---

## Sources

- [Eleken - Fintech UI Examples to Build Trust](https://www.eleken.co/blog-posts/trusted-fintech-ui-examples)
- [Inordo - Color Psychology in Fintech](https://inordo.com/shades-of-trust-how-color-psychology-influences-fintech-ui-design/)
- [Phoenix Strategy Group - Financial Dashboard Colors](https://www.phoenixstrategy.group/blog/best-color-palettes-for-financial-dashboards)
- [Billcut - Why Green Rules Fintech](https://www.billcut.com/blogs/color-psychology-in-fintech-ui-why-green-dominates/)
- [Progress - Choosing Colors for Fintech](https://www.progress.com/blogs/how-choose-right-colors-fintech)
- [Capterra - Landlord Studio](https://www.capterra.com/p/182473/Landlord-Studio/)
- [TaxTank](https://taxtank.com.au/tax-app/)
- [Stessa](https://www.stessa.com/)
