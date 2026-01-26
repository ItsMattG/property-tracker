import { ingestLog } from "./axiom";

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

interface LogOptions {
  requestId?: string;
  userId?: string;
  duration?: number;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const MIN_LOG_LEVEL: LogLevel =
  process.env.NODE_ENV === "production" ? "info" : "debug";

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LOG_LEVEL];
}

// Auto-enrichment fields for structured logs
function getEnrichment() {
  return {
    service: "property-tracker",
    environment: process.env.NODE_ENV || "development",
    region: process.env.VERCEL_REGION || "local",
    commitSha: process.env.VERCEL_GIT_COMMIT_SHA || "unknown",
  };
}

function createStructuredLog(
  level: LogLevel,
  message: string,
  options?: LogOptions,
  context?: LogContext
) {
  const timestamp = new Date().toISOString();
  const enrichment = getEnrichment();

  return {
    timestamp,
    level,
    message,
    ...enrichment,
    ...(options?.requestId && { requestId: options.requestId }),
    ...(options?.userId && { userId: options.userId }),
    ...(options?.duration !== undefined && { duration: options.duration }),
    ...(context && Object.keys(context).length > 0 && { context }),
  };
}

function formatConsoleMessage(
  level: LogLevel,
  message: string,
  context?: LogContext
): string {
  const timestamp = new Date().toISOString();
  const contextStr = context ? ` ${JSON.stringify(context)}` : "";
  return `[${timestamp}] ${level.toUpperCase()}: ${message}${contextStr}`;
}

// Request context storage (using AsyncLocalStorage would be better but keeping it simple)
let currentRequestContext: LogOptions = {};

/**
 * Set the current request context for all subsequent logs.
 * Call this at the start of request handling.
 */
export function setLogContext(context: LogOptions): void {
  currentRequestContext = context;
}

/**
 * Clear the current request context.
 * Call this at the end of request handling.
 */
export function clearLogContext(): void {
  currentRequestContext = {};
}

/**
 * Get the current request context.
 */
export function getLogContext(): LogOptions {
  return currentRequestContext;
}

export const logger = {
  debug(message: string, context?: LogContext, options?: LogOptions) {
    if (shouldLog("debug")) {
      const mergedOptions = { ...currentRequestContext, ...options };
      console.debug(formatConsoleMessage("debug", message, context));
      ingestLog(createStructuredLog("debug", message, mergedOptions, context));
    }
  },

  info(message: string, context?: LogContext, options?: LogOptions) {
    if (shouldLog("info")) {
      const mergedOptions = { ...currentRequestContext, ...options };
      console.info(formatConsoleMessage("info", message, context));
      ingestLog(createStructuredLog("info", message, mergedOptions, context));
    }
  },

  warn(message: string, context?: LogContext, options?: LogOptions) {
    if (shouldLog("warn")) {
      const mergedOptions = { ...currentRequestContext, ...options };
      console.warn(formatConsoleMessage("warn", message, context));
      ingestLog(createStructuredLog("warn", message, mergedOptions, context));
    }
  },

  error(
    message: string,
    error?: Error | unknown,
    context?: LogContext,
    options?: LogOptions
  ) {
    if (shouldLog("error")) {
      const mergedOptions = { ...currentRequestContext, ...options };
      const errorContext =
        error instanceof Error
          ? { ...context, error: error.message, stack: error.stack }
          : error
            ? { ...context, error: String(error) }
            : context;
      console.error(formatConsoleMessage("error", message, errorContext));
      ingestLog(
        createStructuredLog("error", message, mergedOptions, errorContext)
      );
    }
  },

  /**
   * Create a child logger with fixed context values.
   * Useful for adding request-specific context to all logs in a handler.
   */
  child(fixedContext: LogContext, fixedOptions?: LogOptions) {
    return {
      debug: (message: string, context?: LogContext) =>
        logger.debug(message, { ...fixedContext, ...context }, fixedOptions),
      info: (message: string, context?: LogContext) =>
        logger.info(message, { ...fixedContext, ...context }, fixedOptions),
      warn: (message: string, context?: LogContext) =>
        logger.warn(message, { ...fixedContext, ...context }, fixedOptions),
      error: (message: string, error?: Error | unknown, context?: LogContext) =>
        logger.error(
          message,
          error,
          { ...fixedContext, ...context },
          fixedOptions
        ),
    };
  },
};
