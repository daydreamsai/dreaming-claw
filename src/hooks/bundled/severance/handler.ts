import { isSubagentSessionKey } from "../../../routing/session-key.js";
import { resolveHookConfig } from "../../config.js";
import { isAgentBootstrapEvent, type HookHandler } from "../../hooks.js";
import { applySeveranceOverride, resolveSeveranceConfigFromHook } from "../../severance.js";
import { registerSeveranceCommands } from "./commands.js";
import { readPersonaState } from "./persona-state.js";

const HOOK_KEY = "severance";

// Register /innie and /outie commands when this module is loaded
registerSeveranceCommands();

const severanceHook: HookHandler = async (event) => {
  if (!isAgentBootstrapEvent(event)) {
    return;
  }

  const context = event.context;
  if (context.sessionKey && isSubagentSessionKey(context.sessionKey)) {
    return;
  }
  const cfg = context.cfg;
  const hookConfig = resolveHookConfig(cfg, HOOK_KEY);
  if (!hookConfig || hookConfig.enabled === false) {
    return;
  }

  const severanceConfig = resolveSeveranceConfigFromHook(hookConfig as Record<string, unknown>, {
    warn: (message) => console.warn(`[severance] ${message}`),
  });
  if (!severanceConfig) {
    return;
  }

  const workspaceDir = context.workspaceDir;
  if (!workspaceDir || !Array.isArray(context.bootstrapFiles)) {
    return;
  }

  // Check for persona override from /innie or /outie commands
  const personaOverride = await readPersonaState();

  const updated = await applySeveranceOverride({
    files: context.bootstrapFiles,
    workspaceDir,
    config: severanceConfig,
    userTimezone: cfg?.agents?.defaults?.userTimezone,
    personaOverride: personaOverride?.persona,
    log: {
      warn: (message) => console.warn(`[severance] ${message}`),
      debug: (message) => console.debug?.(`[severance] ${message}`),
    },
  });

  context.bootstrapFiles = updated;
};

export default severanceHook;
