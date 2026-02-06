# Core Loop Manual QA Runbook

**Purpose:** Validate the complete BrickTrack core loop with a real bank before beta launch.

**Estimated time:** 30-35 minutes

---

## Pre-requisites

- [ ] Basiq API key configured (production, not sandbox)
- [ ] Real bank login credentials available
- [ ] Test property matching a real investment property exists in BrickTrack
- [ ] Running on staging or local dev environment

---

## Phase 1: Connect (5 min)

- [ ] Navigate to `/banking/connect` and click "Connect Bank Account"
- [ ] Basiq consent UI loads in browser
- [ ] Select real bank, log in with real credentials
- [ ] Consent permissions are correct (read-only)
- [ ] Redirect back to `/banking/callback` succeeds
- [ ] Callback processes and redirects to `/banking`
- [ ] Accounts appear with correct names and masked account numbers
- [ ] Account types are correct (transaction, savings, mortgage)

## Phase 2: Link & Sync (5 min)

- [ ] Assign mortgage account to test property
- [ ] Assign transaction account to same property
- [ ] Sync each account (click Sync button)
- [ ] Transactions visible on `/transactions`
- [ ] Dates are correct (no timezone offset issues)
- [ ] Amounts match bank statement exactly (to the cent)
- [ ] Descriptions are readable (no encoding issues)
- [ ] Income is positive, expenses are negative

## Phase 3: Categorize (15 min)

- [ ] Filter transactions to uncategorized (use category filter)
- [ ] AI suggestions appear with reasonable categories
- [ ] Spot-check: are rent, interest, insurance, council rates correctly identified?
- [ ] Manually categorize 10+ transactions across ATO categories
- [ ] Category dropdown has all expected ATO categories
- [ ] Mark transactions as verified
- [ ] Navigate to `/transactions/review` - suggestions show with confidence levels
- [ ] Batch-accept AI suggestions, verify they apply correctly

## Phase 4: Tax Report (5 min)

- [ ] Navigate to `/reports/tax-position` and select financial year
- [ ] Report renders with real numbers
- [ ] Income total matches rent receipts
- [ ] Expense totals are reasonable per ATO category
- [ ] Net income/loss calculation is correct
- [ ] "Export PDF" downloads, opens, and is formatted professionally
- [ ] Disclaimer text is present in the report

## Phase 5: Accountant Export (5 min)

- [ ] Navigate to `/reports/export` and select financial year
- [ ] Preview totals are reasonable
- [ ] "Export Package" downloads PDF + Excel bundle
- [ ] Excel file: transaction rows match screen, ATO codes present (D1-D18)
- [ ] Navigate to `/export` and download CSV
- [ ] CSV has correct ATO format columns
- [ ] **Send export to accountant** and ask: "Is this usable? What's missing?"

## Phase 6: Regression (2 min)

- [ ] Dashboard numbers reflect categorized data
- [ ] Reconnect bank (click Reconnect on an account) - no duplicate transactions appear

---

## Pass/Fail Criteria

**Pass:** All checkboxes green AND accountant confirms export is usable.

**Fail:** Any of the following:
- Amount mismatch between bank statement and BrickTrack
- Missing transactions that should have been imported
- Broken export (PDF/Excel/CSV fails to download or is malformed)
- Accountant rejects the export format

---

## Known Issues / Notes

- Basiq sandbox credentials (for automated testing only):
  - `gavinBelson` / `hooli2016` - Multi-income, personal loan
  - `richard` / `tabsnotspaces` - Multiple mortgages, rental income
- Rate limiting on sync: minimum 5 minutes between manual syncs per account
- First sync imports 90 days of transaction history
