import type { NetworkTelemetry, EvidenceFinding, StructuredEvidence } from "../types";
import { DIAGNOSTIC_THRESHOLDS as T, evidenceForMetric } from "./evidence-utils";

export function runConnectivityAgent(telemetry: NetworkTelemetry): EvidenceFinding {
  const m = telemetry.metrics;
  const evidence: string[] = [];
  const limitations: string[] = [];
  const observations: string[] = [];
  const structured: StructuredEvidence[] = [];
  const add = (metric: string, value: number, unit: string, threshold: number, high: boolean, label: string) => {
    const text = `${label}: ${value} ${unit} (investigation threshold: ${threshold} ${unit}).`;
    evidence.push(text);
    if (high) observations.push(`${label} is outside the expected investigation range.`);
    structured.push(evidenceForMetric(telemetry, metric, value, unit, threshold, high ? "warning" : "info", text, "connectivity-agent"));
  };
  if (m.rssi_dbm !== undefined) add("rssi_dbm", m.rssi_dbm, "dBm", T.rssi_dbm, m.rssi_dbm <= T.rssi_dbm, "Wireless signal strength");
  else limitations.push("Wireless signal strength is unavailable.");
  if (m.wifi_retransmission_percent !== undefined) add("wifi_retransmission_percent", m.wifi_retransmission_percent, "%", T.wifi_retransmission_percent, m.wifi_retransmission_percent >= T.wifi_retransmission_percent, "Wi-Fi retransmission rate");
  else limitations.push("Wi-Fi retransmission telemetry is unavailable.");
  if (m.dns_failure_percent !== undefined) add("dns_failure_percent", m.dns_failure_percent, "%", T.dns_failure_percent, m.dns_failure_percent >= T.dns_failure_percent, "DNS failure rate");
  else limitations.push("DNS failure telemetry is unavailable.");
  if (m.dhcp_failure_percent !== undefined) add("dhcp_failure_percent", m.dhcp_failure_percent, "%", T.dhcp_failure_percent, m.dhcp_failure_percent >= T.dhcp_failure_percent, "DHCP failure rate");
  else limitations.push("DHCP failure telemetry is unavailable.");
  if (m.packet_loss_percent !== undefined) add("packet_loss_percent", m.packet_loss_percent, "%", T.packet_loss_percent, m.packet_loss_percent >= T.packet_loss_percent, "Packet loss");
  else limitations.push("Packet-loss telemetry is unavailable.");
  if (m.latency_ms !== undefined) add("latency_ms", m.latency_ms, "ms", T.latency_ms, m.latency_ms >= T.latency_ms, "Latency");
  else limitations.push("Latency telemetry is unavailable.");
  if (telemetry.device_status === "down" || telemetry.interface_status === "down" || telemetry.interface_status === "admin_down") {
    observations.push("Device or interface state indicates a connectivity interruption.");
  }
  if (telemetry.neighbors?.length) evidence.push(`Known neighboring devices: ${telemetry.neighbors.join(", ")}.`);
  else limitations.push("Neighbor and path topology data is unavailable; end-to-end affected paths cannot be confirmed.");
  return {
    agent: "connectivity-agent",
    observation: observations.length ? observations.join(" ") : "No connectivity-specific threshold breach was identified; this does not prove end-to-end reachability.",
    evidence, limitations, structured_evidence: structured,
  };
}
