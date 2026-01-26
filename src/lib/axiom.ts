import { Axiom } from "@axiomhq/js";

// Initialize Axiom client (lazy initialization for build-time safety)
let axiomClient: Axiom | null = null;

function getAxiom(): Axiom | null {
  if (!process.env.AXIOM_TOKEN) {
    return null;
  }
  if (!axiomClient) {
    axiomClient = new Axiom({
      token: process.env.AXIOM_TOKEN,
      orgId: process.env.AXIOM_ORG_ID,
    });
  }
  return axiomClient;
}

const DATASET = process.env.AXIOM_DATASET || "property-tracker";

// Auto-enrichment fields
function getEnrichment() {
  return {
    service: "property-tracker",
    environment: process.env.NODE_ENV || "development",
    region: process.env.VERCEL_REGION || "local",
    commitSha: process.env.VERCEL_GIT_COMMIT_SHA || "unknown",
  };
}

export interface LogEvent {
  timestamp: string;
  level: "debug" | "info" | "warn" | "error";
  message: string;
  requestId?: string;
  userId?: string;
  duration?: number;
  context?: Record<string, unknown>;
}

/**
 * Send a structured log event to Axiom
 */
export function ingestLog(event: LogEvent): void {
  const axiom = getAxiom();
  if (!axiom) return;

  axiom.ingest(DATASET, {
    ...getEnrichment(),
    ...event,
    _time: event.timestamp,
  });
}

/**
 * Metrics helpers for common instrumentation patterns
 */
export const axiomMetrics = {
  /**
   * Record a timing metric (duration in milliseconds)
   */
  timing(
    name: string,
    durationMs: number,
    tags: Record<string, string | number | boolean> = {}
  ): void {
    const axiom = getAxiom();
    if (!axiom) return;

    axiom.ingest(DATASET, {
      ...getEnrichment(),
      _time: new Date().toISOString(),
      type: "metric",
      metric: name,
      metricType: "timing",
      value: durationMs,
      unit: "ms",
      ...tags,
    });
  },

  /**
   * Increment a counter metric
   */
  increment(
    name: string,
    tags: Record<string, string | number | boolean> = {},
    value: number = 1
  ): void {
    const axiom = getAxiom();
    if (!axiom) return;

    axiom.ingest(DATASET, {
      ...getEnrichment(),
      _time: new Date().toISOString(),
      type: "metric",
      metric: name,
      metricType: "counter",
      value,
      ...tags,
    });
  },

  /**
   * Record a gauge metric (point-in-time value)
   */
  gauge(
    name: string,
    value: number,
    tags: Record<string, string | number | boolean> = {}
  ): void {
    const axiom = getAxiom();
    if (!axiom) return;

    axiom.ingest(DATASET, {
      ...getEnrichment(),
      _time: new Date().toISOString(),
      type: "metric",
      metric: name,
      metricType: "gauge",
      value,
      ...tags,
    });
  },
};

/**
 * Flush all pending events to Axiom.
 * Call this at the end of serverless functions.
 */
export async function flushAxiom(): Promise<void> {
  const axiom = getAxiom();
  if (!axiom) return;

  try {
    await axiom.flush();
  } catch (error) {
    // Don't let flush failures break the application
    console.error("[axiom] Failed to flush:", error);
  }
}

/**
 * Helper to wrap an async function with automatic timing and flushing.
 * Useful for API route handlers.
 */
export function withAxiomTiming<T extends unknown[], R>(
  name: string,
  fn: (...args: T) => Promise<R>,
  getTags?: (...args: T) => Record<string, string | number | boolean>
): (...args: T) => Promise<R> {
  return async (...args: T) => {
    const start = Date.now();
    try {
      const result = await fn(...args);
      const duration = Date.now() - start;
      axiomMetrics.timing(name, duration, getTags?.(...args) || {});
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      axiomMetrics.timing(name, duration, {
        ...(getTags?.(...args) || {}),
        error: true,
      });
      throw error;
    } finally {
      await flushAxiom();
    }
  };
}
