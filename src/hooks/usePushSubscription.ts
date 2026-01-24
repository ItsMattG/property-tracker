"use client";

import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc/client";

type SubscriptionStatus = "loading" | "unsupported" | "denied" | "prompt" | "subscribed";

export function usePushSubscription() {
  const [status, setStatus] = useState<SubscriptionStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  const { data: vapidKey } = trpc.notification.getVapidPublicKey.useQuery();
  const registerMutation = trpc.notification.registerPushSubscription.useMutation();
  const unregisterMutation = trpc.notification.unregisterPushSubscription.useMutation();

  useEffect(() => {
    checkSubscriptionStatus();
  }, []);

  const checkSubscriptionStatus = async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }

    const permission = Notification.permission;

    if (permission === "denied") {
      setStatus("denied");
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        setStatus("subscribed");
      } else {
        setStatus("prompt");
      }
    } catch (err) {
      console.error("Error checking subscription:", err);
      setStatus("prompt");
    }
  };

  const subscribe = useCallback(async () => {
    if (!vapidKey) {
      setError("Push notifications not configured");
      return false;
    }

    try {
      setError(null);

      // Register service worker
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      // Request permission
      const permission = await Notification.requestPermission();

      if (permission !== "granted") {
        setStatus("denied");
        return false;
      }

      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      // Send to server
      const json = subscription.toJSON();
      await registerMutation.mutateAsync({
        endpoint: subscription.endpoint,
        p256dh: json.keys?.p256dh || "",
        auth: json.keys?.auth || "",
        userAgent: navigator.userAgent,
      });

      setStatus("subscribed");
      return true;
    } catch (err) {
      console.error("Error subscribing:", err);
      setError("Failed to enable notifications");
      return false;
    }
  }, [vapidKey, registerMutation]);

  const unsubscribe = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();
        await unregisterMutation.mutateAsync({ endpoint: subscription.endpoint });
      }

      setStatus("prompt");
      return true;
    } catch (err) {
      console.error("Error unsubscribing:", err);
      setError("Failed to disable notifications");
      return false;
    }
  }, [unregisterMutation]);

  return {
    status,
    error,
    subscribe,
    unsubscribe,
    isSupported: status !== "unsupported",
  };
}

// Helper to convert VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}
