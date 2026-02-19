import { TouchableOpacity, Text, ActivityIndicator } from "react-native";
import { cn } from "../../lib/utils";

interface ButtonProps {
  onPress: () => void;
  children: React.ReactNode;
  variant?: "primary" | "outline" | "destructive" | "ghost";
  size?: "default" | "sm" | "lg";
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}

const variantStyles = {
  primary: "bg-primary",
  outline: "bg-transparent border border-gray-300",
  destructive: "bg-destructive",
  ghost: "bg-transparent",
};

const variantTextStyles = {
  primary: "text-white",
  outline: "text-gray-900",
  destructive: "text-white",
  ghost: "text-gray-900",
};

const sizeStyles = {
  default: "py-3 px-4",
  sm: "py-2 px-3",
  lg: "py-4 px-6",
};

export function Button({
  onPress,
  children,
  variant = "primary",
  size = "default",
  disabled = false,
  loading = false,
  className,
}: ButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      className={cn(
        "rounded-lg items-center justify-center flex-row",
        variantStyles[variant],
        sizeStyles[size],
        (disabled || loading) && "opacity-50",
        className
      )}
    >
      {loading && <ActivityIndicator size="small" color="white" className="mr-2" />}
      <Text className={cn("font-semibold text-base", variantTextStyles[variant])}>
        {typeof children === "string" ? children : children}
      </Text>
    </TouchableOpacity>
  );
}
