import { ScrollView, View, Text, TouchableOpacity, Alert, Switch } from "react-native";
import { useState, useCallback } from "react";
import { useRouter } from "expo-router";
import { User, Bell, Moon, Shield, LogOut, ChevronRight } from "lucide-react-native";
import { useAuth } from "../../../lib/auth-context";
import { Card } from "../../../components/ui/Card";

function SettingRow({
  icon,
  label,
  description,
  right,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  description?: string;
  right?: React.ReactNode;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress && !right}
      className="flex-row items-center py-3 border-b border-gray-100"
    >
      <View className="w-9 h-9 rounded-lg bg-gray-100 items-center justify-center mr-3">
        {icon}
      </View>
      <View className="flex-1">
        <Text className="text-sm font-semibold text-gray-900">{label}</Text>
        {description && <Text className="text-xs text-gray-500">{description}</Text>}
      </View>
      {right ?? (onPress ? <ChevronRight size={16} color="#9ca3af" /> : null)}
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [theme, setTheme] = useState<"system" | "light" | "dark">("system");

  const handleSignOut = useCallback(() => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/(auth)/login");
        },
      },
    ]);
  }, [logout, router]);

  const cycleTheme = useCallback(() => {
    setTheme((prev) => {
      if (prev === "system") return "light";
      if (prev === "light") return "dark";
      return "system";
    });
  }, []);

  return (
    <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 16, gap: 16 }}>
      <Card>
        <View className="items-center py-4">
          <View className="w-16 h-16 rounded-full bg-primary/10 items-center justify-center mb-3">
            <User size={28} color="#2563eb" />
          </View>
          <Text className="text-lg font-bold text-gray-900">{user?.name ?? "User"}</Text>
          <Text className="text-sm text-gray-500">{user?.email ?? ""}</Text>
        </View>
      </Card>

      <Card>
        <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Security</Text>
        <SettingRow
          icon={<Shield size={18} color="#6b7280" />}
          label="Face ID / Biometrics"
          description="Require biometric to open app"
          right={
            <Switch
              value={biometricEnabled}
              onValueChange={setBiometricEnabled}
              trackColor={{ true: "#2563eb" }}
            />
          }
        />
      </Card>

      <Card>
        <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Preferences</Text>
        <SettingRow
          icon={<Bell size={18} color="#6b7280" />}
          label="Notifications"
          description="Push notifications for transactions"
          right={
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ true: "#2563eb" }}
            />
          }
        />
        <SettingRow
          icon={<Moon size={18} color="#6b7280" />}
          label="Theme"
          description={theme.charAt(0).toUpperCase() + theme.slice(1)}
          onPress={cycleTheme}
        />
      </Card>

      <Card>
        <SettingRow
          icon={<LogOut size={18} color="#ef4444" />}
          label="Sign Out"
          onPress={handleSignOut}
        />
      </Card>

      <Text className="text-xs text-gray-400 text-center mt-4">BrickTrack v1.0.0</Text>
    </ScrollView>
  );
}
