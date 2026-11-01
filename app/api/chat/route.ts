
import { NextResponse } from "next/server";
import { generateLLMResponse } from "@/src/netcoop/llm/client";

const INSTRUCTIONS = [
  "You are NetCoop AI, an AI assistant for network fault diagnosis.",
  "Answer analysts clearly and dynamically.",
  "Never invent telemetry, measurements, logs, or investigation results.",
  "Distinguish observed facts from hypotheses and recommendations.",
  "If incident evidence is missing, explain what evidence is needed.",
  "Never claim to have executed diagnostic tools that were not run.",
  "Explain uncertainty when discussing possible root causes.",
].join(" ");

export async function GET() {
  return NextResponse.json({
    name: "NetCoop AI Chat API",
    status: "ready",
    message: "LLM provider configuration is managed server-side.",
  });
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must contain valid JSON." },
      { status: 400 }
    );
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("message" in body) ||
    typeof body.message !== "string" ||
    body.message.trim().length === 0
  ) {
    return NextResponse.json(
      { error: "Provide a non-empty message string." },
      { status: 400 }
    );
  }

  if (body.message.length > 4000) {
    return NextResponse.json(
      { error: "Message must be 4000 characters or fewer." },
      { status: 400 }
    );
  }

  // Deterministic fallback for the exact built-in prompt. This path does not
  // call OpenAI or Ollama, so it remains available if the LLM provider fails.
  const normalizedMessage = body.message.trim().replace(/[?!.]+$/g, "").toLowerCase();
  if (normalizedMessage === "explain packet loss") {
    return NextResponse.json(
      {
        answer: [
          "## What is packet loss?",
          "Packet loss occurs when one or more data packets travelling across a network fail to reach their destination. Networks send information in small units called packets; when packets are dropped, the receiving device may have to wait for them to be retransmitted.",
          "",
          "## Common causes",
          "- Network congestion: routers or links receive more traffic than they can handle.",
          "- Weak Wi-Fi signal or interference: wireless frames are corrupted or cannot be received reliably.",
          "- Faulty or overloaded hardware: routers, switches, network interfaces, or cables may drop traffic.",
          "- Configuration or routing problems: errors such as incorrect MTU settings or unstable routes can disrupt delivery.",
          "",
          "## What users may notice",
          "Slow or interrupted downloads, choppy voice/video calls, lag in online games, timeouts, and poor application performance.",
          "",
          "## How to investigate",
          "1. Measure packet loss over time with ping to the destination and, where possible, to the default gateway.",
          "2. Compare results across wired and Wi-Fi connections to isolate wireless issues.",
          "3. Use traceroute (or tracert on Windows) to identify where along the route latency or loss may begin. Intermediate-hop loss alone is not conclusive because routers may deprioritize diagnostic traffic.",
          "4. Check interface error counters, link utilization, Wi-Fi signal quality, and router/switch logs.",
          "5. Repeat tests at different times to see whether congestion is correlated with peak usage.",
          "",
          "## Key point",
          "Packet loss is a symptom, not a root cause. Confirm where the loss occurs and correlate it with interface, utilization, and wireless evidence before deciding what to fix."
        ].join("\n"),
        provider: "built-in",
        model: "packet-loss-explainer",
        local: true,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const result = await generateLLMResponse({
      systemPrompt: INSTRUCTIONS,
      userPrompt: body.message.trim(),
      temperature: 0.2,
    });

    return NextResponse.json(
      {
        answer: result.content,
        provider: result.provider,
        model: result.model,
        local: result.provider === "ollama",
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "NetCoop AI LLM request failed:",
      error instanceof Error ? error.message : "Unknown error"
    );

    return NextResponse.json(
      {
        error: "The AI model could not complete the request.",
        message:
          "Check your LLM provider configuration, model availability, and API credentials.",
      },
      { status: 502 }
    );
  }
}
