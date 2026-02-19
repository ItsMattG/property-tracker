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
