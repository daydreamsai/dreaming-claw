import { resolveAgentWorkspaceDir, resolveDefaultAgentId } from "../agents/agent-scope.js";
import {
  buildWorkspaceSkillStatus,
  type SkillStatusEntry,
  type SkillStatusReport,
} from "../agents/skills-status.js";
import { formatCliCommand } from "../cli/command-format.js";
import type { OpenClawConfig } from "../config/config.js";
import { loadOpenClawPlugins } from "../plugins/loader.js";
import { note } from "../terminal/note.js";
import { detectLegacyWorkspaceDirs, formatLegacyWorkspaceWarning } from "./doctor-workspace.js";

function findTaskmarketSkill(report: SkillStatusReport): SkillStatusEntry | undefined {
  return report.skills.find(
    (skill) =>
      skill.name.trim().toLowerCase() === "taskmarket" ||
      skill.skillKey.trim().toLowerCase() === "taskmarket",
  );
}

export function buildTaskmarketReadinessWarning(report: SkillStatusReport): string | undefined {
  const taskmarket = findTaskmarketSkill(report);
  if (!taskmarket || taskmarket.disabled || taskmarket.blockedByAllowlist) {
    return undefined;
  }

  const lines: string[] = [];
  if (taskmarket.missing.bins.includes("taskmarket")) {
    lines.push("- Missing Taskmarket CLI binary: taskmarket");
    lines.push(`  Fix: ${formatCliCommand("openclaw skills install taskmarket")}`);
  }

  if (lines.length === 0) {
    return undefined;
  }
  return lines.join("\n");
}

export function noteWorkspaceStatus(cfg: OpenClawConfig) {
  const workspaceDir = resolveAgentWorkspaceDir(cfg, resolveDefaultAgentId(cfg));
  const legacyWorkspace = detectLegacyWorkspaceDirs({ workspaceDir });
  if (legacyWorkspace.legacyDirs.length > 0) {
    note(formatLegacyWorkspaceWarning(legacyWorkspace), "Extra workspace");
  }

  const skillsReport = buildWorkspaceSkillStatus(workspaceDir, { config: cfg });
  note(
    [
      `Eligible: ${skillsReport.skills.filter((s) => s.eligible).length}`,
      `Missing requirements: ${
        skillsReport.skills.filter((s) => !s.eligible && !s.disabled && !s.blockedByAllowlist)
          .length
      }`,
      `Blocked by allowlist: ${skillsReport.skills.filter((s) => s.blockedByAllowlist).length}`,
    ].join("\n"),
    "Skills status",
  );
  const taskmarketWarning = buildTaskmarketReadinessWarning(skillsReport);
  if (taskmarketWarning) {
    note(taskmarketWarning, "Taskmarket");
  }

  const pluginRegistry = loadOpenClawPlugins({
    config: cfg,
    workspaceDir,
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    },
  });
  if (pluginRegistry.plugins.length > 0) {
    const loaded = pluginRegistry.plugins.filter((p) => p.status === "loaded");
    const disabled = pluginRegistry.plugins.filter((p) => p.status === "disabled");
    const errored = pluginRegistry.plugins.filter((p) => p.status === "error");

    const lines = [
      `Loaded: ${loaded.length}`,
      `Disabled: ${disabled.length}`,
      `Errors: ${errored.length}`,
      errored.length > 0
        ? `- ${errored
            .slice(0, 10)
            .map((p) => p.id)
            .join("\n- ")}${errored.length > 10 ? "\n- ..." : ""}`
        : null,
    ].filter((line): line is string => Boolean(line));

    note(lines.join("\n"), "Plugins");
  }
  if (pluginRegistry.diagnostics.length > 0) {
    const lines = pluginRegistry.diagnostics.map((diag) => {
      const prefix = diag.level.toUpperCase();
      const plugin = diag.pluginId ? ` ${diag.pluginId}` : "";
      const source = diag.source ? ` (${diag.source})` : "";
      return `- ${prefix}${plugin}: ${diag.message}${source}`;
    });
    note(lines.join("\n"), "Plugin diagnostics");
  }

  return { workspaceDir };
}
