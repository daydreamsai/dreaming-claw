import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { withEnvAsync } from "../test-utils/env.js";
import { buildWorkspaceSkillStatus } from "./skills-status.js";

describe("taskmarket bundled skill status", () => {
  it("surfaces taskmarket as installable with missing bins when not on PATH", async () => {
    const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-taskmarket-"));
    const bundledDir = path.join(workspaceDir, ".bundled");
    const managedDir = path.join(workspaceDir, ".managed");
    const sourceDir = path.resolve(process.cwd(), "skills", "taskmarket");
    const targetDir = path.join(bundledDir, "taskmarket");

    await fs.mkdir(bundledDir, { recursive: true });
    await fs.cp(sourceDir, targetDir, { recursive: true });

    await withEnvAsync({ OPENCLAW_BUNDLED_SKILLS_DIR: bundledDir, PATH: "" }, async () => {
      const report = buildWorkspaceSkillStatus(workspaceDir, {
        managedSkillsDir: managedDir,
      });
      const taskmarket = report.skills.find((skill) => skill.name === "taskmarket");

      expect(taskmarket).toBeDefined();
      expect(taskmarket?.install[0]?.id).toBe("node");
      expect(taskmarket?.requirements.bins).toContain("taskmarket");
      expect(taskmarket?.missing.bins).toContain("taskmarket");
      expect(taskmarket?.requirements.env).toEqual([]);
      expect(taskmarket?.missing.env).toEqual([]);
    });
  });
});
