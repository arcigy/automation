import { defineConfig, type ViteDevServer } from "vite";
import { readFile } from "node:fs/promises";
import { runBlenderExport } from "./src/server/blender/runBlenderExport";

const readJsonBody = async (req: any) => {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
  const raw = Buffer.concat(chunks).toString("utf-8");
  return JSON.parse(raw) as unknown;
};

const sendJson = (res: any, status: number, data: unknown) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
};

const blenderExportMiddleware = (server: ViteDevServer) => {
  return async (req: any, res: any, next: any) => {
    try {
      if (req.method !== "POST" || !req.url?.startsWith("/api/blender/export")) return next();

      const body = await readJsonBody(req);
      const sceneJson = (body as any)?.sceneJson as unknown;
      const wantPreview = (body as any)?.preview !== false;

      const result = await runBlenderExport({
        sceneJson,
        projectRoot: server.config.root,
        jsonOutPath: "exports/scene.json",
        blendOutPath: "exports/scene.blend",
        previewOutPath: wantPreview ? "exports/preview.png" : null
      });

      let previewDataUrl: string | null = null;
      if (result.previewPath) {
        const buf = await readFile(result.previewPath);
        previewDataUrl = `data:image/png;base64,${buf.toString("base64")}`;
      }

      sendJson(res, 200, {
        ok: true,
        jsonPath: result.jsonPath,
        blendPath: result.blendPath,
        previewPath: result.previewPath,
        previewDataUrl
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      sendJson(res, 500, { ok: false, error: message });
    }
  };
};

export default defineConfig({
  clearScreen: false,
  plugins: [
    {
      name: "blender-export-dev-endpoint",
      apply: "serve",
      configureServer(server) {
        server.middlewares.use(blenderExportMiddleware(server));
      }
    }
  ],
  server: {
    host: "127.0.0.1",
    port: 5180,
    strictPort: false
  }
});

