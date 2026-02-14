import { registerPluginCommand } from "../../../plugins/commands.js";
import type { SeverancePersona } from "../../severance.js";
import { readPersonaState, writePersonaState } from "./persona-state.js";

const PLUGIN_ID = "hook:severance";

let registered = false;

/**
 * Register `/innie` and `/outie` plugin commands so users can switch
 * persona from any channel that supports slash commands (e.g., Telegram).
 *
 * Safe to call multiple times — only registers once.
 */
export function registerSeveranceCommands(): void {
  if (registered) {
    return;
  }
  registered = true;

  const makeHandler = (persona: SeverancePersona) => {
    return async () => {
      await writePersonaState({
        persona,
        timestamp: new Date().toISOString(),
        source: "command",
      });
      const current = await readPersonaState();
      if (current?.persona !== persona) {
        return { text: `Failed to switch persona. Please try again.` };
      }
      const label = persona === "innie" ? "Innie (work)" : "Outie (personal)";
      return {
        text: `Persona switched to **${label}**. Send /new to restart with the new persona.`,
      };
    };
  };

  registerPluginCommand(PLUGIN_ID, {
    name: "innie",
    description: "Switch to innie (work) persona",
    handler: makeHandler("innie"),
  });

  registerPluginCommand(PLUGIN_ID, {
    name: "outie",
    description: "Switch to outie (personal) persona",
    handler: makeHandler("outie"),
  });
}
