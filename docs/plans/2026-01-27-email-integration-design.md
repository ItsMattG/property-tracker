# Email Integration Design — Property Email Forwarding

## Overview

Add per-property email forwarding addresses so users can forward property-related emails into PropertyTracker. Emails are stored, attachments extracted to document storage, invoices matched to transactions, and users notified.

This is the first phase of email integration. A future phase may add full Gmail/Outlook OAuth for direct inbox access.

## Architecture

### Email Flow

1. Each property gets a unique forwarding address: `prop_{token}@inbox.propertytracker.com.au`
2. User configures email forwarding rules in their email client (Gmail/Outlook/etc.)
3. SendGrid receives emails via MX record on `inbox.propertytracker.com.au`
4. SendGrid POSTs parsed email data to `POST /api/webhooks/inbound-email`
5. Webhook handler:
   - Validates request authenticity
   - Resolves forwarding address → property
   - Checks sender against approved sender allowlist
   - Stores email in `property_emails` table
   - Returns 200 immediately
6. Background processing via `waitUntil()`:
   - Extracts attachments → uploads to Supabase storage
   - Scans for dollar amounts → matches against unmatched transactions
   - Sends notification to property owner

### Infrastructure

- **Inbound email provider:** SendGrid Inbound Parse
- **DNS:** MX record on `inbox.propertytracker.com.au` pointing to SendGrid
- **Webhook:** `POST /api/webhooks/inbound-email` (Next.js API route)
- **Async processing:** Vercel `waitUntil()` for background attachment/matching work
- **Storage:** Supabase for attachment files

## Database Schema

### New enum: `email_status`

```
quarantined | approved | rejected
```

### New table: `property_emails`

| Column | Type | Notes |
|--------|------|-------|
| id | serial | PK |
| property_id | int | FK → properties, NOT NULL |
| user_id | text | FK → users (property owner), NOT NULL |
| from_address | text | Sender email, NOT NULL |
| from_name | text | Sender display name |
| subject | text | NOT NULL |
| body_text | text | Plain text body |
| body_html | text | HTML body (nullable) |
| message_id | text | RFC 822 Message-ID header (nullable) |
| in_reply_to | text | Parent message's Message-ID (nullable) |
| thread_id | text | First message_id in thread chain (nullable) |
| status | email_status | Default 'approved' (quarantined if sender unknown) |
| is_read | boolean | Default false |
| received_at | timestamp | When SendGrid received it, NOT NULL |
| created_at | timestamp | Default now(), NOT NULL |

Indexes: `(property_id, received_at DESC)`, `(user_id, is_read)`, `(message_id)` unique, `(thread_id)`

### New table: `property_email_attachments`

| Column | Type | Notes |
|--------|------|-------|
| id | serial | PK |
| email_id | int | FK → property_emails, NOT NULL |
| filename | text | Original filename, NOT NULL |
| content_type | text | MIME type, NOT NULL |
| size_bytes | int | NOT NULL |
| storage_path | text | Supabase storage path, NOT NULL |
| document_id | int | FK → documents (nullable, linked after extraction) |
| created_at | timestamp | Default now(), NOT NULL |

### New table: `property_email_invoice_matches`

| Column | Type | Notes |
|--------|------|-------|
| id | serial | PK |
| email_id | int | FK → property_emails, NOT NULL |
| transaction_id | int | FK → transactions, NOT NULL |
| confidence | real | 0-1 match confidence, NOT NULL |
| amount_detected | numeric | Amount found in email/attachment, NOT NULL |
| status | text | 'pending' / 'accepted' / 'rejected', default 'pending' |
| created_at | timestamp | Default now(), NOT NULL |

### New table: `property_email_senders`

| Column | Type | Notes |
|--------|------|-------|
| id | serial | PK |
| property_id | int | FK → properties, NOT NULL |
| email_pattern | text | e.g. `agent@raywhite.com` or `*@propertyme.com.au`, NOT NULL |
| label | text | User-friendly name, e.g. "Ray White - Smith St" |
| created_at | timestamp | Default now(), NOT NULL |

Unique: `(property_id, email_pattern)`

### Modify `properties` table

Add column:
- `forwarding_address` text, UNIQUE — random token (nanoid, 12 chars). Generated on property creation.

## API Design

### Webhook

**`POST /api/webhooks/inbound-email`**
- Receives multipart/form-data from SendGrid Inbound Parse
- Validates via basic auth header (username/password configured in SendGrid)
- Parses `to` address → extracts token → looks up property
- Checks sender against `property_email_senders` for that property
  - If match → status = 'approved', process normally
  - If no match → status = 'quarantined', notify user for approval
- Deduplicates by `message_id` header
- Creates `property_emails` record
- Uses `waitUntil()` for async processing
- Returns 200 always (to prevent SendGrid retries)

### tRPC Routes (new `emailRouter`)

| Procedure | Type | Auth | Description |
|-----------|------|------|-------------|
| `list` | query | protected | List emails for a property or all properties, paginated, with thread grouping |
| `get` | query | protected | Get single email with attachments and invoice matches |
| `markRead` | mutation | protected | Mark email(s) as read |
| `markUnread` | mutation | protected | Mark email(s) as unread |
| `getUnreadCount` | query | protected | Unread count per property or global |
| `getForwardingAddress` | query | protected | Get forwarding address for a property |
| `regenerateForwardingAddress` | mutation | protected | Generate new address (invalidates old) |
| `approveSender` | mutation | protected | Approve a quarantined email's sender (adds to allowlist + approves email) |
| `rejectEmail` | mutation | protected | Reject a quarantined email |
| `listSenders` | query | protected | List approved senders for a property |
| `addSender` | mutation | protected | Add sender to allowlist |
| `removeSender` | mutation | protected | Remove sender from allowlist |
| `acceptMatch` | mutation | protected | Accept an invoice-to-transaction match |
| `rejectMatch` | mutation | protected | Reject an invoice-to-transaction match |

## UI Design

### New Pages

**1. Global Inbox — `/dashboard/emails`**
- Sidebar nav entry: "Emails" with unread badge
- Shows all emails across all properties
- Filter by property (dropdown)
- Filter by status: All / Unread / Quarantined
- Email list: sender, subject, property name, date, read/unread indicator
- Threads grouped together (expandable)
- Click email → inline expansion or navigate to detail

**2. Property Email Tab — `/dashboard/properties/[id]/emails`**
- New tab on property detail page
- Same email list view but scoped to one property
- Unread count badge on tab

**3. Email Detail View — `/dashboard/properties/[id]/emails/[emailId]`**
- Full email: from, subject, date, body (sanitized HTML or plain text)
- Attachments: download links + "Save to Documents" button
- Invoice match suggestions: detected amount, matched transaction, accept/reject
- Thread: previous messages shown below
- Quarantined emails: "Approve Sender" / "Reject" action bar

**4. Forwarding Setup — within property email tab (empty state) or property settings**
- Shows forwarding address with copy button
- Setup instructions for Gmail and Outlook
- "Manage Approved Senders" section
- "Regenerate Address" button with confirmation

### Dashboard Integration

- Unread email count badge on property cards in portfolio view
- Notification bell shows new email notifications
- Sidebar "Emails" link with global unread count

## Async Processing Pipeline

### Step 1: Attachment Extraction

For each attachment in the SendGrid payload:
1. Validate: skip if > 10MB
2. Upload to Supabase storage: `documents/{userId}/{propertyId}/emails/{emailId}/{filename}`
3. Create `property_email_attachments` record
4. Create `documents` record (links to property's Documents tab)

### Step 2: Invoice Matching

1. Scan email subject + body for dollar amounts: regex `\$[\d,]+\.?\d*`
2. For each detected amount:
   - Query recent unmatched transactions for the property (last 90 days, +/- 20% amount)
   - Score matches:
     - Exact amount + date within 7 days = 0.9
     - Exact amount only = 0.7
     - Close amount (+/- 20%) = 0.4
3. Create `property_email_invoice_matches` for matches with confidence >= 0.5

### Step 3: Notification

Use existing notification service:
- In-app: "New email from {sender} about {property name}"
- Push notification (if enabled)
- Quarantined emails: "Email from {sender} needs approval for {property name}"
- Respects user notification preferences and quiet hours

## Security

- **Webhook auth:** Basic auth header verified against env var `SENDGRID_INBOUND_SECRET`
- **Forwarding tokens:** 12-char nanoid (URL-safe), not sequential — prevents enumeration
- **HTML sanitization:** DOMPurify on email HTML body before rendering
- **Attachment limits:** Max 10MB per attachment, 25MB per email (SendGrid limit)
- **Rate limiting:** 100 emails/hour per property, drop excess with logging
- **Deduplication:** Skip emails with duplicate `message_id`
- **Authorization:** All tRPC routes verify user owns the property

## Edge Cases

- **Unknown forwarding address:** Drop silently, return 200
- **Deleted property:** Drop silently, return 200
- **Unknown sender:** Quarantine email, notify user for approval
- **Duplicate email:** Skip if `message_id` already exists
- **No body:** Store with empty body, still extract attachments
- **Thread detection:** If `in_reply_to` matches existing `message_id`, inherit `thread_id`; otherwise use own `message_id`
- **Oversized attachments:** Skip with note in email detail UI

## Testing

### E2E Tests
- Webhook receives valid email → stored in DB, appears in inbox
- Webhook with unknown address → returns 200, not stored
- Quarantined email → shows approval UI, approve adds sender
- Attachment extraction → visible in email detail and Documents tab
- Invoice matching → suggestion appears, accept/reject works
- Forwarding address copy + regenerate
- Global inbox filters by property
- Thread grouping

### Unit Tests
- Sender pattern matching (exact, wildcard)
- Amount extraction regex
- Invoice matching confidence scoring
- Thread ID computation
- Forwarding token generation

## Dependencies

- `@sendgrid/mail` or raw webhook (no SDK needed for inbound)
- `nanoid` — forwarding address token generation
- `dompurify` + `jsdom` — HTML sanitization
- Existing: Drizzle, tRPC, Supabase storage, notification service

## Environment Variables

- `SENDGRID_INBOUND_SECRET` — webhook auth secret
- MX record: `inbox.propertytracker.com.au` → SendGrid inbound parse servers
