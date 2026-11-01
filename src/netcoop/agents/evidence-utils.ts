import type { NetworkTelemetry, StructuredEvidence } from "../types";

export const DIAGNOSTIC_THRESHOLDS = {
  latency_ms: 150,
  packet_loss_percent: 2,
  jitter_ms: 30,
  utilization_percent: 85,
  cpu_utilization_percent: 85,
  memory_utilization_percent: 90,
  wifi_retransmission_percent: 15,
  rssi_dbm: -75,
  dns_failure_percent: 5,
  dhcp_failure_percent: 5,
} as const;

export function evidenceForMetric(
  telemetry: NetworkTelemetry,
  metric: string,
  value: number | string | boolean,
  unit: string,
  threshold: number | undefined,
  severity: StructuredEvidence["severity"],
  observation: string,
  sourceAgent = "diagnostic-agent",
): StructuredEvidence {
  const evidenceId = [telemetry.incident_id, telemetry.device, metric, telemetry.timestamp ?? "snapshot", String(value)]
    .join(":").replace(/[^a-zA-Z0-9:_-]/g, "_");
  return {
    evidence_id: evidenceId,
    metric,
    value,
    unit,
    ...(threshold !== undefined ? { threshold } : {}),
    severity,
    observation,
    source_agent: sourceAgent,
    source_id: telemetry.source ?? "telemetry-input",
    device_id: telemetry.device,
    ...(telemetry.timestamp ? { timestamp: telemetry.timestamp } : {}),
    provenance: `telemetry:${telemetry.source ?? "user-supplied"}`,
  };
}

export function classifyThreshold(
  metric: keyof typeof DIAGNOSTIC_THRESHOLDS,
  value: number,
): "warning" | "info" {
  const threshold = DIAGNOSTIC_THRESHOLDS[metric];
  const breached = metric === "rssi_dbm" ? value <= threshold : value >= threshold;
  return breached ? "warning" : "info";
}
