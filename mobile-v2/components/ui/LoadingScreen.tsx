import { View, ActivityIndicator, Text } from "react-native";

export function LoadingScreen({ message = "Loading..." }: { message?: string }) {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <ActivityIndicator size="large" color="#2563eb" />
      <Text className="text-gray-500 mt-4 text-base">{message}</Text>
    </View>
  );
}
