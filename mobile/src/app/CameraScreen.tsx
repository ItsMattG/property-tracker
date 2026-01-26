import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { trpc } from "../lib/trpc";

type CaptureStep = "camera" | "preview" | "uploading";

interface Property {
  id: string;
  address: string;
}

export function CameraScreen() {
  const [step, setStep] = useState<CaptureStep>("camera");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [properties, setProperties] = useState<Property[]>([]);
  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    async function fetchProperties() {
      try {
        const data = await trpc.property.list.query();
        setProperties(data);
      } catch (error) {
        console.error("Failed to fetch properties:", error);
      }
    }
    fetchProperties();
  }, []);

  async function takePicture() {
    if (!cameraRef.current) return;

    const photo = await cameraRef.current.takePictureAsync({
      quality: 0.8,
    });

    if (photo?.uri) {
      setImageUri(photo.uri);
      setStep("preview");
    }
  }

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setStep("preview");
    }
  }

  async function uploadDocument() {
    if (!imageUri || !properties[0]) {
      Alert.alert("Error", "Please add a property first");
      return;
    }

    setStep("uploading");

    try {
      // Get file info
      const response = await fetch(imageUri);
      const blob = await response.blob();
      const fileName = `receipt-${Date.now()}.jpg`;

      // Get signed upload URL
      const { signedUrl, storagePath } = await trpc.documents.getUploadUrl.mutate({
        fileName,
        fileType: "image/jpeg",
        fileSize: blob.size,
        propertyId: properties[0].id,
      });

      // Upload to Supabase
      await fetch(signedUrl, {
        method: "PUT",
        headers: { "Content-Type": "image/jpeg" },
        body: blob,
      });

      // Create document record
      await trpc.documents.create.mutate({
        storagePath,
        fileName,
        fileType: "image/jpeg",
        fileSize: blob.size,
        propertyId: properties[0].id,
        category: "receipt",
      });

      Alert.alert("Success", "Document uploaded and processing", [
        { text: "OK", onPress: () => resetCamera() },
      ]);
    } catch (error) {
      console.error("Upload error:", error);
      Alert.alert("Error", "Failed to upload document");
      setStep("preview");
    }
  }

  function resetCamera() {
    setImageUri(null);
    setStep("camera");
  }

  if (!permission) {
    return (
      <View testID="camera-loading" className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View testID="permission-prompt" className="flex-1 items-center justify-center p-4 bg-white">
        <Text className="text-center mb-4">
          Camera access is needed to capture documents
        </Text>
        <TouchableOpacity
          testID="grant-permission-button"
          className="bg-blue-600 rounded-lg px-6 py-3"
          onPress={requestPermission}
        >
          <Text className="text-white font-semibold">Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (step === "uploading") {
    return (
      <View testID="upload-progress" className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#2563eb" />
        <Text className="mt-4 text-gray-600">Uploading document...</Text>
      </View>
    );
  }

  if (step === "preview" && imageUri) {
    return (
      <View testID="preview-screen" className="flex-1 bg-black">
        <Image
          testID="preview-image"
          source={{ uri: imageUri }}
          className="flex-1"
          resizeMode="contain"
        />
        <View className="flex-row p-4 space-x-4">
          <TouchableOpacity
            testID="retake-button"
            className="flex-1 bg-gray-600 rounded-lg py-4"
            onPress={resetCamera}
          >
            <Text className="text-white text-center font-semibold">Retake</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="confirm-button"
            className="flex-1 bg-blue-600 rounded-lg py-4"
            onPress={uploadDocument}
          >
            <Text className="text-white text-center font-semibold">Upload</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View testID="camera-screen" className="flex-1 bg-black">
      <CameraView testID="camera-view" ref={cameraRef} className="flex-1" facing="back">
        <View className="flex-1 justify-end items-center pb-8">
          <View className="flex-row items-center space-x-6">
            <TouchableOpacity
              testID="gallery-button"
              className="bg-white/20 rounded-full p-4"
              onPress={pickImage}
            >
              <Text className="text-white text-sm">Gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="capture-button"
              className="bg-white rounded-full w-20 h-20 border-4 border-gray-300"
              onPress={takePicture}
            />
            <View className="w-16" />
          </View>
        </View>
      </CameraView>
    </View>
  );
}
