import Anthropic from "@anthropic-ai/sdk";
import { createCapClient } from "../cap-client.js";
import { startProvider } from "../cap-provider.js";
import { env } from "../env.js";

// Safety-net worker #2: a real capability (LLM-backed research), used as a fallback
// when no external agent is available yet for the "research" capability. Like
// echo-worker, this does NOT count toward the unique-counterparty metric.

const client = createCapClient(env.researchWorkerSdkKey());
const anthropic = new Anthropic({ apiKey: env.anthropicApiKey() });

await startProvider(client, {
  handleOrder: async (_orderId, negotiationId) => {
    const negotiation = await client.getNegotiation(negotiationId);
    const requirements = safeParse(negotiation.requirements) as { task?: string } | undefined;
    const task = requirements?.task ?? "Provide a brief, well-sourced answer.";

    const msg = await anthropic.messages.create({
      model: env.anthropicModel(),
      max_tokens: 800,
      messages: [
        {
          role: "user",
          content:
            "You are a paid research agent in an autonomous agent marketplace. " +
            "Answer concisely and factually, and explicitly flag any claim you are not confident about.\n\n" +
            `Task: ${task}`,
        },
      ],
    });

    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    return { deliverableText: JSON.stringify({ result: text }) };
  },
});

function safeParse(s: unknown): unknown {
  if (typeof s !== "string") return undefined;
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}
