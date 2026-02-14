import { describe, expect, it } from "vitest";
import { makeTempWorkspace } from "../../../test-helpers/workspace.js";
import { clearPersonaState, readPersonaState, writePersonaState } from "./persona-state.js";

describe("severance persona-state", () => {
  it("returns null when no state file exists", async () => {
    const dir = await makeTempWorkspace("openclaw-persona-");
    const result = await readPersonaState(dir);
    expect(result).toBeNull();
  });

  it("writes and reads innie state", async () => {
    const dir = await makeTempWorkspace("openclaw-persona-");
    await writePersonaState(
      { persona: "innie", timestamp: "2026-01-01T00:00:00Z", source: "command" },
      dir,
    );
    const result = await readPersonaState(dir);
    expect(result).not.toBeNull();
    expect(result?.persona).toBe("innie");
    expect(result?.source).toBe("command");
  });

  it("writes and reads outie state", async () => {
    const dir = await makeTempWorkspace("openclaw-persona-");
    await writePersonaState(
      { persona: "outie", timestamp: "2026-01-01T00:00:00Z", source: "command" },
      dir,
    );
    const result = await readPersonaState(dir);
    expect(result?.persona).toBe("outie");
  });

  it("clears persona state", async () => {
    const dir = await makeTempWorkspace("openclaw-persona-");
    await writePersonaState(
      { persona: "innie", timestamp: "2026-01-01T00:00:00Z" },
      dir,
    );
    expect(await readPersonaState(dir)).not.toBeNull();
    await clearPersonaState(dir);
    expect(await readPersonaState(dir)).toBeNull();
  });

  it("clearPersonaState is safe when file does not exist", async () => {
    const dir = await makeTempWorkspace("openclaw-persona-");
    await expect(clearPersonaState(dir)).resolves.toBeUndefined();
  });

  it("returns null for invalid JSON", async () => {
    const dir = await makeTempWorkspace("openclaw-persona-");
    const { default: fs } = await import("node:fs/promises");
    const { resolvePersonaStatePath } = await import("./persona-state.js");
    const filePath = resolvePersonaStatePath(dir);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, "not json", "utf-8");
    expect(await readPersonaState(dir)).toBeNull();
  });

  it("returns null for invalid persona value", async () => {
    const dir = await makeTempWorkspace("openclaw-persona-");
    const { default: fs } = await import("node:fs/promises");
    const { resolvePersonaStatePath } = await import("./persona-state.js");
    const filePath = resolvePersonaStatePath(dir);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify({ persona: "bogus" }), "utf-8");
    expect(await readPersonaState(dir)).toBeNull();
  });
});
