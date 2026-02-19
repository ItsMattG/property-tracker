# Native Mobile App (React Native / Expo) — Design

**Beads task:** property-tracker-d76

**Goal:** Fresh React Native (Expo) app with core screen parity, biometric auth, and push notifications. Targets App Store + Play Store via EAS.

**V1 Scope:** Dashboard, Properties (list/detail/add), Banking (transactions, review, receipts, bank feeds), Reports & Tools (tax position, cash flow, scorecard, borrowing power), Settings. Biometric auth + push notifications. ~17 screens.

---

## Why React Native (Expo)

- Backend is tRPC — JS/TS only client. Flutter can't use it.
- Shared TypeScript types between web and mobile.
- Expo handles App Store + Play Store builds via EAS.
- NativeWind brings Tailwind knowledge to React Native.
- Expo IS React Native — fully native, accepted by both stores.

---

## Architecture

**Fresh project** in `/mobile-v2`. Existing `/mobile` kept as reference, removed later.

**Stack:**
- Expo SDK 54, React Native 0.81
- Expo Router (file-based routing)
- NativeWind v4 (Tailwind for RN)
- tRPC client (shared backend)
- React Query (via tRPC)
- Expo SecureStore, Expo Local Authentication, Expo Notifications

**Project structure:**
```
mobile-v2/
├── app/                    # Expo Router (file-based)
│   ├── (auth)/             # Login, register
│   ├── (tabs)/             # Main tab navigation
│   │   ├── dashboard/
│   │   ├── properties/     # List + [id] detail
│   │   ├── transactions/   # List, review, bank feeds
│   │   └── more/           # Reports, tools, settings
│   └── _layout.tsx         # Root layout with auth guard
├── components/
│   ├── ui/                 # Card, Button, Input, Badge
│   └── ...                 # Feature components
├── lib/
│   ├── trpc.ts
│   ├── auth.ts
│   └── utils.ts
├── app.json
├── eas.json
└── package.json
```

**Navigation:** 4-tab bottom bar:
1. Dashboard — summary cards, widgets
2. Properties — list → detail (stack)
3. Banking — transactions, review, bank feeds
4. More — reports, tools, settings

---

## Auth Flow

1. App launch → check SecureStore for token → verify with backend
2. Valid token → biometric check → auto-login
3. Invalid/missing → login screen (email + password)
4. On success → store token, offer biometric enrollment

Uses existing `mobileAuth.login`, `mobileAuth.verify` tRPC endpoints. JWT stored in SecureStore. Biometric via `expo-local-authentication` (opt-in after first login).

---

## Screens

### Dashboard Tab
- **Dashboard Home** — Portfolio summary (value, equity, LVR), borrowing power card, recent transactions (5), upcoming reminders, rent review summary. Pull-to-refresh.
- **Notifications** — Push notification history (bell icon in header)

### Properties Tab
- **Property List** — Cards with address, value, yield. Search bar. FAB "+" to add.
- **Property Detail** — Tabbed: Overview (value, loan, purchase), Transactions, Documents (camera upload), Rent Review
- **Add Property** — Form with address, price, date, state, purpose
- **Loan Detail** — Rate, balance, repayment, offset info

### Banking Tab
- **Transactions List** — Infinite scroll, search, category filters. Swipe-to-categorize.
- **Transaction Review** — AI suggestions, approve/reject. Badge count in tab.
- **Bank Feeds** — Connected accounts, balances. Basiq connect via web view.
- **Receipt Capture** — Camera → crop → Supabase upload → attach to transaction

### More Tab
- **More Menu** — Grouped list: Reports, Tools, Settings
- **Tax Position** — Hero card + property breakdown
- **Cash Flow** — Monthly chart + transaction list
- **Scorecard** — Per-property performance scores
- **Borrowing Power** — Mobile-optimized calculator (same engine as web)
- **Settings** — Account, theme, notifications toggle, biometric toggle, logout

**Total: ~17 screens + camera + biometric flow.**

---

## Native Features

### Biometric Auth
- `expo-local-authentication` for Face ID / Touch ID
- Opt-in after first successful login
- Token remains in SecureStore; biometric gates access
- Fallback to password if biometric fails

### Push Notifications
- `expo-notifications` for registration + display
- Register device token on login via `mobileAuth.registerDevice`
- Backend sends via Expo Push API for: transaction review reminders, rent review due, upcoming reminders
- Notification tap deep-links to relevant screen

---

## Data Layer

- tRPC client → `https://bricktrack.au/api/trpc` (or staging)
- Auth: `Authorization: Bearer <jwt>` header
- React Query caching: 30s default staleTime
- No offline support in V1 — graceful error states when offline
- Pull-to-refresh → `invalidate()` on relevant queries

---

## Build & Deploy

- EAS Build: development, preview (staging API), production (prod API)
- EAS Submit: TestFlight (iOS) + Google Play Internal Testing (Android)
- OTA updates via `expo-updates` for JS-only changes

---

## Testing

- Unit: Vitest for utility functions
- Component: React Native Testing Library for key screens
- E2E: Detox for critical flows (login, property CRUD, transaction review) — follow-up
- V1 focus: manual QA via TestFlight / Internal Testing

---

## Not in V1

- Offline-first / local database
- Deep linking from web to app
- Home screen widgets
- Apple Watch / Wear OS
- iPad-optimized layout
- Dark mode (system theme only for now)
