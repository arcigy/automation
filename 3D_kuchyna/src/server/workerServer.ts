import http from "node:http";
import { access, mkdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { runBlenderExport } from "./blender/runBlenderExport";

const PROJECT_ROOT = process.cwd();
const EXPORTS_DIR = path.join(PROJECT_ROOT, "exports");

const readJsonBody = async (req: http.IncomingMessage) => {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
  const raw = Buffer.concat(chunks).toString("utf-8");
  return JSON.parse(raw) as unknown;
};

const sendJson = (res: http.ServerResponse, status: number, data: unknown) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
};

const sendText = (res: http.ServerResponse, status: number, text: string) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(text);
};

const serveExportsFile = async (reqUrl: URL, res: http.ServerResponse) => {
  const rel = reqUrl.pathname.slice("/exports/".length);
  const safeRel = rel.replaceAll("\\", "/");
  if (!safeRel || safeRel.includes("..")) return sendText(res, 400, "Bad path");

  const filePath = path.join(EXPORTS_DIR, safeRel);
  const st = await stat(filePath);
  if (!st.isFile()) return sendText(res, 404, "Not found");

  const buf = await readFile(filePath);
  res.statusCode = 200;
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", safeRel.toLowerCase().endsWith(".png") ? "image/png" : "application/octet-stream");
  res.end(buf);
};

const handleExport = async (req: http.IncomingMessage, res: http.ServerResponse) => {
  const body = await readJsonBody(req);
  const sceneJson = (body as any)?.sceneJson as unknown;

  await mkdir(EXPORTS_DIR, { recursive: true });

  const result = await runBlenderExport({
    sceneJson,
    projectRoot: PROJECT_ROOT,
    jsonOutPath: "exports/scene.json",
    blendOutPath: "exports/scene.blend",
    previewOutPath: "exports/preview.png",
    timeoutMs: 60_000
  });

  if (!result.previewPath) throw new Error("Preview render was not produced.");
  await access(result.previewPath);

  const previewUrl = `/exports/${path.basename(result.previewPath)}?t=${Date.now()}`;
  sendJson(res, 200, {
    ok: true,
    previewUrl,
    jsonPath: result.jsonPath,
    blendPath: result.blendPath
  });
};

export function startWorkerServer() {
  const port = Number(process.env.BLENDER_WORKER_PORT || 5191);
  const host = process.env.BLENDER_WORKER_HOST || "127.0.0.1";

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", `http://${req.headers.host || `${host}:${port}`}`);

      if (req.method === "GET" && url.pathname === "/health") return sendJson(res, 200, { ok: true });

      if (req.method === "GET" && url.pathname.startsWith("/exports/")) return await serveExportsFile(url, res);

      if (req.method === "POST" && url.pathname === "/api/blender/export") return await handleExport(req, res);

      return sendText(res, 404, "Not found");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return sendJson(res, 500, { ok: false, error: message });
    }
  });

  server.listen(port, host, () => {
    console.log(`[blender-worker] listening on http://${host}:${port}`);
  });
}
