# PropertyTracker → BrickTrack Rename

## Overview

Rename all user-facing brand references from "PropertyTracker" to "BrickTrack" throughout the codebase.

## Casing Convention

| Context | Old | New |
|---------|-----|-----|
| Brand/display name | PropertyTracker | BrickTrack |
| Lowercase | propertytracker | bricktrack |
| Kebab-case | property-tracker | brick-track |

## Scope

### In Scope (User-Facing)

- Landing page text, titles, descriptions
- Sidebar/header branding
- Email template headers and footers
- Blog post mentions of the brand
- Mobile app display name
- Structured data (JSON-LD) brand references
- Alt text on images
- FAQ content
- Documentation titles and references
- README.md

### Out of Scope (Technical/Service References)

- `package.json` name field (`property-tracker`)
- Vercel project URL (`propertytracker.vercel.app`)
- Bundle identifiers (`com.propertytracker.app`)
- Sentry project name
- Environment variable names
- File/folder names in the codebase
- Import paths
- Git remote URLs

## Implementation

### Text Replacements

1. `PropertyTracker` → `BrickTrack`
2. `Property Tracker` → `Brick Track` (if any exist)

### Files to Update (~100+ files)

- `/src/app/page.tsx` - Landing page
- `/src/components/landing/*.tsx` - All landing components
- `/src/components/layout/Sidebar.tsx` - App sidebar
- `/src/lib/email/templates/*.tsx` - Email templates
- `/content/blog/*.mdx` - Blog posts
- `/docs/**/*.md` - Documentation
- `/README.md` - Project readme
- `/mobile/app.json` - Mobile app display name only
- `/public/og-image.svg` - OG image text

### Skip Patterns

- `package.json` name field
- `vercel.json` URLs
- Environment variables
- Bundle identifiers
- Import paths

## Edge Cases

- OG image SVG contains embedded text - update the text element
- Mobile `app.json` has `name` (update) and `bundleIdentifier` (skip)
- Blog contextual references like "the PropertyTracker team" become "the BrickTrack team"

## Verification

1. `grep -ri "PropertyTracker"` to confirm no user-facing references remain
2. `npm run build` - no build errors
3. `npm run lint` - no lint issues
4. Visual spot-check: landing page, sidebar, email template

## Not Included

- Logo/image files with embedded "PropertyTracker" graphics (requires design work)
- Favicon or other binary assets
