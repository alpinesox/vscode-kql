#!/usr/bin/env node
const { existsSync } = require("fs");
const { join } = require("path");
const { spawnSync } = require("child_process");

const executable = findExecutable("TRUFFLEHOG", "trufflehog", [
  join(process.cwd(), ".tools", "bin", "trufflehog.exe")
]);

run(executable, ["filesystem", ".", "--exclude-paths", ".trufflehog-exclude", "--fail", "--no-update", "--results=verified"]);

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
