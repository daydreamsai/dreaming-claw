import { describe, expect, it, vi } from "vitest";
import { resolveProviderPluginChoice } from "../../src/plugins/provider-wizard.js";
import { createTestPluginApi } from "../../test/helpers/extensions/plugin-api.js";
import plugin from "./index.js";

function registerProvider() {
  const registerProviderMock = vi.fn();

  plugin.register(
    createTestPluginApi({
      id: "daydreams-x402-auth",
      name: "Daydreams Router (x402) Auth",
      source: "test",
      config: {},
      runtime: {} as never,
      registerProvider: registerProviderMock,
    }),
  );

  expect(registerProviderMock).toHaveBeenCalledTimes(1);
  return registerProviderMock.mock.calls[0]?.[0];
}

describe("daydreams x402 auth plugin", () => {
  it("resolves onboarding choices to the intended auth methods", () => {
    const provider = registerProvider();

    expect(
      resolveProviderPluginChoice({
        providers: [provider],
        choice: "x402",
      })?.method.id,
    ).toBe("taskmarket");
    expect(
      resolveProviderPluginChoice({
        providers: [provider],
        choice: "x402-saw",
      })?.method.id,
    ).toBe("saw");
    expect(
      resolveProviderPluginChoice({
        providers: [provider],
        choice: "x402-private-key",
      })?.method.id,
    ).toBe("wallet");
  });

  it("uses runtime auth plus the generic stream wrapper seam", async () => {
    const provider = registerProvider();

    expect(typeof provider.wrapStreamFn).toBe("function");
    await expect(
      provider.prepareRuntimeAuth?.({
        config: {
          models: {
            providers: {
              x402: {
                baseUrl: "https://ai.xgate.run",
              },
            },
          },
        } as never,
        agentDir: "/tmp/agent",
        workspaceDir: "/tmp/workspace",
        env: process.env,
        provider: "x402",
        modelId: "x402/auto",
        model: {
          id: "auto",
          provider: "x402",
          baseUrl: "https://ai.xgate.run",
        } as never,
        apiKey: "saw:main@/run/saw.sock",
        authMode: "api_key",
        profileId: "x402:default",
      }),
    ).resolves.toMatchObject({
      apiKey: "x402-wallet",
    });
  });
});
