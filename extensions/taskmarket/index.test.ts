import { describe, expect, it, vi } from "vitest";
import type { OpenClawPluginApi } from "../../src/plugins/types.js";
import taskmarketPlugin from "./index.js";

function createFakeApi(): OpenClawPluginApi {
  return {
    id: "taskmarket",
    name: "Taskmarket",
    source: "test",
    config: {},
    pluginConfig: {},
    runtime: {
      version: "test",
      system: {
        enqueueSystemEvent: vi.fn(),
        runCommandWithTimeout: vi.fn(),
        formatNativeDependencyHint: vi.fn(),
      },
    } as unknown as OpenClawPluginApi["runtime"],
    logger: { debug() {}, info() {}, warn() {}, error() {} },
    registerTool: vi.fn(),
    registerHook() {},
    registerHttpHandler() {},
    registerHttpRoute() {},
    registerChannel() {},
    registerGatewayMethod() {},
    registerCli() {},
    registerService() {},
    registerProvider() {},
    registerCommand() {},
    resolvePath: (input) => input,
    on() {},
  };
}

describe("taskmarket plugin config schema", () => {
  it("accepts binary and timeoutMs from config", () => {
    const parsed = taskmarketPlugin.configSchema?.safeParse?.({
      binary: "/usr/local/bin/taskmarket",
      timeoutMs: 60_000,
    });

    expect(parsed?.success).toBe(true);
  });

  it("rejects unknown config keys", () => {
    const parsed = taskmarketPlugin.configSchema?.safeParse?.({
      unknown: "value",
    });

    expect(parsed?.success).toBe(false);
    expect(parsed?.error?.issues[0]?.path).toEqual(["unknown"]);
  });

  it("rejects timeoutMs below minimum", () => {
    const parsed = taskmarketPlugin.configSchema?.safeParse?.({
      timeoutMs: 500,
    });

    expect(parsed?.success).toBe(false);
    expect(parsed?.error?.issues.some((issue) => issue.path.join(".") === "timeoutMs")).toBe(true);
  });
});

describe("taskmarket tool registration", () => {
  it("registers state-changing tools as optional", () => {
    const api = createFakeApi();
    taskmarketPlugin.register(api);

    const calls = (api.registerTool as ReturnType<typeof vi.fn>).mock.calls;
    const byToolName = new Map(
      calls.map((call) => [(call[0] as { name: string }).name, call[1] as { optional?: boolean }]),
    );

    expect(byToolName.get("taskmarket_command")).toEqual({ optional: true });
    expect(byToolName.get("taskmarket_install")).toEqual({ optional: true });
    expect(byToolName.get("taskmarket_apply")).toEqual({ optional: true });
    expect(byToolName.get("taskmarket_search")).toBeUndefined();
    expect(byToolName.get("taskmarket_browse")).toBeUndefined();
    expect(byToolName.get("taskmarket_open")).toBeUndefined();
  });
});
