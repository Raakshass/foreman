import { appendFileSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { OutcomeRecord, ReputationSink } from "@foreman/shared";
import { env } from "./env.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTCOMES_PATH = path.resolve(__dirname, "../data/outcomes.jsonl");

class LocalReputationSink implements ReputationSink {
  async record(entry: OutcomeRecord): Promise<{ txRef?: string }> {
    appendFileSync(OUTCOMES_PATH, JSON.stringify(entry) + "\n");
    return {};
  }

  async getScore(agentId: string): Promise<number | undefined> {
    if (!existsSync(OUTCOMES_PATH)) return undefined;
    const lines = readFileSync(OUTCOMES_PATH, "utf-8").trim().split("\n").filter(Boolean);
    const records: OutcomeRecord[] = lines.map((l) => JSON.parse(l));
    const mine = records.filter((r) => r.agentId === agentId);
    if (mine.length === 0) return undefined;
    return mine.reduce((sum, r) => sum + r.score, 0) / mine.length;
  }
}

// Swap-in point for Person B: once ReputationRegistry.sol is deployed, implement
// this against its ABI so it satisfies the same ReputationSink interface
// (packages/shared/src/types.ts), then flip REPUTATION_MODE=onchain in .env.
// Nothing in orchestrator.ts needs to change.
class OnChainReputationSink implements ReputationSink {
  async record(_entry: OutcomeRecord): Promise<{ txRef?: string }> {
    throw new Error(
      "REPUTATION_MODE=onchain but the on-chain sink isn't implemented yet -- " +
        "see the TODO in packages/agents/src/reputation.ts"
    );
  }
  async getScore(_agentId: string): Promise<number | undefined> {
    throw new Error("On-chain reputation sink not implemented yet.");
  }
}

export function createReputationSink(): ReputationSink {
  return env.reputationMode() === "onchain" ? new OnChainReputationSink() : new LocalReputationSink();
}
