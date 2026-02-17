import { isTruthyEnvValue } from "./env.js";

export type DockerE2eLoopOptions = {
  iterations: number | null;
  sleepSeconds: number;
  continueOnFailure: boolean;
  liveGatewayProviders: string;
  liveGatewayModels: string;
};

function parsePositiveIntEnv(raw: string | undefined, key: string): number | null {
  const value = raw?.trim();
  if (!value) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${key} must be a positive integer`);
  }
  return parsed;
}

function parseNonNegativeIntEnv(raw: string | undefined, key: string): number | null {
  const value = raw?.trim();
  if (!value) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${key} must be a non-negative integer`);
  }
  return parsed;
}

export function resolveDockerE2eLoopOptions(env: NodeJS.ProcessEnv): DockerE2eLoopOptions {
  const forever = isTruthyEnvValue(env.OPENCLAW_E2E_LOOP_FOREVER);
  const iterations = forever
    ? null
    : (parsePositiveIntEnv(env.OPENCLAW_E2E_LOOP_COUNT, "OPENCLAW_E2E_LOOP_COUNT") ?? 1);
  const sleepSeconds =
    parseNonNegativeIntEnv(
      env.OPENCLAW_E2E_LOOP_SLEEP_SECONDS,
      "OPENCLAW_E2E_LOOP_SLEEP_SECONDS",
    ) ?? 0;
  const liveGatewayProviders =
    env.OPENCLAW_E2E_DREAMS_ROUTER_PROVIDERS?.trim() ||
    env.OPENCLAW_LIVE_GATEWAY_PROVIDERS?.trim() ||
    "x402";
  const liveGatewayModels =
    env.OPENCLAW_E2E_DREAMS_ROUTER_MODELS?.trim() ||
    env.OPENCLAW_LIVE_GATEWAY_MODELS?.trim() ||
    "x402/auto";

  return {
    iterations,
    sleepSeconds,
    continueOnFailure: isTruthyEnvValue(env.OPENCLAW_E2E_LOOP_CONTINUE_ON_FAILURE),
    liveGatewayProviders,
    liveGatewayModels,
  };
}
