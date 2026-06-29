#!/usr/bin/env node
const { existsSync } = require("fs");
const { join } = require("path");
const { spawnSync } = require("child_process");

const userProfile = process.env.USERPROFILE ?? "";
const executable = findExecutable("SEMGREP", "semgrep", [
  join(userProfile, ".local", "bin", "semgrep.exe"),
  join(process.cwd(), ".venv", "Scripts", "semgrep.exe")
]);

run(executable, ["scan", "--config", "auto", "--error"]);

function findExecutable(envName, command, fallbacks) {
  const override = process.env[envName];
  if (override) return override;
  if (canRun(command)) return command;
  for (const fallback of fallbacks) {
    if (existsSync(fallback)) return fallback;
  }
  console.error(`${command} is required. Install it, add it to PATH, or set ${envName}.`);
  process.exit(1);
}

function canRun(command) {
  // nosemgrep: javascript.lang.security.detect-child-process.detect-child-process
  return spawnSync(command, ["--version"], { stdio: "ignore" }).status === 0;
}

function run(command, args) {
  // nosemgrep: javascript.lang.security.detect-child-process.detect-child-process
  const result = spawnSync(command, args, { stdio: "inherit" });
  process.exit(result.status ?? 1);
}
