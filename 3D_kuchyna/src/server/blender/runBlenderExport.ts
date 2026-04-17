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
  timeoutMs?: number;
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

  const directCandidates = [
    "C:\\Program Files\\Blender Foundation\\Blender\\blender.exe",
    "C:\\Program Files (x86)\\Blender Foundation\\Blender\\blender.exe"
  ];
  for (const exe of directCandidates) {
    if (await canExecute(exe)) return exe;
  }

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
  if (p.startsWith("http://") || p.startsWith("https://")) {
    try {
      const u = new URL(p);
      if (u.pathname.startsWith("/")) return path.join(projectRoot, "public", u.pathname.slice(1));
      return path.resolve(projectRoot, u.pathname);
    } catch {
      // fall through
    }
  }
  if (path.isAbsolute(p) && !p.startsWith("/")) return p; // Windows/Posix absolute filesystem path
  if (p.startsWith("/")) return path.join(projectRoot, "public", p.slice(1));
  return path.resolve(projectRoot, p);
};

const normalizePublicAssetPath = (projectRoot: string, uri: unknown): string | null => {
  if (typeof uri !== "string" || !uri.trim()) return null;
  const raw = uri.trim();

  const fromPath = (p: string) => {
    if (path.isAbsolute(p) && !p.startsWith("/")) return p;
    if (p.startsWith("/")) return path.join(projectRoot, "public", p.slice(1));
    return path.resolve(projectRoot, p);
  };

  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    try {
      const u = new URL(raw);
      return fromPath(u.pathname);
    } catch {
      return fromPath(raw);
    }
  }

  return fromPath(raw);
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

const withResolvedMaterialTextures = (projectRoot: string, sceneJson: unknown) => {
  if (!isRecord(sceneJson)) return sceneJson;
  const objects = sceneJson.objects;
  if (!Array.isArray(objects)) return sceneJson;

  const nextObjects = objects.map((o) => {
    if (!isRecord(o)) return o;
    const mat = o.material;
    if (!isRecord(mat)) return o;
    const textures = mat.textures;
    if (!isRecord(textures)) return o;

    const resolveOne = (t: unknown) => {
      if (!isRecord(t)) return t;
      const resolvedUri = normalizePublicAssetPath(projectRoot, t.uri);
      if (!resolvedUri) return t;
      return { ...t, uri: resolvedUri };
    };

    const nextTextures: Record<string, unknown> = { ...textures };
    for (const k of Object.keys(nextTextures)) nextTextures[k] = resolveOne(nextTextures[k]);

    return {
      ...o,
      material: {
        ...mat,
        textures: nextTextures
      }
    };
  });

  return { ...sceneJson, objects: nextObjects };
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

  const sceneJson = withResolvedMaterialTextures(projectRoot, withResolvedHdri(projectRoot, args.sceneJson));
  await writeFile(jsonPath, JSON.stringify(sceneJson, null, 2), "utf-8");

  const blenderBin = await resolveBlenderBin(args.blenderPath);
  if (path.isAbsolute(blenderBin) && !(await canExecute(blenderBin))) {
    throw new Error(`Blender binary not found at: ${blenderBin}. Set BLENDER_PATH or install Blender.`);
  }
  const importerPath = path.join(projectRoot, "scripts", "blender", "import_scene.py");

  const rel = (p: string) => {
    const r = path.relative(projectRoot, p);
    return r.length > 0 ? r : p;
  };

  const blenderArgs = [
    "--background",
    "--python",
    rel(importerPath),
    "--",
    rel(jsonPath),
    rel(blendPath),
    previewPath ? rel(previewPath) : "-"
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

  const timeoutMs = typeof args.timeoutMs === "number" && Number.isFinite(args.timeoutMs) ? Math.max(1_000, args.timeoutMs) : 60_000;

  const exitCode: number = await new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        // ignore
      }
      reject(new Error(`Blender timed out after ${timeoutMs}ms.`));
    }, timeoutMs);

    child.on("error", (err) => {
      clearTimeout(t);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(t);
      resolve(code ?? 0);
    });
  }).catch((err: unknown) => {
    const hint =
      blenderBin === "blender"
        ? "Install Blender (or set BLENDER_PATH)."
        : "Check BLENDER_PATH points to a valid Blender executable.";
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to run Blender (${blenderBin}). ${hint} Original error: ${msg}`);
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
