import type { AgentId, AgentMessage } from "../types";

export const AGENT_PROTOCOL_VERSION = "1.0" as const;
export const MAX_MESSAGES_PER_INVESTIGATION = 5000;
const MAX_TEXT_LENGTH = 8000;
const MAX_LIST_ITEMS = 500;
const MAX_MESSAGE_BYTES = 64_000;

const VALID_AGENTS: readonly AgentId[] = [
  "performance-agent", "infrastructure-agent", "connectivity-agent",
  "fault-correlation-agent", "hypothesis-agent", "verification-agent", "coordinator",
];
const VALID_MESSAGE_TYPES = ["finding", "hypothesis", "verification", "request", "response"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= MAX_LIST_ITEMS &&
    value.every((item) => typeof item === "string" && item.length <= MAX_TEXT_LENGTH);
}
function isFiniteConfidence(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}
function validateStructuredEvidence(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > MAX_LIST_ITEMS) return ["Structured evidence must be an array with at most 500 items."];
  const issues: string[] = [];
  value.forEach((item, index) => {
    if (!isRecord(item)) { issues.push(`Structured evidence item ${index} must be an object.`); return; }
    for (const field of ["evidence_id", "metric", "observation", "device_id", "source_agent"]) {
      if (typeof item[field] !== "string" || !String(item[field]).trim() || String(item[field]).length > MAX_TEXT_LENGTH) {
        issues.push(`Structured evidence item ${index} has an invalid ${field}.`);
      }
    }
    if (!(typeof item.value === "string" || typeof item.value === "boolean" || (typeof item.value === "number" && Number.isFinite(item.value)))) {
      issues.push(`Structured evidence item ${index} has an invalid value.`);
    }
    if (!["info", "warning", "critical"].includes(String(item.severity))) {
      issues.push(`Structured evidence item ${index} has an invalid severity.`);
    }
    if (item.threshold !== undefined && (typeof item.threshold !== "number" || !Number.isFinite(item.threshold))) {
      issues.push(`Structured evidence item ${index} has an invalid threshold.`);
    }
    for (const field of ["unit", "source_id", "timestamp", "provenance"]) {
      if (item[field] !== undefined && (typeof item[field] !== "string" || String(item[field]).length > MAX_TEXT_LENGTH)) {
        issues.push(`Structured evidence item ${index} has an invalid ${field}.`);
      }
    }
  });
  return issues;
}

/** Creates a versioned, correlated message for inter-agent communication. */
export function createAgentMessage(input: {
  incidentId: string;
  sender: AgentId;
  recipient: AgentId;
  messageType: AgentMessage["message_type"];
  payload: AgentMessage["payload"];
  correlationId?: string;
}): AgentMessage {
  if (!input.incidentId.trim()) throw new Error("An incident ID is required.");
  if (!VALID_AGENTS.includes(input.sender) || !VALID_AGENTS.includes(input.recipient)) {
    throw new Error("Message sender and recipient must be registered agents.");
  }
  if (input.sender === input.recipient) throw new Error("An agent cannot send a message to itself.");
  if (input.messageType === "response" && !input.correlationId) throw new Error("A response must include the request correlation ID.");
  return {
    protocol_version: AGENT_PROTOCOL_VERSION,
    message_id: crypto.randomUUID(),
    ...(input.correlationId ? { correlation_id: input.correlationId } : {}),
    incident_id: input.incidentId,
    sender: input.sender,
    recipient: input.recipient,
    message_type: input.messageType,
    timestamp: new Date().toISOString(),
    payload: structuredClone(input.payload),
  };
}

/** Runtime validation is mandatory: messages can cross agent or model boundaries. */
export function validateAgentMessage(input: unknown, expectedIncidentId: string): string[] {
  if (!isRecord(input)) return ["Message must be a valid object."];
  const issues: string[] = [];
  try {
    if (JSON.stringify(input).length > MAX_MESSAGE_BYTES) issues.push("Message exceeds the 64 KB protocol limit.");
  } catch {
    issues.push("Message must be serializable JSON data.");
  }
  if (input.protocol_version !== AGENT_PROTOCOL_VERSION) issues.push("Unsupported agent protocol version.");
  if (typeof input.message_id !== "string" || !input.message_id.trim() || input.message_id.length > 128) issues.push("Message ID is missing or invalid.");
  if (input.correlation_id !== undefined && (typeof input.correlation_id !== "string" || !input.correlation_id.trim() || input.correlation_id.length > 128)) issues.push("Correlation ID is invalid.");
  if (typeof input.incident_id !== "string" || input.incident_id !== expectedIncidentId) issues.push("Message incident ID does not match the active incident.");
  if (typeof input.sender !== "string" || !VALID_AGENTS.includes(input.sender as AgentId)) issues.push("Invalid message sender.");
  if (typeof input.recipient !== "string" || !VALID_AGENTS.includes(input.recipient as AgentId)) issues.push("Invalid message recipient.");
  if (input.sender === input.recipient) issues.push("Message sender and recipient must be different agents.");
  if (typeof input.message_type !== "string" || !(VALID_MESSAGE_TYPES as readonly string[]).includes(input.message_type)) issues.push("Invalid message type.");
  if (typeof input.timestamp !== "string" || !Number.isFinite(Date.parse(input.timestamp))) issues.push("Message timestamp is invalid.");
  if (input.message_type === "response" && !input.correlation_id) issues.push("Response message is missing correlation_id.");
  if (!isRecord(input.payload)) { issues.push("Message payload must be an object."); return issues; }

  const payload = input.payload;
  if (!isStringArray(payload.evidence)) issues.push("Evidence must be an array of bounded strings.");
  if (!isStringArray(payload.limitations)) issues.push("Limitations must be an array of bounded strings.");
  for (const field of ["observation", "hypothesis", "verdict"]) {
    if (payload[field] !== undefined && (typeof payload[field] !== "string" || payload[field].length > MAX_TEXT_LENGTH)) issues.push(`${field} must be a bounded string.`);
  }
  if (payload.requested_data !== undefined && !isStringArray(payload.requested_data)) issues.push("Requested data must be an array of bounded strings.");
  if (payload.confidence !== undefined && !isFiniteConfidence(payload.confidence)) issues.push("Confidence must be a number between 0 and 1.");
  if (payload.schema_version !== undefined && payload.schema_version !== "1.0") issues.push("Unsupported telemetry schema version in message payload.");
  if (payload.structured_evidence !== undefined) issues.push(...validateStructuredEvidence(payload.structured_evidence));
  return issues;
}

/** Process-local message bus. A production distributed bus would need durable storage. */
export class AgentMessageBus {
  private readonly messages: AgentMessage[] = [];
  private readonly messageIds = new Set<string>();

  constructor(private readonly incidentId: string) {
    if (!incidentId.trim()) throw new Error("An incident ID is required.");
  }

  send(message: AgentMessage): void {
    const issues = validateAgentMessage(message, this.incidentId);
    if (issues.length) throw new Error(`Invalid agent message: ${issues.join(" ")}`);
    if (this.messageIds.has(message.message_id)) throw new Error(`Duplicate message ID: ${message.message_id}`);
    if (message.message_type === "response") {
      if (!message.correlation_id) throw new Error("A response must reference its request through correlation_id.");
      const request = this.messages.find((candidate) =>
        candidate.message_id === message.correlation_id && candidate.message_type === "request"
      );
      if (!request) throw new Error("Response references an unknown or unsent request.");
      if (request.recipient !== message.sender || request.sender !== message.recipient) {
        throw new Error("Response sender and recipient do not match the correlated request.");
      }
      if (this.messages.some((candidate) =>
        candidate.message_type === "response" && candidate.correlation_id === message.correlation_id
      )) throw new Error("A request can have only one accepted response.");
    }
    if (this.messages.length >= MAX_MESSAGES_PER_INVESTIGATION) throw new Error("Investigation message limit reached.");
    const safeMessage = structuredClone(message);
    this.messages.push(safeMessage);
    this.messageIds.add(message.message_id);
  }

  getMessages(): AgentMessage[] { return structuredClone(this.messages); }
  getMessagesFor(agent: AgentId): AgentMessage[] {
    return structuredClone(this.messages.filter((message) => message.recipient === agent));
  }
  getMessagesFrom(agent: AgentId): AgentMessage[] {
    return structuredClone(this.messages.filter((message) => message.sender === agent));
  }
  getResponseFor(requestMessageId: string, expectedSender?: AgentId): AgentMessage | undefined {
    const response = this.messages.find((message) =>
      message.message_type === "response" && message.correlation_id === requestMessageId &&
      (expectedSender === undefined || message.sender === expectedSender)
    );
    return response ? structuredClone(response) : undefined;
  }
  get size(): number { return this.messages.length; }
}
