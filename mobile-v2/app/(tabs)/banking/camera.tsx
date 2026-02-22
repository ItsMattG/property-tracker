import { useState } from "react";
import { View, Text, Image, Alert } from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Camera as CameraIcon, ImageIcon } from "lucide-react-native";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";

export default function ReceiptCaptureScreen() {
  const router = useRouter();
  const [image, setImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Camera access is required to capture receipts.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]) {
      setImage(result.assets[0].uri);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]) {
      setImage(result.assets[0].uri);
    }
  };

  const handleUpload = async () => {
    if (!image) return;
    setUploading(true);
    try {
      // TODO: Upload to Supabase via signed URL
      Alert.alert("Success", "Receipt uploaded successfully", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert("Error", "Failed to upload receipt");
    } finally {
      setUploading(false);
    }
  };

  return (
    <View className="flex-1 bg-gray-50 p-4">
      {image ? (
        <View className="flex-1">
          <Card className="flex-1 overflow-hidden">
            <Image source={{ uri: image }} className="flex-1 rounded-lg" resizeMode="contain" />
          </Card>
          <View className="gap-3 mt-4">
            <Button onPress={handleUpload} loading={uploading}>
              Upload Receipt
            </Button>
            <Button variant="outline" onPress={() => setImage(null)}>
              Retake
            </Button>
          </View>
        </View>
      ) : (
        <View className="flex-1 items-center justify-center gap-4">
          <CameraIcon size={64} color="#9ca3af" />
          <Text className="text-gray-500 text-base text-center">
            Capture or select a receipt to attach to a transaction
          </Text>
          <View className="w-full gap-3">
            <Button onPress={takePhoto}>
              Take Photo
            </Button>
            <Button variant="outline" onPress={pickImage}>
              Choose from Library
            </Button>
          </View>
        </View>
      )}
    </View>
  );
}
