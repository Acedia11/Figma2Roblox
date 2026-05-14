import { spawnSync } from "node:child_process";

export function Run(Command, Args, Cwd) {
  const Display = `${Command} ${Args.join(" ")}`;
  console.log(`\n> ${Display}`);
  const Result = spawnSync(Command, Args, {
    cwd: Cwd,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (Result.status !== 0) {
    process.exit(Result.status ?? 1);
  }
}
