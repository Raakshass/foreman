// Frozen contract between Person A (agents) and Person B (contracts/dashboard).
// Change shapes here only after syncing -- both sides build against this file.

export interface Subtask {
  id: string;
  description: string;
  capability: string; // e.g. "research", "verification", "summarization"
  maxCostUSDC: number;
}

export interface JobSpec {
  id: string;
  goal: string;
  subtasks: Subtask[];
  budgetUSDC: number;
  deadline?: string; // ISO timestamp
}

export interface Verdict {
  pass: boolean;
  score: number; // 0-100
  reasons: string[];
}

export interface WorkResult {
  jobId: string;
  subtaskId: string;
  agentId: string;
  serviceId: string;
  output: string;
  latencyMs: number;
  costUSDC: number;
  txHash?: string;
  verdict: Verdict;
  attempt: number; // 1-indexed; >1 means this agent was re-hired after a prior failure
}

// Written for every hire attempt (pass or fail) -- reputation must reflect failures too,
// otherwise the score is gameable by only ever recording wins.
export interface OutcomeRecord {
  agentId: string;
  jobId: string;
  subtaskId: string;
  pass: boolean;
  score: number;
  costUSDC: number;
  timestamp: string;
  txRef?: string; // CAP payment tx hash, for auditability
}

export interface JobResult {
  jobId: string;
  goal: string;
  crew: WorkResult[]; // every attempt, including rejected ones
  finalOutput: string;
  totalCostUSDC: number;
  succeeded: boolean;
}

// Local capability registry entry -- how Foreman discovers hireable agents
// until/unless CAP ships a public discovery endpoint. Populated by hand as
// agents are recruited (see recruitment script).
export interface RegistryEntry {
  agentId: string;
  serviceId: string;
  displayName: string;
  capabilities: string[];
  costUSDC: number;
  isOwn: boolean; // true for our own safety-net workers; never counts toward counterparty metrics
  reputationScore?: number; // populated from OutcomeRecord history; undefined = unranked
}

export interface ReputationSink {
  record(entry: OutcomeRecord): Promise<{ txRef?: string }>;
  getScore(agentId: string): Promise<number | undefined>;
}
