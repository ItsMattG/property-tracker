# V0.3 Roadmap - Growth & Engagement Features

**Date:** 2026-01-27
**Status:** Final

## Overview

This roadmap focuses on user engagement, feedback loops, SEO/marketing, and competitive feature parity. Based on user requirements and competitive analysis of TaxTank and The Property Accountant.

---

## Phase 1: User Feedback & Communication

### 1.1 Public Feature Request Board
**Priority:** High
**Complexity:** Medium

A public-facing feature voting system where users can:
- Submit feature requests via in-app widget
- View existing requests on public board
- Upvote/downvote features
- Comment on requests
- See status updates (Planned, In Progress, Shipped)

**Implementation:**
- In-app feedback button (sidebar/header)
- Modal form: title, description, category
- Public `/feedback` or `/roadmap` page
- Vote counts, sorting by votes/recency
- Admin panel to update status
- Notification when status changes

**Database schema:**
- `feature_requests` table (id, user_id, title, description, category, status, vote_count, created_at)
- `feature_votes` table (user_id, feature_id, vote)
- `feature_comments` table (id, feature_id, user_id, content, created_at)

### 1.2 Private Bug Report System
**Priority:** High
**Complexity:** Low

Private bug reporting that goes to an internal queue:
- In-app bug report button
- Form: description, steps to reproduce, severity
- Auto-capture: browser info, current page, user ID
- Optional screenshot attachment
- Admin-only bug queue dashboard

**Implementation:**
- Separate from feature requests
- No public visibility
- Email notification to admin on submission
- Status tracking (New, Investigating, Fixed, Won't Fix)

---

## Phase 2: Changelog & What's New

### 2.1 Public Changelog Page
**Priority:** High
**Complexity:** Low

SEO-friendly changelog at `/changelog`:
- Dated entries, newest first
- Categories: New Features, Improvements, Fixes
- Markdown-based content
- Links to relevant documentation

### 2.2 In-App What's New Drawer
**Priority:** Medium
**Complexity:** Low

Slide-out panel for logged-in users:
- "What's New" button in header with notification dot
- Shows recent updates since last viewed
- Mark as read functionality
- Link to full changelog

**Implementation:**
- `changelog_entries` table (id, title, content, category, published_at)
- `user_changelog_views` table (user_id, last_viewed_at)
- Shared content powers both public page and in-app drawer

---

## Phase 3: Landing Page Overhaul

### 3.1 Social Proof Section
**Priority:** High
**Complexity:** Low

- User count / properties tracked metrics
- Testimonials (placeholder initially, real ones later)
- "As featured in" logos (ProductHunt, etc.)
- Trust badges

### 3.2 Pricing Section
**Priority:** High
**Complexity:** Low

Display existing pricing tiers:
- Free / Pro / Team comparison table
- Feature matrix
- CTA buttons for each tier
- FAQ about billing

### 3.3 Product Screenshots & Demo
**Priority:** High
**Complexity:** Low

- Dashboard screenshot hero
- Feature screenshots with descriptions
- Optional: Embedded demo video
- Interactive feature tour (future)

### 3.4 Comparison Table
**Priority:** Medium
**Complexity:** Low

"PropertyTracker vs Alternatives":
- vs Spreadsheets
- vs Property Manager fees
- vs TaxTank / The Property Accountant
- Highlight unique features

### 3.5 FAQ Section
**Priority:** Medium
**Complexity:** Low

Address common objections:
- Security & privacy
- Bank connection safety
- Data ownership
- Cancellation policy
- Australian-specific features

### 3.6 Expanded Feature Section
**Priority:** Medium
**Complexity:** Low

Full feature showcase:
- All major features with icons
- Expandable details
- Links to relevant pages

---

## Phase 4: Blog & SEO Content

### 4.1 Blog Infrastructure
**Priority:** High
**Complexity:** Medium

Simple MDX-based blog at `/blog`:
- Article list with thumbnails
- Individual article pages
- Categories/tags
- Author attribution
- SEO meta tags
- Social sharing

**Initial content targets:**
- "How to track rental property expenses in Australia"
- "Victorian rental compliance checklist 2026"
- "Property investment tax deductions guide"
- "SMSF property investment rules"
- "Negative gearing explained"

### 4.2 SEO Optimization
**Priority:** Medium
**Complexity:** Low

- Sitemap generation
- robots.txt optimization
- Schema.org structured data
- Open Graph tags
- Canonical URLs

---

## Phase 5: Email Integration (Full)

### 5.1 Gmail/Outlook Integration
**Priority:** Medium
**Complexity:** High
**Dependency:** Build after 9.1 Email Forwarding proves value

Full email integration for users who want automatic sync:
- OAuth connection to Gmail/Outlook
- Filter emails by sender (property managers, agents, lenders)
- Unified inbox view within app
- Reply from within webapp
- Smart matching to transactions/documents

**Features:**
- Email list with property association
- Compose/reply interface
- Attachment extraction
- Auto-link invoices to transactions
- Auto-extract documents to storage

**Implementation considerations:**
- Gmail API / Microsoft Graph API
- Email parsing rules
- Privacy/security review required
- Rate limiting
- Consider as v0.4+ if email forwarding (9.1) satisfies most users

---

## Phase 6: Task Management

### 6.1 Global Task List
**Priority:** Low
**Complexity:** Medium

Unified task list with property/entity filtering:
- Task CRUD (title, description, due date, priority)
- Filter by property or entity
- Status: To Do, In Progress, Done
- Optional: Kanban view toggle
- Reminders/notifications for due dates

**Use cases:**
- "Fix leaky tap at 123 Main St"
- "Review lease renewal"
- "Lodge BAS for Family Trust"
- "Get insurance quote"

---

## Phase 7: Competitive Feature Parity

Based on TaxTank analysis:

### 7.1 CoreLogic/PropTrack AVM Integration
**Priority:** High
**Complexity:** Medium

Live automated property valuations:
- Monthly AVM updates
- Capital growth tracking
- Equity position calculations
- Market comparison

**API options:**
- CoreLogic API
- PropTrack API
- Domain API

### 7.2 Guided Onboarding Flow
**Priority:** High
**Complexity:** Medium

Product tours and setup goals:
- Step-by-step onboarding wizard
- Progress tracking (Goals 0/5)
- Video tutorials at key points
- Contextual help tooltips
- Checklist: Add property, Connect bank, Categorize transactions, etc.

**TaxTank features to match:**
- Goals progress indicator
- Embedded video tutorials
- "Book consultation" option
- Invite accountant/advisor prompts

### 7.3 AI Chat Assistant
**Priority:** Medium
**Complexity:** High

In-app AI support:
- Chat widget (like Intercom but AI-powered)
- Answer common questions
- Guide users through features
- Escalate to human support
- Context-aware (knows user's properties, transactions)

**Implementation options:**
- Claude API integration
- RAG over documentation
- Action capabilities (navigate to page, explain feature)

### 7.4 Shares/Crypto Tracking (Holdings Module)
**Priority:** Low
**Complexity:** High

Expand beyond property:
- Share portfolio tracking
- ETF tracking
- Cryptocurrency tracking
- Live market values
- Dividend tracking
- Capital gains calculations across all asset classes
- Sharesight integration option

**Note:** This is a significant scope expansion. Consider as future v0.4+.

---

## Phase 8: Additional TaxTank-Inspired Features

### 8.1 Forecasted vs Actual Tax Toggle
**Priority:** Medium
**Complexity:** Medium

Dashboard toggle showing:
- Forecasted tax (based on projections)
- Actual tax (based on recorded transactions)
- Year-over-year comparison

### 8.2 MyTax Report Export
**Priority:** Medium
**Complexity:** Medium

ATO MyTax-formatted report:
- Pre-filled format matching ATO categories
- Interactive checklist
- Direct export for self-lodging

### 8.3 Referral/Rewards Program
**Priority:** Low
**Complexity:** Medium

Viral growth mechanism:
- Referral codes
- Rewards for referrer and referee
- Partner integrations (quantity surveyors, insurance, etc.)

### 8.4 Accountant/Advisor Invitation System
**Priority:** Medium
**Complexity:** Medium

Enhanced professional sharing:
- Dedicated invite flow for accountants
- Advisor role with specific permissions
- Real-time collaboration features
- Accountant dashboard view

---

## Implementation Order

| Phase | Feature | Priority | Complexity | Est. Effort |
|-------|---------|----------|------------|-------------|
| 1.1 | Public Feature Request Board | High | Medium | 3-4 days |
| 1.2 | Private Bug Report System | High | Low | 1-2 days |
| 2.1 | Public Changelog Page | High | Low | 1 day |
| 2.2 | In-App What's New Drawer | Medium | Low | 1 day |
| 3.x | Landing Page Overhaul | High | Low | 2-3 days |
| 4.1 | Blog Infrastructure | High | Medium | 2-3 days |
| 7.1 | CoreLogic/PropTrack AVM | High | Medium | 3-4 days |
| 7.2 | Guided Onboarding | High | Medium | 3-4 days |
| 5.1 | Email Integration | Medium | High | 5-7 days |
| 7.3 | AI Chat Assistant | Medium | High | 4-5 days |
| 6.1 | Global Task List | Low | Medium | 2-3 days |
| 7.4 | Shares/Crypto (Holdings) | Low | High | 7-10 days |
| 8.x | Additional Features | Low-Med | Medium | Variable |

---

## Competitive Positioning

### vs TaxTank
**Their strengths:**
- Multi-asset tracking (property + shares + crypto + work income)
- Guided onboarding with goals
- Accountant/advisor collaboration
- MyTax report export
- Partner integrations

**Our advantages:**
- Property-focused depth (compliance, climate risk, benchmarking)
- Scenario simulator
- Broker portal
- Mobile app with Detox E2E tests
- Trust/SMSF compliance tracking

**Gaps to close:**
- AVM integration (they have CoreLogic)
- Guided onboarding
- AI chat assistant
- Shares/crypto tracking (optional - stay focused?)

### vs The Property Accountant
**Their strengths:**
- ISO 27001:2022 certified
- Strong accountant/broker workflows
- Settlement statement auto-capture
- **Unique Email ID for forwarding** - Each user gets a unique email (e.g., 61421966104@email.thepa.au) to forward property emails
- **Support Tickets system** - Built-in ticketing with categories, status, urgency
- **Audit Checks** - Automated checks to catch errors and missed deductions
- **Key Expenses Comparison** - YoY comparison table (Land Tax, Council rates, Water Rates, R&M, Insurance)
- **Per-property pricing** - $3.99/property/month for residential, scales by type
- **Trusted Advisors** - Dedicated Tax Accountant and Mortgage Broker collaboration panels
- **Division 40/43 Depreciation tracking** - Separate tracking for plant/equipment vs building
- **WhatsApp support** - Quick access via WhatsApp button

**Our advantages:**
- More comprehensive feature set
- Entity-level tracking
- Benchmarking features
- Public portfolio sharing
- Scenario simulator (what-if modeling)
- Climate/flood risk integration
- Equity milestone notifications
- Vector DB similar property recommendations

---

## Phase 9: The Property Accountant-Inspired Features

### 9.1 Unique Email Forwarding Address
**Priority:** High
**Complexity:** Medium

Each user gets a unique email address to forward property-related emails:
- Format: `{user_id}@inbox.propertytracker.com.au`
- Auto-parse incoming emails
- Extract attachments as documents
- Match to properties based on address/keywords
- Create transactions from invoices

**Implementation:**
- Email receiving service (SendGrid Inbound, Mailgun, AWS SES)
- Email parsing pipeline
- Document extraction
- Property matching logic

### 9.2 Audit Checks / Data Validation
**Priority:** Medium
**Complexity:** Medium

Automated checks to catch errors and missed deductions:
- Verify loan interest matches bank records
- Flag missing expected expenses (council rates, insurance, water)
- Highlight discrepancies between bank and manual entries
- Suggest commonly missed deductions
- Property-level audit score

### 9.3 Key Expenses YoY Comparison
**Priority:** Medium
**Complexity:** Low

Dashboard widget showing year-over-year expense comparison:
- Land Tax
- Council Rates
- Water Rates
- Repair & Maintenance
- Insurance
- Strata/Body Corporate

Highlight significant changes (>10%) for review.

### 9.4 Enhanced Support Ticket System
**Priority:** Low
**Complexity:** Medium

Upgrade bug reports to full support tickets:
- Ticket ID tracking
- Categories (Bug, Question, Feature Request, Account Issue)
- Urgency levels (Low, Medium, High, Critical)
- Status workflow (Open, In Progress, Waiting on Customer, Resolved, Closed)
- Internal notes
- Email notifications on status change

---

## Updated Implementation Order

| Phase | Feature | Priority | Complexity | Est. Effort |
|-------|---------|----------|------------|-------------|
| 1.1 | Public Feature Request Board | High | Medium | 3-4 days |
| 1.2 | Private Bug Report System | High | Low | 1-2 days |
| 2.1 | Public Changelog Page | High | Low | 1 day |
| 2.2 | In-App What's New Drawer | Medium | Low | 1 day |
| 3.x | Landing Page Overhaul | High | Low | 2-3 days |
| 4.1 | Blog Infrastructure | High | Medium | 2-3 days |
| 7.1 | CoreLogic/PropTrack AVM | High | Medium | 3-4 days |
| 7.2 | Guided Onboarding | High | Medium | 3-4 days |
| **9.1** | **Unique Email Forwarding** | **High** | **Medium** | **3-4 days** |
| 5.1 | Email Integration (Gmail/Outlook) | Medium | High | 5-7 days |
| 7.3 | AI Chat Assistant | Medium | High | 4-5 days |
| 9.2 | Audit Checks | Medium | Medium | 2-3 days |
| 9.3 | Key Expenses YoY Comparison | Medium | Low | 1 day |
| 6.1 | Global Task List | Low | Medium | 2-3 days |
| 7.4 | Shares/Crypto (Holdings) | Low | High | 7-10 days |
| 8.x | Additional Features | Low-Med | Medium | Variable |
| 9.4 | Enhanced Support Tickets | Low | Medium | 2 days |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Feature requests submitted/month | >20 |
| Bug reports response time | <24h |
| Changelog views/month | >500 |
| Landing page conversion rate | >3% |
| Blog organic traffic/month | >1000 |
| Email integration adoption | >30% of Pro users |
| Onboarding completion rate | >70% |
| AI chat satisfaction | >4/5 stars |

---

## Open Questions

1. **Shares/crypto tracking** - Should we stay property-focused or expand? Expanding risks scope creep but increases TAM.

2. **Email integration privacy** - How to handle email data securely? What's the minimum viable feature set?

3. **AVM provider** - CoreLogic vs PropTrack vs Domain? Pricing comparison needed.

4. **AI assistant** - Build custom or use existing solution (Intercom AI, etc.)?

5. **Blog content** - Internal writing or hire content writers?
