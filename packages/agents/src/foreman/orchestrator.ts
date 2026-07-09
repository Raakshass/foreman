import { randomUUID } from "node:crypto";
import type { JobResult, WorkResult } from "@foreman/shared";
import { createCapClient, hireAgent } from "../cap-client.js";
import { env } from "../env.js";
import { findCandidates } from "../registry.js";
import { createReputationSink } from "../reputation.js";
import { plan } from "./planner.js";
import { verify } from "./verifier.js";

const MAX_ATTEMPTS_PER_SUBTASK = 3;

export async function runJob(goal: string, budgetUSDC: number): Promise<JobResult> {
  const jobId = randomUUID();
  const subtasks = await plan(goal, budgetUSDC);
  console.log(`[foreman] job ${jobId}: planned ${subtasks.length} subtask(s)`);

  const client = createCapClient(env.foremanSdkKey());
  const stream = await client.connectWebSocket();
  const reputation = createReputationSink();

  const crew: WorkResult[] = [];
  const finalPieces: string[] = [];
  let totalCostUSDC = 0;
  let allSucceeded = true;

  try {
    for (const subtask of subtasks) {
      const candidates = findCandidates(subtask.capability);
      if (candidates.length === 0) {
        console.warn(`[foreman] no agents registered for capability "${subtask.capability}" -- skipping`);
        allSucceeded = false;
        continue;
      }

      let subtaskSucceeded = false;
      const attemptCap = Math.min(MAX_ATTEMPTS_PER_SUBTASK, candidates.length);

      for (let attempt = 1; attempt <= attemptCap; attempt++) {
        const candidate = candidates[attempt - 1];
        console.log(
          `[foreman] hiring ${candidate.displayName} (${candidate.agentId}) for "${subtask.description}" (attempt ${attempt}/${attemptCap})`
        );

        let workResult: WorkResult;
        try {
          const outcome = await hireAgent(client, stream, {
            serviceId: candidate.serviceId,
            requirements: { task: subtask.description },
            expectedCostUSDC: candidate.costUSDC,
          });

          const verdict = await verify({
            taskDescription: subtask.description,
            capability: subtask.capability,
            output: outcome.output,
          });

          workResult = {
            jobId,
            subtaskId: subtask.id,
            agentId: candidate.agentId,
            serviceId: candidate.serviceId,
            output: outcome.output,
            latencyMs: outcome.latencyMs,
            costUSDC: outcome.costUSDC,
            txHash: outcome.txHash,
            verdict,
            attempt,
          };
        } catch (err) {
          workResult = {
            jobId,
            subtaskId: subtask.id,
            agentId: candidate.agentId,
            serviceId: candidate.serviceId,
            output: "",
            latencyMs: 0,
            costUSDC: 0,
            verdict: { pass: false, score: 0, reasons: [`Hire failed: ${(err as Error).message}`] },
            attempt,
          };
        }

        crew.push(workResult);
        totalCostUSDC += workResult.costUSDC;

        await reputation.record({
          agentId: workResult.agentId,
          jobId,
          subtaskId: subtask.id,
          pass: workResult.verdict.pass,
          score: workResult.verdict.score,
          costUSDC: workResult.costUSDC,
          timestamp: new Date().toISOString(),
          txRef: workResult.txHash,
        });

        if (workResult.verdict.pass) {
          finalPieces.push(`## ${subtask.description}\n\n${workResult.output}`);
          subtaskSucceeded = true;
          break;
        }

        console.warn(
          `[foreman] ${candidate.displayName} failed verification (score ${workResult.verdict.score}): ` +
            `${workResult.verdict.reasons.join("; ")} -- re-hiring next candidate`
        );
      }

      if (!subtaskSucceeded) allSucceeded = false;
    }
  } finally {
    stream.close();
  }

  return {
    jobId,
    goal,
    crew,
    finalOutput: finalPieces.join("\n\n"),
    totalCostUSDC,
    succeeded: allSucceeded,
  };
}
