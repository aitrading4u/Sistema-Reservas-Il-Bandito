type LogLevel = "info" | "warn" | "error";

interface LogPayload {
  scope: string;
  message: string;
  meta?: Record<string, unknown>;
}

function write(level: LogLevel, payload: LogPayload) {
  const entry = {
    level,
    at: new Date().toISOString(),
    ...payload,
  };
  // Basic structured logs for observability in server runtimes.
  console[level](JSON.stringify(entry));
}

export const logger = {
  info(payload: LogPayload) {
    write("info", payload);
  },
  warn(payload: LogPayload) {
    write("warn", payload);
  },
  error(payload: LogPayload) {
    write("error", payload);
  },
};
