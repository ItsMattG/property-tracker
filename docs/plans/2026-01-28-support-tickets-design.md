# Enhanced Support Ticket System — Design

**Date:** 2026-01-28
**Phase:** 9.4
**Status:** Final

## Overview

Upgrade the feedback system with a full support ticket system. New `support_tickets` table with categories, urgency, enhanced status workflow, and sequential ticket IDs. Existing bug reports stay as-is.

## Data Model

**New table: `support_tickets`**
- `id` (UUID, PK)
- `userId` (UUID, FK to users)
- `ticketNumber` (serial integer, auto-increment, displayed as TICK-XXX)
- `category` (enum: bug, question, feature_request, account_issue)
- `subject` (varchar 200)
- `description` (text)
- `urgency` (enum: low, medium, high, critical)
- `status` (enum: open, in_progress, waiting_on_customer, resolved, closed)
- `browserInfo` (jsonb, optional)
- `currentPage` (varchar, optional)
- `createdAt`, `updatedAt` (timestamps)

**New table: `ticket_notes`**
- `id` (UUID, PK)
- `ticketId` (UUID, FK to support_tickets)
- `userId` (UUID, FK to users — admin or customer)
- `content` (text)
- `isInternal` (boolean, default false — admin-only notes)
- `createdAt` (timestamp)

## Status Workflow

```
open → in_progress → resolved → closed
           ↕
   waiting_on_customer
```

## API

**tRPC router: `supportTickets`**

User procedures:
- `create({ category, subject, description, urgency, browserInfo?, currentPage? })` → ticket
- `list({ status?, limit, offset })` → user's tickets
- `get({ id })` → ticket with notes (exclude internal notes)
- `addNote({ ticketId, content })` → add customer reply

Admin procedures:
- `adminList({ status?, urgency?, category?, limit, offset })` → all tickets
- `adminGet({ id })` → ticket with all notes (including internal)
- `updateStatus({ id, status })` → update status
- `addAdminNote({ ticketId, content, isInternal })` → add admin note

## UI

**User-facing:**
- `/settings/support` page listing user's tickets
- "New Ticket" modal with category, subject, description, urgency
- Ticket detail view with conversation thread and status

**Admin-facing:**
- `/settings/support-admin` page listing all tickets with filters
- Ticket detail with status controls, internal notes toggle

## Reports Hub

Add "Support Tickets" link to settings sidebar (not reports hub — this is a settings feature).

## Tech Stack

TypeScript, Vitest, tRPC, Drizzle ORM, Next.js App Router, shadcn/ui.
