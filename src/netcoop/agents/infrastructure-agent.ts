import type { EvidenceFinding, NetworkTelemetry, StructuredEvidence } from "../types";
import { DIAGNOSTIC_THRESHOLDS as T, evidenceForMetric } from "./evidence-utils";

export function runInfrastructureAgent(telemetry: NetworkTelemetry): EvidenceFinding {
  const m = telemetry.metrics;
  const evidence: string[] = [];
  const observations: string[] = [];
  const limitations: string[] = [];
  const structured: StructuredEvidence[] = [];
  const check = (key: keyof typeof m, label: string, unit: string, threshold: number | undefined, high: (v: number) => boolean) => {
    const value = m[key];
    if (value === undefined) { limitations.push(`${label} data is unavailable.`); return; }
    const breached = high(value);
    const text = `${label}: ${value} ${unit}${threshold !== undefined ? ` (investigation threshold: ${threshold} ${unit})` : ""}.`;
    evidence.push(text);
    if (breached) observations.push(`${label} threshold breach detected.`);
    structured.push(evidenceForMetric(telemetry, key, value, unit, threshold, breached ? "warning" : "info", text, "infrastructure-agent"));
  };
  if (telemetry.device_status) {
    const down = telemetry.device_status === "down" || telemetry.device_status === "degraded";
    const text = `Device status: ${telemetry.device_status}.`;
    evidence.push(text);
    if (down) observations.push(`Device reports ${telemetry.device_status} status.`);
    structured.push(evidenceForMetric(telemetry, "device_status", telemetry.device_status, "state", undefined, down ? "critical" : "info", text, "infrastructure-agent"));
  } else limitations.push("Device status was not supplied.");
  if (telemetry.interface_status) {
    const down = telemetry.interface_status === "down" || telemetry.interface_status === "admin_down";
    const text = `Interface status: ${telemetry.interface_status}.`;
    evidence.push(text);
    if (down) observations.push(`Interface reports ${telemetry.interface_status} state.`);
    structured.push(evidenceForMetric(telemetry, "interface_status", telemetry.interface_status, "state", undefined, down ? "critical" : "info", text, "infrastructure-agent"));
  } else limitations.push("Interface operational state was not supplied.");
  check("cpu_utilization_percent", "CPU utilization", "%", T.cpu_utilization_percent, v => v >= T.cpu_utilization_percent);
  check("memory_utilization_percent", "Memory utilization", "%", T.memory_utilization_percent, v => v >= T.memory_utilization_percent);
  check("utilization_percent", "Interface utilization", "%", T.utilization_percent, v => v >= T.utilization_percent);
  check("interface_errors", "Interface errors", "count", 0, v => v > 0);
  check("queue_drops", "Queue drops", "packets", 0, v => v > 0);
  return {
    agent: "infrastructure-agent",
    observation: observations.length ? observations.join(" ") : "No infrastructure threshold breach was identified in the available measurements.",
    evidence, limitations: [...limitations, "Thresholds are configurable demonstration defaults, not universal network standards.", "A single telemetry snapshot does not establish causation."],
    structured_evidence: structured,
  };
}
