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
