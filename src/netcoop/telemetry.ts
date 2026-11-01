import type { NetworkTelemetry, ValidationIssue } from "./types";

const numericLimits: Record<string, { min: number; max: number }> = {
  latency_ms: { min: 0, max: 3_600_000 },
  packet_loss_percent: { min: 0, max: 100 },
  jitter_ms: { min: 0, max: 3_600_000 },
  bandwidth_mbps: { min: 0, max: 1_000_000_000 },
  throughput_mbps: { min: 0, max: 1_000_000_000 },
  link_capacity_mbps: { min: 0, max: 1_000_000_000 },
  rssi_dbm: { min: -120, max: 0 },
  wifi_retransmission_percent: { min: 0, max: 100 },
  dns_failure_percent: { min: 0, max: 100 },
  dhcp_failure_percent: { min: 0, max: 100 },
  utilization_percent: { min: 0, max: 100 },
  cpu_utilization_percent: { min: 0, max: 100 },
  memory_utilization_percent: { min: 0, max: 100 },
  interface_errors: { min: 0, max: Number.MAX_SAFE_INTEGER },
  queue_drops: { min: 0, max: Number.MAX_SAFE_INTEGER },
};

const aliases: Record<string, keyof NetworkTelemetry["metrics"]> = {
  latency: "latency_ms",
  latency_ms: "latency_ms",
  latencyMs: "latency_ms",
  rtt_ms: "latency_ms",
  rtt: "latency_ms",
  packet_loss: "packet_loss_percent",
  packetLoss: "packet_loss_percent",
  packetLossPercent: "packet_loss_percent",
  packet_loss_percent: "packet_loss_percent",
  jitter: "jitter_ms",
  jitterMs: "jitter_ms",
  jitter_ms: "jitter_ms",
  bandwidth: "bandwidth_mbps",
  bandwidth_mbps: "bandwidth_mbps",
  throughput: "throughput_mbps",
  throughput_mbps: "throughput_mbps",
  link_capacity: "link_capacity_mbps",
  link_capacity_mbps: "link_capacity_mbps",
  rssi: "rssi_dbm",
  rssi_dbm: "rssi_dbm",
  signal_strength_dbm: "rssi_dbm",
  wifi_retransmission: "wifi_retransmission_percent",
  wifi_retransmissions_percent: "wifi_retransmission_percent",
  wifi_retransmission_percent: "wifi_retransmission_percent",
  dns_failure: "dns_failure_percent",
  dns_failure_percent: "dns_failure_percent",
  dhcp_failure: "dhcp_failure_percent",
  dhcp_failure_percent: "dhcp_failure_percent",
  utilization: "utilization_percent",
  interface_utilization_percent: "utilization_percent",
  utilization_percent: "utilization_percent",
  cpu: "cpu_utilization_percent",
  cpu_percent: "cpu_utilization_percent",
  cpu_utilization: "cpu_utilization_percent",
  cpu_utilization_percent: "cpu_utilization_percent",
  memory: "memory_utilization_percent",
  memory_percent: "memory_utilization_percent",
  memory_utilization: "memory_utilization_percent",
  memory_utilization_percent: "memory_utilization_percent",
  interface_errors: "interface_errors",
  if_errors: "interface_errors",
  errors: "interface_errors",
  queue_drops: "queue_drops",
  output_drops: "queue_drops",
  drops: "queue_drops",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function convertMetric(value: unknown, metric: keyof NetworkTelemetry["metrics"]):
  | { ok: true; value: number }
  | { ok: false; message: string } {
  let raw = value;
  let unit: string | undefined;

  if (isRecord(value)) {
    raw = value.value;
    unit = typeof value.unit === "string" ? value.unit.trim().toLowerCase() : undefined;
  }

  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return { ok: false, message: "Metric must be a finite number or { value, unit } object." };
  }

  let converted = raw;
  if (unit) {
    const conversions: Partial<Record<string, Record<string, number>>> = {
      latency_ms: { ms: 1, millisecond: 1, milliseconds: 1, s: 1000, sec: 1000, seconds: 1000 },
      jitter_ms: { ms: 1, millisecond: 1, milliseconds: 1, s: 1000, sec: 1000, seconds: 1000 },
      bandwidth_mbps: { mbps: 1, mb: 1, gbps: 1000, kbps: 0.001, bps: 0.000001 },
      throughput_mbps: { mbps: 1, gbps: 1000, kbps: 0.001, bps: 0.000001 },
      link_capacity_mbps: { mbps: 1, gbps: 1000, kbps: 0.001, bps: 0.000001 },
      rssi_dbm: { dbm: 1 },
      wifi_retransmission_percent: { "%": 1, percent: 1, fraction: 100 },
      dns_failure_percent: { "%": 1, percent: 1, fraction: 100 },
      dhcp_failure_percent: { "%": 1, percent: 1, fraction: 100 },
      packet_loss_percent: { "%": 1, percent: 1, fraction: 100 },
      utilization_percent: { "%": 1, percent: 1, fraction: 100 },
      cpu_utilization_percent: { "%": 1, percent: 1, fraction: 100 },
      memory_utilization_percent: { "%": 1, percent: 1, fraction: 100 },
      interface_errors: { count: 1, errors: 1 },
      queue_drops: { count: 1, packets: 1, drops: 1 },
    };
    const factor = conversions[metric]?.[unit];
    if (factor === undefined) {
      return { ok: false, message: `Unsupported unit '${unit}' for ${metric}.` };
    }
    converted *= factor;
  }

  return { ok: true, value: converted };
}

export function validateTelemetry(
  input: unknown
): { valid: true; data: NetworkTelemetry } | {
  valid: false;
  issues: ValidationIssue[];
} {
  const issues: ValidationIssue[] = [];
  if (!isRecord(input)) {
    return { valid: false, issues: [{ field: "body", message: "Expected a JSON object." }] };
  }

  const value = input;
  if (value.schema_version !== undefined && value.schema_version !== "1.0") {
    issues.push({ field: "schema_version", message: "Unsupported telemetry schema version. Supported version: 1.0." });
  }
  if (value.source !== undefined && (typeof value.source !== "string" || !value.source.trim() || value.source.length > 100)) {
    issues.push({ field: "source", message: "source must be a non-empty string of at most 100 characters." });
  }
  if (value.device_status !== undefined && !["up", "down", "degraded", "unknown"].includes(String(value.device_status))) {
    issues.push({ field: "device_status", message: "device_status must be up, down, degraded, or unknown." });
  }
  if (value.interface_status !== undefined && !["up", "down", "admin_down", "unknown"].includes(String(value.interface_status))) {
    issues.push({ field: "interface_status", message: "interface_status must be up, down, admin_down, or unknown." });
  }
  if (value.neighbors !== undefined && (!Array.isArray(value.neighbors) || value.neighbors.some((item) => typeof item !== "string" || !item.trim()))) {
    issues.push({ field: "neighbors", message: "neighbors must be an array of non-empty device identifiers." });
  }
  if (typeof value.incident_id !== "string" || !value.incident_id.trim()) {
    issues.push({ field: "incident_id", message: "A non-empty incident_id is required." });
  } else if (value.incident_id.length > 100) {
    issues.push({ field: "incident_id", message: "incident_id must be at most 100 characters." });
  }

  const device = value.device ?? value.device_id ?? value.hostname ?? value.node;
  if (typeof device !== "string" || !device.trim()) {
    issues.push({ field: "device", message: "A non-empty device, device_id, hostname, or node is required." });
  } else if (device.length > 200) {
    issues.push({ field: "device", message: "device must be at most 200 characters." });
  }

  if (value.timestamp !== undefined &&
      (typeof value.timestamp !== "string" || !Number.isFinite(Date.parse(value.timestamp)))) {
    issues.push({ field: "timestamp", message: "timestamp must be a valid date-time string." });
  }

  const rawMetrics = value.metrics ?? value.telemetry ?? value.measurements;
  if (!isRecord(rawMetrics)) {
    issues.push({ field: "metrics", message: "metrics, telemetry, or measurements must be a JSON object." });
  }

  const normalized: NetworkTelemetry["metrics"] = {};
  if (isRecord(rawMetrics)) {
    const seen = new Set<string>();
    for (const [name, raw] of Object.entries(rawMetrics)) {
      const canonical = aliases[name];
      if (!canonical) {
        issues.push({ field: `metrics.${name}`, message: "Unknown metric alias. Add an explicit schema mapping before ingestion." });
        continue;
      }
      if (seen.has(canonical)) {
        issues.push({ field: `metrics.${name}`, message: `Multiple input fields map to ${canonical}; provide only one to avoid ambiguous telemetry.` });
        continue;
      }
      seen.add(canonical);

      const result = convertMetric(raw, canonical);
      if (!result.ok) {
        issues.push({ field: `metrics.${name}`, message: result.message });
        continue;
      }
      const limits = numericLimits[canonical];
      if (result.value < limits.min || result.value > limits.max) {
        issues.push({ field: `metrics.${name}`, message: `Normalized value must be between ${limits.min} and ${limits.max} (${canonical}).` });
        continue;
      }
      if ((canonical === "interface_errors" || canonical === "queue_drops") &&
          !Number.isSafeInteger(result.value)) {
        issues.push({ field: `metrics.${name}`, message: "Counter metrics must be safe integers." });
        continue;
      }
      normalized[canonical] = result.value;
    }
  }

  if (issues.length) return { valid: false, issues };

  return {
    valid: true,
    data: {
      ...(value.schema_version !== undefined ? { schema_version: value.schema_version as "1.0" } : {}),
      ...(value.source !== undefined ? { source: (value.source as string).trim() } : {}),
      incident_id: (value.incident_id as string).trim(),
      device: (device as string).trim(),
      ...(value.timestamp !== undefined ? { timestamp: value.timestamp as string } : {}),
      ...(value.device_status !== undefined ? { device_status: value.device_status as NetworkTelemetry["device_status"] } : {}),
      ...(value.interface_status !== undefined ? { interface_status: value.interface_status as NetworkTelemetry["interface_status"] } : {}),
      ...(value.neighbors !== undefined ? { neighbors: value.neighbors as string[] } : {}),
      metrics: normalized,
    },
  };
}


/**
 * Tolerant ingestion mode: preserve valid telemetry fields and return rejected
 * fields as explicit issues. Envelope errors (incident/device/metrics object)
 * still reject the complete record. Use validateTelemetry for strict mode.
 */
export function validateTelemetryTolerant(input: unknown):
  | { valid: true; data: NetworkTelemetry; issues: ValidationIssue[] }
  | { valid: false; issues: ValidationIssue[] } {
  if (!isRecord(input)) {
    return { valid: false, issues: [{ field: "body", message: "Expected a JSON object.", severity: "error", code: "INVALID_BODY" }] };
  }

  const rawMetrics = input.metrics ?? input.telemetry ?? input.measurements;
  if (!isRecord(rawMetrics)) {
    const envelope = validateTelemetry(input);
    return envelope.valid
      ? { valid: true, data: envelope.data, issues: [] }
      : { valid: false, issues: envelope.issues };
  }

  const acceptedMetrics: Record<string, unknown> = {};
  const rejected: ValidationIssue[] = [];
  const seenCanonical = new Set<string>();
  for (const [name, metricValue] of Object.entries(rawMetrics)) {
    const canonical = aliases[name];
    if (canonical && seenCanonical.has(canonical)) {
      rejected.push({
        field: `metrics.${name}`,
        message: `Multiple input fields map to ${canonical}; this metric was quarantined as ambiguous.`,
      });
      continue;
    }
    if (canonical) seenCanonical.add(canonical);
    const candidate = validateTelemetry({ ...input, metrics: { [name]: metricValue } });
    if (candidate.valid) {
      const normalized = candidate.data.metrics as Record<string, number | undefined>;
      const canonicalName = Object.keys(normalized).find((key) => normalized[key] !== undefined);
      if (canonicalName) acceptedMetrics[canonicalName] = normalized[canonicalName];
    } else {
      rejected.push(...candidate.issues.filter((issue) => issue.field.startsWith("metrics.")));
    }
  }

  const envelope = validateTelemetry({ ...input, metrics: acceptedMetrics });
  if (!envelope.valid) return { valid: false, issues: envelope.issues };
  return {
    valid: true,
    data: envelope.data,
    issues: rejected.map((issue) => ({ ...issue, severity: "warning", code: "METRIC_QUARANTINED" })),
  };
}
