import { createCapClient } from "../cap-client.js";
import { startProvider } from "../cap-provider.js";
import { env } from "../env.js";

// Safety-net worker #1: trivial, always succeeds, cheap. Its job is to guarantee the
// Foreman demo never stalls on a flaky/offline external agent -- it is NOT counted
// toward the unique-counterparty metric (see registry.json: isOwn: true).

const client = createCapClient(env.echoWorkerSdkKey());

await startProvider(client, {
  handleOrder: async (_orderId, negotiationId) => {
    const negotiation = await client.getNegotiation(negotiationId);
    return {
      deliverableText: JSON.stringify({
        echo: true,
        received: safeParse(negotiation.requirements) ?? null,
        note: "echo-worker: safety-net agent for smoke-testing the Foreman pipeline.",
      }),
    };
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
