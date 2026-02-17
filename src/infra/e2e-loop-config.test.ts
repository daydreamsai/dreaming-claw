import { describe, expect, it } from "vitest";
import { resolveDockerE2eLoopOptions } from "./e2e-loop-config.js";

describe("resolveDockerE2eLoopOptions", () => {
  it("uses safe defaults", () => {
    expect(resolveDockerE2eLoopOptions({})).toEqual({
      continueOnFailure: false,
      iterations: 1,
      liveGatewayModels: "x402/auto",
      liveGatewayProviders: "x402",
      sleepSeconds: 0,
    });
  });

  it("parses explicit finite loop options", () => {
    expect(
      resolveDockerE2eLoopOptions({
        OPENCLAW_E2E_LOOP_COUNT: "3",
        OPENCLAW_E2E_LOOP_SLEEP_SECONDS: "2",
        OPENCLAW_E2E_LOOP_CONTINUE_ON_FAILURE: "1",
        OPENCLAW_LIVE_GATEWAY_PROVIDERS: "x402",
        OPENCLAW_LIVE_GATEWAY_MODELS: "x402/anthropic:claude-opus-4-5",
      }),
    ).toEqual({
      continueOnFailure: true,
      iterations: 3,
      liveGatewayModels: "x402/anthropic:claude-opus-4-5",
      liveGatewayProviders: "x402",
      sleepSeconds: 2,
    });
  });

  it("supports forever mode", () => {
    expect(
      resolveDockerE2eLoopOptions({
        OPENCLAW_E2E_LOOP_FOREVER: "true",
        OPENCLAW_E2E_LOOP_SLEEP_SECONDS: "4",
      }),
    ).toEqual({
      continueOnFailure: false,
      iterations: null,
      liveGatewayModels: "x402/auto",
      liveGatewayProviders: "x402",
      sleepSeconds: 4,
    });
  });

  it("prefers loop-specific dreams router env overrides", () => {
    expect(
      resolveDockerE2eLoopOptions({
        OPENCLAW_LIVE_GATEWAY_PROVIDERS: "google",
        OPENCLAW_LIVE_GATEWAY_MODELS: "google/gemini-3-flash-preview",
        OPENCLAW_E2E_DREAMS_ROUTER_PROVIDERS: "x402",
        OPENCLAW_E2E_DREAMS_ROUTER_MODELS: "x402/auto",
      }),
    ).toEqual({
      continueOnFailure: false,
      iterations: 1,
      liveGatewayModels: "x402/auto",
      liveGatewayProviders: "x402",
      sleepSeconds: 0,
    });
  });

  it("throws for invalid loop count", () => {
    expect(() =>
      resolveDockerE2eLoopOptions({
        OPENCLAW_E2E_LOOP_COUNT: "0",
      }),
    ).toThrow("OPENCLAW_E2E_LOOP_COUNT must be a positive integer");
  });

  it("throws for invalid sleep seconds", () => {
    expect(() =>
      resolveDockerE2eLoopOptions({
        OPENCLAW_E2E_LOOP_SLEEP_SECONDS: "-1",
      }),
    ).toThrow("OPENCLAW_E2E_LOOP_SLEEP_SECONDS must be a non-negative integer");
  });
});
