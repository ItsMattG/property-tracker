# Mobile E2E Testing with Detox - Design Document

## Overview

Comprehensive E2E testing for the PropertyTracker iOS mobile app using Detox, covering all screens and features with both local and CI execution support.

## Technology Choices

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Framework | Detox | Industry standard for React Native, full native iOS testing |
| Test Runner | Jest | Detox default, matches existing project setup |
| Target Device | iPhone 15 Pro (iOS 17) | Widely available simulator |
| CI Runner | GitHub Actions macos-14 | M1-based, faster than Intel |

## Project Structure

```
mobile/
├── e2e/
│   ├── config/
│   │   └── detox.config.js       # Detox configuration
│   ├── fixtures/
│   │   ├── seed-mobile.ts        # Mobile-specific test seeding
│   │   └── test-credentials.ts   # Test user constants
│   ├── screens/
│   │   ├── login.spec.ts
│   │   ├── dashboard.spec.ts
│   │   ├── transactions.spec.ts
│   │   ├── camera.spec.ts
│   │   └── settings.spec.ts
│   ├── flows/
│   │   └── complete-user-journey.spec.ts
│   ├── utils/
│   │   ├── api-client.ts         # Direct API calls for setup
│   │   └── helpers.ts            # Common test utilities
│   └── jest.config.js
├── .detoxrc.js                   # Root Detox config
└── package.json                  # Detox dependencies
```

## Test Data Seeding

Mobile auth requires `mobilePasswordHash` (separate from Clerk web auth). Test seeding extends existing infrastructure:

```typescript
// mobile/e2e/fixtures/test-credentials.ts
export const MOBILE_TEST_USER = {
  email: 'mobile-e2e@propertytracker.test',
  password: 'TestPassword123!',
  name: 'Mobile E2E User',
};

// mobile/e2e/fixtures/seed-mobile.ts
export async function seedMobileTestUser() {
  const passwordHash = await bcrypt.hash(MOBILE_TEST_USER.password, 10);
  return seedTestUser({
    email: MOBILE_TEST_USER.email,
    name: MOBILE_TEST_USER.name,
    mobilePasswordHash: passwordHash,
  });
}

export async function seedMobileTestScenario() {
  const user = await seedMobileTestUser();
  const properties = await seedTestProperties(3);
  const pendingReviews = await seedPendingCategorizations(5);
  return { user, properties, pendingReviews };
}
```

## Test Suites

### 1. Login Screen Tests (5 tests)

| Test | Description |
|------|-------------|
| displays fields | Email, password inputs, login button visible |
| invalid credentials | Shows error for wrong email/password |
| empty fields | Shows validation error |
| successful login | Navigates to Dashboard |
| loading state | Shows spinner during API call |

### 2. Dashboard Screen Tests (8 tests)

| Test | Description |
|------|-------------|
| property count card | Displays stats card with count |
| uncategorized count | Shows pending transaction count |
| property list | Displays all seeded properties |
| property details | Shows address, suburb, price |
| scroll behavior | Scrolls to reveal more properties |
| pull to refresh | Refreshes data when pulled down |
| refresh indicator | Shows loading during refresh |
| empty state | Shows message when no properties |

### 3. Transactions Screen Tests (6 tests)

| Test | Description |
|------|-------------|
| pending list | Displays transactions for review |
| transaction details | Shows description, amount, date |
| category suggestion | Displays suggested category with confidence |
| swipe right accept | Accepts suggestion, card animates out |
| swipe left reject | Marks as personal, card animates out |
| partial swipe | Card snaps back on incomplete swipe |
| empty state | Shows "All caught up!" message |

### 4. Camera Screen Tests (7 tests)

| Test | Description |
|------|-------------|
| camera view | Shows camera when permission granted |
| gallery button | Gallery picker button visible |
| permission denied | Shows permission request message |
| capture preview | Shows preview after capture |
| retake photo | Returns to camera view |
| upload progress | Shows progress indicator |
| upload success | Shows success state after upload |

### 5. Settings Screen Tests (8 tests)

| Test | Description |
|------|-------------|
| user email | Displays user's email |
| user name | Displays user's name |
| notification toggle | Toggle switch visible |
| toggle on | Enables notifications |
| toggle off | Disables notifications |
| toggle persistence | Preference survives app restart |
| sign out dialog | Shows confirmation dialog |
| sign out cancel | Cancels and stays on settings |
| sign out confirm | Signs out, returns to login |
| version display | Shows app version |

### 6. Complete User Journey Test (1 test)

Single comprehensive test covering:
1. Login with valid credentials
2. View dashboard and stats
3. Review transactions (swipe accept/reject)
4. Capture document with camera
5. Check settings
6. Sign out

## Required Code Changes

Add `testID` props to React Native components:

### LoginScreen.tsx
- `email-input`, `password-input`, `login-button`, `error-message`

### DashboardScreen.tsx
- `dashboard-screen`, `stats-property-count`, `stats-uncategorized-count`
- `property-list`, `empty-state`

### TransactionsScreen.tsx
- `transactions-list`, `transaction-card-{index}`
- `transaction-description-{index}`, `transaction-amount-{index}`, `transaction-date-{index}`
- `suggested-category-{index}`, `confidence-badge-{index}`

### CameraScreen.tsx
- `camera-view`, `capture-button`, `gallery-button`
- `preview-screen`, `preview-image`, `retake-button`, `confirm-button`
- `upload-progress`, `upload-success`, `permission-prompt`

### SettingsScreen.tsx
- `settings-screen`, `user-email`, `user-name`
- `notifications-toggle`, `sign-out-button`, `app-version`

### Navigation.tsx
- `tab-dashboard`, `tab-transactions`, `tab-camera`, `tab-settings`

## GitHub Actions CI Configuration

```yaml
# .github/workflows/mobile-e2e.yml

name: Mobile E2E Tests

on:
  push:
    branches: [main]
    paths: ['mobile/**']
  pull_request:
    branches: [main]
    paths: ['mobile/**']

jobs:
  detox-ios:
    runs-on: macos-14
    timeout-minutes: 45

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Select Xcode version
        run: sudo xcode-select -s /Applications/Xcode_15.2.app

      - name: Install applesimutils
        run: |
          brew tap wix/brew
          brew install applesimutils

      - name: Install dependencies
        run: |
          npm ci
          cd mobile && npm ci

      - name: Install Detox CLI
        run: npm install -g detox-cli

      - name: Cache Pods
        uses: actions/cache@v4
        with:
          path: mobile/ios/Pods
          key: pods-${{ hashFiles('mobile/ios/Podfile.lock') }}

      - name: Install CocoaPods
        run: cd mobile/ios && pod install

      - name: Build Detox (Release)
        run: cd mobile && detox build --configuration ios.sim.release

      - name: Start backend server
        run: |
          npm run dev &
          npx wait-on http://localhost:3000
        env:
          DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}

      - name: Seed test data
        run: cd mobile && npm run e2e:seed

      - name: Run Detox tests
        run: cd mobile && detox test --configuration ios.sim.release --headless

      - name: Upload artifacts on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: detox-artifacts
          path: mobile/e2e/artifacts/
```

## Dependencies to Add

```json
{
  "devDependencies": {
    "detox": "^20.x",
    "jest-circus": "^29.x"
  }
}
```

System requirements:
- Xcode 15+ with Command Line Tools
- `applesimutils` (via Homebrew)
- CocoaPods

## Test Coverage Summary

| Suite | Tests | Coverage |
|-------|-------|----------|
| Login | 5 | Auth flow, validation, errors |
| Dashboard | 8 | Stats, list, scroll, refresh, empty |
| Transactions | 6 | List, swipe gestures, empty |
| Camera | 7 | Permissions, capture, upload |
| Settings | 8 | Profile, notifications, sign out |
| Journey | 1 | Full user workflow |
| **Total** | **35** | All screens and features |

## Limitations

1. **Camera capture on simulator**: Returns blank/test image; real photo testing requires physical device
2. **Swipe gestures**: May require tuning of speed/offset parameters for reliability
3. **CI execution time**: macOS runners are slower and more expensive than Linux

## Next Steps

1. Add testID props to all React Native components
2. Set up Detox configuration and dependencies
3. Create test seeding utilities for mobile auth
4. Implement test suites in order: Login > Dashboard > Settings > Transactions > Camera > Journey
5. Configure GitHub Actions workflow
6. Run and tune tests for reliability
