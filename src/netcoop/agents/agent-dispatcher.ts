import type {
  AgentId,
  AgentMessage,
  EvidenceFinding,
  NetworkTelemetry,
} from "../types";

import { getAgentRegistration } from "./agent-registry";
import {
  AgentMessageBus,
  validateAgentMessage,
} from "./agent-communication";
import {
  handleDiagnosticAgentRequest,
} from "./diagnostic-agent-runtime";

const EXECUTABLE_DIAGNOSTIC_AGENTS = new Set<AgentId>([
  "performance-agent",
  "infrastructure-agent",
  "connectivity-agent",
]);

export interface DispatchResult {
  agent: AgentId;
  capability: string;
  finding: EvidenceFinding;
}

export function dispatchDiagnosticAgent(input: {
  request: AgentMessage;
  telemetry: NetworkTelemetry;
  messageBus: AgentMessageBus;
  capabilityId: string;
}): DispatchResult {
  const { request, telemetry, messageBus, capabilityId } = input;
  const agentId = request.recipient;
  const messageIssues = validateAgentMessage(request, telemetry.incident_id);
  if (messageIssues.length > 0) {
    throw new Error(`Dispatcher rejected invalid request: ${messageIssues.join(" ")}`);
  }

  if (request.sender !== "coordinator" || request.message_type !== "request") {
    throw new Error("Dispatcher requires a coordinator-originated request.");
  }

  if (request.incident_id !== telemetry.incident_id) {
    throw new Error("Dispatcher rejected an incident ID mismatch.");
  }

  const registration = getAgentRegistration(agentId);

  if (!registration) {
    throw new Error(`Agent is not registered: ${agentId}`);
  }

  if (!EXECUTABLE_DIAGNOSTIC_AGENTS.has(agentId)) {
    throw new Error(
      `Agent ${agentId} is registered but has no diagnostic execution adapter.`
    );
  }

  if (registration.role !== "diagnostic") {
    throw new Error(`Agent ${agentId} is not a diagnostic agent.`);
  }
  if (telemetry.schema_version && telemetry.schema_version !== "1.0") {
    throw new Error(`Agent ${agentId} cannot process telemetry schema ${telemetry.schema_version}.`);
  }
  if (request.payload.schema_version && request.payload.schema_version !== "1.0") {
    throw new Error(`Agent ${agentId} rejected an incompatible payload schema version.`);
  }

  const capability = registration.capabilities.find(
    (item) => item.id === capabilityId
  );

  if (!capability) {
    throw new Error(
      `Agent ${agentId} does not support capability ${capabilityId}.`
    );
  }

  const requestedData = request.payload.requested_data ?? [];
  if (new Set(requestedData).size !== requestedData.length) {
    throw new Error("Dispatcher rejected duplicate requested evidence identifiers.");
  }

  const unsupportedData = requestedData.filter(
    (item) => !capability.evidenceTypes.includes(item)
  );

  if (unsupportedData.length > 0) {
    throw new Error(
      `Agent ${agentId} does not declare support for: ${unsupportedData.join(", ")}.`
    );
  }

  const finding = handleDiagnosticAgentRequest({
    request,
    telemetry,
    messageBus,
  });

  return {
    agent: agentId,
    capability: capability.id,
    finding,
  };
}
