import { getRegisteredAgents } from "./agent-registry";

export interface InvestigationPlanInput {
  incidentId: string;
  telemetry: Record<string, unknown>;
  findings: Array<{ agent_id: string; summary: string; evidence: Array<{ evidence_id: string; description: string }> }>;
  missingEvidence: string[];
  completedAgents: string[];
  failedAgents?: string[];
  step: number;
  maxSteps?: number;
}
export interface InvestigationPlan {
  action: "dispatch" | "stop";
  agentId?: string;
  capabilityId?: string;
  requestedEvidence?: string[];
  rationale: string;
}

/** Deterministic planner: the prototype must run without an external LLM service. */
export async function planNextInvestigationStep(input: InvestigationPlanInput): Promise<InvestigationPlan> {
  const maxSteps = input.maxSteps ?? 5;
  if (input.step >= maxSteps) return { action: "stop", rationale: "Maximum investigation steps reached." };
  const available = getRegisteredAgents().filter(agent =>
    agent.role === "diagnostic" &&
    !input.completedAgents.includes(agent.id) &&
    !(input.failedAgents ?? []).includes(agent.id)
  );
  if (!available.length) return { action: "stop", rationale: "No uncompleted diagnostic agents remain." };
  const metrics = input.telemetry.metrics && typeof input.telemetry.metrics === "object"
    ? input.telemetry.metrics as Record<string, unknown>
    : input.telemetry;
  const candidates = available.flatMap(agent => agent.capabilities.map(capability => {
    const present = capability.evidenceTypes.filter(key => metrics[key] !== undefined && metrics[key] !== null);
    return { agent, capability, present, score: present.length };
  })).sort((a, b) => b.score - a.score || a.agent.id.localeCompare(b.agent.id));
  const selected = candidates[0];
  if (!selected) return { action: "stop", rationale: "No compatible capability is registered." };
  return {
    action: "dispatch",
    agentId: selected.agent.id,
    capabilityId: selected.capability.id,
    requestedEvidence: selected.present.length ? selected.present : [...selected.capability.evidenceTypes],
    rationale: selected.present.length
      ? `Selected ${selected.agent.name} based on ${selected.present.length} available telemetry field(s).`
      : `Selected ${selected.agent.name} to report missing evidence in its diagnostic domain.`,
  };
}
