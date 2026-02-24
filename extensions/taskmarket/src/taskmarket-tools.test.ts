import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OpenClawPluginApi } from "../../../src/plugins/types.js";
import { __testing, createTaskmarketTools } from "./taskmarket-tools.js";

function fakeApi(overrides: Partial<OpenClawPluginApi> = {}): OpenClawPluginApi {
  return {
    id: "taskmarket",
    name: "taskmarket",
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
    registerTool() {},
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
    ...overrides,
  };
}

function findTool(name: string, api: OpenClawPluginApi) {
  const tool = createTaskmarketTools(api).find((entry) => entry.name === name);
  if (!tool) {
    throw new Error(`Missing tool: ${name}`);
  }
  return tool;
}

describe("taskmarket plugin tools", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("uses taskmarket as default binary", () => {
    const api = fakeApi();
    expect(__testing.resolveBinary(api)).toBe("taskmarket");
  });

  it("honors configured binary override", () => {
    const api = fakeApi({ pluginConfig: { binary: "custom-taskmarket" } });
    expect(__testing.resolveBinary(api)).toBe("custom-taskmarket");
  });

  it("runs search command with query", async () => {
    const api = fakeApi();
    const run = vi.fn().mockResolvedValue({
      code: 0,
      stdout: "results",
      stderr: "",
      signal: null,
      killed: false,
      termination: "exit",
    });
    api.runtime.system.runCommandWithTimeout =
      run as typeof api.runtime.system.runCommandWithTimeout;

    const tool = findTool("taskmarket_search", api);
    const result = await tool.execute("call-1", { query: "calendar agent" });

    expect(run).toHaveBeenCalledWith(
      ["taskmarket", "task", "search", "--skill", "calendar agent", "--human"],
      { timeoutMs: 45_000 },
    );
    expect(JSON.stringify(result.details)).toContain("results");
  });

  it("supports filtered search in json format", async () => {
    const api = fakeApi();
    const run = vi.fn().mockResolvedValue({
      code: 0,
      stdout: '{"items":[{"id":"a"}]}',
      stderr: "",
      signal: null,
      killed: false,
      termination: "exit",
    });
    api.runtime.system.runCommandWithTimeout =
      run as typeof api.runtime.system.runCommandWithTimeout;

    const tool = findTool("taskmarket_search", api);
    const result = await tool.execute("call-1b", {
      mode: "pitch",
      rewardMin: 10,
      limit: 5,
      format: "json",
    });

    expect(run).toHaveBeenCalledWith(
      ["taskmarket", "task", "search", "--mode", "pitch", "--reward-min", "10", "--limit", "5"],
      { timeoutMs: 45_000 },
    );
    expect(JSON.stringify(result.details)).toContain('"id":"a"');
  });

  it("parses json output when format=json", async () => {
    const api = fakeApi();
    const run = vi.fn().mockResolvedValue({
      code: 0,
      stdout: '{"items":[{"id":"a"}]}',
      stderr: "",
      signal: null,
      killed: false,
      termination: "exit",
    });
    api.runtime.system.runCommandWithTimeout =
      run as typeof api.runtime.system.runCommandWithTimeout;

    const tool = findTool("taskmarket_browse", api);
    const result = await tool.execute("call-2", { topic: "video", limit: 3, format: "json" });

    expect(run).toHaveBeenCalledWith(
      ["taskmarket", "task", "search", "--skill", "video", "--limit", "3"],
      { timeoutMs: 45_000 },
    );

    expect(JSON.stringify(result.details)).toContain('"id":"a"');
  });

  it("throws when json output is invalid", async () => {
    const api = fakeApi();
    const run = vi.fn().mockResolvedValue({
      code: 0,
      stdout: "not-json",
      stderr: "",
      signal: null,
      killed: false,
      termination: "exit",
    });
    api.runtime.system.runCommandWithTimeout =
      run as typeof api.runtime.system.runCommandWithTimeout;

    const tool = findTool("taskmarket_search", api);
    await expect(tool.execute("call-3", { format: "json" })).rejects.toThrow(
      /did not return valid JSON/i,
    );
  });

  it("throws on command failure", async () => {
    const api = fakeApi();
    const run = vi.fn().mockResolvedValue({
      code: 2,
      stdout: "",
      stderr: "failed",
      signal: null,
      killed: false,
      termination: "exit",
    });
    api.runtime.system.runCommandWithTimeout =
      run as typeof api.runtime.system.runCommandWithTimeout;

    const tool = findTool("taskmarket_open", api);
    await expect(tool.execute("call-4", { task: "0xabc" })).rejects.toThrow(/failed/i);
  });

  it("requires task for install/open/apply", async () => {
    const api = fakeApi();
    const installTool = findTool("taskmarket_install", api);
    const openTool = findTool("taskmarket_open", api);
    const applyTool = findTool("taskmarket_apply", api);
    await expect(installTool.execute("call-5", {})).rejects.toThrow(/task is required/i);
    await expect(openTool.execute("call-6", {})).rejects.toThrow(/task is required/i);
    await expect(applyTool.execute("call-7", {})).rejects.toThrow(/task is required/i);
  });

  it("maps install to task claim", async () => {
    const api = fakeApi();
    const run = vi.fn().mockResolvedValue({
      code: 0,
      stdout: "ok",
      stderr: "",
      signal: null,
      killed: false,
      termination: "exit",
    });
    api.runtime.system.runCommandWithTimeout =
      run as typeof api.runtime.system.runCommandWithTimeout;

    const tool = findTool("taskmarket_install", api);
    await tool.execute("call-8", { task: "0xabc" });
    expect(run).toHaveBeenCalledWith(["taskmarket", "task", "claim", "0xabc"], {
      timeoutMs: 45_000,
    });
  });

  it("supports apply action=bid with price", async () => {
    const api = fakeApi();
    const run = vi.fn().mockResolvedValue({
      code: 0,
      stdout: "ok",
      stderr: "",
      signal: null,
      killed: false,
      termination: "exit",
    });
    api.runtime.system.runCommandWithTimeout =
      run as typeof api.runtime.system.runCommandWithTimeout;

    const tool = findTool("taskmarket_apply", api);
    await tool.execute("call-9", { task: "0xabc", action: "bid", price: 2.5 });
    expect(run).toHaveBeenCalledWith(["taskmarket", "task", "bid", "0xabc", "--price", "2.5"], {
      timeoutMs: 45_000,
    });
  });

  it("requires price for apply action=bid", async () => {
    const api = fakeApi();
    const tool = findTool("taskmarket_apply", api);
    await expect(tool.execute("call-10", { task: "0xabc", action: "bid" })).rejects.toThrow(
      /price is required/i,
    );
  });

  it("runs command tool with default listing", async () => {
    const api = fakeApi();
    const run = vi.fn().mockResolvedValue({
      code: 0,
      stdout: "results",
      stderr: "",
      signal: null,
      killed: false,
      termination: "exit",
    });
    api.runtime.system.runCommandWithTimeout =
      run as typeof api.runtime.system.runCommandWithTimeout;

    const tool = findTool("taskmarket_command", api);
    await tool.execute("call-11", {});

    expect(run).toHaveBeenCalledWith(["taskmarket", "task", "search", "--human"], {
      timeoutMs: 45_000,
    });
  });

  it("maps legacy command aliases in command tool", async () => {
    const api = fakeApi();
    const run = vi.fn().mockResolvedValue({
      code: 0,
      stdout: "ok",
      stderr: "",
      signal: null,
      killed: false,
      termination: "exit",
    });
    api.runtime.system.runCommandWithTimeout =
      run as typeof api.runtime.system.runCommandWithTimeout;

    const tool = findTool("taskmarket_command", api);
    await tool.execute("call-12", { command: "search --limit 5" });
    expect(run).toHaveBeenCalledWith(["taskmarket", "task", "search", "--limit", "5", "--human"], {
      timeoutMs: 45_000,
    });

    await tool.execute("call-13", { command: "open 0xabc" });
    expect(run).toHaveBeenCalledWith(["taskmarket", "task", "get", "0xabc"], {
      timeoutMs: 45_000,
    });
  });

  it("supports json mode in command tool by removing --human", async () => {
    const api = fakeApi();
    const run = vi.fn().mockResolvedValue({
      code: 0,
      stdout: '{"items":[]}',
      stderr: "",
      signal: null,
      killed: false,
      termination: "exit",
    });
    api.runtime.system.runCommandWithTimeout =
      run as typeof api.runtime.system.runCommandWithTimeout;

    const tool = findTool("taskmarket_command", api);
    await tool.execute("call-14", { command: "search --limit 2", format: "json" });
    expect(run).toHaveBeenCalledWith(["taskmarket", "task", "search", "--limit", "2"], {
      timeoutMs: 45_000,
    });
  });

  it("rejects malformed command args in command tool", async () => {
    const api = fakeApi();
    const tool = findTool("taskmarket_command", api);
    await expect(tool.execute("call-15", { command: 'search "oops' })).rejects.toThrow(
      /invalid command arguments/i,
    );
  });
});

describe("taskmarket command parsing", () => {
  it("parses apply variants for raw dispatch", () => {
    expect(__testing.resolveRawTaskmarketInvocation("apply claim 0xabc")).toEqual({
      command: ["task", "claim"],
      args: ["0xabc"],
    });
    expect(__testing.resolveRawTaskmarketInvocation("apply bid 0xabc --price 1.5")).toEqual({
      command: ["task", "bid"],
      args: ["0xabc", "--price", "1.5"],
    });
  });

  it("falls back unknown text to skill search", () => {
    expect(__testing.resolveRawTaskmarketInvocation("video editing")).toEqual({
      command: ["task", "search"],
      args: ["--skill", "video,editing", "--human"],
    });
  });
});
