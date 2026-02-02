# Trial Email Notifications Design

**Date:** 2026-02-02
**Status:** Ready for implementation

## Problem

Users who sign up for BrickTrack automatically get a 14-day Pro trial, but:
1. No welcome email is sent explaining this
2. No notification when adding multiple properties that only the first will remain active after trial ends

## Solution Overview

Implement a layered notification system:
1. **Welcome email** on signup
2. **Email** when adding 2nd property
3. **Modal** when adding 2nd property (requires acknowledgment)
4. **Toast** when adding 3rd+ properties (gentle reminder)
5. **Persistent banner** on dashboard for trial users with 2+ properties

---

## 1. Welcome Email on Signup

### Trigger
Clerk webhook `user.created` event in `/src/app/api/webhooks/clerk/route.ts`

### Implementation
- After creating the user record with trial settings, call `sendEmailNotification()` with new welcome template
- Create new template at `/src/lib/email/templates/welcome.ts`

### Email Content
```
Subject: Welcome to BrickTrack! Your 14-day Pro trial is active

Body:
- Personalized greeting (Hi {firstName}!)
- "You have full Pro access for 14 days - no credit card required"
- Trial end date displayed clearly
- Quick start section:
  1. Add your first property
  2. Connect your bank for automatic transaction import
  3. Track rental income and expenses
- Primary CTA button: "Add Your First Property" → /properties/new
- Secondary link: "Explore all Pro features" → /settings/billing
- Footer: Trial end date reminder + "Questions? Reply to this email"
```

### Technical Notes
- Reuse existing `baseTemplate()` wrapper for consistent styling
- Use Resend's `to` field with user's email from Clerk webhook payload
- No new dependencies required

---

## 2. Email on 2nd Property Added

### Trigger
Property creation mutation in `/src/server/routers/property.ts`

### Logic
After successfully creating a property, check:
1. Is user on trial? (`trialEndsAt > now` and no active subscription)
2. Is this their 2nd property? (count properties for user === 2)

If both true, send the one-time notification email.

### Email Content
```
Subject: Quick heads up about your BrickTrack properties

Body:
- "You've added your 2nd property - nice work building your portfolio!"
- Clear explanation: "Your 14-day Pro trial gives you unlimited properties.
  After it ends on {trialEndDate}, only your first property stays active."
- What happens to other properties:
  - Data is preserved (not deleted)
  - Properties become "dormant" - view-only, no new transactions
  - Upgrade anytime to reactivate all properties
- Pricing mention: "Pro is $14/month or $120/year"
- CTA button: "Upgrade to Pro" → /settings/billing
- Reassurance: "No pressure - you still have {daysRemaining} days to decide"
```

### Technical Notes
- Create template at `/src/lib/email/templates/property-limit-warning.ts`
- Only send once (when count hits exactly 2, not on 3rd, 4th, etc.)
- Check for active Stripe subscription to avoid sending to paying users

---

## 3. Modal on 2nd Property Addition

### Trigger
Property creation flow in the UI layer (client-side)

### When to Show
- User submits property creation form
- Only when: trial user + this will be property #2
- Shows before property is created (intercept submission)

### Modal Design
```
Title: "Adding your 2nd property"

Body:
"Great news - your Pro trial lets you track unlimited properties!

Just a heads up: after your trial ends on {trialEndDate},
only your first property stays active. The rest become
dormant (data preserved, just view-only).

You can upgrade anytime to keep everything active."

Buttons:
- Primary: "Got it, add property" → proceeds with creation
- Secondary: "View Pro pricing" → opens /settings/billing in new tab
```

### Technical Notes
- Create component at `/src/components/modals/TrialPropertyLimitModal.tsx`
- Use existing Dialog component from shadcn/ui
- Fetch property count + trial status before showing
- Store "has seen modal" in localStorage as backup (ensure shows only once per browser)

---

## 4. Toast on 3rd+ Property Addition

### Trigger
Property creation success (client-side)

### When to Show
- Trial user adds property #3, #4, #5, etc.
- After successful creation

### Toast Content
```
Icon: Info (ℹ️)
Message: "Reminder: Only your first property stays active after your trial"
Action link: "Upgrade" → /settings/billing
Duration: 5 seconds (dismissible)
```

### Technical Notes
- Use existing toast system (sonner)
- Trigger in property creation mutation's `onSuccess` callback
- Simple conditional: `if (isTrialUser && propertyCount > 2) showToast()`
- No persistence needed - show every time as gentle reminder

---

## 5. Persistent Dashboard Banner

### Location
Dashboard page, above main content area

### When to Show
- User is on trial (`trialEndsAt > now` and no active subscription)
- User has 2+ properties
- Not dismissed for current session

### Banner Design
```
Style: Warning/amber background (noticeable but not alarming)

Content:
"You have {propertyCount} properties on your trial. After {trialEndDate},
only your first property stays active. Upgrade to keep them all."

Button: "Upgrade to Pro" → /settings/billing
Dismiss: "×" (dismisses for session, reappears next visit)
```

### Technical Notes
- Create component at `/src/components/banners/TrialPropertyLimitBanner.tsx`
- Fetch data via existing tRPC queries (subscription status + property count)
- Place in dashboard layout, conditionally rendered
- Session-based dismiss using `sessionStorage`

---

## File Changes Summary

### New Files
| File | Purpose |
|------|---------|
| `/src/lib/email/templates/welcome.ts` | Welcome email template |
| `/src/lib/email/templates/property-limit-warning.ts` | 2nd property email template |
| `/src/components/modals/TrialPropertyLimitModal.tsx` | Modal component |
| `/src/components/banners/TrialPropertyLimitBanner.tsx` | Dashboard banner |

### Modified Files
| File | Change |
|------|--------|
| `/src/app/api/webhooks/clerk/route.ts` | Add welcome email send after user creation |
| `/src/server/routers/property.ts` | Add 2nd property email logic |
| Property creation form/page | Add modal trigger and toast logic |
| Dashboard layout | Add banner component |

### No Database Changes Required
All needed data already exists:
- User trial status (`trialEndsAt`, `trialStartedAt` in users table)
- Property count (query properties table)
- Subscription status (subscriptions table)

---

## Implementation Order

1. **Welcome email** - Standalone, can be done first
2. **Email templates** - Create both email templates
3. **Dashboard banner** - Independent of property flow
4. **Modal + Toast** - Property creation flow changes (do together)
5. **Testing** - End-to-end flow verification

---

## Success Criteria

- [ ] New users receive welcome email within seconds of signup
- [ ] Users adding 2nd property see modal and receive email
- [ ] Users adding 3rd+ property see toast notification
- [ ] Dashboard shows banner for trial users with 2+ properties
- [ ] No notifications sent to users with active paid subscriptions
- [ ] All emails render correctly and links work
