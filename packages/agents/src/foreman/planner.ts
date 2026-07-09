import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { Subtask } from "@foreman/shared";
import { env } from "../env.js";
import { loadRegistry } from "../registry.js";

const anthropic = new Anthropic({ apiKey: env.anthropicApiKey() });

const PlanSchema = z.object({
  subtasks: z.array(
    z.object({
      description: z.string(),
      capability: z.string(),
      maxCostUSDC: z.number().positive(),
    })
  ),
});

export async function plan(goal: string, budgetUSDC: number): Promise<Subtask[]> {
  const availableCapabilities = Array.from(new Set(loadRegistry().flatMap((e) => e.capabilities)));

  const msg = await anthropic.messages.create({
    model: env.anthropicModel(),
    max_tokens: 800,
    messages: [
      {
        role: "user",
        content: [
          "You are Foreman, an agent that hires other AI agents on an on-chain marketplace to complete a goal.",
          `Goal: ${goal}`,
          `Total budget: ${budgetUSDC} USDC.`,
          `Agents currently available have ONLY these capabilities: ${
            availableCapabilities.join(", ") || "(none registered yet)"
          }.`,
          "Break the goal into 1-4 subtasks, each mapped to exactly one of the available capabilities.",
          "Do not invent capabilities that aren't in the list above.",
          "Split the budget sensibly across subtasks (maxCostUSDC per subtask).",
          'Respond with ONLY valid JSON, no prose: {"subtasks": [{"description": string, "capability": string, "maxCostUSDC": number}]}',
        ].join("\n\n"),
      },
    ],
  });

  const text = extractText(msg);
  const parsed = PlanSchema.parse(JSON.parse(extractJson(text)));

  return parsed.subtasks.map((s, i) => ({ id: `subtask-${i + 1}`, ...s }));
}

function extractText(msg: Anthropic.Message): string {
  return msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

function extractJson(text: string): string {
  const match = text.match(/\{[\s\S]*\}/);
  return match ? match[0] : text;
}
