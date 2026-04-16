import { spawn } from "node:child_process";
import process from "node:process";

const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";

const worker = spawn(npmBin, ["run", "worker:dev"], { stdio: "inherit", cwd: process.cwd() });
const vite = spawn(npmBin, ["run", "dev"], { stdio: "inherit", cwd: process.cwd() });

const shutdown = () => {
  try {
    worker.kill("SIGTERM");
  } catch {
    // ignore
  }
  try {
    vite.kill("SIGTERM");
  } catch {
    // ignore
  }
};

process.on("SIGINT", () => shutdown());
process.on("SIGTERM", () => shutdown());

const onExit = (code: number | null, label: string) => {
  const c = code ?? 0;
  if (c !== 0) {
    shutdown();
    process.exitCode = c;
    return;
  }
  // If one exits cleanly, stop the other too.
  shutdown();
  console.error(`[dev:local] ${label} exited.`);
};

worker.on("exit", (code) => onExit(code, "worker"));
vite.on("exit", (code) => onExit(code, "vite"));

