/**
 * STRUCTURED LOGGER + METRICS PERSISTENCE
 *
 * Two layers:
 * 1. Console logging (all events) — for Vercel logs / development
 * 2. DB persistence (metrics only) — for the admin dashboard
 */

export type LogLevel = "debug" | "info" | "warn" | "error" | "metric";

class Logger {
  private isDev = process.env.NODE_ENV === "development";

  private log(level: LogLevel, event: string, data?: Record<string, unknown>) {
    if (this.isDev) {
      const color = { debug: "\x1b[90m", info: "\x1b[36m", warn: "\x1b[33m", error: "\x1b[31m", metric: "\x1b[35m" }[level];
      console.log(`${color}[${level.toUpperCase()}]\x1b[0m ${event}`, data ? JSON.stringify(data) : "");
    } else {
      console.log(JSON.stringify({ timestamp: new Date().toISOString(), level, event, data }));
    }
  }

  debug(event: string, data?: Record<string, unknown>) { this.log("debug", event, data); }
  info(event: string, data?: Record<string, unknown>) { this.log("info", event, data); }
  warn(event: string, data?: Record<string, unknown>) { this.log("warn", event, data); }
  error(event: string, data?: Record<string, unknown>) { this.log("error", event, data); }

  metric(event: string, data?: Record<string, unknown>) {
    this.log("metric", event, data);
    this.persistMetric(event, data);
  }

  private async persistMetric(event: string, data?: Record<string, unknown>) {
    try {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const admin = createAdminClient();
      await admin.from("system_metrics").insert({ event, data: data || {} });
    } catch { /* non-critical */ }
  }

  async measure<T>(event: string, fn: () => Promise<T>, extra?: Record<string, unknown>): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      this.metric(event, { ...extra, duration_ms: Date.now() - start, success: true });
      return result;
    } catch (e) {
      this.metric(event, { ...extra, duration_ms: Date.now() - start, success: false, error: e instanceof Error ? e.message : "unknown" });
      throw e;
    }
  }
}

export const logger = new Logger();
