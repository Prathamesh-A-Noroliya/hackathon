import type { AgentId } from "../types";

export type AgentExecutionMode = "sync" | "async";

export interface AgentCapability {
  id: string;
  description: string;
  evidenceTypes: string[];
  /** Minimum telemetry contract understood by this capability. */
  schemaVersion: "1.0";
}

export interface AgentRegistration {
  id: AgentId;
  name: string;
  role: "diagnostic" | "reasoning" | "coordination";
  executionMode: AgentExecutionMode;
  capabilities: AgentCapability[];
}

export const AGENT_REGISTRY: readonly AgentRegistration[] = [
  {
    id: "performance-agent",
    name: "Performance Agent",
    role: "diagnostic",
    executionMode: "sync",
    capabilities: [
      {
        id: "performance_analysis",
        description: "Analyze network latency, packet loss, jitter and bandwidth measurements.",
        evidenceTypes: ["latency_ms", "packet_loss_percent", "jitter_ms", "bandwidth_mbps", "throughput_mbps", "link_capacity_mbps"],
        schemaVersion: "1.0",
      },
    ],
  },
  {
    id: "infrastructure-agent",
    name: "Infrastructure Agent",
    role: "diagnostic",
    executionMode: "sync",
    capabilities: [
      {
        id: "infrastructure_analysis",
        description: "Analyze device resource utilization and network interface health.",
        evidenceTypes: [
          "cpu_utilization_percent",
          "memory_utilization_percent",
          "utilization_percent",
          "interface_errors",
          "queue_drops",
          "link_capacity_mbps",
        ],
        schemaVersion: "1.0",
      },
    ],
  },
  {
    id: "connectivity-agent",
    name: "Connectivity Agent",
    role: "diagnostic",
    executionMode: "sync",
    capabilities: [
      {
        id: "connectivity_analysis",
        description: "Analyze connectivity symptoms and identify missing topology or reachability evidence.",
        evidenceTypes: ["latency_ms", "packet_loss_percent", "interface_errors", "topology", "reachability", "device_status", "interface_status", "neighbors", "dns_failure_percent", "dhcp_failure_percent", "rssi_dbm", "wifi_retransmission_percent"],
        schemaVersion: "1.0",
      },
    ],
  },
  {
    id: "fault-correlation-agent",
    name: "Fault Correlation Agent",
    role: "reasoning",
    executionMode: "sync",
    capabilities: [
      {
        id: "cross_agent_correlation",
        description: "Correlate evidence from multiple diagnostic agents without treating correlation as causation.",
        evidenceTypes: ["agent_findings", "cross_domain_evidence"],
        schemaVersion: "1.0",
      },
    ],
  },
  {
    id: "hypothesis-agent",
    name: "Hypothesis Agent",
    role: "reasoning",
    executionMode: "async",
    capabilities: [
      {
        id: "root_cause_hypothesis",
        description: "Generate competing evidence-grounded root-cause hypotheses.",
        evidenceTypes: ["agent_findings", "evidence_catalog"],
        schemaVersion: "1.0",
      },
    ],
  },
  {
    id: "verification-agent",
    name: "Verification Agent",
    role: "reasoning",
    executionMode: "async",
    capabilities: [
      {
        id: "hypothesis_verification",
        description: "Challenge hypotheses using supporting, contradicting and missing evidence.",
        evidenceTypes: ["hypotheses", "agent_findings", "evidence_catalog"],
        schemaVersion: "1.0",
      },
    ],
  },
];

export function getRegisteredAgents(): AgentRegistration[] {
  return AGENT_REGISTRY.map((agent) => ({
    ...agent,
    capabilities: agent.capabilities.map((capability) => ({
      ...capability,
      evidenceTypes: [...capability.evidenceTypes],
    })),
  }));
}

export function getAgentRegistration(
  agentId: AgentId
): AgentRegistration | undefined {
  return getRegisteredAgents().find((agent) => agent.id === agentId);
}

export function findAgentsForEvidence(
  evidenceTypes: string[]
): AgentRegistration[] {
  const requested = new Set(evidenceTypes);

  return getRegisteredAgents().filter((agent) =>
    agent.capabilities.some((capability) =>
      capability.evidenceTypes.some((type) => requested.has(type))
    )
  );
}


/** Returns a deterministic capability match, suitable for planner fallbacks. */
export function negotiateAgentCapability(input: {
  evidenceTypes: string[];
  schemaVersion?: string;
  roles?: AgentRegistration["role"][];
  excludeAgents?: AgentId[];
}): Array<{ agent: AgentRegistration; capability: AgentCapability; matchedEvidence: string[]; coverage: number }> {
  const requested = [...new Set(input.evidenceTypes)];
  return getRegisteredAgents()
    .filter((agent) => !input.excludeAgents?.includes(agent.id) && (!input.roles || input.roles.includes(agent.role)))
    .flatMap((agent) => agent.capabilities
      .filter((capability) => !input.schemaVersion || capability.schemaVersion === input.schemaVersion)
      .map((capability) => {
        const supported = new Set(capability.evidenceTypes);
        const matchedEvidence = requested.filter((item) => supported.has(item));
        return { agent, capability, matchedEvidence, coverage: requested.length ? matchedEvidence.length / requested.length : 0 };
      })
      .filter((match) => match.matchedEvidence.length > 0))
    .sort((a, b) => b.coverage - a.coverage || b.matchedEvidence.length - a.matchedEvidence.length || a.agent.id.localeCompare(b.agent.id));
}
