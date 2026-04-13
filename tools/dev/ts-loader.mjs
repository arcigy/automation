import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import * as ts from "typescript";

const RUNTIME_EXTS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".mjs",
  ".cjs",
  ".json",
  ".node",
]);

function needsResolution(specifier) {
  const ext = path.extname(specifier);
  return ext.length === 0 || !RUNTIME_EXTS.has(ext);
}

async function tryResolveWithExtensions(specifier, context, defaultResolve) {
  const exts = [".ts", ".tsx", ".js", ".mjs", ".cjs", ".json"];
  for (const ext of exts) {
    try {
      return await defaultResolve(`${specifier}${ext}`, context, defaultResolve);
    } catch {}
    try {
      return await defaultResolve(`${specifier}/index${ext}`, context, defaultResolve);
    } catch {}
  }
  return null;
}

export async function resolve(specifier, context, defaultResolve) {
  // Let node handle builtins and packages.
  if (!specifier.startsWith(".") && !specifier.startsWith("/") && !specifier.startsWith("file:")) {
    return defaultResolve(specifier, context, defaultResolve);
  }

  // Relative/absolute without extension: try .ts first (repo is TS-first).
  if ((specifier.startsWith(".") || specifier.startsWith("/")) && needsResolution(specifier)) {
    const resolved = await tryResolveWithExtensions(specifier, context, defaultResolve);
    if (resolved) return { ...resolved, shortCircuit: true };
  }

  return defaultResolve(specifier, context, defaultResolve);
}

export async function load(url, context, defaultLoad) {
  if (url.startsWith("file:") && (url.endsWith(".ts") || url.endsWith(".tsx"))) {
    const filename = fileURLToPath(url);
    const sourceTs = await readFile(filename, "utf8");

    const isTsx = url.endsWith(".tsx");
    const out = ts.transpileModule(sourceTs, {
      fileName: filename,
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        jsx: isTsx ? ts.JsxEmit.ReactJSX : ts.JsxEmit.Preserve,
        sourceMap: false,
        inlineSources: false,
      },
    });

    return {
      format: "module",
      source: out.outputText,
      shortCircuit: true,
    };
  }

  return defaultLoad(url, context, defaultLoad);
}
