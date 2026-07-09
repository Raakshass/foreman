import "dotenv/config";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}. Copy .env.example to .env and fill it in.`);
  return v;
}

export const env = {
  capApiUrl: () => required("CROO_API_URL"),
  capWsUrl: () => required("CROO_WS_URL"),

  foremanSdkKey: () => required("FOREMAN_SDK_KEY"),
  echoWorkerSdkKey: () => required("ECHO_WORKER_SDK_KEY"),
  researchWorkerSdkKey: () => required("RESEARCH_WORKER_SDK_KEY"),

  echoWorkerServiceId: () => required("ECHO_WORKER_SERVICE_ID"),
  researchWorkerServiceId: () => required("RESEARCH_WORKER_SERVICE_ID"),

  anthropicApiKey: () => required("ANTHROPIC_API_KEY"),
  anthropicModel: () => process.env.ANTHROPIC_MODEL || "claude-sonnet-5",

  reputationMode: () => (process.env.REPUTATION_MODE === "onchain" ? "onchain" : "local") as
    | "onchain"
    | "local",
};
