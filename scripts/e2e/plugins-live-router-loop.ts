#!/usr/bin/env -S node --import tsx
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveDockerE2eLoopOptions } from "../../src/infra/e2e-loop-config.js";

type LoopCommand = {
  label: string;
  file: string;
  env?: Record<string, string>;
};

function runCommand(params: { rootDir: string; iteration: number; command: LoopCommand }): number {
  const scriptPath = path.join(params.rootDir, params.command.file);
  console.log(`\n[loop ${params.iteration}] ${params.command.label}`);
  const result = spawnSync("bash", [scriptPath], {
    cwd: params.rootDir,
    env: {
      ...process.env,
      ...params.command.env,
    },
    stdio: "inherit",
  });
  if (typeof result.status === "number") {
    return result.status;
  }
  if (result.error) {
    console.error(
      `[loop ${params.iteration}] failed to start ${params.command.file}: ${result.error}`,
    );
  } else if (result.signal) {
    console.error(
      `[loop ${params.iteration}] ${params.command.file} terminated by signal: ${result.signal}`,
    );
  }
  return 1;
}

function shouldRunIteration(iteration: number, iterations: number | null): boolean {
  return iterations === null || iteration <= iterations;
}

async function sleep(seconds: number): Promise<void> {
  if (seconds <= 0) {
    return;
  }
  await new Promise<void>((resolve) => {
    setTimeout(resolve, seconds * 1000);
  });
}

async function main() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const rootDir = path.resolve(scriptDir, "../..");
  const options = resolveDockerE2eLoopOptions(process.env);
  console.log(
    `[loop] dreams router target providers=${options.liveGatewayProviders} models=${options.liveGatewayModels}`,
  );
  const commands: LoopCommand[] = [
    { label: "plugin e2e", file: "scripts/e2e/plugins-docker.sh" },
    {
      label: "live gateway e2e (dreams router)",
      file: "scripts/test-live-gateway-models-docker.sh",
      env: {
        OPENCLAW_LIVE_GATEWAY_PROVIDERS: options.liveGatewayProviders,
        OPENCLAW_LIVE_GATEWAY_MODELS: options.liveGatewayModels,
      },
    },
  ];

  let iteration = 1;
  let failures = 0;
  const start = Date.now();

  while (shouldRunIteration(iteration, options.iterations)) {
    console.log(
      `\n==> iteration ${iteration}${options.iterations === null ? " (forever mode)" : `/${options.iterations}`}`,
    );

    for (const command of commands) {
      const exitCode = runCommand({ rootDir, iteration, command });
      if (exitCode !== 0) {
        failures += 1;
        if (!options.continueOnFailure) {
          console.error(
            `\n[loop ${iteration}] failed (${command.label}), exiting with ${exitCode}`,
          );
          process.exit(exitCode);
        }
      }
    }

    iteration += 1;
    if (shouldRunIteration(iteration, options.iterations) && options.sleepSeconds > 0) {
      console.log(`\nwaiting ${options.sleepSeconds}s before next iteration...`);
      await sleep(options.sleepSeconds);
    }
  }

  const elapsedSeconds = Math.round((Date.now() - start) / 1000);
  if (failures > 0) {
    console.error(`\nloop finished with ${failures} failure(s) after ${elapsedSeconds}s`);
    process.exit(1);
  }

  const completed = iteration - 1;
  console.log(`\nloop finished successfully (${completed} iteration(s), ${elapsedSeconds}s)`);
}

await main();
