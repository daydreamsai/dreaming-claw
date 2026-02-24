import type { Command } from "commander";
import { resolveAgentWorkspaceDir, resolveDefaultAgentId } from "../agents/agent-scope.js";
import { installSkill } from "../agents/skills-install.js";
import { loadConfig } from "../config/config.js";
import { defaultRuntime } from "../runtime.js";
import { formatDocsLink } from "../terminal/links.js";
import { theme } from "../terminal/theme.js";
import { formatCliCommand } from "./command-format.js";
import { formatSkillInfo, formatSkillsCheck, formatSkillsList } from "./skills-cli.format.js";

export type {
  SkillInfoOptions,
  SkillsCheckOptions,
  SkillsListOptions,
} from "./skills-cli.format.js";
export { formatSkillInfo, formatSkillsCheck, formatSkillsList } from "./skills-cli.format.js";

type SkillStatusReport = Awaited<
  ReturnType<(typeof import("../agents/skills-status.js"))["buildWorkspaceSkillStatus"]>
>;

type SkillsStatusContext = {
  config: ReturnType<typeof loadConfig>;
  workspaceDir: string;
  report: SkillStatusReport;
};

async function loadSkillsStatusContext(): Promise<SkillsStatusContext> {
  const config = loadConfig();
  const workspaceDir = resolveAgentWorkspaceDir(config, resolveDefaultAgentId(config));
  const { buildWorkspaceSkillStatus } = await import("../agents/skills-status.js");
  return {
    config,
    workspaceDir,
    report: buildWorkspaceSkillStatus(workspaceDir, { config }),
  };
}

async function runSkillsAction(render: (report: SkillStatusReport) => string): Promise<void> {
  try {
    const context = await loadSkillsStatusContext();
    defaultRuntime.log(render(context.report));
  } catch (err) {
    defaultRuntime.error(String(err));
    defaultRuntime.exit(1);
  }
}

function parseInstallTimeoutMs(input: unknown): number | undefined {
  if (typeof input !== "string") {
    return undefined;
  }
  const value = input.trim();
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1000) {
    throw new Error("--timeout-ms must be an integer >= 1000");
  }
  return parsed;
}

function formatInstallIds(ids: string[]): string {
  return ids.length > 0 ? ids.join(", ") : "(none)";
}

async function runSkillsInstallAction(
  name: string,
  opts: {
    id?: string;
    timeoutMs?: string;
  },
): Promise<void> {
  try {
    const context = await loadSkillsStatusContext();
    const query = name.trim();
    const skill = context.report.skills.find(
      (entry) => entry.name === query || entry.skillKey === query,
    );
    if (!skill) {
      defaultRuntime.error(
        `Skill "${query}" not found. Run \`${formatCliCommand("openclaw skills list")}\` to see available skills.`,
      );
      defaultRuntime.exit(1);
      return;
    }

    if (skill.install.length === 0) {
      defaultRuntime.error(
        `Skill "${skill.name}" does not expose install actions. Check details via \`${formatCliCommand(`openclaw skills info ${skill.name}`)}\`.`,
      );
      defaultRuntime.exit(1);
      return;
    }

    const requestedId = opts.id?.trim();
    let installOption = requestedId ? skill.install.find((opt) => opt.id === requestedId) : null;
    if (!installOption) {
      if (requestedId) {
        defaultRuntime.error(
          `Installer "${requestedId}" not found for "${skill.name}". Available installers: ${formatInstallIds(skill.install.map((opt) => opt.id))}.`,
        );
        defaultRuntime.exit(1);
        return;
      }
      if (skill.install.length > 1) {
        defaultRuntime.error(
          `Skill "${skill.name}" has multiple installers. Re-run with \`--id <installId>\`. Available installers: ${formatInstallIds(skill.install.map((opt) => opt.id))}.`,
        );
        defaultRuntime.exit(1);
        return;
      }
      installOption = skill.install[0] ?? null;
    }

    if (!installOption) {
      defaultRuntime.error(`No install option resolved for "${skill.name}".`);
      defaultRuntime.exit(1);
      return;
    }

    const timeoutMs = parseInstallTimeoutMs(opts.timeoutMs);
    const result = await installSkill({
      workspaceDir: context.workspaceDir,
      skillName: skill.name,
      installId: installOption.id,
      timeoutMs,
      config: context.config,
    });
    for (const warning of result.warnings ?? []) {
      defaultRuntime.log(warning);
    }
    if (result.ok) {
      defaultRuntime.log(`Installed ${skill.name} (${installOption.id}).`);
      if (result.stdout) {
        defaultRuntime.log(result.stdout.trim());
      }
      return;
    }

    defaultRuntime.error(result.message);
    if (result.stderr) {
      defaultRuntime.log(result.stderr.trim());
    } else if (result.stdout) {
      defaultRuntime.log(result.stdout.trim());
    }
    defaultRuntime.exit(1);
  } catch (err) {
    defaultRuntime.error(String(err));
    defaultRuntime.exit(1);
  }
}

/**
 * Register the skills CLI commands
 */
export function registerSkillsCli(program: Command) {
  const skills = program
    .command("skills")
    .description("List and inspect available skills")
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("Docs:")} ${formatDocsLink("/cli/skills", "docs.openclaw.ai/cli/skills")}\n`,
    );

  skills
    .command("list")
    .description("List all available skills")
    .option("--json", "Output as JSON", false)
    .option("--eligible", "Show only eligible (ready to use) skills", false)
    .option("-v, --verbose", "Show more details including missing requirements", false)
    .action(async (opts) => {
      await runSkillsAction((report) => formatSkillsList(report, opts));
    });

  skills
    .command("info")
    .description("Show detailed information about a skill")
    .argument("<name>", "Skill name")
    .option("--json", "Output as JSON", false)
    .action(async (name, opts) => {
      await runSkillsAction((report) => formatSkillInfo(report, name, opts));
    });

  skills
    .command("check")
    .description("Check which skills are ready vs missing requirements")
    .option("--json", "Output as JSON", false)
    .action(async (opts) => {
      await runSkillsAction((report) => formatSkillsCheck(report, opts));
    });

  skills
    .command("install")
    .description("Install dependencies for a skill using its declared installer")
    .argument("<name>", "Skill name or skill key")
    .option("--id <installId>", "Installer ID to use when multiple installers exist")
    .option("--timeout-ms <ms>", "Installer timeout in milliseconds (>=1000)")
    .action(async (name, opts) => {
      await runSkillsInstallAction(name, opts);
    });

  // Default action (no subcommand) - show list
  skills.action(async () => {
    await runSkillsAction((report) => formatSkillsList(report, {}));
  });
}
