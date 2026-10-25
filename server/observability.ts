import crypto from 'node:crypto';
import http from 'node:http';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface StructuredLogEntry {
  timestamp: string;
  level: LogLevel;
  requestId?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  durationMs?: number;
  message: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

// Sensitive fields to redact from logs and metric payloads
const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'token',
  'secret',
  'authorization',
  'cookie',
  'set-cookie',
  'apikey',
  'key',
  'pass',
  'credential',
  'invitetoken',
  'privatekey',
  'rawtoken',
  'bodytext',
  'smtp_pass',
  'smtp_user',
]);

/**
 * Recursively deep-sanitizes objects and structures, replacing sensitive credentials with '[REDACTED]'.
 * Avoids logging full event payloads or unnecessary state dumps.
 */
export function sanitizeForLogging(data: unknown, depth = 0): unknown {
  if (depth > 10 || data === null || data === undefined) return data;
  if (typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    // Truncate large arrays in log output to prevent memory bloat
    if (data.length > 25) {
      return [...data.slice(0, 25).map((item) => sanitizeForLogging(item, depth + 1)), `[... ${data.length - 25} more items]`];
    }
    return data.map((item) => sanitizeForLogging(item, depth + 1));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(data as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lowerKey)) {
      sanitized[key] = '[REDACTED]';
    } else if (key === 'state' && typeof val === 'object' && val !== null) {
      // Avoid logging full event application state tree; summarize metadata only
      const stateObj = val as Record<string, unknown>;
      sanitized[key] = {
        eventId: (stateObj.event as Record<string, unknown>)?.id || 'unknown',
        eventName: (stateObj.event as Record<string, unknown>)?.name || 'unknown',
        summaryOnly: true,
      };
    } else {
      sanitized[key] = sanitizeForLogging(val, depth + 1);
    }
  }
  return sanitized;
}

/**
 * Structured JSON Logger for enterprise observability and diagnostics.
 */
export class StructuredLogger {
  private outputStream: (entry: StructuredLogEntry) => void;

  constructor(outputStream?: (entry: StructuredLogEntry) => void) {
    this.outputStream =
      outputStream ||
      ((entry) => {
        // Output clean single-line JSON log in production / standard stdout
        if (process.env.NODE_ENV !== 'test' || process.env.VOWPILOT_LOG_TESTS === 'true') {
          process.stdout.write(JSON.stringify(entry) + '\n');
        }
      });
  }

  public log(
    level: LogLevel,
    message: string,
    meta?: {
      requestId?: string;
      method?: string;
      path?: string;
      statusCode?: number;
      durationMs?: number;
      error?: unknown;
      extra?: Record<string, unknown>;
    }
  ): StructuredLogEntry {
    let errorString: string | undefined;
    if (meta?.error) {
      if (meta.error instanceof Error) {
        errorString = meta.error.message;
      } else {
        errorString = String(meta.error);
      }
    }

    const entry: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(meta?.requestId ? { requestId: meta.requestId } : {}),
      ...(meta?.method ? { method: meta.method } : {}),
      ...(meta?.path ? { path: meta.path } : {}),
      ...(meta?.statusCode !== undefined ? { statusCode: meta.statusCode } : {}),
      ...(meta?.durationMs !== undefined ? { durationMs: Math.round(meta.durationMs * 100) / 100 } : {}),
      ...(errorString ? { error: errorString } : {}),
      ...(meta?.extra ? { metadata: sanitizeForLogging(meta.extra) as Record<string, unknown> } : {}),
    };

    this.outputStream(entry);
    return entry;
  }

  public debug(message: string, meta?: Parameters<StructuredLogger['log']>[2]): StructuredLogEntry {
    return this.log('DEBUG', message, meta);
  }

  public info(message: string, meta?: Parameters<StructuredLogger['log']>[2]): StructuredLogEntry {
    return this.log('INFO', message, meta);
  }

  public warn(message: string, meta?: Parameters<StructuredLogger['log']>[2]): StructuredLogEntry {
    return this.log('WARN', message, meta);
  }

  public error(message: string, meta?: Parameters<StructuredLogger['log']>[2]): StructuredLogEntry {
    return this.log('ERROR', message, meta);
  }
}

/**
 * Operational Metrics Collector:
 * In-memory operational metrics registry recording request counts, latency percentiles,
 * active SSE connections, database queries, and error rates.
 */
export class MetricsRegistry {
  private totalRequests = 0;
  private statusCodes: Map<number, number> = new Map();
  private routeLatencies: Map<string, number[]> = new Map(); // routeKey -> latency samples
  private activeSseConnections = 0;
  private maxActiveSseConnections = 0;
  private totalDbQueries = 0;
  private slowDbQueries = 0;
  private dbQueryDurations: number[] = [];
  private emailDispatchCount = 0;
  private emailErrorCount = 0;

  public recordRequest(method: string, path: string, statusCode: number, durationMs: number): void {
    this.totalRequests++;
    this.statusCodes.set(statusCode, (this.statusCodes.get(statusCode) || 0) + 1);

    // Normalize path to prevent high-cardinality route explosion
    const normalizedPath = this.normalizeRoute(path);
    const key = `${method} ${normalizedPath}`;
    const samples = this.routeLatencies.get(key) || [];
    // Keep bounded rolling sample (last 1000 requests per route)
    if (samples.length >= 1000) {
      samples.shift();
    }
    samples.push(durationMs);
    this.routeLatencies.set(key, samples);
  }

  public recordDbQuery(durationMs: number): void {
    this.totalDbQueries++;
    if (durationMs > 50) {
      this.slowDbQueries++;
    }
    if (this.dbQueryDurations.length >= 1000) {
      this.dbQueryDurations.shift();
    }
    this.dbQueryDurations.push(durationMs);
  }

  public incrementSseConnection(): number {
    this.activeSseConnections++;
    if (this.activeSseConnections > this.maxActiveSseConnections) {
      this.maxActiveSseConnections = this.activeSseConnections;
    }
    return this.activeSseConnections;
  }

  public decrementSseConnection(): number {
    if (this.activeSseConnections > 0) {
      this.activeSseConnections--;
    }
    return this.activeSseConnections;
  }

  public recordEmailDispatch(success: boolean): void {
    this.emailDispatchCount++;
    if (!success) {
      this.emailErrorCount++;
    }
  }

  public getSnapshot(): {
    totalRequests: number;
    activeSseConnections: number;
    maxActiveSseConnections: number;
    statusSummary: { '2xx': number; '4xx': number; '5xx': number; other: number };
    errorRatePercent: number;
    database: {
      totalQueries: number;
      slowQueries: number;
      latencyP50Ms: number;
      latencyP95Ms: number;
      latencyP99Ms: number;
    };
    routeMetrics: Record<
      string,
      {
        count: number;
        p50Ms: number;
        p95Ms: number;
        p99Ms: number;
        avgMs: number;
        minMs: number;
        maxMs: number;
      }
    >;
    email: {
      totalDispatched: number;
      errors: number;
    };
    uptimeSeconds: number;
  } {
    let count2xx = 0;
    let count4xx = 0;
    let count5xx = 0;
    let other = 0;

    for (const [code, count] of this.statusCodes.entries()) {
      if (code >= 200 && code < 300) count2xx += count;
      else if (code >= 400 && code < 500) count4xx += count;
      else if (code >= 500 && code < 600) count5xx += count;
      else other += count;
    }

    const errorCount = count5xx;
    const errorRatePercent =
      this.totalRequests > 0 ? Math.round((errorCount / this.totalRequests) * 10000) / 100 : 0;

    const routeMetrics: Record<string, any> = {};
    for (const [route, samples] of this.routeLatencies.entries()) {
      if (samples.length === 0) continue;
      const sorted = [...samples].sort((a, b) => a - b);
      const count = sorted.length;
      const sum = sorted.reduce((acc, val) => acc + val, 0);

      routeMetrics[route] = {
        count,
        minMs: Math.round(sorted[0] * 100) / 100,
        maxMs: Math.round(sorted[count - 1] * 100) / 100,
        avgMs: Math.round((sum / count) * 100) / 100,
        p50Ms: Math.round(sorted[Math.floor(count * 0.5)] * 100) / 100,
        p95Ms: Math.round(sorted[Math.floor(count * 0.95)] * 100) / 100,
        p99Ms: Math.round(sorted[Math.floor(count * 0.99)] * 100) / 100,
      };
    }

    const sortedDb = [...this.dbQueryDurations].sort((a, b) => a - b);
    const dbCount = sortedDb.length;

    return {
      totalRequests: this.totalRequests,
      activeSseConnections: this.activeSseConnections,
      maxActiveSseConnections: this.maxActiveSseConnections,
      statusSummary: { '2xx': count2xx, '4xx': count4xx, '5xx': count5xx, other },
      errorRatePercent,
      database: {
        totalQueries: this.totalDbQueries,
        slowQueries: this.slowDbQueries,
        latencyP50Ms: dbCount > 0 ? Math.round(sortedDb[Math.floor(dbCount * 0.5)] * 100) / 100 : 0,
        latencyP95Ms: dbCount > 0 ? Math.round(sortedDb[Math.floor(dbCount * 0.95)] * 100) / 100 : 0,
        latencyP99Ms: dbCount > 0 ? Math.round(sortedDb[Math.floor(dbCount * 0.99)] * 100) / 100 : 0,
      },
      routeMetrics,
      email: {
        totalDispatched: this.emailDispatchCount,
        errors: this.emailErrorCount,
      },
      uptimeSeconds: Math.round(process.uptime()),
    };
  }

  public reset(): void {
    this.totalRequests = 0;
    this.statusCodes.clear();
    this.routeLatencies.clear();
    this.activeSseConnections = 0;
    this.maxActiveSseConnections = 0;
    this.totalDbQueries = 0;
    this.slowDbQueries = 0;
    this.dbQueryDurations = [];
    this.emailDispatchCount = 0;
    this.emailErrorCount = 0;
  }

  private normalizeRoute(path: string): string {
    return path
      .replace(/\/events\/[a-zA-Z0-9_-]+\/stream/, '/events/:id/stream')
      .replace(/\/events\/[a-zA-Z0-9_-]+\/invites\/[a-zA-Z0-9_-]+/, '/events/:id/invites/:tokenHash')
      .replace(/\/events\/[a-zA-Z0-9_-]+\/invites/, '/events/:id/invites')
      .replace(/\/events\/[a-zA-Z0-9_-]+\/members\/[a-zA-Z0-9_-]+/, '/events/:id/members/:userId')
      .replace(/\/events\/[a-zA-Z0-9_-]+/, '/events/:id');
  }
}

/**
 * Extract or generate a clean Request Correlation ID.
 * Honors incoming X-Request-ID if well-formed (alphanumeric/hyphen/underscore, max 64 chars);
 * otherwise generates a cryptographically secure random identifier.
 */
export function resolveCorrelationId(req: http.IncomingMessage): string {
  const incoming = req.headers['x-request-id'];
  if (typeof incoming === 'string') {
    const trimmed = incoming.trim();
    if (/^[a-zA-Z0-9_-]{8,64}$/.test(trimmed)) {
      return trimmed;
    }
  }
  return `req_${crypto.randomBytes(12).toString('hex')}`;
}

export const globalLogger = new StructuredLogger();
export const globalMetrics = new MetricsRegistry();
