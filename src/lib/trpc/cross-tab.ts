/**
 * Cross-tab cache invalidation via BroadcastChannel.
 * When a mutation in one tab changes data, other tabs
 * are notified to refetch only the affected queries.
 */

const CHANNEL_NAME = "bricktrack-cache-invalidation";

type InvalidationMessage = {
  keys: string[]; // tRPC query keys to invalidate, e.g. ["transaction.list"]
};

let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof window === "undefined") return null;
  if (!channel) {
    try {
      channel = new BroadcastChannel(CHANNEL_NAME);
    } catch {
      // BroadcastChannel not supported
      return null;
    }
  }
  return channel;
}

/** Broadcast to other tabs that these query keys should be invalidated */
export function broadcastInvalidation(keys: string[]) {
  const ch = getChannel();
  if (ch) {
    ch.postMessage({ keys } satisfies InvalidationMessage);
  }
}

/** Listen for invalidation messages from other tabs */
export function onCrossTabInvalidation(
  callback: (keys: string[]) => void
): () => void {
  const ch = getChannel();
  if (!ch) return () => {};

  const handler = (event: MessageEvent<InvalidationMessage>) => {
    callback(event.data.keys);
  };
  ch.addEventListener("message", handler);
  return () => ch.removeEventListener("message", handler);
}
