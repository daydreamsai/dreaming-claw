import { Type } from "@sinclair/typebox";
import { stringEnum } from "openclaw/plugin-sdk";
import type { AnyAgentTool, OpenClawPluginApi } from "openclaw/plugin-sdk";

type TaskmarketToolResult = {
  content: Array<{ type: "text"; text: string }>;
  details: unknown;
};

type TaskmarketPluginConfig = {
  binary?: string;
  timeoutMs?: number;
};

const OUTPUT_FORMATS = ["text", "json"] as const;
const TASK_MODES = ["bounty", "claim", "pitch", "benchmark", "auction"] as const;
const APPLY_ACTIONS = ["claim", "pitch", "bid"] as const;
const TOP_LEVEL_COMMANDS = new Set([
  "task",
  "agents",
  "inbox",
  "stats",
  "address",
  "identity",
  "deposit",
  "init",
  "help",
]);

function json(payload: unknown): TaskmarketToolResult {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

function resolveBinary(api: OpenClawPluginApi): string {
  const cfg = (api.pluginConfig ?? {}) as TaskmarketPluginConfig;
  const binary = typeof cfg.binary === "string" ? cfg.binary.trim() : "";
  return binary || "taskmarket";
}

function resolveTimeoutMs(api: OpenClawPluginApi, timeoutMs?: number): number {
  if (typeof timeoutMs === "number" && Number.isFinite(timeoutMs) && timeoutMs >= 1000) {
    return timeoutMs;
  }
  const cfg = (api.pluginConfig ?? {}) as TaskmarketPluginConfig;
  if (
    typeof cfg.timeoutMs === "number" &&
    Number.isFinite(cfg.timeoutMs) &&
    cfg.timeoutMs >= 1000
  ) {
    return cfg.timeoutMs;
  }
  return 45_000;
}

function splitShellArgs(raw: string): string[] | null {
  const tokens: string[] = [];
  let buf = "";
  let inSingle = false;
  let inDouble = false;
  let escaped = false;

  const pushToken = () => {
    if (buf.length > 0) {
      tokens.push(buf);
      buf = "";
    }
  };

  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (escaped) {
      buf += ch;
      escaped = false;
      continue;
    }
    if (!inSingle && !inDouble && ch === "\\") {
      escaped = true;
      continue;
    }
    if (inSingle) {
      if (ch === "'") {
        inSingle = false;
      } else {
        buf += ch;
      }
      continue;
    }
    if (inDouble) {
      const next = raw[i + 1];
      if (ch === "\\" && next && (next === "\\" || next === '"' || next === "$" || next === "`")) {
        buf += next;
        i += 1;
        continue;
      }
      if (ch === '"') {
        inDouble = false;
      } else {
        buf += ch;
      }
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      continue;
    }
    if (/\s/.test(ch)) {
      pushToken();
      continue;
    }
    buf += ch;
  }

  if (escaped || inSingle || inDouble) {
    return null;
  }
  pushToken();
  return tokens;
}

function resolveRawTaskmarketInvocation(rawCommand: string): { command: string[]; args: string[] } {
  const raw = rawCommand.trim();
  if (!raw) {
    return { command: ["task", "search"], args: ["--human"] };
  }

  const tokens = splitShellArgs(raw);
  if (!tokens) {
    throw new Error("Invalid command arguments (unclosed quote or escape)");
  }
  if (tokens.length === 0) {
    return { command: ["task", "search"], args: ["--human"] };
  }

  const [first, ...rest] = tokens;
  const head = first.toLowerCase();

  if (head === "-h" || head === "--help") {
    return { command: [], args: [first, ...rest] };
  }

  if (TOP_LEVEL_COMMANDS.has(head)) {
    return { command: [first], args: rest };
  }

  if (head === "search" || head === "browse") {
    return { command: ["task", "search"], args: [...rest, "--human"] };
  }
  if (head === "open") {
    return { command: ["task", "get"], args: rest };
  }
  if (head === "install") {
    return { command: ["task", "claim"], args: rest };
  }
  if (head === "apply") {
    const applyAction = (rest[0] ?? "").toLowerCase();
    if (applyAction === "claim" || applyAction === "pitch" || applyAction === "bid") {
      return { command: ["task", applyAction], args: rest.slice(1) };
    }
    return { command: ["task", "claim"], args: rest };
  }

  if (head.startsWith("-")) {
    return { command: ["task", "search"], args: [...tokens, "--human"] };
  }

  return { command: ["task", "search"], args: ["--skill", tokens.join(","), "--human"] };
}

async function runTaskmarketCommand(params: {
  api: OpenClawPluginApi;
  command: string[];
  args: string[];
  timeoutMs?: number;
  format?: (typeof OUTPUT_FORMATS)[number];
}): Promise<TaskmarketToolResult> {
  const binary = resolveBinary(params.api);
  const timeoutMs = resolveTimeoutMs(params.api, params.timeoutMs);
  const argv = [binary, ...params.command, ...params.args];
  const commandLabel = [binary, ...params.command].join(" ");
  let result: Awaited<ReturnType<OpenClawPluginApi["runtime"]["system"]["runCommandWithTimeout"]>>;
  try {
    result = await params.api.runtime.system.runCommandWithTimeout(argv, { timeoutMs });
  } catch (err) {
    throw new Error(`Failed to run ${commandLabel}: ${String(err)}`);
  }

  const stdout = result.stdout.trim();
  const stderr = result.stderr.trim();
  if (result.code !== 0) {
    const detail = stderr || stdout || "unknown error";
    throw new Error(`${commandLabel} failed (${result.code ?? "?"}): ${detail}`);
  }

  if ((params.format ?? "text") === "json") {
    try {
      const parsed = stdout ? (JSON.parse(stdout) as unknown) : {};
      return json({
        ok: true,
        command: argv.join(" "),
        parsed,
      });
    } catch {
      throw new Error(`${commandLabel} did not return valid JSON`);
    }
  }

  return json({
    ok: true,
    command: argv.join(" "),
    stdout,
    stderr: stderr || undefined,
  });
}

export function createTaskmarketTools(api: OpenClawPluginApi): AnyAgentTool[] {
  const commandTool: AnyAgentTool = {
    name: "taskmarket_command",
    label: "Taskmarket Command",
    description: "Run Taskmarket commands from raw args (for /taskmarket slash dispatch).",
    parameters: Type.Object(
      {
        command: Type.Optional(
          Type.String({
            description:
              "Raw Taskmarket args (for example: 'search --limit 20' or 'task get 0x...').",
          }),
        ),
        format: Type.Optional(stringEnum(OUTPUT_FORMATS, { description: "Response format." })),
        timeoutMs: Type.Optional(Type.Number({ minimum: 1000 })),
      },
      { additionalProperties: false },
    ),
    async execute(_id: string, params: Record<string, unknown>) {
      const rawCommand = typeof params.command === "string" ? params.command : "";
      const format = typeof params.format === "string" ? params.format.trim() : "";
      const timeoutMs = typeof params.timeoutMs === "number" ? params.timeoutMs : undefined;
      const invocation = resolveRawTaskmarketInvocation(rawCommand);
      const args = [...invocation.args];
      if (format === "json") {
        const humanIndex = args.indexOf("--human");
        if (humanIndex >= 0) {
          args.splice(humanIndex, 1);
        }
      }
      return await runTaskmarketCommand({
        api,
        command: invocation.command,
        args,
        timeoutMs,
        format: format === "json" ? "json" : "text",
      });
    },
  };

  const searchTool: AnyAgentTool = {
    name: "taskmarket_search",
    label: "Taskmarket Search",
    description: "Search and list Taskmarket tasks.",
    parameters: Type.Object(
      {
        query: Type.Optional(
          Type.String({ description: "Alias for skill tag filter (comma-separated)." }),
        ),
        status: Type.Optional(
          Type.String({
            description: "Task status filter.",
            default: "open",
          }),
        ),
        mode: Type.Optional(stringEnum(TASK_MODES, { description: "Task mode filter." })),
        skill: Type.Optional(Type.String({ description: "Skill/tag filter (comma-separated)." })),
        rewardMin: Type.Optional(Type.Number({ minimum: 0 })),
        rewardMax: Type.Optional(Type.Number({ minimum: 0 })),
        deadlineHours: Type.Optional(Type.Number({ minimum: 1 })),
        limit: Type.Optional(Type.Number({ minimum: 1 })),
        format: Type.Optional(stringEnum(OUTPUT_FORMATS, { description: "Response format." })),
        timeoutMs: Type.Optional(Type.Number({ minimum: 1000 })),
      },
      { additionalProperties: false },
    ),
    async execute(_id: string, params: Record<string, unknown>) {
      const query = typeof params.query === "string" ? params.query.trim() : "";
      const status = typeof params.status === "string" ? params.status.trim() : "";
      const mode = typeof params.mode === "string" ? params.mode.trim() : "";
      const skill = typeof params.skill === "string" ? params.skill.trim() : "";
      const rewardMin = typeof params.rewardMin === "number" ? params.rewardMin : undefined;
      const rewardMax = typeof params.rewardMax === "number" ? params.rewardMax : undefined;
      const deadlineHours =
        typeof params.deadlineHours === "number" ? params.deadlineHours : undefined;
      const limit = typeof params.limit === "number" ? params.limit : undefined;
      const format = typeof params.format === "string" ? params.format.trim() : "";
      const timeoutMs = typeof params.timeoutMs === "number" ? params.timeoutMs : undefined;
      const args: string[] = [];
      if (status) {
        args.push("--status", status);
      }
      if (mode) {
        args.push("--mode", mode);
      }
      const skillFilter = skill || query;
      if (skillFilter) {
        args.push("--skill", skillFilter);
      }
      if (typeof rewardMin === "number") {
        args.push("--reward-min", String(rewardMin));
      }
      if (typeof rewardMax === "number") {
        args.push("--reward-max", String(rewardMax));
      }
      if (typeof deadlineHours === "number") {
        args.push("--deadline-hours", String(deadlineHours));
      }
      if (typeof limit === "number") {
        args.push("--limit", String(limit));
      }
      if (format !== "json") {
        args.push("--human");
      }
      return await runTaskmarketCommand({
        api,
        command: ["task", "search"],
        args,
        timeoutMs,
        format: format === "json" ? "json" : "text",
      });
    },
  };

  const browseTool: AnyAgentTool = {
    name: "taskmarket_browse",
    label: "Taskmarket Browse",
    description: "Browse Taskmarket tasks, optionally filtered by topic.",
    parameters: Type.Object(
      {
        topic: Type.Optional(Type.String({ description: "Optional topic/category to browse." })),
        limit: Type.Optional(Type.Number({ minimum: 1 })),
        format: Type.Optional(stringEnum(OUTPUT_FORMATS, { description: "Response format." })),
        timeoutMs: Type.Optional(Type.Number({ minimum: 1000 })),
      },
      { additionalProperties: false },
    ),
    async execute(_id: string, params: Record<string, unknown>) {
      const topic = typeof params.topic === "string" ? params.topic.trim() : "";
      const limit = typeof params.limit === "number" ? params.limit : undefined;
      const format = typeof params.format === "string" ? params.format.trim() : "";
      const timeoutMs = typeof params.timeoutMs === "number" ? params.timeoutMs : undefined;
      const args: string[] = [];
      if (topic) {
        args.push("--skill", topic);
      }
      if (typeof limit === "number") {
        args.push("--limit", String(limit));
      }
      if (format !== "json") {
        args.push("--human");
      }
      return await runTaskmarketCommand({
        api,
        command: ["task", "search"],
        args,
        timeoutMs,
        format: format === "json" ? "json" : "text",
      });
    },
  };

  const installTool: AnyAgentTool = {
    name: "taskmarket_install",
    label: "Taskmarket Install",
    description: "Claim a Taskmarket task by id (legacy alias for apply).",
    parameters: Type.Object(
      {
        task: Type.String({ description: "Task id to claim." }),
        timeoutMs: Type.Optional(Type.Number({ minimum: 1000 })),
      },
      { additionalProperties: false },
    ),
    async execute(_id: string, params: Record<string, unknown>) {
      const task = typeof params.task === "string" ? params.task.trim() : "";
      if (!task) {
        throw new Error("task is required");
      }
      const timeoutMs = typeof params.timeoutMs === "number" ? params.timeoutMs : undefined;
      return await runTaskmarketCommand({
        api,
        command: ["task", "claim"],
        args: [task],
        timeoutMs,
      });
    },
  };

  const openTool: AnyAgentTool = {
    name: "taskmarket_open",
    label: "Taskmarket Open",
    description: "Fetch details for a Taskmarket task by id.",
    parameters: Type.Object(
      {
        task: Type.String({ description: "Task id to fetch." }),
        timeoutMs: Type.Optional(Type.Number({ minimum: 1000 })),
      },
      { additionalProperties: false },
    ),
    async execute(_id: string, params: Record<string, unknown>) {
      const task = typeof params.task === "string" ? params.task.trim() : "";
      if (!task) {
        throw new Error("task is required");
      }
      const timeoutMs = typeof params.timeoutMs === "number" ? params.timeoutMs : undefined;
      return await runTaskmarketCommand({
        api,
        command: ["task", "get"],
        args: [task],
        timeoutMs,
      });
    },
  };

  const applyTool: AnyAgentTool = {
    name: "taskmarket_apply",
    label: "Taskmarket Apply",
    description: "Apply to a Taskmarket task by claim, pitch, or bid.",
    parameters: Type.Object(
      {
        task: Type.String({ description: "Task id to apply to." }),
        action: Type.Optional(stringEnum(APPLY_ACTIONS, { description: "Apply action." })),
        text: Type.Optional(Type.String({ description: "Pitch text (for action=pitch)." })),
        durationHours: Type.Optional(
          Type.Number({ minimum: 1, description: "Estimated duration hours for a pitch." }),
        ),
        price: Type.Optional(Type.Number({ minimum: 0, description: "Bid price in USDC." })),
        timeoutMs: Type.Optional(Type.Number({ minimum: 1000 })),
      },
      { additionalProperties: false },
    ),
    async execute(_id: string, params: Record<string, unknown>) {
      const task = typeof params.task === "string" ? params.task.trim() : "";
      if (!task) {
        throw new Error("task is required");
      }
      const action = typeof params.action === "string" ? params.action.trim() : "claim";
      const text = typeof params.text === "string" ? params.text.trim() : "";
      const durationHours =
        typeof params.durationHours === "number" ? params.durationHours : undefined;
      const price = typeof params.price === "number" ? params.price : undefined;
      const timeoutMs = typeof params.timeoutMs === "number" ? params.timeoutMs : undefined;
      const args = [task];
      if (action === "pitch") {
        if (text) {
          args.push("--text", text);
        }
        if (typeof durationHours === "number") {
          args.push("--duration", String(durationHours));
        }
      }
      if (action === "bid") {
        if (typeof price !== "number") {
          throw new Error("price is required when action=bid");
        }
        args.push("--price", String(price));
      }
      return await runTaskmarketCommand({
        api,
        command: ["task", action],
        args,
        timeoutMs,
      });
    },
  };

  return [commandTool, searchTool, browseTool, installTool, openTool, applyTool];
}

export const __testing = {
  resolveBinary,
  resolveTimeoutMs,
  resolveRawTaskmarketInvocation,
};
