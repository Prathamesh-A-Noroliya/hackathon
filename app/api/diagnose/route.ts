import { NextResponse } from "next/server";
import { validateTelemetry, validateTelemetryTolerant } from "@/src/netcoop/telemetry";
import { getRegisteredAgents } from "@/src/netcoop/agents/agent-registry";
import { runInvestigationCoordinator } from "@/src/netcoop/agents/investigation-coordinator";

export async function GET() {
  return NextResponse.json({
    name: "NetCoop AI Diagnosis API",
    status: "ready",
    mode: "multi-agent-investigation",
    protocol_version: "1.0",
    telemetry_schema_version: "1.0",
    agents: getRegisteredAgents(),
    ingestion_modes: ["strict", "tolerant"],
  });
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    const contentType = request.headers.get("content-type") ?? "";

    if (!contentType.toLowerCase().includes("application/json")) {
      return NextResponse.json(
        {
          error: "Unsupported content type.",
          message: "Send the request using application/json.",
        },
        { status: 415 }
      );
    }

    const rawBody = await request.text();

    if (rawBody.length > 100_000) {
      return NextResponse.json(
        { error: "Request body exceeds the 100 KB limit." },
        { status: 413 }
      );
    }

    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request body." },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Unable to read request body." },
      { status: 400 }
    );
  }

  const ingestionMode = typeof body === "object" && body !== null && !Array.isArray(body)
    ? (body as Record<string, unknown>).ingestion_mode
    : undefined;
  const telemetryInput = typeof body === "object" && body !== null && !Array.isArray(body)
    ? Object.fromEntries(Object.entries(body as Record<string, unknown>).filter(([key]) => key !== "ingestion_mode"))
    : body;
  const validation = ingestionMode === "tolerant"
    ? validateTelemetryTolerant(telemetryInput)
    : validateTelemetry(telemetryInput);

  if (!validation.valid) {
    return NextResponse.json(
      {
        error: "Telemetry validation failed.",
        issues: validation.issues,
      },
      { status: 400 }
    );
  }

  try {
    const report = await runInvestigationCoordinator(validation.data);

    return NextResponse.json(
      {
        message: "Investigation executed successfully.",
        incident: validation.data,
        ingestion: {
          mode: ingestionMode === "tolerant" ? "tolerant" : "strict",
          warnings: "issues" in validation ? validation.issues : [],
        },
        investigation: {
          status: report.execution_status ?? "completed",
          agents_executed: [...new Set([...report.findings.map((finding) => finding.agent), ...(report.hypotheses.length ? ["hypothesis-agent"] : []), ...(report.verifications.length ? ["verification-agent"] : []), "coordinator"])],
          agent_failures: report.agent_failures ?? [],
          report,
        },
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "NetCoop AI investigation failed:",
      error instanceof Error ? error.message : "Unknown error"
    );

    return NextResponse.json(
      {
        error: "Investigation execution failed.",
        message:
          error instanceof Error
            ? error.message
            : "The coordinator could not complete the investigation.",
      },
      { status: 500 }
    );
  }
}
