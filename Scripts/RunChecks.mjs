import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Run } from "./RunCommand.mjs";

const Root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

Run("npm", ["test"], path.join(Root, "Worker"));
Run("npm", ["exec", "tsc", "--", "--noEmit"], path.join(Root, "Worker"));
Run(
  "rojo",
  ["build", "default.project.json", "--output", path.join(tmpdir(), "FigmaToRoblox-root-check.rbxm")],
  path.join(Root, "RobloxPlugin"),
);
Run("npm", ["run", "Test"], path.join(Root, "FidelityHarness"));
