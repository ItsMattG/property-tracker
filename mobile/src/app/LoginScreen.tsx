import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useAuth } from "../lib/AuthContext";

export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  async function handleLogin() {
    if (!email || !password) {
      setError("Please enter email and password");
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      await login(email, password);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Login failed. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-white"
    >
      <View className="flex-1 justify-center px-6">
        <Text className="text-3xl font-bold text-center mb-2">
          PropertyTracker
        </Text>
        <Text className="text-gray-500 text-center mb-8">
          Sign in with your mobile password
        </Text>

        <View className="space-y-4">
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-1">Email</Text>
            <TextInput
              className="border border-gray-300 rounded-lg px-4 py-3 text-base"
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
          </View>

          <View>
            <Text className="text-sm font-medium text-gray-700 mb-1">
              Password
            </Text>
            <TextInput
              className="border border-gray-300 rounded-lg px-4 py-3 text-base"
              placeholder="Mobile password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
            />
          </View>

          {error ? (
            <Text className="text-red-500 text-sm">{error}</Text>
          ) : null}

          <TouchableOpacity
            className={`rounded-lg py-4 ${
              isLoading ? "bg-blue-400" : "bg-blue-600"
            }`}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white text-center font-semibold text-base">
                Sign In
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <Text className="text-gray-500 text-center mt-8 text-sm">
          Set up mobile access from Settings → Mobile App on the web
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}
