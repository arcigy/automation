import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";

const nodeBin = process.execPath;
const tsxCli = path.join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");
const viteCli = path.join(process.cwd(), "node_modules", "vite", "bin", "vite.js");

const worker = spawn(nodeBin, [tsxCli, "scripts/worker.ts"], { stdio: "inherit", cwd: process.cwd() });
const vite = spawn(nodeBin, [viteCli, "--host", "127.0.0.1", "--port", "5180"], { stdio: "inherit", cwd: process.cwd() });

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
