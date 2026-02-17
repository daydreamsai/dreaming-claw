import { describe, expect, it } from "vitest";
import { resolveX402LiveSettings } from "./x402-live-settings.js";

describe("resolveX402LiveSettings", () => {
  it("returns null when disabled", () => {
    expect(resolveX402LiveSettings({})).toBeNull();
  });

  it("throws when enabled without a private key", () => {
    expect(() =>
      resolveX402LiveSettings({
        OPENCLAW_LIVE_X402: "1",
        OPENCLAW_LIVE_X402_ROUTER_URL: "https://ai.xgate.run",
      }),
    ).toThrow("OPENCLAW_LIVE_X402_PRIVATE_KEY must be a 0x-prefixed 64-hex private key.");
  });

  it("applies defaults for optional settings", () => {
    expect(
      resolveX402LiveSettings({
        OPENCLAW_LIVE_X402: "1",
        OPENCLAW_LIVE_X402_PRIVATE_KEY:
          "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      }),
    ).toEqual({
      modelRef: "x402/moonshot:kimi-k2.5",
      network: "eip155:8453",
      permitCapUsd: 10,
      privateKey: "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      routerUrl: "https://ai.xgate.run",
    });
  });

  it("supports explicit overrides", () => {
    expect(
      resolveX402LiveSettings({
        OPENCLAW_LIVE_X402: "1",
        OPENCLAW_LIVE_X402_PRIVATE_KEY:
          "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd",
        OPENCLAW_LIVE_X402_ROUTER_URL: "https://router.example/v1/",
        OPENCLAW_LIVE_X402_MODEL: "x402/anthropic:claude-opus-4-5",
        OPENCLAW_LIVE_X402_NETWORK: "eip155:84532",
        OPENCLAW_LIVE_X402_PERMIT_CAP_USD: "25.5",
      }),
    ).toEqual({
      modelRef: "x402/anthropic:claude-opus-4-5",
      network: "eip155:84532",
      permitCapUsd: 25.5,
      privateKey: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      routerUrl: "https://router.example",
    });
  });

  it("requires x402 model refs", () => {
    expect(() =>
      resolveX402LiveSettings({
        OPENCLAW_LIVE_X402: "1",
        OPENCLAW_LIVE_X402_PRIVATE_KEY:
          "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd",
        OPENCLAW_LIVE_X402_MODEL: "openai/gpt-5.2",
      }),
    ).toThrow("OPENCLAW_LIVE_X402_MODEL must start with x402/");
  });
});
