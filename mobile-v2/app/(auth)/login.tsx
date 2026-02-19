import { useState } from "react";
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useAuth } from "../../lib/auth-context";

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError("Please enter email and password");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-white"
    >
      <ScrollView
        contentContainerStyle={{
          flex: 1,
          justifyContent: "center",
          paddingHorizontal: 24,
        }}
      >
        <View className="mb-10">
          <Text className="text-3xl font-bold text-gray-900">BrickTrack</Text>
          <Text className="text-base text-gray-500 mt-2">
            Sign in to manage your property portfolio
          </Text>
        </View>

        <View className="gap-4">
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="Your password"
            secureTextEntry
          />

          {error ? (
            <Text className="text-destructive text-sm">{error}</Text>
          ) : null}

          <Button onPress={handleLogin} loading={loading} className="mt-2">
            Sign In
          </Button>
        </View>

        <Text className="text-xs text-gray-400 text-center mt-8">
          Set up mobile access from Settings on the web
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
