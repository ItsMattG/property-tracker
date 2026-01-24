// Service Worker for Push Notifications

self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const payload = event.data.json();

    const options = {
      body: payload.body,
      icon: payload.icon || "/icon-192.png",
      badge: "/icon-192.png",
      data: payload.data || {},
      requireInteraction: true,
      actions: [
        { action: "view", title: "View" },
        { action: "dismiss", title: "Dismiss" },
      ],
    };

    event.waitUntil(self.registration.showNotification(payload.title, options));
  } catch (error) {
    console.error("Error showing notification:", error);
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") {
    return;
  }

  const url = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Check if there's already a window open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      // Open new window if none found
      return clients.openWindow(url);
    })
  );
});

// Handle subscription changes
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    fetch("/api/notification/subscription-changed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        oldEndpoint: event.oldSubscription?.endpoint,
        newSubscription: event.newSubscription,
      }),
    })
  );
});
