import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { Verdict } from "@foreman/shared";
import { env } from "../env.js";
import { rubricFor } from "./rubric.js";

const VerdictSchema = z.object({
  pass: z.boolean(),
  score: z.number().min(0).max(100),
  reasons: z.array(z.string()),
});

const anthropic = new Anthropic({ apiKey: env.anthropicApiKey() });

export async function verify(params: {
  taskDescription: string;
  capability: string;
  output: string;
}): Promise<Verdict> {
  const rubric = rubricFor(params.capability);

  // Cheap structural gate before spending a judge call on obvious garbage.
  if (!params.output || params.output.trim().length === 0) {
    return { pass: false, score: 0, reasons: ["Empty output"] };
  }

  const msg = await anthropic.messages.create({
    model: env.anthropicModel(),
    max_tokens: 500,
    messages: [
      {
        role: "user",
        content: [
          "You are a strict but fair QA judge for an autonomous agent marketplace.",
          `Task given to the hired agent: ${params.taskDescription}`,
          `Agent's output:\n${params.output}`,
          `Score against this rubric (every criterion matters):\n${rubric.criteria
            .map((c) => `- ${c}`)
            .join("\n")}`,
          `The output passes only if score >= ${rubric.passThreshold}.`,
          'Respond with ONLY valid JSON, no prose: {"pass": boolean, "score": number, "reasons": string[]}',
        ].join("\n\n"),
      },
    ],
  });

  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  try {
    return VerdictSchema.parse(JSON.parse(extractJson(text)));
  } catch {
    return { pass: false, score: 0, reasons: [`Judge returned unparseable output: ${text.slice(0, 200)}`] };
  }
}

function extractJson(text: string): string {
  const match = text.match(/\{[\s\S]*\}/);
  return match ? match[0] : text;
}
