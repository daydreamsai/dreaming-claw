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
});
