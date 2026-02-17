import { isTruthyEnvValue } from "../infra/env.js";

const PRIVATE_KEY_REGEX = /^0x[0-9a-fA-F]{64}$/;
const DEFAULT_ROUTER_URL = "https://ai.xgate.run";
const DEFAULT_MODEL_REF = "x402/moonshot:kimi-k2.5";
const DEFAULT_NETWORK = "eip155:8453";
const DEFAULT_PERMIT_CAP_USD = 10;

export type X402LiveSettings = {
  privateKey: string;
  routerUrl: string;
  modelRef: string;
  network: string;
  permitCapUsd: number;
};

function normalizeRouterUrl(value?: string): string {
  const raw = value?.trim() || DEFAULT_ROUTER_URL;
  const withProtocol = raw.startsWith("http") ? raw : `https://${raw}`;
  return withProtocol.replace(/\/+$/, "").replace(/\/v1\/?$/, "");
}

function parsePermitCap(raw?: string): number {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return DEFAULT_PERMIT_CAP_USD;
  }
  const parsed = Number.parseFloat(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("OPENCLAW_LIVE_X402_PERMIT_CAP_USD must be a positive number.");
  }
  return parsed;
}

export function resolveX402LiveSettings(env: NodeJS.ProcessEnv): X402LiveSettings | null {
  if (!isTruthyEnvValue(env.OPENCLAW_LIVE_X402)) {
    return null;
  }

  const privateKey = env.OPENCLAW_LIVE_X402_PRIVATE_KEY?.trim() ?? "";
  if (!PRIVATE_KEY_REGEX.test(privateKey)) {
    throw new Error("OPENCLAW_LIVE_X402_PRIVATE_KEY must be a 0x-prefixed 64-hex private key.");
  }

  const modelRef = env.OPENCLAW_LIVE_X402_MODEL?.trim() || DEFAULT_MODEL_REF;
  if (!modelRef.startsWith("x402/")) {
    throw new Error("OPENCLAW_LIVE_X402_MODEL must start with x402/");
  }

  return {
    privateKey,
    routerUrl: normalizeRouterUrl(env.OPENCLAW_LIVE_X402_ROUTER_URL),
    modelRef,
    network: env.OPENCLAW_LIVE_X402_NETWORK?.trim() || DEFAULT_NETWORK,
    permitCapUsd: parsePermitCap(env.OPENCLAW_LIVE_X402_PERMIT_CAP_USD),
  };
}
