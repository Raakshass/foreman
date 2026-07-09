# Foreman

An agent that takes a goal, breaks it into subtasks, and hires a crew of other
CAP agents to complete them -- paying each in USDC, verifying their output, and
automatically re-hiring a different agent if one fails.

Built for the [CROO Agent Hackathon](https://dorahacks.io/hackathon/croo-agent-hackathon)
on the CROO Agent Protocol (CAP).

## Architecture

```
packages/
  shared/     Types shared between the agent code and the contracts/dashboard
  agents/     Person A's domain -- Foreman + worker agents (this is what's built so far)
  contracts/  Person B's domain -- ReputationRegistry + StakeVault (not started)
  dashboard/  Person B's domain -- live job/crew/payment view (not started)
```

Foreman pipeline: `plan` (Claude decomposes the goal) -> `discover` (capability ->
hireable agent, from `packages/agents/data/registry.json`) -> `hire` (CAP negotiate
-> pay -> await delivery) -> `verify` (Claude-as-judge against a rubric) -> re-hire
the next candidate on failure -> `compose` the final output -> `record` an
`OutcomeRecord` for every attempt (pass or fail) to the reputation sink.

## Setup

```bash
npm install
cp .env.example .env    # then fill in the values below
npm run build --workspace packages/shared
```

### Manual steps required (cannot be done from code)

1. **Create a CROO account** at [agent.croo.network](https://agent.croo.network) and sign in.
2. **Register three agents** (My Agents -> Register Agent): `foreman`, `echo-worker`, `research-worker`.
   Each registration mints an AA wallet + Agent DID and shows an **API key once** --
   save each one into `.env` immediately (`FOREMAN_SDK_KEY`, `ECHO_WORKER_SDK_KEY`,
   `RESEARCH_WORKER_SDK_KEY`).
3. **Register a service** under `echo-worker` and under `research-worker` (flat-priced
   USDC, NOT `require_fund_transfer`, unless you've read the note in
   `src/cap-provider.ts` about `acceptNegotiationWithFundAddress`). Copy each
   service's `serviceId` into `.env` (`ECHO_WORKER_SERVICE_ID`, `RESEARCH_WORKER_SERVICE_ID`).
4. **Fund every agent's AA wallet** (Dashboard -> agent -> Configure page) with a small
   amount of USDC on Base -- the AA wallet address, **not** the Controller/Executor
   address. `foreman`'s wallet pays; the two workers' wallets just need enough gas
   headroom if the network isn't in its 0%-gas launch window.
5. **Update `packages/agents/data/registry.json`** -- replace the placeholder
   `agentId`/`serviceId` values with the real ones from steps 2-3.
6. **Get an Anthropic API key** (console.anthropic.com) for `ANTHROPIC_API_KEY` --
   this powers the planner and verifier.

## Running it

Three separate terminals:

```bash
npm run worker:echo       # terminal 1 -- safety-net worker #1
npm run worker:research   # terminal 2 -- safety-net worker #2
npm run foreman -- "Produce a due-diligence brief on a hypothetical token launch"   # terminal 3
```

Foreman will plan subtasks, hire whichever registered agents match each
subtask's capability (starting with your two safety-net workers), verify
their output, and print the composed result plus a cost/crew summary.

## Recruiting real external agents (Day 5 GTM)

Every job Foreman runs against your own two workers is a smoke test, not a
counterparty. To hit the hackathon's unique-counterparty/buyer-wallet numbers,
add real external teams' agents to `registry.json` (`isOwn: false`) after
recruiting them in the CROO Discord -- see the recruitment post drafted earlier
in this project's planning. Never route Foreman's own workers at each other
repeatedly to pad the numbers; that trips the event's self-trade/sybil review.

## Known SDK gaps (verify if CAP ships updates)

- No public "discover agents by capability" endpoint is confirmed to exist yet
  -- `registry.json` is the stand-in. If CAP adds one, replace `findCandidates`
  in `src/registry.ts` with a real API call.
- `hireAgent` in `src/cap-client.ts` assumes sequential (not concurrent) hires
  per `AgentClient` instance -- see the comment there before parallelizing.
