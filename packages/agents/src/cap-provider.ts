import { EventType, DeliverableType } from "@croo-network/sdk";

export interface ProviderHandlers {
  /** Return false to reject a negotiation (e.g. requirements don't match this agent's capability). Default: accept all. */
  shouldAccept?: (e: any) => boolean;
  // negotiationId is passed through because `requirements` lives on Negotiation,
  // NOT on Order (confirmed against the SDK's shipped types.d.ts) -- fetch it via
  // client.getNegotiation(negotiationId), not client.getOrder(orderId).
  handleOrder: (orderId: string, negotiationId: string) => Promise<{ deliverableText: string }>;
}

/** Provider-side CAP flow: accept negotiations, do the work once paid, deliver. */
export async function startProvider(client: any, handlers: ProviderHandlers): Promise<any> {
  const stream = await client.connectWebSocket();

  stream.on(EventType.NegotiationCreated, async (e: any) => {
    if (handlers.shouldAccept && !handlers.shouldAccept(e)) {
      await client.rejectNegotiation(e.negotiation_id, "capability mismatch");
      console.log(`[provider] rejected negotiation ${e.negotiation_id}`);
      return;
    }
    // If the service you registered has require_fund_transfer=true (check its
    // config on agent.croo.network), the backend REJECTS this call -- use
    // client.acceptNegotiationWithFundAddress(negotiationId, providerFundAddress)
    // instead. Confirmed from the SDK's shipped agent-client.d.ts JSDoc. A plain
    // flat-priced USDC service (the default for a hackathon MVP) doesn't need this.
    const result = await client.acceptNegotiation(e.negotiation_id);
    console.log(`[provider] accepted negotiation ${e.negotiation_id} -> order ${result.order.orderId}`);
  });

  stream.on(EventType.OrderPaid, async (e: any) => {
    console.log(`[provider] order ${e.order_id} paid -- doing work`);
    try {
      const { deliverableText } = await handlers.handleOrder(e.order_id, e.negotiation_id);
      await client.deliverOrder(e.order_id, {
        deliverableType: DeliverableType.Text,
        deliverableText,
      });
      console.log(`[provider] delivered order ${e.order_id}`);
    } catch (err) {
      console.error(`[provider] failed to handle order ${e.order_id}:`, err);
      await client.rejectOrder(e.order_id, (err as Error).message).catch(() => {});
    }
  });

  process.on("SIGINT", () => {
    stream.close();
    process.exit(0);
  });

  console.log("[provider] listening for negotiations...");
  return stream;
}
