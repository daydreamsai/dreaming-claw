import type { AnyAgentTool, OpenClawPluginApi } from "openclaw/plugin-sdk";
import { createTaskmarketTools } from "./src/taskmarket-tools.js";

type TaskmarketPluginConfig = {
  binary?: string;
  timeoutMs?: number;
};

type ConfigIssue = {
  path: Array<string | number>;
  message: string;
};

type TaskmarketConfigSchema = {
  safeParse: (
    value: unknown,
  ) =>
    | { success: true; data: TaskmarketPluginConfig }
    | { success: false; error: { issues: ConfigIssue[] } };
  jsonSchema: {
    type: "object";
    additionalProperties: false;
    properties: {
      binary: {
        type: "string";
        description: string;
      };
      timeoutMs: {
        type: "number";
        minimum: number;
        description: string;
      };
    };
  };
  uiHints: {
    binary: {
      label: string;
      placeholder: string;
    };
    timeoutMs: {
      label: string;
      placeholder: string;
    };
  };
};

function createTaskmarketConfigSchema(): TaskmarketConfigSchema {
  return {
    safeParse(
      value: unknown,
    ):
      | { success: true; data: TaskmarketPluginConfig }
      | { success: false; error: { issues: ConfigIssue[] } } {
      if (value === undefined) {
        return { success: true, data: {} };
      }
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {
          success: false,
          error: { issues: [{ path: [], message: "expected config object" }] },
        };
      }

      const raw = value as Record<string, unknown>;
      const issues: ConfigIssue[] = [];
      const parsed: TaskmarketPluginConfig = {};

      for (const key of Object.keys(raw)) {
        if (key !== "binary" && key !== "timeoutMs") {
          issues.push({ path: [key], message: "unknown config key" });
        }
      }

      if ("binary" in raw && raw.binary !== undefined) {
        if (typeof raw.binary !== "string") {
          issues.push({ path: ["binary"], message: "expected string" });
        } else {
          parsed.binary = raw.binary;
        }
      }

      if ("timeoutMs" in raw && raw.timeoutMs !== undefined) {
        const timeoutMs = raw.timeoutMs;
        if (typeof timeoutMs !== "number" || !Number.isFinite(timeoutMs) || timeoutMs < 1000) {
          issues.push({ path: ["timeoutMs"], message: "must be a finite number >= 1000" });
        } else {
          parsed.timeoutMs = timeoutMs;
        }
      }

      if (issues.length > 0) {
        return { success: false, error: { issues } };
      }

      return { success: true, data: parsed };
    },
    jsonSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        binary: {
          type: "string",
          description: "Override CLI binary name/path (default: taskmarket).",
        },
        timeoutMs: {
          type: "number",
          minimum: 1000,
          description: "Default command timeout in milliseconds.",
        },
      },
    },
    uiHints: {
      binary: {
        label: "CLI Binary Path",
        placeholder: "/usr/local/bin/taskmarket",
      },
      timeoutMs: {
        label: "Command Timeout (ms)",
        placeholder: "45000",
      },
    },
  };
}

const OPTIONAL_TOOLS = new Set(["taskmarket_command", "taskmarket_install", "taskmarket_apply"]);

const plugin = {
  id: "taskmarket",
  name: "Taskmarket",
  description: "Typed Taskmarket CLI tools for searching and installing marketplace tasks",
  configSchema: createTaskmarketConfigSchema(),
  register(api: OpenClawPluginApi) {
    const tools = createTaskmarketTools(api);
    for (const tool of tools) {
      api.registerTool(
        tool as AnyAgentTool,
        OPTIONAL_TOOLS.has(tool.name) ? { optional: true } : undefined,
      );
    }
  },
};

export default plugin;

export const __testing = {
  createTaskmarketConfigSchema,
};
