# TaxTank/PropertyTank — Bank Reconciliation Flow Analysis

## Overview
TaxTank uses a multi-step flow: **Connect Bank → Allocate Accounts → Reconcile Transactions**. This creates a clear pipeline from raw bank data to categorised, property-linked transactions.

---

## 1. Bank Connection

When you connect a bank (e.g. ING), you select which accounts within that bank to import. A bank may have multiple accounts (e.g. savings, offset, everyday) — you don't have to connect all of them upfront.

**Key detail:** You can reconnect later to add more accounts from the same bank without re-authenticating the entire connection.

---

## 2. Account Allocation (Settings)

After connecting, you go to **Settings** to manage account allocation. For each connected bank account, you choose:

| Setting | Options |
|---------|---------|
| **Account type** | Personal or Property |
| **Property assignment** | Which property this account belongs to (if property type) |
| **Import date range** | Control how far back to import data |
| **Reconnect** | Add more accounts from the same bank |

This is a one-time setup per account — once allocated, transactions flow automatically into the right property context.

---

## 3. Bank Feeds View — Detailed UI Breakdown

The Bank Feeds page is the primary hub for managing connected banks and unreconciled transactions.

### Page Layout (top to bottom)

**Header:** "Bank Feeds" — simple page title

**Total Account Overview Card:**
- Left column — summary stats:
  - Total loans: $0.00
  - Total cash in bank: $243.95
  - Total cash in: $0.00
  - Total cash out: -$11.00 (with +100% change indicator in green)
- Right side — bar chart visualisation showing account balances
  - Toggle between pie chart and bar chart (two small icons top-right of chart)
  - X-axis labels show account names (e.g. "ING AUSTRALIA ORANGE EVERYDAY")

**Filter Tabs Row:**
- Three pill-style tabs: "All Tanks" (active/filled blue), "Personal" (outline), "Property" (outline)
- Right side: toggle "Display Active Bank Accounts only" with settings gear icon
- "All Tanks" = show everything; "Personal" / "Property" filter by account type

**"+ Add Bank" Button:**
- Blue filled button, top-right of the bank cards section
- Initiates the bank connection flow

### Connected Bank Cards

Each connected bank shows as a **horizontal card** with:
- **Bank logo** (actual institution logo, e.g. ING orange lion, Westpac red W)
- **Account count**: "1 account(s)" or "+ Accounts" link (for newly connected banks needing setup)
- **Bank name**: "ING Direct: Profile 1" / "Westpac: Profile 1"
- **Three-dot menu** (kebab icon) — likely for disconnect/settings

Multiple banks appear **side by side horizontally** as separate cards.

### Account Details Popup (on clicking a bank card)

When clicking a bank card (e.g. Westpac with "+ Accounts"), a **modal dialog** appears:

**Modal header:** Bank logo + full bank name in blue (e.g. "Westpac Banking Corporation")

**Import date range:**
- Two date pickers side by side:
  - "Import transactions from" — e.g. 01/07/2024 (start of financial year)
  - "Import transactions to" — e.g. 09/02/2026 (today)

**Account listing table:**
- Each account row shows:
  - **Checkbox** (to select for import)
  - **Account name** in blue link text (e.g. "Westpac Choice")
  - **Account number** below name (e.g. 733695548678)
  - **Balance** column (e.g. $1,752.70)
  - **Type** column (e.g. "Transaction Accounts")
  - **Tank type** dropdown — "Select Tank Type" (Personal or Property assignment)

**Tank Type dropdown flow:**
- Default state: "Select Tank Type" placeholder
- Options: **Personal** or **Property**
- Selecting **Personal**: no further configuration needed
- Selecting **Property**: expands a property allocation section below the account row

**Property allocation (when Tank type = Property):**
- Shows "Property 1" section with:
  - **"Select property" dropdown** — lists all user's properties (e.g. "10 Smith Street", "123 A'BECKETT STREET")
  - **"Percent*" field** — required, defaults to 100
  - **X button** to remove this property allocation
- **"+ Add property" link** at the bottom — adds another property row ("Property 2", "Property 3", etc.)
- Each additional property row has its own property dropdown + percent field + X to remove
- Percentages must total 100% across all property allocations
- Validation: "Field is required" shown in red under empty property dropdowns
- **Use case:** A single bank account (e.g. offset account) serving multiple properties can have transactions split proportionally (e.g. 60% Property A, 40% Property B)

**"Manage accounts" — Reconnect flow:**
- Clicking "Manage accounts" in the modal footer triggers a **confirmation dialog**:
  - Text: "Reconnect your bank to select more accounts to share with TaxTank"
  - Two buttons: "Cancel" (outlined) and "Confirm" (blue filled)
- On confirm: redirects to the bank's OAuth/CDR flow to re-authenticate and select additional accounts
- This allows adding more accounts from the same bank without creating a new connection

**Modal footer buttons:**
- "Manage accounts" (text link, left) — triggers reconnect flow above
- "Back" (outlined button)
- "Submit" (blue filled button)

### Account Cards (below bank cards)

**Search bar:** Full-width search input with magnifying glass icon

Each allocated account shows as a **larger card** with:
- **Bank logo** (matching the institution)
- **Account type badge**: "Property" label at top
- **Account name** in blue: "ING Australia Orange Everyday"
- **Institution**: "ING Bank (Australia)..."
- **Masked account number**: xxxx6523
- **Three-dot menu** (kebab) for per-account actions

**Balance comparison section** within the card:
- Two columns side by side:
  - "Bank balance": $248.39 (what the bank says)
  - "TaxTank balance": $243.95 (what's been reconciled)
- The difference ($4.44) represents unreconciled items

**Reconcile CTA:**
- Large blue filled button: "Reconcile 337 Items"
- Count shows number of unreconciled transactions

**Property link:**
- Blue text link below the button: "10 Smith Street"
- Shows which property this account is allocated to

### Key UX Observations

1. **Two-level hierarchy**: Banks → Accounts. Click a bank to see/manage its accounts, then accounts show individually with reconciliation status
2. **Balance discrepancy is front-and-center**: Showing both bank balance and TaxTank balance makes it immediately obvious when reconciliation is needed
3. **The reconcile button is the primary CTA**: Large, prominent, with item count — drives users to take action
4. **Property attribution visible on card**: You can see at a glance which property each account feeds into
5. **Date range control at the bank level**: Import window is set per-bank connection, not per-account
6. **Tank type = property allocation**: The "Select Tank Type" dropdown in the modal is where you assign an account as Personal or Property (and presumably pick which property)

---

## 4. Account Reconciliation Page — Full UI Breakdown

Clicking "Reconcile X Items" on a bank account card opens the **per-account reconciliation page**. This is the core workspace where users process imported transactions.

### Page Structure (top to bottom)

**Account Switcher Tabs (top bar):**
- Horizontal pill tabs for each connected account: "ING Australia Orange Everyday" (active/blue fill), "Westpac Choice" (outline)
- Clicking a tab switches to that account's reconciliation view
- Active tab is highlighted with blue background + white text

**Account Header:**
- Account name in blue: "ING Australia Orange Everyday"
- Masked account number below: "XXXX6523"
- Institution with logo: ING logo + "ING Bank (Australia) Limited (trading as ING Direct)"

**Balance Summary Card:**
- Three key figures side by side:
  - **TaxTank balance**: $243.95 (sum of reconciled transactions)
  - **Current bank balance**: $476.81 (from bank feed)
  - **Monthly move**: $0.00 (net movement this month)
- Below those, two more:
  - **Cash In**: $0.00
  - **Cash Out**: $0.00
- Right side: **Cash flow chart** showing monthly bars
  - Toggle between bar chart and line chart (two small icons top-right)
  - X-axis: months (JUL, AUG, SEP... through JUN — financial year)
  - Visualises cash in/out over time for this account

**Three-tab navigation:**
| Tab | Purpose |
|-----|---------|
| **Reconcile** (active, blue text) | Unreconciled transactions — the work queue |
| **Account Transactions** | Already reconciled/allocated transactions |
| **Bank Rules** | Manage auto-categorisation rules for this account |

"Add Budget" button sits right-aligned next to the tabs.

---

### Reconcile Tab — Transaction Table

**Header row:**
- "Transactions" title in blue
- "Last update 28.06.25" timestamp
- **Import** button (upload icon) — manual transaction import
- **Download** button (download icon) — CSV export
- **?** help button

**Search & filter bar:**
- Checkbox (select all)
- Full-width text search: "Search Transaction"
- Date range: "Search From" date picker + "Search To" date picker

**Table columns:**

| Column | Detail | Sortable | Filterable |
|--------|--------|----------|------------|
| **Checkbox** | Row selection for bulk actions | No | No |
| **Date** | Format: DD.MM.YY (e.g. "01.07.24"). Sort arrows (ascending/descending) | Yes | No |
| **Description** | **Truncated with ellipsis** (e.g. "Origin Energy Ho Direct Debit - Recei..."). Small tooltip/info icon next to text — **hover shows full description** in tooltip. Has filter icon (funnel) + sort arrows | Yes | Yes |
| **Amount** | Shows **"$0.00 of -$38.73 allocated"** format. Green `$0.00` = amount allocated so far. Second amount = total transaction amount (negative = debit, positive = credit). "allocated" label. This makes it immediately clear what's been processed vs what's pending | Yes | No |
| **Rules** | "**+ Create rule**" button per row — creates auto-categorisation rule based on this transaction's description pattern | No | No |
| **Notes** | Chat bubble icon. Shows **badge with count** when notes exist (e.g. blue "1" badge). Click opens Discussion Notes modal | No | Yes (sort arrows) |
| **Actions** | Three inline text links: **"Allocate"** \| **"Transfer"** \| **"More ▼"** dropdown | No | No |

---

### Discussion Notes Modal (per transaction)

Clicking the Notes chat bubble icon opens a modal:

**Header:** "Discussion Notes" in blue
**Subtitle:** "Reply to your accountants note or add your own to clarify this bank transaction"

**Note thread:**
- Each note shows:
  - User **avatar** (circular, grey placeholder if no photo)
  - **Author name**: "John Smith"
  - **Note content**: free text
  - **Date**: "Feb 9, 2026"
  - **Edit** (pencil icon) and **Delete** (trash icon) buttons per note — only for your own notes
- Notes are displayed in chronological order

**New note input:**
- "New Note*" label (required field)
- Multi-line textarea
- **Cancel** button (outlined) and **Save** button (blue filled)

**Key design insight:** This is a **threaded discussion system**, not a single notes field. Multiple users (property owner + accountant + other team members) can have a conversation about a specific transaction. This is designed for **accountant collaboration** — the accountant can flag a transaction with a question, the owner replies, etc.

---

### Allocation Popup (per transaction)

Clicking "Allocate" on a transaction row opens an **inline popup/panel** (not a full modal, appears to expand below or float near the row):

**Account type icons (top row):**
- Five circular icons representing allocation targets:
  - Person icon (personal)
  - Dollar/property icon (property) — highlighted orange when selected
  - Building icon (possibly body corporate / strata)
  - Shopping cart icon (possibly business expense)
  - Document icon (possibly other/misc)
- These determine the type of allocation

**Attachment link:** Top-right corner — "Attachment" with paperclip icon. Opens file upload for receipt/document attachment to this transaction. Uploaded attachments appear in the **Spare Tank → Receipts** list (see section 4b below).

**Allocation form:**
| Field | Detail |
|-------|--------|
| **Property** | Dropdown selector. Shows all user's properties (e.g. "10 Smith Street" with checkmark for selected, "123 A'BECKETT STREET"). Required field |
| **Claim percent** | Text input. What percentage of this transaction to claim as deductible. Useful for mixed-use expenses (e.g. home office internet — claim 30%) |
| **Category** | Dropdown: "Select category" — expense categories (interest, repairs, insurance, etc.) |

**Action buttons:**
- **"Allocate"** — confirms the allocation with current settings
- **"Split"** — opens split mode to divide the transaction across multiple properties/categories (similar to account-level property split — add multiple rows with property + percent + category)

**Key design insight:** The claim percent field is important for Australian tax — many expenses are only partially deductible (e.g. if a property was rented for 9 months, you claim 75% of annual expenses). This is separate from the property split.

---

### Transfer Action (per transaction)

Clicking "Transfer" on a transaction moves it to a different bank account. Use cases:
- Transaction imported to wrong account
- Inter-account transfer matching (avoid double-counting)
- Reclassifying which account "owns" a transaction

---

### "More" Dropdown (per transaction)

The "More ▼" dropdown likely contains additional actions:
- Edit transaction details
- Delete/exclude transaction
- Mark as personal (skip reconciliation)
- View original bank data

---

### Post-reconciliation

Once a transaction is allocated (property + category assigned), it moves from the **Reconcile** tab into the **Account Transactions** tab. The reconcile count decreases. The allocated amount updates from "$0.00 of -$38.73" to "$38.73 of $38.73 allocated" (fully allocated).

### Bank Rules Tab

Separate tab for managing auto-categorisation rules:
- List of created rules
- Each rule maps a description pattern → property + category + claim percent
- Rules auto-apply to future transactions matching the pattern
- "Create rule" from the transaction table pre-fills the description pattern

---

### Key UX Observations from Reconciliation Page

1. **"$0.00 of -$38.73 allocated" is brilliant** — instantly shows allocation progress per transaction without needing to click into it
2. **Inline actions, not navigation** — Allocate/Notes/Rules all open as popups/modals within the same page. User never leaves the reconciliation workspace
3. **Discussion Notes enable accountant collaboration** — this is a key differentiator from a simple "notes" text field. It's a mini chat per transaction
4. **Claim percent is separate from category** — handles Australian tax partial deductibility elegantly
5. **Account tabs at top** — quick switching between accounts without going back to bank feeds overview
6. **Three-tab structure** (Reconcile / Account Transactions / Bank Rules) keeps everything for one account in one place
7. **Create Rule is inline** — one click from seeing a transaction to creating a rule for all future similar transactions
8. **Attachment per transaction** — receipt/document trail at the individual transaction level

---

## 4b. Spare Tank — Receipts List

Transaction attachments uploaded via the allocation popup's "Attachment" link surface in the **Spare Tank** section under the **Receipts** tab. This provides a centralised view of all receipt documentation across all transactions.

### Spare Tank Page Layout

**Page title:** "Spare Tank"

**Three-tab navigation:**
| Tab | Purpose |
|-----|---------|
| **Documents** | General document storage |
| **Receipts** (active, blue fill) | Transaction receipt attachments — auto-populated from allocation attachments |
| **Properties** | Property-related documents |

### Receipts Table

**Search bar:** Full-width search input with magnifying glass icon

**Table columns:**

| Column | Detail |
|--------|--------|
| **File icon** | Document icon indicating file type |
| **File Name** | Truncated filename with ellipsis (e.g. "hendrik-cornelissen--qrcOR33ErA-unspla...") |
| **Uploaded Date** | Format: DD.MM.YY (e.g. "01.07.24") |
| **Tank** | Icon badge showing which "tank" the receipt belongs to (property icon = property tank, dollar icon = spare) |
| **Category** | The expense category from the transaction allocation (e.g. "Interest on loan(s)") |
| **Properties** | Which property the receipt is linked to (e.g. "123 A'BECKETT STREET") |
| **Amount** | The transaction amount (e.g. "-$40.00") |
| **View** | Eye icon — preview the receipt |
| **Download** | Download icon — download the file |

**Pagination:**
- "Items per page" dropdown (default 50)
- Page navigation: first, prev, next, last buttons
- Shows "1–1 of 1" count

### Key Design Insights

1. **Receipts are auto-linked** — uploading an attachment during transaction allocation automatically populates the Spare Tank receipts list with the transaction's metadata (category, property, amount)
2. **Centralised receipt management** — users don't have to remember which transaction has which receipt. All receipts are browsable from one place
3. **Tax-ready documentation** — the receipts list essentially builds an audit trail: every deductible expense can have a receipt attached, searchable by property and category
4. **Separate from Documents** — general documents (e.g. contracts, valuations) live in the Documents tab; receipts specifically for transaction evidence live in Receipts

---

## 4c. Bank Connection Notifications

TaxTank sends in-app notifications at key stages of the bank connection and transaction import pipeline.

### Notification Types (bank-related)

| Notification | When triggered |
|-------------|----------------|
| **"Bank accounts are ready to select"** | After connecting a bank via CDR/OAuth — accounts have been fetched and the user can now choose which to import |
| **"Transactions for the selected accounts have been uploaded"** | After selecting accounts and submitting — transaction data has been pulled from the bank and is ready for reconciliation |

### Notification UI — Two Views

**1. Dropdown preview (bell icon in header):**
- Bell icon in the top-right nav bar (with red badge count when unread)
- Clicking opens a **dropdown panel** showing recent notifications
- Each notification shows: bell icon + message text + date (e.g. "Feb 9, 2026")
- "See all notifications" link at the bottom → navigates to full notifications page
- Notifications appear in reverse chronological order

**2. Full notifications page (`/client/notifications`):**
- Dedicated page listing all notifications
- Same format: bell icon + message + date per row
- Full list without truncation
- Includes non-bank notifications too (e.g. "Your email address has been verified")

### Notification Flow for Bank Connection

The notifications reveal the async pipeline:
1. User connects a bank → redirect back to TaxTank
2. **Notification 1:** "Bank accounts are ready to select" — CDR fetch is complete, accounts are available
3. User selects accounts, assigns Tank types, clicks Submit
4. **Notification 2:** "Transactions for the selected accounts have been uploaded" — transaction import is complete, reconciliation can begin

This pattern repeats each time the user reconnects to add more accounts (visible in screenshot: two pairs of notifications from the same session).

### Key Design Insight

The two-step notification flow indicates that **bank data fetching is asynchronous** — the user doesn't wait in a loading spinner. They connect, go about their business, and get notified when accounts are ready to select and again when transactions are ready to reconcile. This is important for UX because CDR/bank data fetches can take seconds to minutes depending on the institution.

---

## 5. "Transfer to Different Bank" — Analysis

This feature likely handles scenarios where:
- A transaction was imported into the wrong account
- An inter-account transfer needs to be matched (e.g. money moving from personal to offset)
- A refund or reversal needs to be linked to the originating account

**My take:** This is probably most useful for handling **inter-account transfers** — e.g. if $2,000 moves from your personal account to your offset account, both sides of the transfer get imported. "Transfer to different bank" lets you link them so they don't double-count. It could also handle misallocation — if a transaction was imported under the wrong account, you can move it to the correct one without deleting and re-importing.

This is a relatively niche feature and likely low priority for BrickTrack's initial bank reconciliation implementation.

---

## 6. Key Design Principles from TaxTank

1. **Separation of connection vs allocation** — Connecting a bank is one step; deciding what each account is for is a separate settings step
2. **Property-centric allocation** — Everything funnels into a property context
3. **Two-stage transaction lifecycle** — "Unreconciled" (bank feeds) → "Reconciled" (account transactions)
4. **Rules for efficiency** — Create rules once, auto-categorise future transactions
5. **Collaboration-aware** — Notes field designed for accountant visibility
6. **Receipt attachment** — Document trail at the transaction level
7. **Non-destructive** — Transactions sit in a queue until explicitly reconciled

---

## 7. Implications for BrickTrack

### What to adopt
- The two-stage lifecycle (unreconciled → reconciled) is clean and intuitive
- Rules-based auto-categorisation saves significant time for recurring transactions
- Property allocation at the account level (not per-transaction) reduces friction
- Receipt upload per transaction is valuable for tax documentation

### What to simplify
- Account allocation could happen during the connection flow rather than in a separate settings page
- The "transfer to different bank" feature can be deferred
- Split allocations across multiple properties can be a v2 feature
- For MVP, focus on: import → categorise → done

### Suggested BrickTrack flow (simplified)
1. **Connect bank** (via Basiq) → select accounts
2. **During connection:** assign each account to a property (or mark as personal/skip)
3. **Bank feeds page:** show unreconciled transactions per property
4. **Reconcile:** one-click categorise with smart suggestions, create rules
5. **Done:** transaction moves to the property's transaction history
