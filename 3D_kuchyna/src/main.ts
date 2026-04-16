import "./style.css";
import { startApp } from "./app";

const viewer = document.getElementById("viewer");
const form = document.getElementById("form");
const errors = document.getElementById("errors");
const parts = document.getElementById("parts");
const exportOut = document.getElementById("exportOut") as HTMLTextAreaElement | null;
const copyBtn = document.getElementById("copyBtn") as HTMLButtonElement | null;
const copyStatus = document.getElementById("copyStatus");
const measureBtn = document.getElementById("measureBtn") as HTMLButtonElement | null;
const clearMeasuresBtn = document.getElementById("clearMeasuresBtn") as HTMLButtonElement | null;
const axisLock = document.getElementById("axisLock") as HTMLInputElement | null;
const measureReadout = document.getElementById("measureReadout");

if (
  !viewer ||
  !form ||
  !errors ||
  !parts ||
  !exportOut ||
  !copyBtn ||
  !copyStatus ||
  !measureBtn ||
  !clearMeasuresBtn ||
  !axisLock ||
  !measureReadout
) {
  throw new Error("Missing required DOM elements (viewer/form/errors/parts/exportOut/measure...).");
}

startApp({
  viewerEl: viewer,
  formEl: form,
  errorsEl: errors,
  partsEl: parts,
  exportOutEl: exportOut,
  copyBtn,
  copyStatusEl: copyStatus,
  measureBtn,
  clearMeasuresBtn,
  axisLockEl: axisLock,
  measureReadoutEl: measureReadout,
  resetBtn: document.getElementById("resetBtn") as HTMLButtonElement,
  exportBtn: document.getElementById("exportBtn") as HTMLButtonElement
});
