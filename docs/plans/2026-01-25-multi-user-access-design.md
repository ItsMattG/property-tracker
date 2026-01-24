# Multi-user Access Design

**Date:** 2026-01-25
**Status:** Approved

## Overview

Role-based access control allowing portfolio owners to invite partners and accountants to view and manage their property portfolio. Access is at the portfolio level (all properties shared). All users authenticate via Clerk.

---

## Data Model

```sql
portfolioMemberRoleEnum = pgEnum("portfolio_member_role", ["owner", "partner", "accountant"])

portfolioMembers
- id (uuid, pk)
- ownerId (uuid, fk → users) - the portfolio owner
- userId (uuid, fk → users) - the member
- role (portfolio_member_role enum)
- invitedBy (uuid, fk → users)
- invitedAt (timestamp)
- joinedAt (timestamp, nullable) - null until accepted
- unique constraint on (ownerId, userId)

inviteStatusEnum = pgEnum("invite_status", ["pending", "accepted", "declined", "expired"])

portfolioInvites
- id (uuid, pk)
- ownerId (uuid, fk → users)
- email (text) - invited email
- role (portfolio_member_role)
- status (invite_status)
- token (text, unique) - for accept link
- invitedBy (uuid, fk → users)
- expiresAt (timestamp) - 7 days default
- createdAt

auditActionEnum = pgEnum("audit_action", ["member_invited", "member_removed", "role_changed", "invite_accepted", "invite_declined", "bank_connected", "bank_disconnected"])

auditLog
- id (uuid, pk)
- ownerId (uuid, fk → users) - portfolio owner
- actorId (uuid, fk → users) - who performed action
- action (audit_action)
- targetEmail (text, nullable) - for invite actions
- metadata (jsonb) - additional context
- createdAt
```

---

## Role Permissions

| Action | Owner | Partner | Accountant |
|--------|-------|---------|------------|
| View properties, transactions, loans | ✓ | ✓ | ✓ |
| View reports, CGT, documents | ✓ | ✓ | ✓ |
| View valuations, forecasts, anomalies | ✓ | ✓ | ✓ |
| Create/edit transactions | ✓ | ✓ | ✗ |
| Create/edit properties, loans | ✓ | ✓ | ✗ |
| Manage recurring rules | ✓ | ✓ | ✗ |
| Upload documents | ✓ | ✓ | ✓ |
| Connect/disconnect banks | ✓ | ✓ | ✗ |
| Invite/remove members | ✓ | ✗ | ✗ |
| Change member roles | ✓ | ✗ | ✗ |
| View audit log | ✓ | ✓ | ✗ |
| Delete portfolio data | ✓ | ✗ | ✗ |

---

## Access Control Implementation

**Portfolio Context Helper**

```typescript
interface PortfolioContext {
  ownerId: string;      // whose portfolio we're viewing
  role: "owner" | "partner" | "accountant";
  canWrite: boolean;    // owner or partner
  canManageMembers: boolean;  // owner only
  canManageBanks: boolean;    // owner or partner
  canViewAuditLog: boolean;   // owner or partner
}

function getPortfolioContext(userId: string, portfolioOwnerId?: string): PortfolioContext
```

- All existing queries change from `userId = currentUser` to `ownerId = portfolioOwnerId`
- Mutations check `canWrite` before allowing changes
- Member management checks `canManageMembers`
- Bank operations check `canManageBanks`

**Portfolio Switching**

- Users who are members of multiple portfolios see a portfolio switcher
- Current portfolio stored in cookie
- Default to own portfolio if user is also an owner

---

## Invitation Flow

**Sending an Invite**

1. Owner goes to `/settings/team`
2. Clicks "Invite Member", enters email and selects role
3. System creates `portfolioInvites` record with unique token
4. Email sent via Resend: "You've been invited to view [Owner Name]'s portfolio"
5. Link in email: `/invite/accept?token=xxx`
6. Invite expires after 7 days

**Accepting an Invite**

1. Recipient clicks link in email
2. If not logged in → redirect to Clerk sign-up/login, then back to accept page
3. Accept page shows: inviter name, role being granted, accept/decline buttons
4. On accept: create `portfolioMembers` record, update invite status, log to audit
5. Redirect to the shared portfolio dashboard

**Edge Cases**

- Email already a member → show error "Already a member of this portfolio"
- Invite expired → show error with "Request new invite" message
- User declines → update status, no member record created
- Owner can cancel pending invites from settings
- Owner can resend expired invites (creates new token, resets expiry)

---

## UI Design

### Team Settings Page (`/settings/team`)

- Header: "Team Members" with "Invite Member" button
- Member list showing:
  - Name, email, role badge (Owner/Partner/Accountant)
  - Joined date
  - Actions: Change role (dropdown), Remove (with confirmation)
- Pending invites section:
  - Email, role, sent date, expires date
  - Actions: Resend, Cancel
- Owner cannot remove themselves or change their own role

### Portfolio Switcher (Sidebar)

- Only visible if user belongs to multiple portfolios
- Dropdown showing: "My Portfolio" + list of portfolios they're members of
- Each item shows: Owner name, role badge
- Selecting switches context, refreshes page data

### Audit Log (`/settings/audit-log`)

- Visible to owners and partners only
- Table: Date, Actor, Action, Details
- Filter by action type
- Last 90 days, paginated

### Role Indicator

- When viewing someone else's portfolio, show banner: "Viewing [Owner]'s portfolio as [Role]"
- Subtle indicator in sidebar showing current portfolio context

---

## File Changes

### New Files

| File | Purpose |
|------|---------|
| `/src/server/db/schema.ts` | Add 3 tables + 3 enums |
| `/src/server/routers/team.ts` | Invite, list, remove, change role endpoints |
| `/src/server/services/portfolio-access.ts` | getPortfolioContext helper, permission checks |
| `/src/lib/email/templates/invite.ts` | Invitation email template |
| `/src/app/(dashboard)/settings/team/page.tsx` | Team management page |
| `/src/app/(dashboard)/settings/audit-log/page.tsx` | Audit log page |
| `/src/app/invite/accept/page.tsx` | Accept invite page (outside dashboard) |
| `/src/components/layout/PortfolioSwitcher.tsx` | Sidebar portfolio dropdown |
| `/src/components/team/InviteMemberModal.tsx` | Invite form modal |
| `/src/components/team/MemberList.tsx` | Team member list |

### Modified Files

| File | Change |
|------|--------|
| `/src/server/routers/_app.ts` | Register team router |
| `/src/server/trpc.ts` | Add portfolio context to all procedures |
| `/src/server/routers/*.ts` | Update all routers to use ownerId instead of userId |
| `/src/components/layout/Sidebar.tsx` | Add PortfolioSwitcher, role banner |
| `/src/app/(dashboard)/layout.tsx` | Fetch portfolio context, pass to children |

---

## Migration Strategy

- Existing users automatically become "owner" of their own portfolio
- All existing data remains tied to userId (which becomes ownerId in queries)
- No data migration needed - just query logic changes

---

## Future Enhancements

- Per-property access control
- Custom roles with granular permissions
- Team activity feed
- Billing/subscription management for owners
