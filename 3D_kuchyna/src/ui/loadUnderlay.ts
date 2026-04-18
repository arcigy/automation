export type UnderlaySource = {
  kind: "png" | "jpg" | "pdf";
  name: string;
  canvas: HTMLCanvasElement;
  physicalSizeMm?: { w: number; h: number } | null;
};

export async function loadUnderlayToCanvas(file: File): Promise<UnderlaySource> {
  const name = file.name || "underlay";
  const ext = (name.split(".").pop() || "").toLowerCase();
  const kind: UnderlaySource["kind"] =
    ext === "pdf" || file.type === "application/pdf"
      ? "pdf"
      : ext === "jpg" || ext === "jpeg" || file.type === "image/jpeg"
        ? "jpg"
        : "png";

  if (kind !== "pdf") {
    const buf = new Uint8Array(await file.arrayBuffer());
    const bmp = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context not available.");
    ctx.drawImage(bmp, 0, 0);
    bmp.close?.();

    let physicalSizeMm: UnderlaySource["physicalSizeMm"] = null;
    if (kind === "png") {
      const readU32be = (i: number) => (buf[i] << 24) | (buf[i + 1] << 16) | (buf[i + 2] << 8) | buf[i + 3];
      const readType = (i: number) => String.fromCharCode(buf[i], buf[i + 1], buf[i + 2], buf[i + 3]);
      const isPng =
        buf.length >= 8 &&
        buf[0] === 0x89 &&
        buf[1] === 0x50 &&
        buf[2] === 0x4e &&
        buf[3] === 0x47 &&
        buf[4] === 0x0d &&
        buf[5] === 0x0a &&
        buf[6] === 0x1a &&
        buf[7] === 0x0a;

      if (!isPng) return { kind, name, canvas, physicalSizeMm: null };
      let off = 8;
      while (off + 12 <= buf.length) {
        const len = readU32be(off);
        const type = readType(off + 4);
        const dataOff = off + 8;
        if (dataOff + len + 4 > buf.length) break;
        if (type === "pHYs" && len === 9) {
          const ppux = readU32be(dataOff);
          const ppuy = readU32be(dataOff + 4);
          const unit = buf[dataOff + 8];
          if (unit === 1 && ppux > 0 && ppuy > 0) {
            const wMm = (bmp.width / ppux) * 1000;
            const hMm = (bmp.height / ppuy) * 1000;
            if (Number.isFinite(wMm) && Number.isFinite(hMm) && wMm > 0 && hMm > 0) {
              physicalSizeMm = { w: wMm, h: hMm };
            }
          }
          break;
        }
        off += 12 + len;
      }
    }

    return { kind, name, canvas, physicalSizeMm };
  }

  const pdfMod = await import("pdfjs-dist/legacy/build/pdf");
  const workerUrl = (await import("pdfjs-dist/legacy/build/pdf.worker?url")).default;
  pdfMod.GlobalWorkerOptions.workerSrc = workerUrl;

  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfMod.getDocument({ data }).promise;
  const page = await doc.getPage(1);

  const base = page.getViewport({ scale: 1 });
  const mmPerPt = 25.4 / 72;
  const physicalSizeMm = { w: base.width * mmPerPt, h: base.height * mmPerPt };
  const maxDim = 2400;
  const scale = Math.min(maxDim / base.width, maxDim / base.height, 6);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context not available.");

  await page.render({ canvasContext: ctx, viewport }).promise;
  return { kind, name, canvas, physicalSizeMm };
}
