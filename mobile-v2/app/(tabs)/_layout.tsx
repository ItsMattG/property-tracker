import { Tabs } from "expo-router";
import {
  Home,
  Building2,
  ArrowLeftRight,
  MoreHorizontal,
} from "lucide-react-native";

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
          tabBarIcon: ({ color, size }) => (
            <Building2 size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="banking"
        options={{
          title: "Banking",
          tabBarIcon: ({ color, size }) => (
            <ArrowLeftRight size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "More",
          tabBarIcon: ({ color, size }) => (
            <MoreHorizontal size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
