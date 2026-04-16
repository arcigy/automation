import { spawn } from "node:child_process";
import { access, mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

type RunBlenderExportArgs = {
  sceneJson: unknown;
  projectRoot?: string;
  jsonOutPath?: string;
  blendOutPath?: string;
  previewOutPath?: string | null;
  blenderPath?: string;
};

export type RunBlenderExportResult = {
  jsonPath: string;
  blendPath: string;
  previewPath: string | null;
  exitCode: number;
  stdout: string;
  stderr: string;
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

const canExecute = async (p: string) => {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
};

const tryResolveBlenderFromDefaultInstall = async (): Promise<string | null> => {
  if (process.platform !== "win32") return null;

  const candidatesRoots = ["C:\\Program Files\\Blender Foundation", "C:\\Program Files (x86)\\Blender Foundation"];
  for (const root of candidatesRoots) {
    try {
      const entries = await readdir(root, { withFileTypes: true });
      const blenderDirs = entries.filter((e) => e.isDirectory() && e.name.toLowerCase().startsWith("blender "));
      blenderDirs.sort((a, b) => b.name.localeCompare(a.name));
      for (const d of blenderDirs) {
        const exe = path.join(root, d.name, "blender.exe");
        if (await canExecute(exe)) return exe;
      }
    } catch {
      // ignore
    }
  }
  return null;
};

const resolveBlenderBin = async (explicit: string | undefined) => {
  if (explicit) return explicit;
  if (process.env.BLENDER_PATH) return process.env.BLENDER_PATH;
  const auto = await tryResolveBlenderFromDefaultInstall();
  return auto ?? "blender";
};

const normalizeHdriPath = (projectRoot: string, hdriPath: unknown): string | null => {
  if (typeof hdriPath !== "string" || !hdriPath.trim()) return null;
  const p = hdriPath.trim();
  if (path.isAbsolute(p) && !p.startsWith("/")) return p; // Windows/Posix absolute filesystem path
  if (p.startsWith("/")) return path.join(projectRoot, "public", p.slice(1));
  return path.resolve(projectRoot, p);
};

const withResolvedHdri = (projectRoot: string, sceneJson: unknown) => {
  if (!isRecord(sceneJson)) return sceneJson;
  const env = sceneJson.environment;
  if (!isRecord(env)) return sceneJson;
  const resolved = normalizeHdriPath(projectRoot, env.hdriPath);
  return {
    ...sceneJson,
    environment: {
      ...env,
      hdriPath: resolved
    }
  };
};

export async function runBlenderExport(args: RunBlenderExportArgs): Promise<RunBlenderExportResult> {
  const projectRoot = args.projectRoot ? path.resolve(args.projectRoot) : process.cwd();
  const exportsDir = path.join(projectRoot, "exports");

  const jsonPath = args.jsonOutPath ? path.resolve(projectRoot, args.jsonOutPath) : path.join(exportsDir, "scene.json");
  const blendPath = args.blendOutPath ? path.resolve(projectRoot, args.blendOutPath) : path.join(exportsDir, "scene.blend");
  const previewPath =
    args.previewOutPath === null
      ? null
      : args.previewOutPath
        ? path.resolve(projectRoot, args.previewOutPath)
        : null;

  await mkdir(exportsDir, { recursive: true });

  const sceneJson = withResolvedHdri(projectRoot, args.sceneJson);
  await writeFile(jsonPath, JSON.stringify(sceneJson, null, 2), "utf-8");

  const blenderBin = await resolveBlenderBin(args.blenderPath);
  const importerPath = path.join(projectRoot, "scripts", "blender", "import_scene.py");

  const blenderArgs = [
    "--background",
    "--factory-startup",
    "--python",
    importerPath,
    "--",
    jsonPath,
    blendPath,
    previewPath ?? "-"
  ];

  const child = spawn(blenderBin, blenderArgs, {
    cwd: projectRoot,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"]
  });

  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (d) => (stdout += d.toString()));
  child.stderr.on("data", (d) => (stderr += d.toString()));

  const exitCode: number = await new Promise((resolve, reject) => {
    child.on("error", (err) => reject(err));
    child.on("close", (code) => resolve(code ?? 0));
  }).catch((err: unknown) => {
    const hint =
      blenderBin === "blender"
        ? "Install Blender (or set BLENDER_PATH)."
        : "Check BLENDER_PATH points to a valid Blender executable.";
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to start Blender (${blenderBin}). ${hint} Original error: ${msg}`);
  });

  if (exitCode !== 0) {
    const msg = [
      `Blender exited with code ${exitCode}.`,
      `Command: ${blenderBin} ${blenderArgs.map((a) => JSON.stringify(a)).join(" ")}`,
      stderr.trim() ? `stderr:\n${stderr.trim()}` : "",
      stdout.trim() ? `stdout:\n${stdout.trim()}` : ""
    ]
      .filter(Boolean)
      .join("\n\n");
    throw new Error(msg);
  }

  return { jsonPath, blendPath, previewPath, exitCode, stdout, stderr };
}
