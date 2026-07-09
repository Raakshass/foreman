import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { RegistryEntry } from "@foreman/shared";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REGISTRY_PATH = path.resolve(__dirname, "../data/registry.json");

// Stand-in for CAP capability discovery: the SDK reference confirms an AgentClient
// exists for negotiation/payment/delivery, but does NOT confirm a public
// "discover agents by capability" endpoint. Until/unless one exists, Foreman
// resolves capability -> hireable agent from this hand-maintained file. This is also
// exactly where Day 5's Discord-recruited external agents get added (see
// scripts/recruit.md), which is what drives the unique-counterparty count.

export function loadRegistry(): RegistryEntry[] {
  if (!existsSync(REGISTRY_PATH)) return [];
  return JSON.parse(readFileSync(REGISTRY_PATH, "utf-8"));
}

export function saveRegistry(entries: RegistryEntry[]): void {
  writeFileSync(REGISTRY_PATH, JSON.stringify(entries, null, 2));
}

export function upsertEntry(entry: RegistryEntry): void {
  const all = loadRegistry();
  const idx = all.findIndex((e) => e.agentId === entry.agentId);
  if (idx >= 0) all[idx] = entry;
  else all.push(entry);
  saveRegistry(all);
}

/** Candidates for a capability, best first: higher reputation, then lower cost. Unranked agents sort after ranked ones. */
export function findCandidates(capability: string): RegistryEntry[] {
  return loadRegistry()
    .filter((e) => e.capabilities.includes(capability))
    .sort((a, b) => {
      const repDiff = (b.reputationScore ?? -1) - (a.reputationScore ?? -1);
      if (repDiff !== 0) return repDiff;
      return a.costUSDC - b.costUSDC;
    });
}
