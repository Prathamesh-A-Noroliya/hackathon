
export type TelemetrySchemaVersion = "1.0";
export type DeviceStatus = "up" | "down" | "degraded" | "unknown";
export type InterfaceStatus = "up" | "down" | "admin_down" | "unknown";

export interface NetworkTelemetry {
  schema_version?: TelemetrySchemaVersion;
  source?: string;
  incident_id: string;
  device: string;
  timestamp?: string;
  device_status?: DeviceStatus;
  interface_status?: InterfaceStatus;
  neighbors?: string[];
  metrics: {
    latency_ms?: number;
    packet_loss_percent?: number;
    jitter_ms?: number;
    bandwidth_mbps?: number;
    throughput_mbps?: number;
    link_capacity_mbps?: number;
    utilization_percent?: number;
    rssi_dbm?: number;
    wifi_retransmission_percent?: number;
    dns_failure_percent?: number;
    dhcp_failure_percent?: number;
    cpu_utilization_percent?: number;
    memory_utilization_percent?: number;
    interface_errors?: number;
    queue_drops?: number;
  };
}

export interface ValidationIssue {
  field: string;
  message: string;
  code?: string;
  severity?: "warning" | "error";
}

/** A machine-readable observation that can be exchanged between agents. */
export interface StructuredEvidence {
  evidence_id: string;
  metric: string;
  value: number | string | boolean;
  unit?: string;
  threshold?: number;
  severity: "info" | "warning" | "critical";
  observation: string;
  source_agent: AgentId | string;
  source_id?: string;
  device_id: string;
  timestamp?: string;
  provenance?: string;
}

export interface EvidenceFinding {
  agent: string;
  observation: string;
  evidence: string[];
  limitations: string[];
  structured_evidence?: StructuredEvidence[];
}

export interface EvidenceReference {
  id: string;
  agent: string;
  statement: string;
}

export interface DiagnosisHypothesis {
  id: string;
  explanation: string;
  supporting_evidence: string[];
  contradicting_evidence: string[];
  missing_evidence: string[];
  confidence: number;
}

export type VerificationVerdict =
  | "supported"
  | "challenged"
  | "inconclusive";

export interface DiagnosisVerification {
  hypothesis_id: string;
  verdict: VerificationVerdict;
  supporting_evidence: string[];
  contradicting_evidence: string[];
  missing_evidence: string[];
  reasoning: string;
  confidence: number;
}

export type DiagnosisStatus =
  | "probable_cause"
  | "multiple_plausible_causes"
  | "insufficient_evidence"
  | "no_fault_detected";

export interface DiagnosisReport {
  incident_id: string;
  device: string;
  status: DiagnosisStatus;
  summary: string;
  suspected_root_cause: string;
  confidence: number;
  confidence_method?: "uncalibrated_model_assessment";
  confidence_note?: string;
  telemetry_coverage?: number;
  affected_devices: string[];
  supporting_evidence: {
    metric: string;
    value: string;
    interpretation: string;
  }[];
  alternative_causes: string[];
  recommended_actions: string[];
  evidence_sources: string[];

  // Original observations from diagnostic agents
  findings: EvidenceFinding[];

  // Traceable evidence and AI assessments
  evidence_catalog: EvidenceReference[];
  hypotheses: DiagnosisHypothesis[];
  verifications: DiagnosisVerification[];

  missing_evidence: string[];
  limitations: string[];
  recommendations: string[];
  generated_at: string;
  structured_evidence?: StructuredEvidence[];
  agent_timeline?: {
    message_id: string;
    correlation_id?: string;
    sender: AgentId;
    recipient: AgentId;
    message_type: AgentMessageType;
    timestamp: string;
  }[];
  topology?: {
    devices: string[];
    links: { source: string; target: string }[];
    limitations: string[];
  };
  execution_status?: "completed" | "partial";
  agent_failures?: string[];
}

// Shared communication protocol for NetCoop AI agents

export type AgentId =
  | "performance-agent"
  | "infrastructure-agent"
  | "connectivity-agent"
  | "fault-correlation-agent"
  | "hypothesis-agent"
  | "verification-agent"
  | "coordinator";

export type AgentMessageType =
  | "finding"
  | "hypothesis"
  | "verification"
  | "request"
  | "response";

export interface AgentMessage {
  protocol_version: "1.0";
  message_id: string;
  correlation_id?: string;
  incident_id: string;
  sender: AgentId;
  recipient: AgentId;
  message_type: AgentMessageType;
  timestamp: string;
  payload: {
    observation?: string;
    hypothesis?: string;
    verdict?: string;
    evidence: string[];
    limitations: string[];
    confidence?: number;
    requested_data?: string[];
    structured_evidence?: StructuredEvidence[];
    schema_version?: TelemetrySchemaVersion;
  };
}

