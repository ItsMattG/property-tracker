# React Native Mobile App Design

**Date:** 2026-01-26
**Status:** Approved

## Goal

Build a companion mobile app for PropertyTracker with three core features: dashboard viewing, transaction categorization (swipe-to-categorize), and document capture.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Mobile App (Expo)                 │
├─────────────────────────────────────────────────────┤
│  Screens: Dashboard, Transactions, Camera, Settings │
│  State: React Query (via tRPC) + Zustand for local  │
│  Storage: SecureStore (JWT), AsyncStorage (prefs)   │
└─────────────────────────────────────────────────────┘
                          │
                          │ HTTPS + JWT
                          ▼
┌─────────────────────────────────────────────────────┐
│              Existing Next.js Backend               │
├─────────────────────────────────────────────────────┤
│  New: auth.mobileLogin (returns JWT)                │
│  New: notification.registerDevice (push tokens)     │
│  Existing: All other tRPC routes work as-is         │
└─────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────┐
│           Supabase Storage + PostgreSQL             │
└─────────────────────────────────────────────────────┘
```

**Key decisions:**
- Separate Expo project in `/mobile` directory (not monorepo)
- tRPC client configured with JWT in Authorization header
- Minimal backend changes - just auth + push token registration

## Screens & Navigation

Four main tabs:

```
┌─────────────────────────────────────────────────────┐
│  [Dashboard]  [Transactions]  [Camera]  [Settings]  │
└─────────────────────────────────────────────────────┘
```

### Dashboard Tab
- Portfolio summary (total value, equity, cash flow)
- Active alerts count with tap to expand
- Property list with key metrics
- Pull-to-refresh

### Transactions Tab
- "Needs Review" section at top (uncategorized transactions)
- Swipe left = categorize (shows category picker)
- Swipe right = mark as personal/ignore
- Filter by property, date range
- Recent transactions list below

### Camera Tab
- Opens camera directly (or photo library)
- After capture: select property, optional notes
- Uploads to Supabase, triggers AI extraction
- Shows processing status

### Settings Tab
- Account info
- Push notification toggles
- Sign out

### Auth Screens (before main app)
- Login (email/password)
- No signup - users create accounts on web first

## Backend Changes

### 1. Mobile Auth Endpoint

```typescript
// auth.mobileLogin
// Input: { email, password }
// Output: { token: JWT, user: { id, email, name } }
// JWT contains userId, expires in 30 days
```

### 2. Push Token Registration

```typescript
// notification.registerDevice
// Input: { pushToken: string, platform: 'ios' | 'android' }
// Stores in new push_tokens table
```

### 3. New Database Table

```sql
push_tokens (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL, -- 'ios' or 'android'
  created_at TIMESTAMP DEFAULT NOW()
)
```

### 4. Modify Alert Sending

When creating alerts/notifications, also send push via Expo's push API. Add to existing notification logic.

### Existing Endpoints (no changes needed)

- `stats.getDashboard` - Dashboard data
- `categorization.getPending` - Uncategorized transactions
- `categorization.categorize` - Swipe to categorize
- `documents.getUploadUrl` - Document upload

## Mobile Tech Stack

- **Expo SDK 52** - Latest stable
- **React Navigation** - Tab + stack navigation
- **tRPC React Query** - API client (same pattern as web)
- **Expo Camera** - Document capture
- **Expo SecureStore** - JWT storage
- **Expo Notifications** - Push notifications
- **NativeWind** - Tailwind CSS for React Native

## Project Structure

```
/mobile
├── app.json              # Expo config
├── package.json
├── src/
│   ├── app/              # Screens
│   │   ├── (auth)/       # Login screen
│   │   ├── (tabs)/       # Main tab screens
│   │   │   ├── dashboard.tsx
│   │   │   ├── transactions.tsx
│   │   │   ├── camera.tsx
│   │   │   └── settings.tsx
│   │   └── _layout.tsx
│   ├── components/       # Shared components
│   ├── lib/
│   │   ├── trpc.ts       # tRPC client setup
│   │   └── auth.ts       # JWT handling
│   └── hooks/            # Custom hooks
└── assets/               # Images, fonts
```

## Error Handling

- **Network errors** - Show toast with retry button, cache last successful data
- **Auth errors (401)** - Clear JWT, redirect to login
- **Upload failures** - Queue failed uploads, retry when online
- **Offline mode** - Show cached dashboard data, disable actions that need network

## Testing

- **Unit tests** - Jest for utility functions
- **Component tests** - React Native Testing Library
- **E2E** - Detox for critical flows (login, categorize, upload)
- **Manual testing** - Expo Go on physical devices

## MVP Scope

**Included:**
- Dashboard with portfolio summary and alerts
- Transaction categorization with swipe gestures
- Document capture with camera
- Push notifications for alerts
- JWT authentication

**Not included (future):**
- Offline-first sync
- Biometric auth
- Deep linking
- Widget support
- Apple/Google Pay
