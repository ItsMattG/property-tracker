import { Stack } from "expo-router";

export default function BankingLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#ffffff" },
        headerTitleStyle: { fontWeight: "600" },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="review" options={{ title: "Review Transactions" }} />
      <Stack.Screen name="feeds" options={{ title: "Bank Feeds" }} />
      <Stack.Screen name="camera" options={{ title: "Capture Receipt" }} />
    </Stack>
  );
}
