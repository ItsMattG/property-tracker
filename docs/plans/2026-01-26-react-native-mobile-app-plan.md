# React Native Mobile App Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a React Native companion mobile app with dashboard, transaction categorization, and document capture.

**Architecture:** Expo-managed app in `/mobile` directory, using tRPC client with JWT auth against existing Next.js backend. Minimal backend changes: add mobile auth endpoint and push token registration.

**Tech Stack:** Expo SDK 52, React Navigation, tRPC React Query, NativeWind, Expo Camera, Expo SecureStore, Expo Notifications

---

## Task 1: Backend - Push Tokens Database Table

**Files:**
- Modify: `src/server/db/schema.ts`
- Create: `drizzle/migrations/XXXX_add_push_tokens.sql` (via drizzle-kit)

**Step 1: Add push_tokens table to schema**

Add after existing notification tables in `src/server/db/schema.ts`:

```typescript
export const pushTokens = pgTable("push_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  platform: text("platform", { enum: ["ios", "android"] }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const pushTokensRelations = relations(pushTokens, ({ one }) => ({
  user: one(users, {
    fields: [pushTokens.userId],
    references: [users.id],
  }),
}));
```

**Step 2: Generate migration**

Run: `npx drizzle-kit generate`
Expected: New migration file created

**Step 3: Apply migration**

Run: `npx drizzle-kit push`
Expected: Table created successfully

**Step 4: Commit**

```bash
git add src/server/db/schema.ts drizzle/
git commit -m "feat: add push_tokens table for mobile notifications"
```

---

## Task 2: Backend - Mobile Auth Router

**Files:**
- Create: `src/server/routers/mobileAuth.ts`
- Modify: `src/server/routers/_app.ts`

**Step 1: Create mobile auth router**

Create `src/server/routers/mobileAuth.ts`:

```typescript
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../trpc";
import { users, pushTokens } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { sign, verify } from "jsonwebtoken";
import bcrypt from "bcryptjs";

const JWT_SECRET = process.env.JWT_SECRET || "development-secret-change-me";
const JWT_EXPIRES_IN = "30d";

export interface MobileJwtPayload {
  userId: string;
  email: string;
}

export function verifyMobileToken(token: string): MobileJwtPayload {
  return verify(token, JWT_SECRET) as MobileJwtPayload;
}

export const mobileAuthRouter = router({
  // Login with email/password
  login: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.query.users.findFirst({
        where: eq(users.email, input.email),
      });

      if (!user || !user.mobilePasswordHash) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password",
        });
      }

      const validPassword = await bcrypt.compare(
        input.password,
        user.mobilePasswordHash
      );

      if (!validPassword) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password",
        });
      }

      const token = sign(
        { userId: user.id, email: user.email } as MobileJwtPayload,
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      return {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      };
    }),

  // Register push token
  registerDevice: publicProcedure
    .input(
      z.object({
        token: z.string().min(1),
        pushToken: z.string().min(1),
        platform: z.enum(["ios", "android"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify JWT
      let payload: MobileJwtPayload;
      try {
        payload = verifyMobileToken(input.token);
      } catch {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid token",
        });
      }

      // Upsert push token
      const existing = await ctx.db.query.pushTokens.findFirst({
        where: eq(pushTokens.token, input.pushToken),
      });

      if (existing) {
        // Update if owned by different user
        if (existing.userId !== payload.userId) {
          await ctx.db
            .update(pushTokens)
            .set({ userId: payload.userId })
            .where(eq(pushTokens.id, existing.id));
        }
        return { success: true };
      }

      await ctx.db.insert(pushTokens).values({
        userId: payload.userId,
        token: input.pushToken,
        platform: input.platform,
      });

      return { success: true };
    }),

  // Unregister push token
  unregisterDevice: publicProcedure
    .input(
      z.object({
        token: z.string().min(1),
        pushToken: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify JWT
      let payload: MobileJwtPayload;
      try {
        payload = verifyMobileToken(input.token);
      } catch {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid token",
        });
      }

      await ctx.db
        .delete(pushTokens)
        .where(
          and(
            eq(pushTokens.userId, payload.userId),
            eq(pushTokens.token, input.pushToken)
          )
        );

      return { success: true };
    }),

  // Verify token is still valid
  verify: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      try {
        const payload = verifyMobileToken(input.token);
        const user = await ctx.db.query.users.findFirst({
          where: eq(users.id, payload.userId),
        });

        if (!user) {
          return { valid: false, user: null };
        }

        return {
          valid: true,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
          },
        };
      } catch {
        return { valid: false, user: null };
      }
    }),
});
```

**Step 2: Add mobilePasswordHash to users table**

In `src/server/db/schema.ts`, add to users table:

```typescript
mobilePasswordHash: text("mobile_password_hash"),
```

**Step 3: Generate and apply migration**

Run: `npx drizzle-kit generate && npx drizzle-kit push`
Expected: Column added successfully

**Step 4: Register router in _app.ts**

Add import and router:

```typescript
import { mobileAuthRouter } from "./mobileAuth";

// In appRouter:
mobileAuth: mobileAuthRouter,
```

**Step 5: Commit**

```bash
git add src/server/routers/mobileAuth.ts src/server/routers/_app.ts src/server/db/schema.ts drizzle/
git commit -m "feat: add mobile auth router with JWT login"
```

---

## Task 3: Backend - Mobile Password Setup UI

**Files:**
- Create: `src/app/(dashboard)/settings/mobile/page.tsx`
- Modify: `src/app/(dashboard)/settings/page.tsx` (add link)

**Step 1: Create mobile settings page**

Create `src/app/(dashboard)/settings/mobile/page.tsx`:

```typescript
"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Smartphone, Check } from "lucide-react";

export default function MobileSettingsPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const { data: hasPassword, refetch } = trpc.user.hasMobilePassword.useQuery();

  const setMobilePassword = trpc.user.setMobilePassword.useMutation({
    onSuccess: () => {
      setSuccess(true);
      setPassword("");
      setConfirmPassword("");
      refetch();
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setMobilePassword.mutate({ password });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mobile App Access</h1>
        <p className="text-muted-foreground">
          Set up a password to access PropertyTracker from the mobile app
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Mobile Password
          </CardTitle>
          <CardDescription>
            This password is used only for mobile app login. Your web login remains unchanged.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasPassword && (
            <Alert className="mb-4">
              <Check className="h-4 w-4" />
              <AlertDescription>
                Mobile password is set. You can update it below.
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="password">
                {hasPassword ? "New Password" : "Password"}
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
              />
            </div>
            <div>
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert>
                <Check className="h-4 w-4" />
                <AlertDescription>
                  Mobile password {hasPassword ? "updated" : "set"} successfully
                </AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              disabled={setMobilePassword.isPending}
            >
              {setMobilePassword.isPending
                ? "Saving..."
                : hasPassword
                ? "Update Password"
                : "Set Password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 2: Add user router endpoints**

Create or modify user router to add:

```typescript
hasMobilePassword: protectedProcedure.query(async ({ ctx }) => {
  const user = await ctx.db.query.users.findFirst({
    where: eq(users.id, ctx.user.id),
    columns: { mobilePasswordHash: true },
  });
  return !!user?.mobilePasswordHash;
}),

setMobilePassword: writeProcedure
  .input(z.object({ password: z.string().min(8) }))
  .mutation(async ({ ctx, input }) => {
    const hash = await bcrypt.hash(input.password, 12);
    await ctx.db
      .update(users)
      .set({ mobilePasswordHash: hash })
      .where(eq(users.id, ctx.user.id));
    return { success: true };
  }),
```

**Step 3: Add link in settings page**

Add navigation link to mobile settings.

**Step 4: Commit**

```bash
git add src/app/\(dashboard\)/settings/mobile/
git commit -m "feat: add mobile password setup page"
```

---

## Task 4: Expo Project Setup

**Files:**
- Create: `mobile/` directory with Expo project

**Step 1: Initialize Expo project**

Run from project root:
```bash
npx create-expo-app@latest mobile --template blank-typescript
cd mobile
```

**Step 2: Install dependencies**

```bash
npx expo install expo-secure-store expo-camera expo-image-picker expo-notifications expo-device
npm install @react-navigation/native @react-navigation/bottom-tabs react-native-screens react-native-safe-area-context
npm install @tanstack/react-query @trpc/client @trpc/react-query superjson
npm install nativewind tailwindcss
npm install react-native-gesture-handler react-native-reanimated
```

**Step 3: Configure NativeWind**

Create `mobile/tailwind.config.js`:
```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

Create `mobile/global.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**Step 4: Configure babel**

Update `mobile/babel.config.js`:
```javascript
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: ["react-native-reanimated/plugin"],
  };
};
```

**Step 5: Update app.json**

```json
{
  "expo": {
    "name": "PropertyTracker",
    "slug": "property-tracker",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "automatic",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.propertytracker.app",
      "infoPlist": {
        "NSCameraUsageDescription": "PropertyTracker needs camera access to capture receipts and documents"
      }
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      },
      "package": "com.propertytracker.app",
      "permissions": ["CAMERA"]
    },
    "plugins": [
      "expo-camera",
      "expo-secure-store"
    ]
  }
}
```

**Step 6: Create project structure**

```bash
mkdir -p src/app src/components src/lib src/hooks
```

**Step 7: Commit**

```bash
git add mobile/
git commit -m "feat: initialize Expo project with dependencies"
```

---

## Task 5: Mobile - tRPC Client Setup

**Files:**
- Create: `mobile/src/lib/trpc.ts`
- Create: `mobile/src/lib/auth.ts`

**Step 1: Create auth utility**

Create `mobile/src/lib/auth.ts`:

```typescript
import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "auth_token";
const USER_KEY = "auth_user";

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
}

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function getUser(): Promise<AuthUser | null> {
  const json = await SecureStore.getItemAsync(USER_KEY);
  return json ? JSON.parse(json) : null;
}

export async function setUser(user: AuthUser): Promise<void> {
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
}

export async function clearUser(): Promise<void> {
  await SecureStore.deleteItemAsync(USER_KEY);
}

export async function clearAuth(): Promise<void> {
  await Promise.all([clearToken(), clearUser()]);
}
```

**Step 2: Create tRPC client**

Create `mobile/src/lib/trpc.ts`:

```typescript
import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { getToken } from "./auth";
import type { AppRouter } from "../../../src/server/routers/_app";

export const trpc = createTRPCReact<AppRouter>();

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

export function createTRPCClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${API_URL}/api/trpc`,
        transformer: superjson,
        async headers() {
          const token = await getToken();
          return token
            ? { Authorization: `Bearer ${token}` }
            : {};
        },
      }),
    ],
  });
}
```

**Step 3: Create QueryClient provider**

Create `mobile/src/lib/providers.tsx`:

```typescript
import React, { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trpc, createTRPCClient } from "./trpc";

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        staleTime: 30000,
      },
    },
  }));
  const [trpcClient] = useState(() => createTRPCClient());

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
```

**Step 4: Commit**

```bash
git add mobile/src/lib/
git commit -m "feat: add tRPC client and auth utilities"
```

---

## Task 6: Mobile - Auth Context and Login Screen

**Files:**
- Create: `mobile/src/lib/AuthContext.tsx`
- Create: `mobile/src/app/LoginScreen.tsx`

**Step 1: Create auth context**

Create `mobile/src/lib/AuthContext.tsx`:

```typescript
import React, { createContext, useContext, useEffect, useState } from "react";
import { getToken, getUser, setToken, setUser, clearAuth, AuthUser } from "./auth";
import { trpc } from "./trpc";

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loginMutation = trpc.mobileAuth.login.useMutation();

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const [token, savedUser] = await Promise.all([getToken(), getUser()]);
      if (token && savedUser) {
        setUserState(savedUser);
      }
    } catch (error) {
      console.error("Auth check failed:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function login(email: string, password: string) {
    const result = await loginMutation.mutateAsync({ email, password });
    await setToken(result.token);
    await setUser(result.user);
    setUserState(result.user);
  }

  async function logout() {
    await clearAuth();
    setUserState(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
```

**Step 2: Create login screen**

Create `mobile/src/app/LoginScreen.tsx`:

```typescript
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useAuth } from "../lib/AuthContext";

export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  async function handleLogin() {
    if (!email || !password) {
      setError("Please enter email and password");
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      await login(email, password);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Login failed. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-white"
    >
      <View className="flex-1 justify-center px-6">
        <Text className="text-3xl font-bold text-center mb-2">
          PropertyTracker
        </Text>
        <Text className="text-gray-500 text-center mb-8">
          Sign in with your mobile password
        </Text>

        <View className="space-y-4">
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-1">Email</Text>
            <TextInput
              className="border border-gray-300 rounded-lg px-4 py-3 text-base"
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
          </View>

          <View>
            <Text className="text-sm font-medium text-gray-700 mb-1">
              Password
            </Text>
            <TextInput
              className="border border-gray-300 rounded-lg px-4 py-3 text-base"
              placeholder="Mobile password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
            />
          </View>

          {error ? (
            <Text className="text-red-500 text-sm">{error}</Text>
          ) : null}

          <TouchableOpacity
            className={`rounded-lg py-4 ${
              isLoading ? "bg-blue-400" : "bg-blue-600"
            }`}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white text-center font-semibold text-base">
                Sign In
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <Text className="text-gray-500 text-center mt-8 text-sm">
          Set up mobile access from Settings → Mobile App on the web
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}
```

**Step 3: Commit**

```bash
git add mobile/src/lib/AuthContext.tsx mobile/src/app/LoginScreen.tsx
git commit -m "feat: add auth context and login screen"
```

---

## Task 7: Mobile - Navigation Structure

**Files:**
- Create: `mobile/src/app/Navigation.tsx`
- Modify: `mobile/App.tsx`

**Step 1: Create navigation structure**

Create `mobile/src/app/Navigation.tsx`:

```typescript
import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { View, Text, ActivityIndicator } from "react-native";
import { useAuth } from "../lib/AuthContext";
import { LoginScreen } from "./LoginScreen";

// Placeholder screens - will be replaced
function DashboardScreen() {
  return (
    <View className="flex-1 items-center justify-center">
      <Text>Dashboard</Text>
    </View>
  );
}

function TransactionsScreen() {
  return (
    <View className="flex-1 items-center justify-center">
      <Text>Transactions</Text>
    </View>
  );
}

function CameraScreen() {
  return (
    <View className="flex-1 items-center justify-center">
      <Text>Camera</Text>
    </View>
  );
}

function SettingsScreen() {
  return (
    <View className="flex-1 items-center justify-center">
      <Text>Settings</Text>
    </View>
  );
}

const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: "#2563eb",
        tabBarInactiveTintColor: "#6b7280",
        headerShown: true,
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: "Dashboard",
        }}
      />
      <Tab.Screen
        name="Transactions"
        component={TransactionsScreen}
        options={{
          tabBarLabel: "Review",
        }}
      />
      <Tab.Screen
        name="Camera"
        component={CameraScreen}
        options={{
          tabBarLabel: "Capture",
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: "Settings",
        }}
      />
    </Tab.Navigator>
  );
}

export function Navigation() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? <MainTabs /> : <LoginScreen />}
    </NavigationContainer>
  );
}
```

**Step 2: Update App.tsx**

Replace `mobile/App.tsx`:

```typescript
import "./global.css";
import React from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { TRPCProvider } from "./src/lib/providers";
import { AuthProvider } from "./src/lib/AuthContext";
import { Navigation } from "./src/app/Navigation";

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <TRPCProvider>
          <AuthProvider>
            <Navigation />
            <StatusBar style="auto" />
          </AuthProvider>
        </TRPCProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
```

**Step 3: Test navigation**

Run: `cd mobile && npx expo start`
Expected: App launches with login screen

**Step 4: Commit**

```bash
git add mobile/src/app/Navigation.tsx mobile/App.tsx
git commit -m "feat: add bottom tab navigation structure"
```

---

## Task 8: Mobile - Dashboard Screen

**Files:**
- Create: `mobile/src/app/DashboardScreen.tsx`
- Update: `mobile/src/app/Navigation.tsx`

**Step 1: Create dashboard screen**

Create `mobile/src/app/DashboardScreen.tsx`:

```typescript
import React from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { trpc } from "../lib/trpc";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function DashboardScreen() {
  const {
    data: stats,
    isLoading,
    refetch,
    isRefetching,
  } = trpc.stats.dashboard.useQuery();

  const { data: properties } = trpc.property.list.useQuery();

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
      }
    >
      <View className="p-4 space-y-4">
        {/* Stats Cards */}
        <View className="flex-row space-x-3">
          <View className="flex-1 bg-white rounded-xl p-4 shadow-sm">
            <Text className="text-gray-500 text-sm">Properties</Text>
            <Text className="text-2xl font-bold">
              {isLoading ? "-" : stats?.propertyCount ?? 0}
            </Text>
          </View>
          <View className="flex-1 bg-white rounded-xl p-4 shadow-sm">
            <Text className="text-gray-500 text-sm">To Review</Text>
            <Text className="text-2xl font-bold text-orange-600">
              {isLoading ? "-" : stats?.uncategorizedCount ?? 0}
            </Text>
          </View>
        </View>

        {/* Properties List */}
        <View className="bg-white rounded-xl shadow-sm">
          <View className="p-4 border-b border-gray-100">
            <Text className="font-semibold text-lg">Properties</Text>
          </View>
          {properties?.length === 0 ? (
            <View className="p-4">
              <Text className="text-gray-500 text-center">
                No properties yet
              </Text>
            </View>
          ) : (
            properties?.map((property, index) => (
              <TouchableOpacity
                key={property.id}
                className={`p-4 ${
                  index < (properties?.length ?? 0) - 1
                    ? "border-b border-gray-100"
                    : ""
                }`}
              >
                <Text className="font-medium">{property.address}</Text>
                <Text className="text-gray-500 text-sm">
                  {property.suburb}, {property.state} {property.postcode}
                </Text>
                <Text className="text-blue-600 font-medium mt-1">
                  {formatCurrency(Number(property.purchasePrice))}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      </View>
    </ScrollView>
  );
}
```

**Step 2: Update navigation to use real screen**

In `Navigation.tsx`, import and use `DashboardScreen`.

**Step 3: Commit**

```bash
git add mobile/src/app/DashboardScreen.tsx mobile/src/app/Navigation.tsx
git commit -m "feat: add dashboard screen with property list"
```

---

## Task 9: Mobile - Transactions Review Screen

**Files:**
- Create: `mobile/src/app/TransactionsScreen.tsx`
- Create: `mobile/src/components/SwipeableTransaction.tsx`

**Step 1: Create swipeable transaction component**

Create `mobile/src/components/SwipeableTransaction.tsx`:

```typescript
import React from "react";
import { View, Text, Animated, StyleSheet } from "react-native";
import { RectButton } from "react-native-gesture-handler";
import Swipeable from "react-native-gesture-handler/Swipeable";

interface Transaction {
  id: string;
  description: string;
  amount: string;
  date: string;
  suggestedCategory: string | null;
  suggestionConfidence: string | null;
}

interface Props {
  transaction: Transaction;
  onAccept: () => void;
  onReject: () => void;
}

export function SwipeableTransaction({ transaction, onAccept, onReject }: Props) {
  function renderLeftActions(
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) {
    const scale = dragX.interpolate({
      inputRange: [0, 100],
      outputRange: [0, 1],
      extrapolate: "clamp",
    });

    return (
      <RectButton style={styles.leftAction} onPress={onAccept}>
        <Animated.Text style={[styles.actionText, { transform: [{ scale }] }]}>
          Accept
        </Animated.Text>
      </RectButton>
    );
  }

  function renderRightActions(
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) {
    const scale = dragX.interpolate({
      inputRange: [-100, 0],
      outputRange: [1, 0],
      extrapolate: "clamp",
    });

    return (
      <RectButton style={styles.rightAction} onPress={onReject}>
        <Animated.Text style={[styles.actionText, { transform: [{ scale }] }]}>
          Personal
        </Animated.Text>
      </RectButton>
    );
  }

  const amount = parseFloat(transaction.amount);
  const isIncome = amount > 0;

  return (
    <Swipeable
      renderLeftActions={renderLeftActions}
      renderRightActions={renderRightActions}
      onSwipeableLeftOpen={onAccept}
      onSwipeableRightOpen={onReject}
    >
      <View className="bg-white p-4 border-b border-gray-100">
        <View className="flex-row justify-between items-start">
          <View className="flex-1 mr-4">
            <Text className="font-medium" numberOfLines={1}>
              {transaction.description}
            </Text>
            <Text className="text-gray-500 text-sm mt-1">
              {transaction.date}
            </Text>
            {transaction.suggestedCategory && (
              <View className="flex-row items-center mt-2">
                <View className="bg-blue-100 rounded-full px-2 py-0.5">
                  <Text className="text-blue-700 text-xs">
                    {transaction.suggestedCategory.replace(/_/g, " ")}
                  </Text>
                </View>
                {transaction.suggestionConfidence && (
                  <Text className="text-gray-400 text-xs ml-2">
                    {Math.round(parseFloat(transaction.suggestionConfidence))}%
                  </Text>
                )}
              </View>
            )}
          </View>
          <Text
            className={`font-semibold ${
              isIncome ? "text-green-600" : "text-gray-900"
            }`}
          >
            {isIncome ? "+" : ""}${Math.abs(amount).toFixed(2)}
          </Text>
        </View>
      </View>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  leftAction: {
    backgroundColor: "#22c55e",
    justifyContent: "center",
    alignItems: "flex-start",
    paddingLeft: 20,
    flex: 1,
  },
  rightAction: {
    backgroundColor: "#6b7280",
    justifyContent: "center",
    alignItems: "flex-end",
    paddingRight: 20,
    flex: 1,
  },
  actionText: {
    color: "white",
    fontWeight: "600",
    fontSize: 14,
  },
});
```

**Step 2: Create transactions screen**

Create `mobile/src/app/TransactionsScreen.tsx`:

```typescript
import React from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { trpc } from "../lib/trpc";
import { SwipeableTransaction } from "../components/SwipeableTransaction";

export function TransactionsScreen() {
  const utils = trpc.useUtils();

  const {
    data,
    isLoading,
    refetch,
    isRefetching,
  } = trpc.categorization.getPendingReview.useQuery({
    confidenceFilter: "all",
    limit: 50,
    offset: 0,
  });

  const acceptMutation = trpc.categorization.acceptSuggestion.useMutation({
    onSuccess: () => {
      utils.categorization.getPendingReview.invalidate();
      utils.stats.dashboard.invalidate();
    },
  });

  const rejectMutation = trpc.categorization.rejectSuggestion.useMutation({
    onSuccess: () => {
      utils.categorization.getPendingReview.invalidate();
      utils.stats.dashboard.invalidate();
    },
  });

  function handleAccept(transactionId: string) {
    acceptMutation.mutate({ transactionId });
  }

  function handleReject(transactionId: string) {
    rejectMutation.mutate({
      transactionId,
      newCategory: "personal",
    });
  }

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  const transactions = data?.transactions ?? [];

  return (
    <View className="flex-1 bg-gray-50">
      {transactions.length === 0 ? (
        <View className="flex-1 items-center justify-center p-4">
          <Text className="text-gray-500 text-center text-lg">
            All caught up!
          </Text>
          <Text className="text-gray-400 text-center mt-2">
            No transactions need review
          </Text>
        </View>
      ) : (
        <>
          <View className="bg-blue-50 p-3">
            <Text className="text-blue-800 text-sm text-center">
              Swipe right to accept • Swipe left to mark personal
            </Text>
          </View>
          <FlatList
            data={transactions}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <SwipeableTransaction
                transaction={item}
                onAccept={() => handleAccept(item.id)}
                onReject={() => handleReject(item.id)}
              />
            )}
            refreshControl={
              <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
            }
          />
        </>
      )}
    </View>
  );
}
```

**Step 3: Update navigation**

Import and use `TransactionsScreen` in Navigation.tsx.

**Step 4: Commit**

```bash
git add mobile/src/app/TransactionsScreen.tsx mobile/src/components/SwipeableTransaction.tsx
git commit -m "feat: add transactions review screen with swipe gestures"
```

---

## Task 10: Mobile - Camera/Document Capture Screen

**Files:**
- Create: `mobile/src/app/CameraScreen.tsx`

**Step 1: Create camera screen**

Create `mobile/src/app/CameraScreen.tsx`:

```typescript
import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { trpc } from "../lib/trpc";

type CaptureStep = "camera" | "preview" | "uploading";

export function CameraScreen() {
  const [step, setStep] = useState<CaptureStep>("camera");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const { data: properties } = trpc.property.list.useQuery();
  const getUploadUrl = trpc.documents.getUploadUrl.useMutation();
  const createDocument = trpc.documents.create.useMutation();

  async function takePicture() {
    if (!cameraRef.current) return;

    const photo = await cameraRef.current.takePictureAsync({
      quality: 0.8,
    });

    if (photo?.uri) {
      setImageUri(photo.uri);
      setStep("preview");
    }
  }

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setStep("preview");
    }
  }

  async function uploadDocument() {
    if (!imageUri || !properties?.[0]) {
      Alert.alert("Error", "Please add a property first");
      return;
    }

    setStep("uploading");

    try {
      // Get file info
      const response = await fetch(imageUri);
      const blob = await response.blob();
      const fileName = `receipt-${Date.now()}.jpg`;

      // Get signed upload URL
      const { signedUrl, storagePath } = await getUploadUrl.mutateAsync({
        fileName,
        fileType: "image/jpeg",
        fileSize: blob.size,
        propertyId: properties[0].id, // Default to first property for MVP
      });

      // Upload to Supabase
      await fetch(signedUrl, {
        method: "PUT",
        headers: { "Content-Type": "image/jpeg" },
        body: blob,
      });

      // Create document record
      await createDocument.mutateAsync({
        storagePath,
        fileName,
        fileType: "image/jpeg",
        fileSize: blob.size,
        propertyId: properties[0].id,
        category: "receipt",
      });

      Alert.alert("Success", "Document uploaded and processing", [
        { text: "OK", onPress: () => resetCamera() },
      ]);
    } catch (error) {
      console.error("Upload error:", error);
      Alert.alert("Error", "Failed to upload document");
      setStep("preview");
    }
  }

  function resetCamera() {
    setImageUri(null);
    setStep("camera");
  }

  if (!permission) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View className="flex-1 items-center justify-center p-4">
        <Text className="text-center mb-4">
          Camera access is needed to capture documents
        </Text>
        <TouchableOpacity
          className="bg-blue-600 rounded-lg px-6 py-3"
          onPress={requestPermission}
        >
          <Text className="text-white font-semibold">Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (step === "uploading") {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#2563eb" />
        <Text className="mt-4 text-gray-600">Uploading document...</Text>
      </View>
    );
  }

  if (step === "preview" && imageUri) {
    return (
      <View className="flex-1 bg-black">
        <Image
          source={{ uri: imageUri }}
          className="flex-1"
          resizeMode="contain"
        />
        <View className="flex-row p-4 space-x-4">
          <TouchableOpacity
            className="flex-1 bg-gray-600 rounded-lg py-4"
            onPress={resetCamera}
          >
            <Text className="text-white text-center font-semibold">Retake</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 bg-blue-600 rounded-lg py-4"
            onPress={uploadDocument}
          >
            <Text className="text-white text-center font-semibold">Upload</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <CameraView ref={cameraRef} className="flex-1" facing="back">
        <View className="flex-1 justify-end items-center pb-8">
          <View className="flex-row items-center space-x-6">
            <TouchableOpacity
              className="bg-white/20 rounded-full p-4"
              onPress={pickImage}
            >
              <Text className="text-white text-sm">Gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="bg-white rounded-full w-20 h-20 border-4 border-gray-300"
              onPress={takePicture}
            />
            <View className="w-16" />
          </View>
        </View>
      </CameraView>
    </View>
  );
}
```

**Step 2: Update navigation**

Import and use `CameraScreen` in Navigation.tsx.

**Step 3: Commit**

```bash
git add mobile/src/app/CameraScreen.tsx mobile/src/app/Navigation.tsx
git commit -m "feat: add camera screen for document capture"
```

---

## Task 11: Mobile - Settings Screen

**Files:**
- Create: `mobile/src/app/SettingsScreen.tsx`

**Step 1: Create settings screen**

Create `mobile/src/app/SettingsScreen.tsx`:

```typescript
import React from "react";
import { View, Text, TouchableOpacity, Switch, Alert } from "react-native";
import { useAuth } from "../lib/AuthContext";
import { trpc } from "../lib/trpc";

export function SettingsScreen() {
  const { user, logout } = useAuth();
  const { data: preferences } = trpc.notification.getPreferences.useQuery();
  const updatePreferences = trpc.notification.updatePreferences.useMutation();

  function handleLogout() {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: logout },
    ]);
  }

  function togglePush(value: boolean) {
    updatePreferences.mutate({ pushEnabled: value });
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Account Section */}
      <View className="mt-6">
        <Text className="px-4 pb-2 text-sm font-medium text-gray-500 uppercase">
          Account
        </Text>
        <View className="bg-white">
          <View className="p-4 border-b border-gray-100">
            <Text className="text-sm text-gray-500">Email</Text>
            <Text className="font-medium">{user?.email}</Text>
          </View>
          <View className="p-4">
            <Text className="text-sm text-gray-500">Name</Text>
            <Text className="font-medium">{user?.name || "Not set"}</Text>
          </View>
        </View>
      </View>

      {/* Notifications Section */}
      <View className="mt-6">
        <Text className="px-4 pb-2 text-sm font-medium text-gray-500 uppercase">
          Notifications
        </Text>
        <View className="bg-white">
          <View className="p-4 flex-row justify-between items-center">
            <View>
              <Text className="font-medium">Push Notifications</Text>
              <Text className="text-sm text-gray-500">
                Receive alerts on your device
              </Text>
            </View>
            <Switch
              value={preferences?.pushEnabled ?? true}
              onValueChange={togglePush}
              trackColor={{ true: "#2563eb" }}
            />
          </View>
        </View>
      </View>

      {/* Sign Out */}
      <View className="mt-6">
        <TouchableOpacity
          className="bg-white p-4"
          onPress={handleLogout}
        >
          <Text className="text-red-600 text-center font-medium">
            Sign Out
          </Text>
        </TouchableOpacity>
      </View>

      {/* Version */}
      <Text className="text-center text-gray-400 text-sm mt-8">
        PropertyTracker Mobile v1.0.0
      </Text>
    </View>
  );
}
```

**Step 2: Update navigation**

Import and use `SettingsScreen` in Navigation.tsx.

**Step 3: Commit**

```bash
git add mobile/src/app/SettingsScreen.tsx mobile/src/app/Navigation.tsx
git commit -m "feat: add settings screen with notifications toggle"
```

---

## Task 12: Backend - Mobile Auth Middleware

**Files:**
- Modify: `src/server/trpc.ts`
- Create: `src/pages/api/trpc/[trpc].ts` (if not exists, modify existing)

**Step 1: Add mobile auth middleware**

Add to `src/server/trpc.ts`:

```typescript
import { verifyMobileToken, MobileJwtPayload } from "./routers/mobileAuth";

export const mobileProcedure = t.procedure.use(async ({ ctx, next }) => {
  // Check for Bearer token in Authorization header
  const authHeader = ctx.req?.headers?.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  const token = authHeader.substring(7);
  let payload: MobileJwtPayload;

  try {
    payload = verifyMobileToken(token);
  } catch {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  const user = await ctx.db.query.users.findFirst({
    where: eq(users.id, payload.userId),
  });

  if (!user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  // For mobile, always use user's own portfolio
  const portfolio: PortfolioContext = {
    ownerId: user.id,
    role: "owner",
    canWrite: true,
    canManageMembers: true,
    canManageBanks: true,
    canViewAuditLog: true,
    canUploadDocuments: true,
  };

  return next({
    ctx: {
      ...ctx,
      user,
      portfolio,
    },
  });
});
```

**Step 2: Update protectedProcedure to support both auth methods**

Modify `protectedProcedure` to check for JWT if Clerk auth fails:

```typescript
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  // Try Clerk auth first (web)
  if (ctx.clerkId) {
    // ... existing Clerk auth logic
  }

  // Fall back to JWT auth (mobile)
  const authHeader = ctx.req?.headers?.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    try {
      const payload = verifyMobileToken(token);
      const user = await ctx.db.query.users.findFirst({
        where: eq(users.id, payload.userId),
      });

      if (user) {
        const portfolio: PortfolioContext = {
          ownerId: user.id,
          role: "owner",
          canWrite: true,
          canManageMembers: true,
          canManageBanks: true,
          canViewAuditLog: true,
          canUploadDocuments: true,
        };

        return next({ ctx: { ...ctx, user, portfolio } });
      }
    } catch {
      // Invalid JWT
    }
  }

  throw new TRPCError({ code: "UNAUTHORIZED" });
});
```

**Step 3: Add request to context**

Update `createTRPCContext` to include request headers:

```typescript
export const createTRPCContext = async (opts?: { req?: Request }) => {
  const { userId: clerkId } = await auth();
  const cookieStore = await cookies();
  const portfolioOwnerId = cookieStore.get("portfolio_owner_id")?.value;

  return {
    db,
    clerkId,
    portfolioOwnerId,
    req: opts?.req,
  };
};
```

**Step 4: Commit**

```bash
git add src/server/trpc.ts
git commit -m "feat: add mobile JWT auth support to tRPC middleware"
```

---

## Task 13: Integration Testing

**Files:**
- Test manually in Expo Go

**Step 1: Start backend**

Run: `npm run dev`
Expected: Next.js server running on localhost:3000

**Step 2: Start mobile app**

Run: `cd mobile && npx expo start`
Expected: Expo dev server starts

**Step 3: Test on device/simulator**

1. Open Expo Go on device
2. Scan QR code
3. Verify login screen appears
4. Set mobile password on web (Settings → Mobile)
5. Login on mobile app
6. Verify dashboard loads with properties
7. Navigate to Transactions tab
8. Test swipe gestures
9. Navigate to Camera tab
10. Test document capture
11. Verify upload succeeds
12. Test Settings and sign out

**Step 4: Fix any issues found**

Document and fix any bugs.

**Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: address integration testing issues"
```

---

## Task 14: Environment Configuration

**Files:**
- Create: `mobile/.env.example`
- Create: `mobile/eas.json`

**Step 1: Create env example**

Create `mobile/.env.example`:

```
EXPO_PUBLIC_API_URL=http://localhost:3000
```

**Step 2: Create EAS config**

Create `mobile/eas.json`:

```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "env": {
        "EXPO_PUBLIC_API_URL": "https://staging.propertytracker.app"
      }
    },
    "production": {
      "env": {
        "EXPO_PUBLIC_API_URL": "https://propertytracker.app"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

**Step 3: Update .gitignore**

Add to `mobile/.gitignore`:

```
.env
.env.local
```

**Step 4: Commit**

```bash
git add mobile/.env.example mobile/eas.json mobile/.gitignore
git commit -m "chore: add environment configuration"
```

---

## Summary

This plan creates a React Native mobile app with:

1. **Backend changes** (Tasks 1-3, 12):
   - Push tokens table for mobile notifications
   - Mobile auth router with JWT login
   - Mobile password setup UI
   - Dual auth middleware (Clerk + JWT)

2. **Mobile app** (Tasks 4-11, 13-14):
   - Expo project with NativeWind styling
   - tRPC client with JWT auth
   - Auth context and login screen
   - Bottom tab navigation
   - Dashboard with property list
   - Transaction review with swipe gestures
   - Camera/document capture
   - Settings with notification toggles

The existing backend endpoints (stats.dashboard, property.list, categorization.*, documents.*) work as-is with the new JWT auth middleware.
