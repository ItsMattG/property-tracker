import { useEffect } from "react";
import { Slot, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { TRPCProvider } from "../lib/trpc-provider";
import { AuthProvider, useAuth } from "../lib/auth-context";
import { getTRPCClient } from "../lib/trpc";
import { LoadingScreen } from "../components/ui/LoadingScreen";
import "../global.css";

const vanillaClient = getTRPCClient();

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
        <AuthProvider trpcClient={vanillaClient}>
          <AuthGuard>
            <StatusBar style="dark" />
            <Slot />
          </AuthGuard>
        </AuthProvider>
      </TRPCProvider>
    </SafeAreaProvider>
  );
}
