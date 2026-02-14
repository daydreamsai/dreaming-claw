import fs from "node:fs/promises";
import path from "node:path";
import { resolveStateDir } from "../../../config/paths.js";
import type { SeverancePersona } from "../../severance.js";

export type SeverancePersonaState = {
  persona: SeverancePersona;
  timestamp: string;
  source?: string;
};

const STATE_FILENAME = "severance-persona-state.json";

export function resolvePersonaStatePath(stateDir?: string): string {
  const dir = stateDir ?? resolveStateDir();
  return path.join(dir, STATE_FILENAME);
}

export async function readPersonaState(stateDir?: string): Promise<SeverancePersonaState | null> {
  const filePath = resolvePersonaStatePath(stateDir);
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      return null;
    }
    const obj = parsed as Record<string, unknown>;
    if (obj.persona !== "innie" && obj.persona !== "outie") {
      return null;
    }
    return {
      persona: obj.persona,
      timestamp: typeof obj.timestamp === "string" ? obj.timestamp : new Date().toISOString(),
      source: typeof obj.source === "string" ? obj.source : undefined,
    };
  } catch {
    return null;
  }
}

export async function writePersonaState(
  state: SeverancePersonaState,
  stateDir?: string,
): Promise<void> {
  const filePath = resolvePersonaStatePath(stateDir);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(state, null, 2), "utf-8");
}

export async function clearPersonaState(stateDir?: string): Promise<void> {
  const filePath = resolvePersonaStatePath(stateDir);
  try {
    await fs.unlink(filePath);
  } catch {
    // Already absent — nothing to do
  }
}
