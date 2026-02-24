import { describe, expect, it } from "vitest";
import type { SkillStatusEntry, SkillStatusReport } from "../agents/skills-status.js";
import { buildTaskmarketReadinessWarning } from "./doctor-workspace-status.js";

function createSkill(overrides: Partial<SkillStatusEntry> = {}): SkillStatusEntry {
  return {
    name: "taskmarket",
    description: "Taskmarket skill",
    source: "openclaw-bundled",
    bundled: true,
    filePath: "/tmp/taskmarket/SKILL.md",
    baseDir: "/tmp/taskmarket",
    skillKey: "taskmarket",
    emoji: "TM",
    homepage: "https://api-market.daydreams.systems",
    always: false,
    disabled: false,
    blockedByAllowlist: false,
    eligible: false,
    requirements: {
      bins: ["taskmarket"],
      anyBins: [],
      env: [],
      config: [],
      os: [],
    },
    missing: {
      bins: ["taskmarket"],
      anyBins: [],
      env: [],
      config: [],
      os: [],
    },
    configChecks: [],
    install: [{ id: "node", kind: "node", label: "Install taskmarket", bins: ["taskmarket"] }],
    ...overrides,
  };
}

function createReport(skills: SkillStatusEntry[]): SkillStatusReport {
  return {
    workspaceDir: "/tmp/workspace",
    managedSkillsDir: "/tmp/managed",
    skills,
  };
}

describe("buildTaskmarketReadinessWarning", () => {
  it("returns undefined when taskmarket skill is absent", () => {
    const report = createReport([
      createSkill({
        name: "other-skill",
        skillKey: "other-skill",
      }),
    ]);
    expect(buildTaskmarketReadinessWarning(report)).toBeUndefined();
  });

  it("returns fix steps when binary is missing", () => {
    const report = createReport([createSkill()]);
    const warning = buildTaskmarketReadinessWarning(report);
    expect(warning).toContain("Missing Taskmarket CLI binary");
    expect(warning).toContain("openclaw skills install taskmarket");
  });

  it("returns undefined when taskmarket is ready", () => {
    const report = createReport([
      createSkill({
        eligible: true,
        missing: {
          bins: [],
          anyBins: [],
          env: [],
          config: [],
          os: [],
        },
      }),
    ]);
    expect(buildTaskmarketReadinessWarning(report)).toBeUndefined();
  });

  it("returns undefined when taskmarket is disabled", () => {
    const report = createReport([
      createSkill({
        disabled: true,
      }),
    ]);
    expect(buildTaskmarketReadinessWarning(report)).toBeUndefined();
  });
});
