import { Stack } from "expo-router";

export default function MoreLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#ffffff" },
        headerTitleStyle: { fontWeight: "600" },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="tax-position" options={{ title: "Tax Position" }} />
      <Stack.Screen name="cash-flow" options={{ title: "Cash Flow" }} />
      <Stack.Screen name="scorecard" options={{ title: "Property Scorecard" }} />
      <Stack.Screen name="borrowing-power" options={{ title: "Borrowing Power" }} />
      <Stack.Screen name="settings" options={{ title: "Settings" }} />
    </Stack>
  );
}
