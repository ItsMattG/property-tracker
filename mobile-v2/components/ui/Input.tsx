import { TextInput, View, Text } from "react-native";
import { cn } from "../../lib/utils";

interface InputProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "email-address" | "numeric" | "decimal-pad";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  error?: string;
  className?: string;
}

export function Input({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  error,
  className,
}: InputProps) {
  return (
    <View className={className}>
      {label && <Text className="text-sm font-medium text-gray-700 mb-1">{label}</Text>}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        placeholderTextColor="#9ca3af"
        className={cn(
          "border rounded-lg px-3 py-3 text-base text-gray-900",
          error ? "border-destructive" : "border-gray-300"
        )}
      />
      {error && <Text className="text-sm text-destructive mt-1">{error}</Text>}
    </View>
  );
}
