import { AgentClient, EventType } from "@croo-network/sdk";
import { env } from "./env.js";

// Verified against node_modules/@croo-network/sdk/dist/*.d.ts directly (not just the
// docs site). The real Negotiation/Order/Event shapes are confirmed; this file still
// types the CAP boundary as `any` rather than importing those types, purely to avoid
// coupling every call site to the SDK's internal type names. Everything upstream
// (orchestrator, workers) uses the strict @foreman/shared types instead.

export function createCapClient(sdkKey: string): any {
  return new AgentClient(
    {
      baseURL: env.capApiUrl(),
      wsURL: env.capWsUrl(),
    },
    sdkKey
  );
}

export interface HireParams {
  serviceId: string;
  requirements: Record<string, unknown>;
  expectedCostUSDC: number;
  negotiationTimeoutMs?: number;
  deliveryTimeoutMs?: number;
}

export interface HireOutcome {
  output: string;
  latencyMs: number;
  costUSDC: number;
  txHash?: string;
  orderId: string;
}

/**
 * Requester-side CAP flow, run once per hire:
 *   negotiateOrder -> (provider accepts -> OrderCreated) -> payOrder ->
 *   (provider delivers -> OrderCompleted) -> getDelivery
 *
 * The SDK's shared `Event` type carries both `negotiation_id` and `order_id` as
 * optional fields, so OrderCreated should include negotiation_id in practice --
 * confirmed from the shipped .d.ts, not just the docs. The `? ... : true` fallback
 * below only protects against that field arriving empty at runtime; it is only safe
 * for sequential hires on one client. If you later hire multiple agents concurrently
 * on the same AgentClient, match strictly (drop the `: true` branch) or open one
 * client per concurrent hire.
 */
export async function hireAgent(
  client: any,
  stream: any,
  params: HireParams
): Promise<HireOutcome> {
  const negotiationTimeoutMs = params.negotiationTimeoutMs ?? 30_000;
  const deliveryTimeoutMs = params.deliveryTimeoutMs ?? 90_000;
  const startedAt = Date.now();

  const neg = await client.negotiateOrder({
    serviceId: params.serviceId,
    requirements: JSON.stringify(params.requirements),
  });

  const orderId = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new Error(
          `Negotiation ${neg.negotiationId} timed out after ${negotiationTimeoutMs}ms waiting for provider to accept -- is the provider agent running?`
        )
      );
    }, negotiationTimeoutMs);

    const onOrderCreated = (e: any) => {
      const matches = e.negotiation_id ? e.negotiation_id === neg.negotiationId : true;
      if (!matches) return;
      clearTimeout(timer);
      resolve(e.order_id);
    };

    stream.on(EventType.OrderCreated, onOrderCreated);
  });

  await client.payOrder(orderId);

  const deliverableText = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Order ${orderId} timed out after ${deliveryTimeoutMs}ms waiting for delivery`));
    }, deliveryTimeoutMs);

    const onOrderCompleted = async (e: any) => {
      if (e.order_id !== orderId) return;
      clearTimeout(timer);
      const delivery = await client.getDelivery(orderId);
      resolve(delivery.deliverableText ?? "");
    };

    stream.on(EventType.OrderCompleted, onOrderCompleted);
  });

  return {
    output: deliverableText,
    latencyMs: Date.now() - startedAt,
    costUSDC: params.expectedCostUSDC,
    orderId,
  };
}
