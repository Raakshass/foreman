import { runJob } from "./orchestrator.js";

const goal =
  process.argv.slice(2).join(" ") ||
  "Produce a short due-diligence brief on a hypothetical token launch.";
const budget = Number(process.env.JOB_BUDGET_USDC ?? 1);

const result = await runJob(goal, budget);

console.log("\n===== JOB RESULT =====");
console.log(`Job: ${result.jobId}`);
console.log(`Succeeded: ${result.succeeded}`);
console.log(`Total cost: $${result.totalCostUSDC.toFixed(4)} USDC`);
console.log(`Crew size (all attempts): ${result.crew.length}`);
console.log(`Unique agents hired: ${new Set(result.crew.map((c) => c.agentId)).size}`);
console.log("\n--- Final Output ---\n");
console.log(result.finalOutput || "(no output produced -- check warnings above)");

process.exit(result.succeeded ? 0 : 1);
