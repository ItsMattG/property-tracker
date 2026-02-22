import { useState } from "react";
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter, Stack } from "expo-router";
import { trpc } from "../../../lib/trpc";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Card } from "../../../components/ui/Card";

const STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"];
const PURPOSES = ["investment", "owner_occupied"];

export default function AddPropertyScreen() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const createMutation = trpc.property.create.useMutation({
    onSuccess: (data) => {
      utils.property.list.invalidate();
      if (data?.id) {
        utils.property.get.setData({ id: data.id }, data);
        router.replace(`/(tabs)/properties/${data.id}`);
      } else {
        router.back();
      }
    },
  });

  const [address, setAddress] = useState("");
  const [suburb, setSuburb] = useState("");
  const [state, setState] = useState("NSW");
  const [postcode, setPostcode] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [purpose, setPurpose] = useState("investment");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!address.trim()) newErrors.address = "Address is required";
    if (!suburb.trim()) newErrors.suburb = "Suburb is required";
    if (!postcode.trim()) newErrors.postcode = "Postcode is required";
    if (!purchasePrice.trim() || isNaN(Number(purchasePrice))) newErrors.purchasePrice = "Valid price is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreate = () => {
    if (!validate()) return;
    createMutation.mutate({
      address: address.trim(),
      suburb: suburb.trim(),
      state,
      postcode: postcode.trim(),
      purchasePrice: Number(purchasePrice),
      purpose,
    });
  };

  return (
    <>
      <Stack.Screen options={{ title: "Add Property" }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 16, gap: 16 }}>
          <Card>
            <Text className="text-base font-semibold text-gray-900 mb-4">Property Details</Text>
            <View className="gap-3">
              <Input label="Street Address" value={address} onChangeText={setAddress} placeholder="123 Main St" error={errors.address} />
              <Input label="Suburb" value={suburb} onChangeText={setSuburb} placeholder="Sydney" error={errors.suburb} />
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Text className="text-sm font-medium text-gray-700 mb-1">State</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {STATES.map((s) => (
                      <Button
                        key={s}
                        variant={state === s ? "primary" : "outline"}
                        size="sm"
                        onPress={() => setState(s)}
                      >
                        {s}
                      </Button>
                    ))}
                  </View>
                </View>
              </View>
              <Input label="Postcode" value={postcode} onChangeText={setPostcode} placeholder="2000" keyboardType="numeric" error={errors.postcode} />
            </View>
          </Card>

          <Card>
            <Text className="text-base font-semibold text-gray-900 mb-4">Purchase Info</Text>
            <View className="gap-3">
              <Input label="Purchase Price" value={purchasePrice} onChangeText={setPurchasePrice} placeholder="750000" keyboardType="decimal-pad" error={errors.purchasePrice} />
              <View>
                <Text className="text-sm font-medium text-gray-700 mb-2">Purpose</Text>
                <View className="flex-row gap-2">
                  {PURPOSES.map((p) => (
                    <Button
                      key={p}
                      variant={purpose === p ? "primary" : "outline"}
                      size="sm"
                      onPress={() => setPurpose(p)}
                      className="flex-1"
                    >
                      {p === "investment" ? "Investment" : "Owner Occupied"}
                    </Button>
                  ))}
                </View>
              </View>
            </View>
          </Card>

          <Button
            onPress={handleCreate}
            loading={createMutation.isPending}
            disabled={createMutation.isPending}
          >
            Add Property
          </Button>

          {createMutation.isError && (
            <Text className="text-destructive text-sm text-center">
              {createMutation.error.message}
            </Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
