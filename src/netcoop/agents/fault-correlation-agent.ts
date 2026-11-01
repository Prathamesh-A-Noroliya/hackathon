import type { EvidenceFinding, StructuredEvidence } from "../types";

function categoryForMetric(metric: string): string {
  if (["latency_ms", "packet_loss_percent", "jitter_ms", "throughput_mbps", "bandwidth_mbps"].includes(metric)) return "performance";
  if (["utilization_percent", "cpu_utilization_percent", "memory_utilization_percent", "interface_errors", "queue_drops", "device_status", "interface_status"].includes(metric)) return "infrastructure";
  if (["rssi_dbm", "wifi_retransmission_percent"].includes(metric)) return "wireless";
  if (metric === "dns_failure_percent") return "dns";
  if (metric === "dhcp_failure_percent") return "dhcp";
  return "other";
}

export function runFaultCorrelationAgent(findings: EvidenceFinding[]): EvidenceFinding {
  const byId = new Map<string, StructuredEvidence>();
  for (const finding of findings) {
    for (const item of finding.structured_evidence ?? []) {
      if (!byId.has(item.evidence_id)) byId.set(item.evidence_id, item);
    }
  }
  const evidence = [...byId.values()];
  const anomalous = evidence.filter(item => item.severity === "warning" || item.severity === "critical");
  const categories = [...new Set(anomalous.map(item => categoryForMetric(item.metric)).filter(item => item !== "other"))];
  const crossDomain = categories.length >= 2;
  const observation = crossDomain
    ? `Cross-domain anomalies were observed in ${categories.join(", ")}. These findings are related in the same incident but do not establish causation.`
    : anomalous.length
      ? `Anomalies were observed in the ${categories[0] ?? "available"} domain. Independent cross-domain corroboration is not yet available.`
      : "No configured threshold breaches were identified in the structured evidence supplied to the correlation agent.";
  return {
    agent: "fault-correlation-agent",
    observation,
    evidence: anomalous.map(item => `${item.metric}: ${item.value} ${item.unit ?? ""} [${item.severity}]`),
    limitations: [
      "Repeated measurements with the same evidence ID are deduplicated before correlation.",
      "Cross-domain correlation indicates a relationship worth investigating; it is not proof of root cause.",
      ...(categories.length < 2 ? ["Insufficient distinct anomalous evidence domains for cross-domain corroboration."] : []),
    ],
    structured_evidence: evidence,
  };
}
