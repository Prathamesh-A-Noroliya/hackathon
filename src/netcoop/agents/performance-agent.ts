import type { EvidenceFinding, NetworkTelemetry, StructuredEvidence } from "../types";
import { DIAGNOSTIC_THRESHOLDS as T, evidenceForMetric } from "./evidence-utils";

export function runPerformanceAgent(telemetry: NetworkTelemetry): EvidenceFinding {
  const m = telemetry.metrics;
  const evidence: string[] = [];
  const limitations: string[] = [];
  const structured: StructuredEvidence[] = [];
  const observations: string[] = [];
  const check = (key: keyof typeof m, label: string, unit: string, threshold: number, elevated: (v: number) => boolean) => {
    const value = m[key];
    if (value === undefined) { limitations.push(`${label} telemetry is missing.`); return; }
    const isHigh = elevated(value);
    const text = `${label}: ${value} ${unit}${threshold !== undefined ? ` (investigation threshold: ${threshold} ${unit})` : ""}.`;
    evidence.push(text);
    if (isHigh) observations.push(`${label} is above its investigation threshold.`);
    structured.push(evidenceForMetric(telemetry, key, value, unit, threshold, isHigh ? "warning" : "info", text, "performance-agent"));
  };
  check("latency_ms", "Latency", "ms", T.latency_ms, v => v >= T.latency_ms);
  check("packet_loss_percent", "Packet loss", "%", T.packet_loss_percent, v => v >= T.packet_loss_percent);
  check("jitter_ms", "Jitter", "ms", T.jitter_ms, v => v >= T.jitter_ms);
  if (m.throughput_mbps !== undefined) {
    const capacity = m.link_capacity_mbps ?? m.bandwidth_mbps;
    const low = capacity !== undefined && capacity > 0 && m.throughput_mbps / capacity < 0.5;
    const throughputThreshold = capacity !== undefined ? capacity * 0.5 : undefined;
    const text = `Throughput: ${m.throughput_mbps} Mbps${capacity !== undefined ? ` against ${capacity} Mbps reported capacity (investigation threshold: ${throughputThreshold} Mbps)` : " (capacity baseline unavailable)"}.`;
    evidence.push(text);
    if (low) observations.push("Throughput is below 50% of the reported link capacity; confirm expected demand and measurement direction.");
    structured.push(evidenceForMetric(telemetry, "throughput_mbps", m.throughput_mbps, "Mbps", throughputThreshold, low ? "warning" : "info", text, "performance-agent"));
    if (capacity === undefined) limitations.push("Throughput was supplied without link capacity; relative throughput cannot be assessed.");
  } else limitations.push("Throughput telemetry is missing.");
  if (m.bandwidth_mbps !== undefined) evidence.push(`Reported bandwidth: ${m.bandwidth_mbps} Mbps.`);
  else if (m.link_capacity_mbps === undefined) limitations.push("Bandwidth or link-capacity baseline is missing.");
  return {
    agent: "performance-agent",
    observation: observations.length ? observations.join(" ") : "No elevated latency, packet loss, or jitter was identified in the available measurements.",
    evidence, limitations, structured_evidence: structured,
  };
}
