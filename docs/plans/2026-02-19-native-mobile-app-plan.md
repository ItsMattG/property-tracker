# Native Mobile App Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fresh React Native (Expo) app with 17 screens covering dashboard, properties, banking, reports, tools, settings, biometric auth, and push notifications.

**Architecture:** Expo SDK 54 with Expo Router (file-based navigation), NativeWind v4 (Tailwind), tRPC React Query client for data fetching with caching. Auth via JWT in SecureStore with optional biometric unlock. Connects to existing BrickTrack tRPC backend.

**Tech Stack:** Expo 54, React Native 0.81, Expo Router, NativeWind v4, tRPC v11 + React Query v5, Expo SecureStore, Expo Local Authentication, Expo Notifications, Vitest

---

## Batch Guide

This plan has 25 tasks. Execute in batches:

| Batch | Tasks | Focus |
|-------|-------|-------|
| 1 | 1-4 | Project scaffold, auth, tRPC, base UI |
| 2 | 5-8 | Tab navigation, dashboard, property list/detail |
| 3 | 9-13 | Add property, loans, transactions, review |
| 4 | 14-18 | Bank feeds, receipts, more menu, tax, cash flow |
| 5 | 19-22 | Scorecard, borrowing power, settings, biometrics |
| 6 | 23-25 | Push notifications, EAS config, final verification |

---

### Task 1: Scaffold Expo Project

**Files:**
- Create: `mobile-v2/` (entire directory via `npx create-expo-app`)
- Modify: `mobile-v2/package.json`
- Modify: `mobile-v2/app.json`

**Step 1: Create fresh Expo project with Expo Router template**

```bash
cd ~/worktrees/property-tracker/mobile-app
npx create-expo-app@latest mobile-v2 --template tabs
cd mobile-v2
```

**Step 2: Install dependencies**

```bash
npx expo install expo-secure-store expo-local-authentication expo-notifications expo-camera expo-image-picker expo-status-bar
npm install @trpc/client@11 @trpc/react-query@11 @tanstack/react-query@5 superjson nativewind@4 tailwindcss@3
npm install -D @types/react react-native-testing-library vitest
```

**Step 3: Configure `app.json`**

Update `app.json` with BrickTrack branding:
```json
{
  "expo": {
    "name": "BrickTrack",
    "slug": "bricktrack",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/images/icon.png",
    "scheme": "bricktrack",
    "userInterfaceStyle": "automatic",
    "newArchEnabled": true,
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "au.com.bricktrack.app",
      "infoPlist": {
        "NSCameraUsageDescription": "BrickTrack uses the camera to capture receipts and property documents.",
        "NSFaceIDUsageDescription": "Use Face ID to quickly unlock BrickTrack."
      }
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/images/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      },
      "package": "au.com.bricktrack.app",
      "permissions": ["CAMERA", "USE_BIOMETRIC", "USE_FINGERPRINT"]
    },
    "plugins": [
      "expo-router",
      "expo-secure-store",
      "expo-camera",
      ["expo-notifications", {
        "icon": "./assets/images/notification-icon.png",
        "color": "#2563eb"
      }]
    ]
  }
}
```

**Step 4: Configure NativeWind**

Create `mobile-v2/tailwind.config.js`:
```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: "#2563eb",
        success: "#16a34a",
        warning: "#d97706",
        destructive: "#dc2626",
      },
    },
  },
  plugins: [],
};
```

Create `mobile-v2/global.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**Step 5: Commit**

```bash
git add mobile-v2/
git commit -m "feat: scaffold fresh Expo project for BrickTrack mobile"
```

---

### Task 2: Auth Library (JWT + SecureStore)

**Files:**
- Create: `mobile-v2/lib/auth.ts`
- Create: `mobile-v2/lib/auth-context.tsx`

**Step 1: Create token storage utilities**

Create `mobile-v2/lib/auth.ts`:
```typescript
import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "bricktrack_token";
const USER_KEY = "bricktrack_user";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getUser(): Promise<AuthUser | null> {
  const json = await SecureStore.getItemAsync(USER_KEY);
  if (!json) return null;
  try {
    return JSON.parse(json) as AuthUser;
  } catch {
    return null;
  }
}

export async function setUser(user: AuthUser): Promise<void> {
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
}

export async function clearAuth(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);
}
```

**Step 2: Create auth context**

Create `mobile-v2/lib/auth-context.tsx`:
```typescript
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { getToken, getUser, setToken, setUser, clearAuth, type AuthUser } from "./auth";

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children, trpcClient }: { children: ReactNode; trpcClient: any }) {
  const [user, setUserState] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const restoreSession = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) {
        setIsLoading(false);
        return;
      }
      const result = await trpcClient.mobileAuth.verify.query({ token });
      if (result?.user) {
        setUserState(result.user);
        await setUser(result.user);
      } else {
        await clearAuth();
      }
    } catch {
      await clearAuth();
    } finally {
      setIsLoading(false);
    }
  }, [trpcClient]);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await trpcClient.mobileAuth.login.mutate({ email, password });
    await setToken(result.token);
    await setUser(result.user);
    setUserState(result.user);
  }, [trpcClient]);

  const logout = useCallback(async () => {
    await clearAuth();
    setUserState(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated: !!user, login, logout, restoreSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
```

**Step 3: Commit**

```bash
git add mobile-v2/lib/
git commit -m "feat: add auth library with JWT SecureStore and context"
```

---

### Task 3: tRPC Client with React Query

**Files:**
- Create: `mobile-v2/lib/trpc.ts`
- Create: `mobile-v2/lib/trpc-provider.tsx`

**Step 1: Create tRPC client**

Create `mobile-v2/lib/trpc.ts`:
```typescript
import { createTRPCReact, httpBatchLink } from "@trpc/react-query";
import { getToken } from "./auth";
import type { AppRouter } from "../../../src/server/routers/_app";

export const trpc = createTRPCReact<AppRouter>();

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

export function getTRPCClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${API_URL}/api/trpc`,
        async headers() {
          const token = await getToken();
          return token ? { authorization: `Bearer ${token}` } : {};
        },
      }),
    ],
  });
}
```

**Step 2: Create provider**

Create `mobile-v2/lib/trpc-provider.tsx`:
```typescript
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trpc, getTRPCClient } from "./trpc";

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );
  const [trpcClient] = useState(() => getTRPCClient());

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
```

**Step 3: Commit**

```bash
git add mobile-v2/lib/trpc.ts mobile-v2/lib/trpc-provider.tsx
git commit -m "feat: add tRPC React Query client with auth headers"
```

---

### Task 4: Base UI Components

**Files:**
- Create: `mobile-v2/components/ui/Card.tsx`
- Create: `mobile-v2/components/ui/Button.tsx`
- Create: `mobile-v2/components/ui/Input.tsx`
- Create: `mobile-v2/components/ui/Badge.tsx`
- Create: `mobile-v2/components/ui/LoadingScreen.tsx`
- Create: `mobile-v2/lib/utils.ts`

**Step 1: Create utility functions**

Create `mobile-v2/lib/utils.ts`:
```typescript
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

export function cn(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(" ");
}
```

**Step 2: Create Card component**

Create `mobile-v2/components/ui/Card.tsx`:
```typescript
import { View, Text } from "react-native";
import { cn } from "../../lib/utils";

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <View className={cn("bg-white rounded-xl p-4 shadow-sm border border-gray-100", className)}>
      {children}
    </View>
  );
}

export function CardTitle({ children }: { children: React.ReactNode }) {
  return <Text className="text-base font-semibold text-gray-900 mb-2">{children}</Text>;
}

export function CardDescription({ children }: { children: React.ReactNode }) {
  return <Text className="text-sm text-gray-500">{children}</Text>;
}
```

**Step 3: Create Button component**

Create `mobile-v2/components/ui/Button.tsx`:
```typescript
import { TouchableOpacity, Text, ActivityIndicator } from "react-native";
import { cn } from "../../lib/utils";

interface ButtonProps {
  onPress: () => void;
  children: React.ReactNode;
  variant?: "primary" | "outline" | "destructive" | "ghost";
  size?: "default" | "sm" | "lg";
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}

const variantStyles = {
  primary: "bg-primary",
  outline: "bg-transparent border border-gray-300",
  destructive: "bg-destructive",
  ghost: "bg-transparent",
};

const variantTextStyles = {
  primary: "text-white",
  outline: "text-gray-900",
  destructive: "text-white",
  ghost: "text-gray-900",
};

const sizeStyles = {
  default: "py-3 px-4",
  sm: "py-2 px-3",
  lg: "py-4 px-6",
};

export function Button({
  onPress,
  children,
  variant = "primary",
  size = "default",
  disabled = false,
  loading = false,
  className,
}: ButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      className={cn(
        "rounded-lg items-center justify-center flex-row",
        variantStyles[variant],
        sizeStyles[size],
        (disabled || loading) && "opacity-50",
        className
      )}
    >
      {loading && <ActivityIndicator size="small" color="white" className="mr-2" />}
      <Text className={cn("font-semibold text-base", variantTextStyles[variant])}>
        {typeof children === "string" ? children : children}
      </Text>
    </TouchableOpacity>
  );
}
```

**Step 4: Create Input component**

Create `mobile-v2/components/ui/Input.tsx`:
```typescript
import { TextInput, View, Text } from "react-native";
import { cn } from "../../lib/utils";

interface InputProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "email-address" | "numeric" | "decimal-pad";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  error?: string;
  className?: string;
}

export function Input({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  error,
  className,
}: InputProps) {
  return (
    <View className={className}>
      {label && <Text className="text-sm font-medium text-gray-700 mb-1">{label}</Text>}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        placeholderTextColor="#9ca3af"
        className={cn(
          "border rounded-lg px-3 py-3 text-base text-gray-900",
          error ? "border-destructive" : "border-gray-300"
        )}
      />
      {error && <Text className="text-sm text-destructive mt-1">{error}</Text>}
    </View>
  );
}
```

**Step 5: Create Badge component**

Create `mobile-v2/components/ui/Badge.tsx`:
```typescript
import { View, Text } from "react-native";
import { cn } from "../../lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "destructive" | "outline";
}

const variantStyles = {
  default: "bg-primary/10",
  success: "bg-success/10",
  warning: "bg-warning/10",
  destructive: "bg-destructive/10",
  outline: "bg-transparent border border-gray-300",
};

const textStyles = {
  default: "text-primary",
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
  outline: "text-gray-700",
};

export function Badge({ children, variant = "default" }: BadgeProps) {
  return (
    <View className={cn("rounded-full px-2.5 py-0.5 self-start", variantStyles[variant])}>
      <Text className={cn("text-xs font-medium", textStyles[variant])}>{children}</Text>
    </View>
  );
}
```

**Step 6: Create LoadingScreen**

Create `mobile-v2/components/ui/LoadingScreen.tsx`:
```typescript
import { View, ActivityIndicator, Text } from "react-native";

export function LoadingScreen({ message = "Loading..." }: { message?: string }) {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <ActivityIndicator size="large" color="#2563eb" />
      <Text className="text-gray-500 mt-4 text-base">{message}</Text>
    </View>
  );
}
```

**Step 7: Commit**

```bash
git add mobile-v2/components/ mobile-v2/lib/utils.ts
git commit -m "feat: add base UI components (Card, Button, Input, Badge, Loading)"
```

---

### Task 5: Root Layout + Tab Navigation

**Files:**
- Modify: `mobile-v2/app/_layout.tsx`
- Create: `mobile-v2/app/(auth)/login.tsx`
- Create: `mobile-v2/app/(tabs)/_layout.tsx`
- Create: `mobile-v2/app/(tabs)/dashboard/index.tsx` (placeholder)
- Create: `mobile-v2/app/(tabs)/properties/index.tsx` (placeholder)
- Create: `mobile-v2/app/(tabs)/banking/index.tsx` (placeholder)
- Create: `mobile-v2/app/(tabs)/more/index.tsx` (placeholder)

**Step 1: Create root layout with auth guard**

Replace `mobile-v2/app/_layout.tsx`:
```typescript
import { useEffect } from "react";
import { Slot, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { TRPCProvider } from "../lib/trpc-provider";
import { AuthProvider, useAuth } from "../lib/auth-context";
import { LoadingScreen } from "../components/ui/LoadingScreen";
import "../global.css";

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments[0] === "(auth)";

    if (!isAuthenticated && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (isAuthenticated && inAuthGroup) {
      router.replace("/(tabs)/dashboard");
    }
  }, [isAuthenticated, isLoading, segments]);

  if (isLoading) return <LoadingScreen message="Starting BrickTrack..." />;
  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <TRPCProvider>
        <AuthProvider>
          <AuthGuard>
            <StatusBar style="dark" />
            <Slot />
          </AuthGuard>
        </AuthProvider>
      </TRPCProvider>
    </SafeAreaProvider>
  );
}
```

Note: `AuthProvider` will need adjustment — it currently takes a `trpcClient` prop. For Expo Router + tRPC React Query, the auth context should use the tRPC hooks or a vanilla client for login/verify. Adjust `auth-context.tsx` to create its own vanilla client for auth-only calls (since React Query hooks aren't available outside the provider tree for initial auth check).

**Step 2: Create login screen**

Create `mobile-v2/app/(auth)/login.tsx`:
```typescript
import { useState } from "react";
import { View, Text, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useAuth } from "../../lib/auth-context";

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError("Please enter email and password");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (e: any) {
      setError(e.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-white"
    >
      <ScrollView contentContainerClassName="flex-1 justify-center px-6">
        <View className="mb-10">
          <Text className="text-3xl font-bold text-gray-900">BrickTrack</Text>
          <Text className="text-base text-gray-500 mt-2">
            Sign in to manage your property portfolio
          </Text>
        </View>

        <View className="gap-4">
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="Your password"
            secureTextEntry
          />

          {error ? (
            <Text className="text-destructive text-sm">{error}</Text>
          ) : null}

          <Button onPress={handleLogin} loading={loading} className="mt-2">
            Sign In
          </Button>
        </View>

        <Text className="text-xs text-gray-400 text-center mt-8">
          Set up mobile access from Settings → Mobile App on the web
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
```

**Step 3: Create tab layout**

Create `mobile-v2/app/(tabs)/_layout.tsx`:
```typescript
import { Tabs } from "expo-router";
import { Home, Building2, ArrowLeftRight, MoreHorizontal } from "lucide-react-native";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#2563eb",
        tabBarInactiveTintColor: "#6b7280",
        tabBarStyle: { borderTopColor: "#e5e7eb" },
        headerStyle: { backgroundColor: "#ffffff" },
        headerTitleStyle: { fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="properties"
        options={{
          title: "Properties",
          tabBarIcon: ({ color, size }) => <Building2 size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="banking"
        options={{
          title: "Banking",
          tabBarIcon: ({ color, size }) => <ArrowLeftRight size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "More",
          tabBarIcon: ({ color, size }) => <MoreHorizontal size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
```

Note: Install `lucide-react-native` dependency: `npm install lucide-react-native react-native-svg`

**Step 4: Create placeholder screens**

Create each placeholder with a simple view:

`mobile-v2/app/(tabs)/dashboard/index.tsx`:
```typescript
import { View, Text } from "react-native";
export default function DashboardScreen() {
  return <View className="flex-1 items-center justify-center bg-white"><Text>Dashboard</Text></View>;
}
```

Repeat for `properties/index.tsx`, `banking/index.tsx`, `more/index.tsx`.

**Step 5: Commit**

```bash
git add mobile-v2/app/
git commit -m "feat: add root layout, auth guard, login screen, tab navigation"
```

---

### Task 6: Dashboard Screen

**Files:**
- Modify: `mobile-v2/app/(tabs)/dashboard/index.tsx`
- Create: `mobile-v2/components/dashboard/PortfolioSummaryCard.tsx`
- Create: `mobile-v2/components/dashboard/BorrowingPowerCard.tsx`
- Create: `mobile-v2/components/dashboard/RecentTransactions.tsx`

**Step 1: Create PortfolioSummaryCard**

Create `mobile-v2/components/dashboard/PortfolioSummaryCard.tsx`:
```typescript
import { View, Text } from "react-native";
import { Card, CardTitle } from "../ui/Card";
import { formatCurrency, formatPercent } from "../../lib/utils";

interface PortfolioSummaryProps {
  totalValue: number;
  totalEquity: number;
  totalDebt: number;
  portfolioLvr: number;
  propertyCount: number;
}

export function PortfolioSummaryCard({ totalValue, totalEquity, totalDebt, portfolioLvr, propertyCount }: PortfolioSummaryProps) {
  return (
    <Card>
      <CardTitle>Portfolio Summary</CardTitle>
      <Text className="text-2xl font-bold text-gray-900">{formatCurrency(totalValue)}</Text>
      <Text className="text-sm text-gray-500 mb-3">{propertyCount} {propertyCount === 1 ? "property" : "properties"}</Text>
      <View className="flex-row justify-between">
        <View>
          <Text className="text-xs text-gray-500">Equity</Text>
          <Text className="text-base font-semibold text-success">{formatCurrency(totalEquity)}</Text>
        </View>
        <View>
          <Text className="text-xs text-gray-500">Debt</Text>
          <Text className="text-base font-semibold text-gray-900">{formatCurrency(totalDebt)}</Text>
        </View>
        <View>
          <Text className="text-xs text-gray-500">LVR</Text>
          <Text className="text-base font-semibold text-gray-900">{formatPercent(portfolioLvr)}</Text>
        </View>
      </View>
    </Card>
  );
}
```

**Step 2: Create BorrowingPowerCard**

Create `mobile-v2/components/dashboard/BorrowingPowerCard.tsx`:
```typescript
import { View, Text } from "react-native";
import { Card, CardTitle } from "../ui/Card";
import { formatCurrency } from "../../lib/utils";
import { cn } from "../../lib/utils";

interface BorrowingPowerProps {
  estimatedBorrowingPower: number;
  usableEquity: number;
  netSurplus: number;
  hasLoans: boolean;
}

export function BorrowingPowerCard({ estimatedBorrowingPower, usableEquity, netSurplus, hasLoans }: BorrowingPowerProps) {
  if (!hasLoans) {
    return (
      <Card>
        <CardTitle>Borrowing Power</CardTitle>
        <Text className="text-sm text-gray-500 text-center py-4">Add loans to see borrowing power</Text>
      </Card>
    );
  }

  return (
    <Card>
      <CardTitle>Borrowing Power</CardTitle>
      <Text className={cn(
        "text-2xl font-bold",
        estimatedBorrowingPower > 50000 ? "text-success" : estimatedBorrowingPower > 0 ? "text-warning" : "text-destructive"
      )}>
        {formatCurrency(estimatedBorrowingPower)}
      </Text>
      <View className="flex-row justify-between mt-3">
        <View>
          <Text className="text-xs text-gray-500">Usable Equity</Text>
          <Text className="text-sm font-semibold">{formatCurrency(usableEquity)}</Text>
        </View>
        <View>
          <Text className="text-xs text-gray-500">Net Surplus</Text>
          <Text className={cn("text-sm font-semibold", netSurplus > 0 ? "text-success" : "text-destructive")}>
            {formatCurrency(netSurplus)}/yr
          </Text>
        </View>
      </View>
    </Card>
  );
}
```

**Step 3: Create RecentTransactions**

Create `mobile-v2/components/dashboard/RecentTransactions.tsx`:
```typescript
import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Card, CardTitle } from "../ui/Card";
import { formatCurrency, formatDate } from "../../lib/utils";
import { cn } from "../../lib/utils";

interface Transaction {
  id: string;
  description: string;
  amount: number;
  date: string;
  category: string | null;
  transactionType: string;
}

export function RecentTransactions({ transactions }: { transactions: Transaction[] }) {
  const router = useRouter();

  if (transactions.length === 0) {
    return (
      <Card>
        <CardTitle>Recent Transactions</CardTitle>
        <Text className="text-sm text-gray-500 text-center py-4">No recent transactions</Text>
      </Card>
    );
  }

  return (
    <Card>
      <View className="flex-row justify-between items-center mb-2">
        <CardTitle>Recent Transactions</CardTitle>
        <TouchableOpacity onPress={() => router.push("/(tabs)/banking")}>
          <Text className="text-sm text-primary font-medium">See all</Text>
        </TouchableOpacity>
      </View>
      {transactions.slice(0, 5).map((tx) => (
        <View key={tx.id} className="flex-row justify-between py-2.5 border-b border-gray-100 last:border-0">
          <View className="flex-1 mr-3">
            <Text className="text-sm text-gray-900" numberOfLines={1}>{tx.description}</Text>
            <Text className="text-xs text-gray-500">{formatDate(tx.date)}</Text>
          </View>
          <Text className={cn(
            "text-sm font-medium",
            tx.transactionType === "income" ? "text-success" : "text-gray-900"
          )}>
            {tx.transactionType === "income" ? "+" : "-"}{formatCurrency(Math.abs(tx.amount))}
          </Text>
        </View>
      ))}
    </Card>
  );
}
```

**Step 4: Build dashboard screen**

Replace `mobile-v2/app/(tabs)/dashboard/index.tsx`:
```typescript
import { ScrollView, RefreshControl, View, Text } from "react-native";
import { useState, useCallback } from "react";
import { trpc } from "../../../lib/trpc";
import { PortfolioSummaryCard } from "../../../components/dashboard/PortfolioSummaryCard";
import { BorrowingPowerCard } from "../../../components/dashboard/BorrowingPowerCard";
import { RecentTransactions } from "../../../components/dashboard/RecentTransactions";
import { LoadingScreen } from "../../../components/ui/LoadingScreen";

export default function DashboardScreen() {
  const utils = trpc.useUtils();
  const { data: stats, isLoading: statsLoading } = trpc.stats.dashboard.useQuery();
  const { data: borrowing, isLoading: borrowingLoading } = trpc.portfolio.getBorrowingPower.useQuery(
    undefined,
    { staleTime: 60_000 }
  );
  const { data: txData } = trpc.transaction.list.useQuery(
    { limit: 5, offset: 0 },
    { staleTime: 30_000 }
  );

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      utils.stats.dashboard.invalidate(),
      utils.portfolio.getBorrowingPower.invalidate(),
      utils.transaction.list.invalidate(),
    ]);
    setRefreshing(false);
  }, [utils]);

  if (statsLoading || borrowingLoading) return <LoadingScreen />;

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      contentContainerClassName="p-4 gap-4"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {stats && (
        <PortfolioSummaryCard
          totalValue={stats.totalValue ?? 0}
          totalEquity={stats.totalEquity ?? 0}
          totalDebt={stats.totalDebt ?? 0}
          portfolioLvr={stats.portfolioLvr ?? 0}
          propertyCount={stats.propertyCount ?? 0}
        />
      )}

      {borrowing && (
        <BorrowingPowerCard
          estimatedBorrowingPower={borrowing.estimatedBorrowingPower}
          usableEquity={borrowing.usableEquity}
          netSurplus={borrowing.netSurplus}
          hasLoans={borrowing.hasLoans}
        />
      )}

      <RecentTransactions transactions={txData?.transactions ?? []} />
    </ScrollView>
  );
}
```

**Step 5: Commit**

```bash
git add mobile-v2/app/ mobile-v2/components/dashboard/
git commit -m "feat: add dashboard screen with portfolio summary, borrowing power, recent transactions"
```

---

### Task 7: Property List Screen

**Files:**
- Modify: `mobile-v2/app/(tabs)/properties/index.tsx`
- Create: `mobile-v2/app/(tabs)/properties/[id].tsx`
- Create: `mobile-v2/components/properties/PropertyCard.tsx`

**Step 1: Create PropertyCard**

Create `mobile-v2/components/properties/PropertyCard.tsx`:
```typescript
import { TouchableOpacity, View, Text } from "react-native";
import { useRouter } from "expo-router";
import { Building2 } from "lucide-react-native";
import { formatCurrency } from "../../lib/utils";

interface PropertyCardProps {
  id: string;
  address: string;
  suburb: string;
  state: string;
  currentValue: number | null;
  purchasePrice: number;
  grossYield: number | null;
}

export function PropertyCard({ id, address, suburb, state, currentValue, purchasePrice, grossYield }: PropertyCardProps) {
  const router = useRouter();

  return (
    <TouchableOpacity
      onPress={() => router.push(`/(tabs)/properties/${id}`)}
      className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-3"
    >
      <View className="flex-row items-start">
        <View className="w-10 h-10 rounded-lg bg-primary/10 items-center justify-center mr-3">
          <Building2 size={20} color="#2563eb" />
        </View>
        <View className="flex-1">
          <Text className="text-base font-semibold text-gray-900" numberOfLines={1}>{address}</Text>
          <Text className="text-sm text-gray-500">{suburb}, {state}</Text>
        </View>
        <View className="items-end">
          <Text className="text-base font-semibold text-gray-900">
            {formatCurrency(currentValue ?? purchasePrice)}
          </Text>
          {grossYield !== null && grossYield > 0 && (
            <Text className="text-xs text-success">{grossYield.toFixed(1)}% yield</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}
```

**Step 2: Build property list screen**

Replace `mobile-v2/app/(tabs)/properties/index.tsx`:
```typescript
import { FlatList, View, Text, RefreshControl, TouchableOpacity } from "react-native";
import { useState, useCallback } from "react";
import { useRouter } from "expo-router";
import { Plus } from "lucide-react-native";
import { trpc } from "../../../lib/trpc";
import { PropertyCard } from "../../../components/properties/PropertyCard";
import { LoadingScreen } from "../../../components/ui/LoadingScreen";

export default function PropertiesScreen() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const { data: properties, isLoading } = trpc.property.list.useQuery();

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await utils.property.list.invalidate();
    setRefreshing(false);
  }, [utils]);

  if (isLoading) return <LoadingScreen />;

  return (
    <View className="flex-1 bg-gray-50">
      <FlatList
        data={properties ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <PropertyCard
            id={item.id}
            address={item.address}
            suburb={item.suburb}
            state={item.state}
            currentValue={item.currentValue ?? null}
            purchasePrice={Number(item.purchasePrice)}
            grossYield={item.grossYield ?? null}
          />
        )}
        contentContainerClassName="p-4"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View className="items-center py-12">
            <Text className="text-gray-500 text-base mb-4">No properties yet</Text>
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/properties/add")}
              className="bg-primary rounded-lg px-4 py-2"
            >
              <Text className="text-white font-semibold">Add Property</Text>
            </TouchableOpacity>
          </View>
        }
      />
      {(properties?.length ?? 0) > 0 && (
        <TouchableOpacity
          onPress={() => router.push("/(tabs)/properties/add")}
          className="absolute bottom-6 right-6 w-14 h-14 bg-primary rounded-full items-center justify-center shadow-lg"
        >
          <Plus size={24} color="white" />
        </TouchableOpacity>
      )}
    </View>
  );
}
```

**Step 3: Create property detail placeholder**

Create `mobile-v2/app/(tabs)/properties/[id].tsx`:
```typescript
import { View, Text } from "react-native";
import { useLocalSearchParams } from "expo-router";

export default function PropertyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-gray-500">Property detail: {id}</Text>
    </View>
  );
}
```

**Step 4: Commit**

```bash
git add mobile-v2/app/ mobile-v2/components/properties/
git commit -m "feat: add property list screen with cards and FAB"
```

---

### Task 8: Property Detail Screen

**Files:**
- Modify: `mobile-v2/app/(tabs)/properties/[id].tsx`
- Create: `mobile-v2/components/properties/PropertyOverview.tsx`
- Create: `mobile-v2/components/properties/PropertyLoanCard.tsx`

**Step 1: Create PropertyOverview**

Create `mobile-v2/components/properties/PropertyOverview.tsx`:
```typescript
import { View, Text } from "react-native";
import { Card, CardTitle } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { formatCurrency, formatDate } from "../../lib/utils";

interface PropertyOverviewProps {
  address: string;
  suburb: string;
  state: string;
  postcode: string;
  purchasePrice: number;
  purchaseDate: string | null;
  currentValue: number | null;
  status: string;
  purpose: string;
}

export function PropertyOverview(props: PropertyOverviewProps) {
  const growth = props.currentValue && props.purchasePrice > 0
    ? ((props.currentValue - props.purchasePrice) / props.purchasePrice) * 100
    : null;

  return (
    <Card>
      <View className="flex-row items-start justify-between mb-3">
        <View className="flex-1">
          <Text className="text-lg font-bold text-gray-900">{props.address}</Text>
          <Text className="text-sm text-gray-500">{props.suburb}, {props.state} {props.postcode}</Text>
        </View>
        <Badge variant={props.status === "active" ? "success" : "outline"}>
          {props.status}
        </Badge>
      </View>

      <View className="flex-row justify-between mt-2">
        <View>
          <Text className="text-xs text-gray-500">Purchase Price</Text>
          <Text className="text-base font-semibold">{formatCurrency(props.purchasePrice)}</Text>
          {props.purchaseDate && (
            <Text className="text-xs text-gray-400">{formatDate(props.purchaseDate)}</Text>
          )}
        </View>
        {props.currentValue && (
          <View className="items-end">
            <Text className="text-xs text-gray-500">Current Value</Text>
            <Text className="text-base font-semibold">{formatCurrency(props.currentValue)}</Text>
            {growth !== null && (
              <Text className={`text-xs ${growth >= 0 ? "text-success" : "text-destructive"}`}>
                {growth >= 0 ? "+" : ""}{growth.toFixed(1)}%
              </Text>
            )}
          </View>
        )}
      </View>
    </Card>
  );
}
```

**Step 2: Create PropertyLoanCard**

Create `mobile-v2/components/properties/PropertyLoanCard.tsx`:
```typescript
import { View, Text } from "react-native";
import { Card, CardTitle } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { formatCurrency, formatPercent } from "../../lib/utils";

interface Loan {
  id: string;
  lender: string | null;
  loanType: string;
  currentBalance: number;
  interestRate: number;
  repaymentAmount: number;
  repaymentFrequency: string;
}

export function PropertyLoanCard({ loans }: { loans: Loan[] }) {
  if (loans.length === 0) {
    return (
      <Card>
        <CardTitle>Loans</CardTitle>
        <Text className="text-sm text-gray-500 text-center py-4">No loans linked to this property</Text>
      </Card>
    );
  }

  return (
    <Card>
      <CardTitle>Loans</CardTitle>
      {loans.map((loan) => (
        <View key={loan.id} className="py-3 border-b border-gray-100 last:border-0">
          <View className="flex-row justify-between items-start">
            <View>
              <Text className="text-sm font-semibold text-gray-900">{loan.lender ?? "Unknown Lender"}</Text>
              <Badge variant="outline">{loan.loanType.replace(/_/g, " ")}</Badge>
            </View>
            <View className="items-end">
              <Text className="text-base font-semibold">{formatCurrency(loan.currentBalance)}</Text>
              <Text className="text-xs text-gray-500">{formatPercent(loan.interestRate)}</Text>
            </View>
          </View>
          <Text className="text-xs text-gray-500 mt-1">
            {formatCurrency(loan.repaymentAmount)} / {loan.repaymentFrequency}
          </Text>
        </View>
      ))}
    </Card>
  );
}
```

**Step 3: Build property detail screen**

Replace `mobile-v2/app/(tabs)/properties/[id].tsx`:
```typescript
import { ScrollView, RefreshControl, View, Text } from "react-native";
import { useState, useCallback } from "react";
import { useLocalSearchParams, Stack } from "expo-router";
import { trpc } from "../../../lib/trpc";
import { PropertyOverview } from "../../../components/properties/PropertyOverview";
import { PropertyLoanCard } from "../../../components/properties/PropertyLoanCard";
import { RecentTransactions } from "../../../components/dashboard/RecentTransactions";
import { LoadingScreen } from "../../../components/ui/LoadingScreen";

export default function PropertyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const utils = trpc.useUtils();

  const { data: property, isLoading } = trpc.property.get.useQuery({ id: id! });
  const { data: txData } = trpc.transaction.list.useQuery(
    { propertyId: id!, limit: 10, offset: 0 },
    { enabled: !!id }
  );

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      utils.property.get.invalidate({ id: id! }),
      utils.transaction.list.invalidate(),
    ]);
    setRefreshing(false);
  }, [utils, id]);

  if (isLoading || !property) return <LoadingScreen />;

  return (
    <>
      <Stack.Screen options={{ title: property.address }} />
      <ScrollView
        className="flex-1 bg-gray-50"
        contentContainerClassName="p-4 gap-4"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <PropertyOverview
          address={property.address}
          suburb={property.suburb}
          state={property.state}
          postcode={property.postcode}
          purchasePrice={Number(property.purchasePrice)}
          purchaseDate={property.purchaseDate}
          currentValue={property.currentValue ?? null}
          status={property.status}
          purpose={property.purpose}
        />
        <PropertyLoanCard loans={property.loans ?? []} />
        <RecentTransactions transactions={txData?.transactions ?? []} />
      </ScrollView>
    </>
  );
}
```

**Step 4: Commit**

```bash
git add mobile-v2/app/ mobile-v2/components/properties/
git commit -m "feat: add property detail screen with overview, loans, transactions"
```

---

### Task 9-25: Remaining Screens

Due to the size of this plan, Tasks 9-25 follow the same pattern. Each task creates components + screen. Here is the task list with key files:

**Task 9: Add Property Form**
- Create: `mobile-v2/app/(tabs)/properties/add.tsx`
- Form: address, suburb, state (picker), postcode, purchase price, purchase date, purpose (picker)
- Mutation: `trpc.property.create.useMutation()` → navigate to detail on success

**Task 10: Transactions List Screen**
- Modify: `mobile-v2/app/(tabs)/banking/index.tsx`
- Create: `mobile-v2/components/banking/TransactionRow.tsx`
- FlatList with infinite scroll, search bar, category filter chips
- Query: `trpc.transaction.list.useQuery({ limit: 50, offset })`

**Task 11: Transaction Review Screen**
- Create: `mobile-v2/app/(tabs)/banking/review.tsx`
- Create: `mobile-v2/components/banking/SwipeableTransaction.tsx`
- Swipe-to-accept/reject with `react-native-gesture-handler/Swipeable`
- Badge count on Banking tab via `trpc.categorization.getPendingCount.useQuery()`

**Task 12: Bank Feeds Screen**
- Create: `mobile-v2/app/(tabs)/banking/feeds.tsx`
- Connected accounts list with balances
- Basiq connect button opens WebView for CDR consent

**Task 13: Receipt Capture Screen**
- Create: `mobile-v2/app/(tabs)/banking/camera.tsx`
- Camera → preview → upload flow using `expo-camera` + `expo-image-picker`
- Upload to Supabase signed URL, create document record

**Task 14: More Menu Screen**
- Modify: `mobile-v2/app/(tabs)/more/index.tsx`
- Grouped list: Reports (Tax Position, Cash Flow, Scorecard), Tools (Borrowing Power), Settings
- Each item navigates to sub-route

**Task 15: Tax Position Screen**
- Create: `mobile-v2/app/(tabs)/more/tax-position.tsx`
- Hero card (total deductions, estimated tax saving)
- Property breakdown table (scrollable)
- Query: `trpc.taxPosition.getSummary.useQuery()`

**Task 16: Cash Flow Screen**
- Create: `mobile-v2/app/(tabs)/more/cash-flow.tsx`
- Monthly summary cards (income, expenses, net)
- Transaction list filtered by month
- Query: `trpc.transaction.list.useQuery()` with date filter

**Task 17: Scorecard Screen**
- Create: `mobile-v2/app/(tabs)/more/scorecard.tsx`
- Performance score per property (card list)
- Query: `trpc.performanceBenchmarking.getPortfolioScorecard.useQuery()`

**Task 18: Borrowing Power Screen**
- Create: `mobile-v2/app/(tabs)/more/borrowing-power.tsx`
- Mobile-optimized version of web calculator
- Reuse `calculateBorrowingPower()` from `../../lib/borrowing-power-calc` (copy utility or share)
- Input sections with collapsible accordion

**Task 19: Settings Screen**
- Create: `mobile-v2/app/(tabs)/more/settings.tsx`
- Account info (name, email)
- Biometric toggle (enable/disable Face ID)
- Notification toggle
- Theme selector (system/light/dark)
- Sign out button with confirmation

**Task 20: Biometric Auth**
- Modify: `mobile-v2/lib/auth-context.tsx`
- Create: `mobile-v2/lib/biometrics.ts`
- On first login success: prompt "Enable Face ID?"
- On app launch with stored token: require biometric before showing app
- Uses `expo-local-authentication` — `authenticateAsync()` with fallback to passcode
- Settings toggle to enable/disable

**Task 21: Push Notifications**
- Create: `mobile-v2/lib/notifications.ts`
- Modify: `mobile-v2/app/_layout.tsx`
- Register for push on login via `Notifications.getExpoPushTokenAsync()`
- Call `trpc.mobileAuth.registerDevice.mutate()` with token
- Handle notification tap → deep link to relevant screen
- Unregister on logout via `trpc.mobileAuth.unregisterDevice.mutate()`

**Task 22: EAS Build & Submit Config**
- Modify: `mobile-v2/eas.json`
- Add development, preview (staging API), production (prod API) build profiles
- Add submit config for App Store Connect + Google Play Console
- Add `mobile-v2/.easignore` to exclude test files from builds

**Task 23: Utility Tests**
- Create: `mobile-v2/lib/__tests__/utils.test.ts`
- Create: `mobile-v2/lib/__tests__/auth.test.ts`
- Test formatCurrency, formatPercent, formatDate, cn
- Test auth token/user storage mock

**Task 24: App Store Assets**
- Create: `mobile-v2/assets/` — icon.png (1024x1024), adaptive-icon.png, splash.png
- Update `app.json` with correct asset paths
- Add privacy policy URL and terms URL

**Task 25: Final Verification**
- Run TypeScript check: `npx tsc --noEmit`
- Run tests: `npx vitest run`
- Verify all screens render (manual check via Expo Go)
- Verify auth flow works end-to-end
- Verify tab navigation and deep linking

---

## Tech Notes

- **Expo Router** uses file-based routing like Next.js App Router — `app/(tabs)/properties/[id].tsx` = `/properties/:id`
- **NativeWind v4** uses `className` prop on React Native components — same Tailwind classes as web
- **tRPC React Query** provides `useQuery`/`useMutation` hooks — same patterns as web app
- **Expo SecureStore** encrypts data at rest on device — used for JWT tokens
- **Expo Local Authentication** supports Face ID, Touch ID, and Android biometrics
- **EAS Build** compiles native binaries in the cloud — no Xcode/Android Studio needed locally
- **EAS Submit** uploads to App Store Connect / Google Play Console automatically
- **Auth:** Uses existing `mobileAuth` tRPC router — no backend changes needed
- **Data:** All queries hit the same tRPC endpoints as the web app — no API changes
