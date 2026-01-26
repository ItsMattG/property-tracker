import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, Switch, Alert } from "react-native";
import { useAuth } from "../lib/AuthContext";
import { trpc } from "../lib/trpc";

interface Preferences {
  pushEnabled: boolean;
}

export function SettingsScreen() {
  const { user, logout } = useAuth();
  const [preferences, setPreferences] = useState<Preferences | null>(null);

  useEffect(() => {
    async function fetchPreferences() {
      try {
        const data = await trpc.notification.getPreferences.query();
        setPreferences(data);
      } catch (error) {
        console.error("Failed to fetch preferences:", error);
      }
    }
    fetchPreferences();
  }, []);

  function handleLogout() {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: logout },
    ]);
  }

  async function togglePush(value: boolean) {
    try {
      await trpc.notification.updatePreferences.mutate({ pushEnabled: value });
      setPreferences((prev) => (prev ? { ...prev, pushEnabled: value } : null));
    } catch (error) {
      console.error("Failed to update preferences:", error);
    }
  }

  return (
    <View testID="settings-screen" className="flex-1 bg-gray-50">
      {/* Account Section */}
      <View className="mt-6">
        <Text className="px-4 pb-2 text-sm font-medium text-gray-500 uppercase">
          Account
        </Text>
        <View className="bg-white">
          <View testID="user-email-container" className="p-4 border-b border-gray-100">
            <Text className="text-sm text-gray-500">Email</Text>
            <Text testID="user-email" className="font-medium">{user?.email}</Text>
          </View>
          <View testID="user-name-container" className="p-4">
            <Text className="text-sm text-gray-500">Name</Text>
            <Text testID="user-name" className="font-medium">{user?.name || "Not set"}</Text>
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
              testID="notifications-toggle"
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
          testID="sign-out-button"
          className="bg-white p-4"
          onPress={handleLogout}
        >
          <Text className="text-red-600 text-center font-medium">
            Sign Out
          </Text>
        </TouchableOpacity>
      </View>

      {/* Version */}
      <Text testID="app-version" className="text-center text-gray-400 text-sm mt-8">
        PropertyTracker Mobile v1.0.0
      </Text>
    </View>
  );
}
