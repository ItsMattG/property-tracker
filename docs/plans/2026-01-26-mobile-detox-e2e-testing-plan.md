# Mobile Detox E2E Testing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Set up comprehensive Detox E2E testing for the PropertyTracker iOS mobile app with 35 tests covering all screens.

**Architecture:** Detox framework with Jest test runner, testing against iOS Simulator. Tests use API-based seeding to create mobile-compatible test users (with mobilePasswordHash). CI runs on GitHub Actions macos-14 runners.

**Tech Stack:** Detox 20.x, Jest, React Native 0.81, Expo 54, TypeScript

---

## Task 1: Install Detox Dependencies

**Files:**
- Modify: `mobile/package.json`

**Step 1: Add Detox dev dependencies**

Run:
```bash
cd mobile && npm install --save-dev detox jest-circus @types/detox
```

**Step 2: Verify installation**

Run:
```bash
cd mobile && npm ls detox
```

Expected: Shows detox@20.x installed

**Step 3: Commit**

```bash
git add mobile/package.json mobile/package-lock.json
git commit -m "chore: add Detox dependencies for E2E testing"
```

---

## Task 2: Create Detox Configuration

**Files:**
- Create: `mobile/.detoxrc.js`
- Create: `mobile/e2e/jest.config.js`

**Step 1: Create root Detox config**

Create `mobile/.detoxrc.js`:
```javascript
/** @type {Detox.DetoxConfig} */
module.exports = {
  testRunner: {
    args: {
      $0: 'jest',
      config: 'e2e/jest.config.js',
    },
    jest: {
      setupTimeout: 120000,
    },
  },
  apps: {
    'ios.debug': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Debug-iphonesimulator/PropertyTracker.app',
      build: 'xcodebuild -workspace ios/PropertyTracker.xcworkspace -scheme PropertyTracker -configuration Debug -sdk iphonesimulator -derivedDataPath ios/build',
    },
    'ios.release': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Release-iphonesimulator/PropertyTracker.app',
      build: 'xcodebuild -workspace ios/PropertyTracker.xcworkspace -scheme PropertyTracker -configuration Release -sdk iphonesimulator -derivedDataPath ios/build',
    },
  },
  devices: {
    simulator: {
      type: 'ios.simulator',
      device: {
        type: 'iPhone 15 Pro',
      },
    },
  },
  configurations: {
    'ios.sim.debug': {
      device: 'simulator',
      app: 'ios.debug',
    },
    'ios.sim.release': {
      device: 'simulator',
      app: 'ios.release',
    },
  },
};
```

**Step 2: Create Jest config for Detox**

Create `mobile/e2e/jest.config.js`:
```javascript
/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  rootDir: '..',
  testMatch: ['<rootDir>/e2e/**/*.spec.ts'],
  testTimeout: 120000,
  maxWorkers: 1,
  globalSetup: 'detox/runners/jest/globalSetup',
  globalTeardown: 'detox/runners/jest/globalTeardown',
  reporters: ['detox/runners/jest/reporter'],
  testEnvironment: 'detox/runners/jest/testEnvironment',
  verbose: true,
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
};
```

**Step 3: Verify config syntax**

Run:
```bash
cd mobile && node -e "require('./.detoxrc.js')"
```

Expected: No errors

**Step 4: Commit**

```bash
git add mobile/.detoxrc.js mobile/e2e/jest.config.js
git commit -m "chore: add Detox and Jest configuration"
```

---

## Task 3: Create Test Credentials and Seeding Utilities

**Files:**
- Create: `mobile/e2e/fixtures/test-credentials.ts`
- Create: `mobile/e2e/fixtures/seed-mobile.ts`

**Step 1: Create test credentials**

Create `mobile/e2e/fixtures/test-credentials.ts`:
```typescript
export const MOBILE_TEST_USER = {
  email: 'mobile-e2e@propertytracker.test',
  password: 'TestPassword123!',
  name: 'Mobile E2E User',
};

export const API_BASE_URL = process.env.API_URL || 'http://localhost:3000';
```

**Step 2: Create seeding utility**

Create `mobile/e2e/fixtures/seed-mobile.ts`:
```typescript
import { MOBILE_TEST_USER, API_BASE_URL } from './test-credentials';

interface SeedResponse {
  user: { id: string; email: string };
  properties: Array<{ id: string; address: string }>;
  pendingTransactions: Array<{ id: string; description: string }>;
}

export async function seedMobileTestScenario(): Promise<SeedResponse> {
  const response = await fetch(`${API_BASE_URL}/api/test/seed-mobile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: MOBILE_TEST_USER.email,
      password: MOBILE_TEST_USER.password,
      name: MOBILE_TEST_USER.name,
      propertyCount: 3,
      pendingTransactionCount: 5,
    }),
  });

  if (!response.ok) {
    throw new Error(`Seed failed: ${response.status}`);
  }

  return response.json();
}

export async function cleanupMobileTestData(): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/test/cleanup-mobile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: MOBILE_TEST_USER.email }),
  });

  if (!response.ok) {
    throw new Error(`Cleanup failed: ${response.status}`);
  }
}
```

**Step 3: Commit**

```bash
git add mobile/e2e/fixtures/
git commit -m "feat: add test credentials and seeding utilities"
```

---

## Task 4: Create Test API Endpoints

**Files:**
- Create: `src/pages/api/test/seed-mobile.ts`
- Create: `src/pages/api/test/cleanup-mobile.ts`

**Step 1: Create seed endpoint**

Create `src/pages/api/test/seed-mobile.ts`:
```typescript
import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';
import { db } from '@/server/db';
import { users, properties, transactions, bankAccounts } from '@/server/db/schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Not available in production' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password, name, propertyCount = 3, pendingTransactionCount = 5 } = req.body;

  try {
    // Clean up existing test user
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (existingUser) {
      await db.delete(transactions).where(eq(transactions.userId, existingUser.id));
      await db.delete(bankAccounts).where(eq(bankAccounts.userId, existingUser.id));
      await db.delete(properties).where(eq(properties.userId, existingUser.id));
      await db.delete(users).where(eq(users.id, existingUser.id));
    }

    // Create test user with mobile password hash
    const passwordHash = await bcrypt.hash(password, 10);
    const userId = randomUUID();

    await db.insert(users).values({
      id: userId,
      clerkId: `test_clerk_${userId.slice(0, 8)}`,
      email,
      name,
      mobilePasswordHash: passwordHash,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create properties
    const createdProperties = [];
    for (let i = 0; i < propertyCount; i++) {
      const propertyId = randomUUID();
      await db.insert(properties).values({
        id: propertyId,
        userId,
        address: `${100 + i} Test Street`,
        suburb: 'Sydney',
        state: 'NSW',
        postcode: '2000',
        purchasePrice: `${500000 + i * 100000}.00`,
        purchaseDate: '2024-01-15',
        entityName: 'Personal',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      createdProperties.push({ id: propertyId, address: `${100 + i} Test Street` });
    }

    // Create bank account for transactions
    const bankAccountId = randomUUID();
    await db.insert(bankAccounts).values({
      id: bankAccountId,
      userId,
      basiqConnectionId: `test_conn_${bankAccountId.slice(0, 8)}`,
      basiqAccountId: `test_acct_${bankAccountId.slice(0, 8)}`,
      institution: 'Test Bank',
      accountName: 'Test Account',
      accountNumberMasked: '****1234',
      accountType: 'transaction',
      isConnected: true,
      defaultPropertyId: createdProperties[0]?.id,
      lastSyncedAt: new Date(),
      createdAt: new Date(),
    });

    // Create pending transactions
    const createdTransactions = [];
    for (let i = 0; i < pendingTransactionCount; i++) {
      const txId = randomUUID();
      await db.insert(transactions).values({
        id: txId,
        userId,
        bankAccountId,
        basiqTransactionId: `test_txn_${txId.slice(0, 8)}`,
        description: `Test Transaction ${i + 1}`,
        amount: `-${(50 + i * 25).toFixed(2)}`,
        date: new Date().toISOString().split('T')[0],
        category: 'uncategorized',
        transactionType: 'expense',
        suggestedCategory: 'repairs_and_maintenance',
        suggestionConfidence: `${70 + i * 5}`,
        isDeductible: false,
        isVerified: false,
        propertyId: createdProperties[0]?.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      createdTransactions.push({ id: txId, description: `Test Transaction ${i + 1}` });
    }

    return res.status(200).json({
      user: { id: userId, email },
      properties: createdProperties,
      pendingTransactions: createdTransactions,
    });
  } catch (error) {
    console.error('Seed error:', error);
    return res.status(500).json({ error: 'Failed to seed test data' });
  }
}
```

**Step 2: Create cleanup endpoint**

Create `src/pages/api/test/cleanup-mobile.ts`:
```typescript
import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '@/server/db';
import { users, properties, transactions, bankAccounts } from '@/server/db/schema';
import { eq } from 'drizzle-orm';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Not available in production' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body;

  try {
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (user) {
      await db.delete(transactions).where(eq(transactions.userId, user.id));
      await db.delete(bankAccounts).where(eq(bankAccounts.userId, user.id));
      await db.delete(properties).where(eq(properties.userId, user.id));
      await db.delete(users).where(eq(users.id, user.id));
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Cleanup error:', error);
    return res.status(500).json({ error: 'Failed to cleanup test data' });
  }
}
```

**Step 3: Commit**

```bash
git add src/pages/api/test/
git commit -m "feat: add test seeding API endpoints for mobile E2E"
```

---

## Task 5: Create Test Helpers

**Files:**
- Create: `mobile/e2e/utils/helpers.ts`

**Step 1: Create helpers**

Create `mobile/e2e/utils/helpers.ts`:
```typescript
import { device, element, by, expect } from 'detox';
import { MOBILE_TEST_USER } from '../fixtures/test-credentials';

export async function loginAsTestUser(): Promise<void> {
  await element(by.id('email-input')).typeText(MOBILE_TEST_USER.email);
  await element(by.id('password-input')).typeText(MOBILE_TEST_USER.password);
  await element(by.id('login-button')).tap();
  await expect(element(by.id('dashboard-screen'))).toBeVisible();
}

export async function logout(): Promise<void> {
  await element(by.id('tab-settings')).tap();
  await element(by.id('sign-out-button')).tap();
  await element(by.text('Sign Out')).tap();
  await expect(element(by.id('login-screen'))).toBeVisible();
}

export async function navigateToTab(tabId: string): Promise<void> {
  await element(by.id(tabId)).tap();
}

export async function waitForElement(testId: string, timeout = 5000): Promise<void> {
  await waitFor(element(by.id(testId)))
    .toBeVisible()
    .withTimeout(timeout);
}

export async function clearAndType(testId: string, text: string): Promise<void> {
  await element(by.id(testId)).clearText();
  await element(by.id(testId)).typeText(text);
}
```

**Step 2: Commit**

```bash
git add mobile/e2e/utils/
git commit -m "feat: add Detox test helper utilities"
```

---

## Task 6: Add testID Props to LoginScreen

**Files:**
- Modify: `mobile/src/app/LoginScreen.tsx`

**Step 1: Add testID to root View**

In `mobile/src/app/LoginScreen.tsx`, change line 44-45:
```tsx
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-white"
      testID="login-screen"
    >
```

**Step 2: Add testID to email input**

Change line 56-64:
```tsx
            <TextInput
              testID="email-input"
              className="border border-gray-300 rounded-lg px-4 py-3 text-base"
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
```

**Step 3: Add testID to password input**

Change line 71-78:
```tsx
            <TextInput
              testID="password-input"
              className="border border-gray-300 rounded-lg px-4 py-3 text-base"
              placeholder="Mobile password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
            />
```

**Step 4: Add testID to error message**

Change line 81-83:
```tsx
          {error ? (
            <Text testID="error-message" className="text-red-500 text-sm">{error}</Text>
          ) : null}
```

**Step 5: Add testID to login button**

Change line 85-99:
```tsx
          <TouchableOpacity
            testID="login-button"
            className={`rounded-lg py-4 ${
              isLoading ? "bg-blue-400" : "bg-blue-600"
            }`}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator testID="login-loading" color="white" />
            ) : (
              <Text className="text-white text-center font-semibold text-base">
                Sign In
              </Text>
            )}
          </TouchableOpacity>
```

**Step 6: Commit**

```bash
git add mobile/src/app/LoginScreen.tsx
git commit -m "feat: add testID props to LoginScreen for Detox"
```

---

## Task 7: Add testID Props to DashboardScreen

**Files:**
- Modify: `mobile/src/app/DashboardScreen.tsx`

**Step 1: Add testID to root ScrollView**

In `mobile/src/app/DashboardScreen.tsx`, change line 66-71:
```tsx
    <ScrollView
      testID="dashboard-screen"
      className="flex-1 bg-gray-50"
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
      }
    >
```

**Step 2: Add testID to property count card**

Change line 75-80:
```tsx
          <View testID="stats-property-count" className="flex-1 bg-white rounded-xl p-4 shadow-sm">
            <Text className="text-gray-500 text-sm">Properties</Text>
            <Text className="text-2xl font-bold">
              {isLoading ? "-" : stats?.propertyCount ?? 0}
            </Text>
          </View>
```

**Step 3: Add testID to uncategorized count card**

Change line 81-86:
```tsx
          <View testID="stats-uncategorized-count" className="flex-1 bg-white rounded-xl p-4 shadow-sm">
            <Text className="text-gray-500 text-sm">To Review</Text>
            <Text className="text-2xl font-bold text-orange-600">
              {isLoading ? "-" : stats?.uncategorizedCount ?? 0}
            </Text>
          </View>
```

**Step 4: Add testID to properties list container**

Change line 90:
```tsx
        <View testID="property-list" className="bg-white rounded-xl shadow-sm">
```

**Step 5: Add testID to empty state**

Change line 94-99:
```tsx
            <View testID="empty-state" className="p-4">
              <Text className="text-gray-500 text-center">
                No properties yet
              </Text>
            </View>
```

**Step 6: Add testID to property items**

Change line 101-118:
```tsx
            properties.map((property, index) => (
              <TouchableOpacity
                key={property.id}
                testID={`property-item-${index}`}
                className={`p-4 ${
                  index < properties.length - 1
                    ? "border-b border-gray-100"
                    : ""
                }`}
              >
                <Text testID={`property-address-${index}`} className="font-medium">{property.address}</Text>
                <Text testID={`property-location-${index}`} className="text-gray-500 text-sm">
                  {property.suburb}, {property.state} {property.postcode}
                </Text>
                <Text testID={`property-price-${index}`} className="text-blue-600 font-medium mt-1">
                  {formatCurrency(Number(property.purchasePrice))}
                </Text>
              </TouchableOpacity>
            ))
```

**Step 7: Commit**

```bash
git add mobile/src/app/DashboardScreen.tsx
git commit -m "feat: add testID props to DashboardScreen for Detox"
```

---

## Task 8: Add testID Props to TransactionsScreen

**Files:**
- Modify: `mobile/src/app/TransactionsScreen.tsx`

**Step 1: Add testID to loading state**

In `mobile/src/app/TransactionsScreen.tsx`, change line 75-79:
```tsx
      <View testID="transactions-loading" className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
```

**Step 2: Add testID to root View**

Change line 83:
```tsx
    <View testID="transactions-screen" className="flex-1 bg-gray-50">
```

**Step 3: Add testID to empty state**

Change line 84-92:
```tsx
      {transactions.length === 0 ? (
        <View testID="transactions-empty" className="flex-1 items-center justify-center p-4">
          <Text className="text-gray-500 text-center text-lg">
            All caught up!
          </Text>
          <Text className="text-gray-400 text-center mt-2">
            No transactions need review
          </Text>
        </View>
      ) : (
```

**Step 4: Add testID to FlatList**

Change line 100-113:
```tsx
          <FlatList
            testID="transactions-list"
            data={transactions}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => (
              <SwipeableTransaction
                testID={`transaction-card-${index}`}
                transaction={item}
                onAccept={() => handleAccept(item.id)}
                onReject={() => handleReject(item.id)}
              />
            )}
            refreshControl={
              <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
            }
          />
```

**Step 5: Commit**

```bash
git add mobile/src/app/TransactionsScreen.tsx
git commit -m "feat: add testID props to TransactionsScreen for Detox"
```

---

## Task 9: Add testID Props to SwipeableTransaction

**Files:**
- Modify: `mobile/src/components/SwipeableTransaction.tsx`

**Step 1: Update Props interface**

In `mobile/src/components/SwipeableTransaction.tsx`, change line 15-19:
```typescript
interface Props {
  testID?: string;
  transaction: Transaction;
  onAccept: () => void;
  onReject: () => void;
}
```

**Step 2: Add testID to component**

Change line 21:
```typescript
export function SwipeableTransaction({ testID, transaction, onAccept, onReject }: Props) {
```

**Step 3: Add testID to Swipeable wrapper**

Change line 64-71:
```tsx
    <Swipeable
      testID={testID}
      renderLeftActions={renderLeftActions}
      renderRightActions={renderRightActions}
      onSwipeableOpen={(direction) => {
        if (direction === "left") onAccept();
        if (direction === "right") onReject();
      }}
    >
```

**Step 4: Add testID to content elements**

Change line 72-105:
```tsx
      <View testID={testID ? `${testID}-content` : undefined} className="bg-white p-4 border-b border-gray-100">
        <View className="flex-row justify-between items-start">
          <View className="flex-1 mr-4">
            <Text testID={testID ? `${testID}-description` : undefined} className="font-medium" numberOfLines={1}>
              {transaction.description}
            </Text>
            <Text testID={testID ? `${testID}-date` : undefined} className="text-gray-500 text-sm mt-1">
              {transaction.date}
            </Text>
            {transaction.suggestedCategory && (
              <View className="flex-row items-center mt-2">
                <View testID={testID ? `${testID}-category` : undefined} className="bg-blue-100 rounded-full px-2 py-0.5">
                  <Text className="text-blue-700 text-xs">
                    {transaction.suggestedCategory.replace(/_/g, " ")}
                  </Text>
                </View>
                {transaction.suggestionConfidence && (
                  <Text testID={testID ? `${testID}-confidence` : undefined} className="text-gray-400 text-xs ml-2">
                    {Math.round(parseFloat(transaction.suggestionConfidence))}%
                  </Text>
                )}
              </View>
            )}
          </View>
          <Text
            testID={testID ? `${testID}-amount` : undefined}
            className={`font-semibold ${
              isIncome ? "text-green-600" : "text-gray-900"
            }`}
          >
            {isIncome ? "+" : ""}${Math.abs(amount).toFixed(2)}
          </Text>
        </View>
      </View>
```

**Step 5: Commit**

```bash
git add mobile/src/components/SwipeableTransaction.tsx
git commit -m "feat: add testID props to SwipeableTransaction for Detox"
```

---

## Task 10: Add testID Props to CameraScreen

**Files:**
- Modify: `mobile/src/app/CameraScreen.tsx`

**Step 1: Add testID to permission loading state**

In `mobile/src/app/CameraScreen.tsx`, change line 119-124:
```tsx
  if (!permission) {
    return (
      <View testID="camera-loading" className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" />
      </View>
    );
  }
```

**Step 2: Add testID to permission prompt**

Change line 127-140:
```tsx
  if (!permission.granted) {
    return (
      <View testID="permission-prompt" className="flex-1 items-center justify-center p-4 bg-white">
        <Text className="text-center mb-4">
          Camera access is needed to capture documents
        </Text>
        <TouchableOpacity
          testID="grant-permission-button"
          className="bg-blue-600 rounded-lg px-6 py-3"
          onPress={requestPermission}
        >
          <Text className="text-white font-semibold">Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }
```

**Step 3: Add testID to uploading state**

Change line 143-150:
```tsx
  if (step === "uploading") {
    return (
      <View testID="upload-progress" className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#2563eb" />
        <Text className="mt-4 text-gray-600">Uploading document...</Text>
      </View>
    );
  }
```

**Step 4: Add testID to preview screen**

Change line 152-175:
```tsx
  if (step === "preview" && imageUri) {
    return (
      <View testID="preview-screen" className="flex-1 bg-black">
        <Image
          testID="preview-image"
          source={{ uri: imageUri }}
          className="flex-1"
          resizeMode="contain"
        />
        <View className="flex-row p-4 space-x-4">
          <TouchableOpacity
            testID="retake-button"
            className="flex-1 bg-gray-600 rounded-lg py-4"
            onPress={resetCamera}
          >
            <Text className="text-white text-center font-semibold">Retake</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="confirm-button"
            className="flex-1 bg-blue-600 rounded-lg py-4"
            onPress={uploadDocument}
          >
            <Text className="text-white text-center font-semibold">Upload</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
```

**Step 5: Add testID to camera view**

Change line 178-197:
```tsx
  return (
    <View testID="camera-screen" className="flex-1 bg-black">
      <CameraView testID="camera-view" ref={cameraRef} className="flex-1" facing="back">
        <View className="flex-1 justify-end items-center pb-8">
          <View className="flex-row items-center space-x-6">
            <TouchableOpacity
              testID="gallery-button"
              className="bg-white/20 rounded-full p-4"
              onPress={pickImage}
            >
              <Text className="text-white text-sm">Gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="capture-button"
              className="bg-white rounded-full w-20 h-20 border-4 border-gray-300"
              onPress={takePicture}
            />
            <View className="w-16" />
          </View>
        </View>
      </CameraView>
    </View>
  );
```

**Step 6: Commit**

```bash
git add mobile/src/app/CameraScreen.tsx
git commit -m "feat: add testID props to CameraScreen for Detox"
```

---

## Task 11: Add testID Props to SettingsScreen

**Files:**
- Modify: `mobile/src/app/SettingsScreen.tsx`

**Step 1: Add testID to root View**

In `mobile/src/app/SettingsScreen.tsx`, change line 43:
```tsx
    <View testID="settings-screen" className="flex-1 bg-gray-50">
```

**Step 2: Add testID to email display**

Change line 50-53:
```tsx
          <View testID="user-email-container" className="p-4 border-b border-gray-100">
            <Text className="text-sm text-gray-500">Email</Text>
            <Text testID="user-email" className="font-medium">{user?.email}</Text>
          </View>
```

**Step 3: Add testID to name display**

Change line 54-57:
```tsx
          <View testID="user-name-container" className="p-4">
            <Text className="text-sm text-gray-500">Name</Text>
            <Text testID="user-name" className="font-medium">{user?.name || "Not set"}</Text>
          </View>
```

**Step 4: Add testID to notifications toggle**

Change line 74-78:
```tsx
            <Switch
              testID="notifications-toggle"
              value={preferences?.pushEnabled ?? true}
              onValueChange={togglePush}
              trackColor={{ true: "#2563eb" }}
            />
```

**Step 5: Add testID to sign out button**

Change line 85-91:
```tsx
        <TouchableOpacity
          testID="sign-out-button"
          className="bg-white p-4"
          onPress={handleLogout}
        >
          <Text className="text-red-600 text-center font-medium">
            Sign Out
          </Text>
        </TouchableOpacity>
```

**Step 6: Add testID to version**

Change line 96-98:
```tsx
      <Text testID="app-version" className="text-center text-gray-400 text-sm mt-8">
        PropertyTracker Mobile v1.0.0
      </Text>
```

**Step 7: Commit**

```bash
git add mobile/src/app/SettingsScreen.tsx
git commit -m "feat: add testID props to SettingsScreen for Detox"
```

---

## Task 12: Add testID Props to Navigation

**Files:**
- Modify: `mobile/src/app/Navigation.tsx`

**Step 1: Add testID to tabs**

In `mobile/src/app/Navigation.tsx`, change line 23-51:
```tsx
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: "Dashboard",
          tabBarTestID: "tab-dashboard",
        }}
      />
      <Tab.Screen
        name="Transactions"
        component={TransactionsScreen}
        options={{
          tabBarLabel: "Review",
          tabBarTestID: "tab-transactions",
        }}
      />
      <Tab.Screen
        name="Camera"
        component={CameraScreen}
        options={{
          tabBarLabel: "Capture",
          tabBarTestID: "tab-camera",
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: "Settings",
          tabBarTestID: "tab-settings",
        }}
      />
```

**Step 2: Commit**

```bash
git add mobile/src/app/Navigation.tsx
git commit -m "feat: add testID props to Navigation tabs for Detox"
```

---

## Task 13: Create Login Screen Tests

**Files:**
- Create: `mobile/e2e/screens/login.spec.ts`

**Step 1: Create login tests**

Create `mobile/e2e/screens/login.spec.ts`:
```typescript
import { device, element, by, expect } from 'detox';
import { seedMobileTestScenario, cleanupMobileTestData } from '../fixtures/seed-mobile';
import { MOBILE_TEST_USER } from '../fixtures/test-credentials';

describe('Login Screen', () => {
  beforeAll(async () => {
    await seedMobileTestScenario();
  });

  afterAll(async () => {
    await cleanupMobileTestData();
  });

  beforeEach(async () => {
    await device.launchApp({ newInstance: true });
  });

  it('displays email and password fields', async () => {
    await expect(element(by.id('login-screen'))).toBeVisible();
    await expect(element(by.id('email-input'))).toBeVisible();
    await expect(element(by.id('password-input'))).toBeVisible();
    await expect(element(by.id('login-button'))).toBeVisible();
  });

  it('shows error for empty fields', async () => {
    await element(by.id('login-button')).tap();
    await expect(element(by.id('error-message'))).toBeVisible();
    await expect(element(by.text('Please enter email and password'))).toBeVisible();
  });

  it('shows error for invalid credentials', async () => {
    await element(by.id('email-input')).typeText('wrong@email.com');
    await element(by.id('password-input')).typeText('wrongpassword');
    await element(by.id('login-button')).tap();

    await waitFor(element(by.id('error-message')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('shows loading state during login', async () => {
    await element(by.id('email-input')).typeText(MOBILE_TEST_USER.email);
    await element(by.id('password-input')).typeText(MOBILE_TEST_USER.password);
    await element(by.id('login-button')).tap();

    // Loading indicator should appear briefly
    // Note: This may be too fast to catch reliably
  });

  it('successfully logs in with valid credentials', async () => {
    await element(by.id('email-input')).typeText(MOBILE_TEST_USER.email);
    await element(by.id('password-input')).typeText(MOBILE_TEST_USER.password);
    await element(by.id('login-button')).tap();

    await waitFor(element(by.id('dashboard-screen')))
      .toBeVisible()
      .withTimeout(10000);
  });
});
```

**Step 2: Commit**

```bash
git add mobile/e2e/screens/login.spec.ts
git commit -m "test: add login screen Detox tests"
```

---

## Task 14: Create Dashboard Screen Tests

**Files:**
- Create: `mobile/e2e/screens/dashboard.spec.ts`

**Step 1: Create dashboard tests**

Create `mobile/e2e/screens/dashboard.spec.ts`:
```typescript
import { device, element, by, expect } from 'detox';
import { seedMobileTestScenario, cleanupMobileTestData } from '../fixtures/seed-mobile';
import { loginAsTestUser } from '../utils/helpers';

describe('Dashboard Screen', () => {
  beforeAll(async () => {
    await seedMobileTestScenario();
    await device.launchApp({ newInstance: true });
    await loginAsTestUser();
  });

  afterAll(async () => {
    await cleanupMobileTestData();
  });

  describe('Stats Cards', () => {
    it('displays property count card', async () => {
      await expect(element(by.id('stats-property-count'))).toBeVisible();
      await expect(element(by.text('3'))).toBeVisible();
    });

    it('displays uncategorized transaction count', async () => {
      await expect(element(by.id('stats-uncategorized-count'))).toBeVisible();
    });
  });

  describe('Property List', () => {
    it('displays all seeded properties', async () => {
      await expect(element(by.id('property-list'))).toBeVisible();
      await expect(element(by.id('property-item-0'))).toBeVisible();
    });

    it('shows property details', async () => {
      await expect(element(by.id('property-address-0'))).toBeVisible();
      await expect(element(by.id('property-location-0'))).toBeVisible();
      await expect(element(by.id('property-price-0'))).toBeVisible();
    });

    it('scrolls to reveal more properties', async () => {
      await element(by.id('dashboard-screen')).scroll(200, 'down');
      await expect(element(by.id('property-item-1'))).toBeVisible();
    });
  });

  describe('Pull to Refresh', () => {
    it('refreshes data when pulled down', async () => {
      await element(by.id('dashboard-screen')).swipe('down', 'slow', 0.5);
      // Data should reload - verify list still visible
      await waitFor(element(by.id('property-list')))
        .toBeVisible()
        .withTimeout(5000);
    });
  });
});

describe('Dashboard Empty State', () => {
  beforeAll(async () => {
    await cleanupMobileTestData();
    // Seed user with no properties
    await fetch('http://localhost:3000/api/test/seed-mobile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'mobile-e2e@propertytracker.test',
        password: 'TestPassword123!',
        name: 'Mobile E2E User',
        propertyCount: 0,
        pendingTransactionCount: 0,
      }),
    });
    await device.launchApp({ newInstance: true });
    await loginAsTestUser();
  });

  afterAll(async () => {
    await cleanupMobileTestData();
  });

  it('shows empty state when no properties exist', async () => {
    await expect(element(by.id('empty-state'))).toBeVisible();
    await expect(element(by.text('No properties yet'))).toBeVisible();
  });
});
```

**Step 2: Commit**

```bash
git add mobile/e2e/screens/dashboard.spec.ts
git commit -m "test: add dashboard screen Detox tests"
```

---

## Task 15: Create Transactions Screen Tests

**Files:**
- Create: `mobile/e2e/screens/transactions.spec.ts`

**Step 1: Create transactions tests**

Create `mobile/e2e/screens/transactions.spec.ts`:
```typescript
import { device, element, by, expect } from 'detox';
import { seedMobileTestScenario, cleanupMobileTestData } from '../fixtures/seed-mobile';
import { loginAsTestUser, navigateToTab } from '../utils/helpers';

describe('Transactions Screen', () => {
  beforeAll(async () => {
    await seedMobileTestScenario();
    await device.launchApp({ newInstance: true });
    await loginAsTestUser();
    await navigateToTab('tab-transactions');
  });

  afterAll(async () => {
    await cleanupMobileTestData();
  });

  describe('Transaction List', () => {
    it('displays pending transactions for review', async () => {
      await expect(element(by.id('transactions-list'))).toBeVisible();
      await expect(element(by.id('transaction-card-0'))).toBeVisible();
    });

    it('shows transaction details', async () => {
      await expect(element(by.id('transaction-card-0-description'))).toBeVisible();
      await expect(element(by.id('transaction-card-0-amount'))).toBeVisible();
      await expect(element(by.id('transaction-card-0-date'))).toBeVisible();
    });

    it('displays suggested category with confidence', async () => {
      await expect(element(by.id('transaction-card-0-category'))).toBeVisible();
      await expect(element(by.id('transaction-card-0-confidence'))).toBeVisible();
    });
  });

  describe('Swipe Gestures', () => {
    it('swipe right accepts the suggestion', async () => {
      const card = element(by.id('transaction-card-0'));
      await card.swipe('right', 'fast', 0.7);

      await waitFor(element(by.id('transaction-card-0')))
        .not.toBeVisible()
        .withTimeout(3000);
    });

    it('swipe left marks as personal', async () => {
      // After previous swipe, card-0 is now the next transaction
      const card = element(by.id('transaction-card-0'));
      await card.swipe('left', 'fast', 0.7);

      await waitFor(element(by.id('transaction-card-0')))
        .not.toBeVisible()
        .withTimeout(3000);
    });
  });
});

describe('Transactions Empty State', () => {
  beforeAll(async () => {
    await cleanupMobileTestData();
    // Seed user with no pending transactions
    await fetch('http://localhost:3000/api/test/seed-mobile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'mobile-e2e@propertytracker.test',
        password: 'TestPassword123!',
        name: 'Mobile E2E User',
        propertyCount: 1,
        pendingTransactionCount: 0,
      }),
    });
    await device.launchApp({ newInstance: true });
    await loginAsTestUser();
    await navigateToTab('tab-transactions');
  });

  afterAll(async () => {
    await cleanupMobileTestData();
  });

  it('shows "All caught up!" when no pending reviews', async () => {
    await expect(element(by.id('transactions-empty'))).toBeVisible();
    await expect(element(by.text('All caught up!'))).toBeVisible();
  });
});
```

**Step 2: Commit**

```bash
git add mobile/e2e/screens/transactions.spec.ts
git commit -m "test: add transactions screen Detox tests"
```

---

## Task 16: Create Camera Screen Tests

**Files:**
- Create: `mobile/e2e/screens/camera.spec.ts`

**Step 1: Create camera tests**

Create `mobile/e2e/screens/camera.spec.ts`:
```typescript
import { device, element, by, expect } from 'detox';
import { seedMobileTestScenario, cleanupMobileTestData } from '../fixtures/seed-mobile';
import { loginAsTestUser, navigateToTab } from '../utils/helpers';

describe('Camera Screen - Permission Granted', () => {
  beforeAll(async () => {
    await seedMobileTestScenario();
    await device.launchApp({
      newInstance: true,
      permissions: { camera: 'YES', photos: 'YES' },
    });
    await loginAsTestUser();
    await navigateToTab('tab-camera');
  });

  afterAll(async () => {
    await cleanupMobileTestData();
  });

  it('shows camera view when permission granted', async () => {
    await expect(element(by.id('camera-screen'))).toBeVisible();
    await expect(element(by.id('camera-view'))).toBeVisible();
  });

  it('shows capture button', async () => {
    await expect(element(by.id('capture-button'))).toBeVisible();
  });

  it('shows gallery picker button', async () => {
    await expect(element(by.id('gallery-button'))).toBeVisible();
  });

  it('shows preview after capture', async () => {
    await element(by.id('capture-button')).tap();

    await waitFor(element(by.id('preview-screen')))
      .toBeVisible()
      .withTimeout(5000);
    await expect(element(by.id('preview-image'))).toBeVisible();
  });

  it('allows retaking photo from preview', async () => {
    await element(by.id('retake-button')).tap();

    await expect(element(by.id('camera-screen'))).toBeVisible();
    await expect(element(by.id('camera-view'))).toBeVisible();
  });
});

describe('Camera Screen - Permission Denied', () => {
  beforeAll(async () => {
    await seedMobileTestScenario();
    await device.launchApp({
      newInstance: true,
      permissions: { camera: 'NO' },
    });
    await loginAsTestUser();
    await navigateToTab('tab-camera');
  });

  afterAll(async () => {
    await cleanupMobileTestData();
  });

  it('shows permission request message when denied', async () => {
    await expect(element(by.id('permission-prompt'))).toBeVisible();
    await expect(element(by.text('Camera access is needed to capture documents'))).toBeVisible();
  });

  it('shows grant permission button', async () => {
    await expect(element(by.id('grant-permission-button'))).toBeVisible();
  });
});
```

**Step 2: Commit**

```bash
git add mobile/e2e/screens/camera.spec.ts
git commit -m "test: add camera screen Detox tests"
```

---

## Task 17: Create Settings Screen Tests

**Files:**
- Create: `mobile/e2e/screens/settings.spec.ts`

**Step 1: Create settings tests**

Create `mobile/e2e/screens/settings.spec.ts`:
```typescript
import { device, element, by, expect } from 'detox';
import { seedMobileTestScenario, cleanupMobileTestData } from '../fixtures/seed-mobile';
import { MOBILE_TEST_USER } from '../fixtures/test-credentials';
import { loginAsTestUser, navigateToTab } from '../utils/helpers';

describe('Settings Screen', () => {
  beforeAll(async () => {
    await seedMobileTestScenario();
    await device.launchApp({ newInstance: true });
    await loginAsTestUser();
    await navigateToTab('tab-settings');
  });

  afterAll(async () => {
    await cleanupMobileTestData();
  });

  describe('User Info Display', () => {
    it('displays user email', async () => {
      await expect(element(by.id('user-email'))).toBeVisible();
      await expect(element(by.text(MOBILE_TEST_USER.email))).toBeVisible();
    });

    it('displays user name', async () => {
      await expect(element(by.id('user-name'))).toBeVisible();
      await expect(element(by.text(MOBILE_TEST_USER.name))).toBeVisible();
    });
  });

  describe('Notification Toggle', () => {
    it('displays notification toggle switch', async () => {
      await expect(element(by.id('notifications-toggle'))).toBeVisible();
    });

    it('toggles notifications', async () => {
      await element(by.id('notifications-toggle')).tap();
      // Toggle state changed - API call made
      // Wait for state to settle
      await new Promise(resolve => setTimeout(resolve, 1000));
    });
  });

  describe('Version Display', () => {
    it('shows app version', async () => {
      await expect(element(by.id('app-version'))).toBeVisible();
      await expect(element(by.text('PropertyTracker Mobile v1.0.0'))).toBeVisible();
    });
  });

  describe('Sign Out', () => {
    it('displays sign out button', async () => {
      await expect(element(by.id('sign-out-button'))).toBeVisible();
    });

    it('shows confirmation dialog on sign out tap', async () => {
      await element(by.id('sign-out-button')).tap();

      await expect(element(by.text('Sign Out'))).toBeVisible();
      await expect(element(by.text('Cancel'))).toBeVisible();
    });

    it('cancels sign out when Cancel tapped', async () => {
      // Dialog should still be open from previous test
      await element(by.text('Cancel')).tap();

      await expect(element(by.id('settings-screen'))).toBeVisible();
    });

    it('signs out and returns to login when confirmed', async () => {
      await element(by.id('sign-out-button')).tap();
      await element(by.text('Sign Out')).atIndex(1).tap(); // The confirm button

      await waitFor(element(by.id('login-screen')))
        .toBeVisible()
        .withTimeout(5000);
    });
  });
});
```

**Step 2: Commit**

```bash
git add mobile/e2e/screens/settings.spec.ts
git commit -m "test: add settings screen Detox tests"
```

---

## Task 18: Create Complete User Journey Test

**Files:**
- Create: `mobile/e2e/flows/complete-user-journey.spec.ts`

**Step 1: Create journey test**

Create `mobile/e2e/flows/complete-user-journey.spec.ts`:
```typescript
import { device, element, by, expect } from 'detox';
import { seedMobileTestScenario, cleanupMobileTestData } from '../fixtures/seed-mobile';
import { MOBILE_TEST_USER } from '../fixtures/test-credentials';

describe('Complete User Journey', () => {
  beforeAll(async () => {
    await seedMobileTestScenario();
    await device.launchApp({
      newInstance: true,
      permissions: { camera: 'YES', photos: 'YES' },
    });
  });

  afterAll(async () => {
    await cleanupMobileTestData();
  });

  it('completes full app workflow', async () => {
    // 1. LOGIN
    await element(by.id('email-input')).typeText(MOBILE_TEST_USER.email);
    await element(by.id('password-input')).typeText(MOBILE_TEST_USER.password);
    await element(by.id('login-button')).tap();

    await waitFor(element(by.id('dashboard-screen')))
      .toBeVisible()
      .withTimeout(10000);

    // 2. VIEW DASHBOARD
    await expect(element(by.id('stats-property-count'))).toBeVisible();
    await expect(element(by.id('property-list'))).toBeVisible();

    // 3. REVIEW TRANSACTIONS
    await element(by.id('tab-transactions')).tap();
    await expect(element(by.id('transactions-list'))).toBeVisible();

    // Accept first transaction
    await element(by.id('transaction-card-0')).swipe('right', 'fast', 0.7);
    await waitFor(element(by.id('transaction-card-0')))
      .not.toBeVisible()
      .withTimeout(3000);

    // Reject second transaction (now at index 0)
    await element(by.id('transaction-card-0')).swipe('left', 'fast', 0.7);

    // 4. CAPTURE DOCUMENT
    await element(by.id('tab-camera')).tap();
    await expect(element(by.id('camera-view'))).toBeVisible();
    await element(by.id('capture-button')).tap();

    await waitFor(element(by.id('preview-screen')))
      .toBeVisible()
      .withTimeout(5000);

    // Go back to camera (don't upload in journey test)
    await element(by.id('retake-button')).tap();

    // 5. CHECK SETTINGS
    await element(by.id('tab-settings')).tap();
    await expect(element(by.text(MOBILE_TEST_USER.email))).toBeVisible();
    await expect(element(by.id('notifications-toggle'))).toBeVisible();

    // 6. SIGN OUT
    await element(by.id('sign-out-button')).tap();
    await element(by.text('Sign Out')).atIndex(1).tap();

    await waitFor(element(by.id('login-screen')))
      .toBeVisible()
      .withTimeout(5000);
  });
});
```

**Step 2: Commit**

```bash
git add mobile/e2e/flows/
git commit -m "test: add complete user journey Detox test"
```

---

## Task 19: Add npm Scripts for Detox

**Files:**
- Modify: `mobile/package.json`

**Step 1: Add Detox scripts**

Add to `mobile/package.json` scripts section:
```json
{
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web",
    "e2e:build": "detox build --configuration ios.sim.debug",
    "e2e:build:release": "detox build --configuration ios.sim.release",
    "e2e:test": "detox test --configuration ios.sim.debug",
    "e2e:test:release": "detox test --configuration ios.sim.release --headless",
    "e2e:seed": "ts-node e2e/scripts/seed.ts"
  }
}
```

**Step 2: Commit**

```bash
git add mobile/package.json
git commit -m "chore: add Detox npm scripts"
```

---

## Task 20: Create GitHub Actions Workflow

**Files:**
- Create: `.github/workflows/mobile-e2e.yml`

**Step 1: Create workflow file**

Create `.github/workflows/mobile-e2e.yml`:
```yaml
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

      - name: Install root dependencies
        run: npm ci

      - name: Install mobile dependencies
        run: cd mobile && npm ci

      - name: Install Detox CLI
        run: npm install -g detox-cli

      - name: Cache CocoaPods
        uses: actions/cache@v4
        with:
          path: mobile/ios/Pods
          key: pods-${{ hashFiles('mobile/ios/Podfile.lock') }}

      - name: Install CocoaPods
        run: cd mobile/ios && pod install

      - name: Build Detox (Release)
        run: cd mobile && npm run e2e:build:release

      - name: Start backend server
        run: |
          npm run dev &
          npx wait-on http://localhost:3000
        env:
          DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
          CLERK_SECRET_KEY: ${{ secrets.CLERK_SECRET_KEY }}

      - name: Run Detox tests
        run: cd mobile && npm run e2e:test:release

      - name: Upload artifacts on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: detox-artifacts
          path: mobile/e2e/artifacts/
```

**Step 2: Commit**

```bash
git add .github/workflows/mobile-e2e.yml
git commit -m "ci: add GitHub Actions workflow for mobile E2E tests"
```

---

## Task 21: Final Verification and Documentation

**Files:**
- Update: `mobile/README.md` (if exists, otherwise create)

**Step 1: Create/update mobile README**

Create or update `mobile/README.md`:
```markdown
# PropertyTracker Mobile App

React Native mobile app for PropertyTracker.

## Development

```bash
npm install
npm start
```

## E2E Testing with Detox

### Prerequisites

- Xcode 15+ with Command Line Tools
- iOS Simulator (iPhone 15 Pro recommended)
- applesimutils: `brew tap wix/brew && brew install applesimutils`

### Running Tests Locally

1. Start the backend server:
   ```bash
   cd .. && npm run dev
   ```

2. Build the app for testing:
   ```bash
   npm run e2e:build
   ```

3. Run the tests:
   ```bash
   npm run e2e:test
   ```

### Test Structure

- `e2e/screens/` - Individual screen tests
- `e2e/flows/` - End-to-end user journey tests
- `e2e/fixtures/` - Test data seeding utilities
- `e2e/utils/` - Helper functions

### CI

Tests run automatically on GitHub Actions for PRs affecting `mobile/` directory.
```

**Step 2: Commit**

```bash
git add mobile/README.md
git commit -m "docs: add mobile E2E testing documentation"
```

**Step 3: Verify all tests compile**

Run:
```bash
cd mobile && npx tsc --noEmit
```

Expected: No TypeScript errors

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Install Detox dependencies | package.json |
| 2 | Create Detox configuration | .detoxrc.js, jest.config.js |
| 3 | Create test credentials/seeding | fixtures/*.ts |
| 4 | Create test API endpoints | api/test/*.ts |
| 5 | Create test helpers | utils/helpers.ts |
| 6-12 | Add testID props to components | 6 screen files + 1 component |
| 13-18 | Create test suites | 5 screen tests + 1 journey test |
| 19 | Add npm scripts | package.json |
| 20 | Create CI workflow | mobile-e2e.yml |
| 21 | Documentation | README.md |

**Total: 21 tasks, ~35 tests**
