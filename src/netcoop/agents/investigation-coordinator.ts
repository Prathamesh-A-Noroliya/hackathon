import { dispatchDiagnosticAgent } from "./agent-dispatcher";
import { getRegisteredAgents } from "./agent-registry";
import type { AgentId, DiagnosisReport, EvidenceFinding, NetworkTelemetry } from "../types";
import { runFaultCorrelationAgent } from "./fault-correlation-agent";
import { runHypothesisAgent } from "./hypothesis-agent";
import { runVerificationAgent } from "./verification-agent";
import { assessTopology } from "./topology-agent";
import { AgentMessageBus, createAgentMessage } from "./agent-communication";
import { AgentTaskManager } from "./task-manager";

export async function runInvestigationCoordinator(telemetry: NetworkTelemetry): Promise<DiagnosisReport> {
  const bus = new AgentMessageBus(telemetry.incident_id);
  const tasks = new AgentTaskManager();
  const failed: AgentId[] = [];
  const executionErrors: string[] = [];

  // Fan out all registered specialist diagnostics concurrently. Each task has
  // its own correlated request, bounded retry policy and isolated failure path.
  // A failed specialist never discards valid findings returned by its peers.
  const specialists = getRegisteredAgents().filter(agent => agent.role === "diagnostic");
  await Promise.all(specialists.map(async (agent) => {
    const capability = agent.capabilities[0];
    if (!capability) {
      failed.push(agent.id);
      executionErrors.push(`${agent.id}: no diagnostic capability is registered.`);
      return;
    }
    const availableEvidence = capability.evidenceTypes.filter(key =>
      key === "topology" || key === "reachability" || key === "device_status" || key === "interface_status" || key === "neighbors"
        ? (key === "topology" || key === "reachability" ? true : (telemetry as unknown as Record<string, unknown>)[key] !== undefined)
        : telemetry.metrics[key as keyof NetworkTelemetry["metrics"]] !== undefined
    );
    const requestedEvidence = availableEvidence.length ? availableEvidence : capability.evidenceTypes;
    let completed = false;
    let lastFailure = "Agent did not complete after bounded retries.";

    for (let attempt = 1; attempt <= 2; attempt++) {
      const request = createAgentMessage({
        incidentId: telemetry.incident_id,
        sender: "coordinator",
        recipient: agent.id,
        messageType: "request",
        payload: {
          requested_data: requestedEvidence,
          evidence: [],
          limitations: [],
          observation: `Parallel diagnostic dispatch to ${agent.name}. Attempt ${attempt}/2.`,
          schema_version: telemetry.schema_version ?? "1.0",
        },
      });
      bus.send(request);
      const task = tasks.createTask(request, 10_000);
      try {
        tasks.markRunning(task.task_id);
        await Promise.resolve();
        dispatchDiagnosticAgent({ request, telemetry, messageBus: bus, capabilityId: capability.id });
        const response = bus.getResponseFor(request.message_id, agent.id);
        if (!response) throw new Error("No correlated response was received before the task deadline.");
        tasks.completeFromResponse(response);
        completed = true;
        break;
      } catch (error) {
        lastFailure = error instanceof Error ? error.message : "Unknown diagnostic error.";
        const current = tasks.getTask(task.task_id);
        if (current && (current.status === "pending" || current.status === "running")) {
          try { tasks.failTask(task.task_id, lastFailure); } catch { /* task already terminal */ }
        }
      }
    }

    if (!completed) {
      failed.push(agent.id);
      executionErrors.push(`${agent.id}: ${lastFailure} (after 2 attempts)`);
    }
  }));

  const requests = bus.getMessages().filter(m => m.sender === "coordinator" && m.message_type === "request");
  const diagnosticFindings: EvidenceFinding[] = bus.getMessagesFor("coordinator")
    .filter(message => message.message_type === "response" && Boolean(message.correlation_id) && requests.some(request =>
      request.message_id === message.correlation_id && request.recipient === message.sender && request.incident_id === message.incident_id))
    .map(message => ({
      agent: message.sender,
      observation: message.payload.observation ?? "No observation provided.",
      evidence: message.payload.evidence ?? [],
      limitations: message.payload.limitations ?? [],
      ...(message.payload.structured_evidence ? { structured_evidence: message.payload.structured_evidence } : {}),
    }));

  const findings: EvidenceFinding[] = [...diagnosticFindings];
  const correlation = runFaultCorrelationAgent(diagnosticFindings);
  findings.push(correlation);
  bus.send(createAgentMessage({
    incidentId: telemetry.incident_id, sender: "fault-correlation-agent", recipient: "coordinator", messageType: "finding",
    payload: { observation: correlation.observation, evidence: correlation.evidence, limitations: correlation.limitations },
  }));

  const hypothesisResult = await runHypothesisAgent(telemetry.incident_id, telemetry.device, findings);
  for (const hypothesis of hypothesisResult.hypotheses) {
    bus.send(createAgentMessage({
      incidentId: telemetry.incident_id, sender: "hypothesis-agent", recipient: "coordinator", messageType: "hypothesis",
      payload: { hypothesis: hypothesis.explanation, confidence: hypothesis.confidence, evidence: hypothesis.supporting_evidence, limitations: [...hypothesis.contradicting_evidence, ...hypothesis.missing_evidence] },
    }));
  }
  const verificationResult = await runVerificationAgent({ telemetry, findings, hypotheses: hypothesisResult.hypotheses, evidenceCatalog: hypothesisResult.evidence_catalog });
  for (const verification of verificationResult.verifications) {
    bus.send(createAgentMessage({
      incidentId: telemetry.incident_id, sender: "verification-agent", recipient: "coordinator", messageType: "verification",
      payload: { verdict: `${verification.hypothesis_id}: ${verification.verdict}. ${verification.reasoning}`, confidence: verification.confidence, evidence: [...verification.supporting_evidence, ...verification.contradicting_evidence], limitations: verification.missing_evidence },
    }));
  }

  const structuredEvidence = [...new Map(
    diagnosticFindings.flatMap(f => f.structured_evidence ?? []).map(item => [item.evidence_id, item])
  ).values()];
  const hasAnomaly = structuredEvidence.some(item => item.severity === "warning" || item.severity === "critical");
  const metricCount = Object.values(telemetry.metrics).filter(value => value !== undefined).length;
  const supported = verificationResult.verifications.filter(v => v.verdict === "supported" && v.confidence >= 0.7);
  const leadingVerification = [...verificationResult.verifications].sort((a, b) => b.confidence - a.confidence)[0];
  const leadingHypothesis = leadingVerification ? hypothesisResult.hypotheses.find(h => h.id === leadingVerification.hypothesis_id) : undefined;
  const selectedVerifications = supported.length ? supported : leadingVerification ? [leadingVerification] : [];
  const evidenceIds = [...new Set(selectedVerifications.flatMap(v => v.supporting_evidence))];
  const evidenceCatalog = hypothesisResult.evidence_catalog;
  const missingEvidence = [...new Set([
    ...findings.flatMap(f => f.limitations), ...hypothesisResult.limitations, ...verificationResult.limitations,
    ...hypothesisResult.hypotheses.flatMap(h => h.missing_evidence),
    ...verificationResult.verifications.flatMap(v => v.missing_evidence),
  ])];
  const recommendations = new Set<string>();
  const metricRecommendations: Array<[keyof NetworkTelemetry["metrics"], string]> = [
    ["latency_ms", "Collect latency time-series and path-hop measurements."],
    ["packet_loss_percent", "Collect packet-loss measurements at multiple points along the path."],
    ["jitter_ms", "Collect jitter measurements over a representative time window."],
    ["utilization_percent", "Collect interface utilization and queue statistics."],
    ["interface_errors", "Collect interface error deltas and link state-change logs."],
    ["queue_drops", "Collect queue-drop counters over time and inspect QoS policy."],
    ["cpu_utilization_percent", "Collect device CPU history and process-level diagnostics."],
    ["memory_utilization_percent", "Collect device memory history and resource alarms."],
    ["rssi_dbm", "Collect client RSSI and access-point association measurements."],
    ["wifi_retransmission_percent", "Collect Wi-Fi retransmission and channel utilization data."],
    ["dns_failure_percent", "Collect DNS resolver response codes and query latency."],
    ["dhcp_failure_percent", "Collect DHCP lease, relay and address-pool logs."],
  ];
  for (const [key, recommendation] of metricRecommendations) if (telemetry.metrics[key] === undefined) recommendations.add(recommendation);
  for (const hypothesis of hypothesisResult.hypotheses) for (const item of hypothesis.missing_evidence) recommendations.add(`Collect additional evidence: ${item}`);
  if (supported.length) recommendations.add("Validate the supported hypothesis against historical telemetry and device logs before corrective action.");
  else recommendations.add("Do not treat a candidate explanation as confirmed. Collect the missing evidence and repeat the investigation.");
  if (executionErrors.length) recommendations.add("Review agent execution errors and rerun any incomplete diagnostic tasks.");

  const status: DiagnosisReport["status"] = supported.length === 1 ? "probable_cause"
    : supported.length > 1 ? "multiple_plausible_causes"
    : !hasAnomaly && metricCount >= 5 && failed.length === 0 ? "no_fault_detected"
    : "insufficient_evidence";
  const summary = status === "no_fault_detected"
    ? `No configured diagnostic threshold was breached across ${metricCount} supplied metric(s). This is a clean snapshot, not a guarantee of end-to-end service availability.`
    : status === "probable_cause" || status === "multiple_plausible_causes"
      ? `${supported.length} hypothesis(es) passed the evidence-support check. They remain probable explanations, not confirmed causes; validate against historical telemetry before remediation.`
      : `The investigation evaluated ${hypothesisResult.hypotheses.length} candidate hypothesis(es), but the available evidence is not sufficient to support a reliable root-cause conclusion.`;

  const allMessages = bus.getMessages();
  const topology = assessTopology(telemetry);
  return {
    incident_id: telemetry.incident_id,
    device: telemetry.device,
    status,
    summary,
    suspected_root_cause: status === "no_fault_detected" ? "No fault detected in the supplied telemetry snapshot."
      : supported.length ? hypothesisResult.hypotheses.find(h => h.id === supported[0].hypothesis_id)?.explanation ?? "Evidence-supported hypothesis unavailable."
      : leadingHypothesis ? `Unconfirmed hypothesis: ${leadingHypothesis.explanation}` : "Insufficient evidence to establish a probable root cause.",
    confidence: supported.length ? Math.max(...supported.map(v => v.confidence))
      : status === "no_fault_detected" ? Math.min(0.8, 0.55 + metricCount * 0.03)
      : leadingVerification ? Math.min(leadingVerification.confidence, leadingHypothesis?.confidence ?? leadingVerification.confidence) : 0,
    confidence_method: "uncalibrated_model_assessment",
    confidence_note: "This is an evidence-informed model assessment, not a statistically calibrated probability. Calibrate against a labelled validation set before interpreting it as a probability of correctness.",
    telemetry_coverage: Math.round((metricCount / 15) * 100) / 100,
    affected_devices: hasAnomaly ? [telemetry.device] : [],
    supporting_evidence: evidenceIds.map(id => {
      const ref = evidenceCatalog.find(item => item.id === id);
      return { metric: ref?.statement.split(":")[0] ?? "unknown", value: ref?.statement.split(":").slice(1).join(":").trim() ?? "Not available", interpretation: ref?.statement ?? "Evidence reference unavailable" };
    }),
    alternative_causes: hypothesisResult.hypotheses.filter(h => !supported.some(v => v.hypothesis_id === h.id)).map(h => h.explanation),
    recommended_actions: [...recommendations],
    evidence_sources: [...new Set(diagnosticFindings.map(f => f.agent))],
    findings,
    evidence_catalog: evidenceCatalog,
    hypotheses: hypothesisResult.hypotheses,
    verifications: verificationResult.verifications,
    missing_evidence: missingEvidence,
    limitations: [...new Set([...findings.flatMap(f => f.limitations), ...hypothesisResult.limitations, ...verificationResult.limitations, ...executionErrors])],
    recommendations: [...recommendations],
    generated_at: new Date().toISOString(),
    structured_evidence: structuredEvidence,
    agent_timeline: allMessages.map(message => ({ message_id: message.message_id, ...(message.correlation_id ? { correlation_id: message.correlation_id } : {}), sender: message.sender, recipient: message.recipient, message_type: message.message_type, timestamp: message.timestamp })),
    topology,
    execution_status: failed.length === 0 ? "completed" : "partial",
    agent_failures: executionErrors,
  };
}
