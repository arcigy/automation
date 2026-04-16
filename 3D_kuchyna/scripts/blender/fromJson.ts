import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { runBlenderExport } from "../../src/server/blender/runBlenderExport";

type ArgMap = Record<string, string | boolean>;

const parseArgs = (argv: string[]): ArgMap => {
  const out: ArgMap = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) out[key] = true;
    else {
      out[key] = next;
      i++;
    }
  }
  return out;
};

const usage = () => {
  console.log(
    [
      "Usage:",
      "  npm run blender:from-json -- --json <scene.json> [--blend <out.blend>] [--preview <out.png>]",
      "",
      "Env:",
      "  BLENDER_PATH=/absolute/path/to/blender (optional)"
    ].join("\n")
  );
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const jsonArg = args.json;
  if (typeof jsonArg !== "string" || !jsonArg.trim()) {
    usage();
    process.exitCode = 2;
    return;
  }

  const projectRoot = process.cwd();
  const jsonPath = path.resolve(projectRoot, jsonArg);
  const raw = await readFile(jsonPath, "utf-8");
  const sceneJson = JSON.parse(raw.replace(/^\uFEFF/, "")) as unknown;

  const blendOutPath = typeof args.blend === "string" ? args.blend : undefined;
  const previewOutPath = typeof args.preview === "string" ? args.preview : null;

  const res = await runBlenderExport({
    sceneJson,
    projectRoot,
    jsonOutPath: "exports/scene.json",
    blendOutPath,
    previewOutPath
  });

  console.log(
    JSON.stringify(
      {
        jsonPath: res.jsonPath,
        blendPath: res.blendPath,
        previewPath: res.previewPath
      },
      null,
      2
    )
  );
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
