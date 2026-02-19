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
