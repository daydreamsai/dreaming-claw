import { beforeEach, describe, expect, it, vi } from "vitest";

const resolveManifestProviderAuthChoice = vi.hoisted(() => vi.fn());
const resolveProviderPluginChoice = vi.hoisted(() => vi.fn());
const resolvePluginProviders = vi.hoisted(() => vi.fn(() => []));

vi.mock("../plugins/provider-auth-choices.js", () => ({
  resolveManifestProviderAuthChoice,
}));

vi.mock("../plugins/provider-auth-choice.runtime.js", () => ({
  resolveProviderPluginChoice,
  resolvePluginProviders,
}));

import { resolvePreferredProviderForAuthChoice } from "./auth-choice.preferred-provider.js";

describe("resolvePreferredProviderForAuthChoice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveManifestProviderAuthChoice.mockReturnValue(undefined);
    resolvePluginProviders.mockReturnValue([]);
    resolveProviderPluginChoice.mockReturnValue(null);
  });

  it("prefers manifest metadata when available", async () => {
    resolveManifestProviderAuthChoice.mockReturnValue({
      pluginId: "openai",
      providerId: "openai",
      methodId: "api-key",
      choiceId: "openai-api-key",
      choiceLabel: "OpenAI API key",
    });

    await expect(resolvePreferredProviderForAuthChoice({ choice: "openai-api-key" })).resolves.toBe(
      "openai",
    );
    expect(resolvePluginProviders).not.toHaveBeenCalled();
  });

  it("normalizes legacy auth choices before plugin lookup", async () => {
    resolveProviderPluginChoice.mockReturnValue({
      provider: { id: "anthropic", label: "Anthropic", auth: [] },
      method: { id: "setup-token", label: "setup-token", kind: "token" },
    });

    await expect(resolvePreferredProviderForAuthChoice({ choice: "claude-cli" })).resolves.toBe(
      "anthropic",
    );
    expect(resolveProviderPluginChoice).toHaveBeenCalledWith(
      expect.objectContaining({
        choice: "setup-token",
      }),
    );
    expect(resolvePluginProviders).toHaveBeenCalledWith(
      expect.objectContaining({
        bundledProviderAllowlistCompat: true,
        bundledProviderVitestCompat: true,
      }),
    );
  });

  it("falls back to static core choices when no provider plugin claims the choice", async () => {
    await expect(resolvePreferredProviderForAuthChoice({ choice: "chutes" })).resolves.toBe(
      "chutes",
    );
  });

  it("resolves x402 through manifest metadata instead of a static fallback", async () => {
    resolveManifestProviderAuthChoice.mockReturnValue({
      pluginId: "daydreams-x402-auth",
      providerId: "x402",
      methodId: "taskmarket",
      choiceId: "x402",
      choiceLabel: "Taskmarket wallet keystore",
    });

    await expect(resolvePreferredProviderForAuthChoice({ choice: "x402" })).resolves.toBe("x402");
    expect(resolvePluginProviders).not.toHaveBeenCalled();
  });
});
