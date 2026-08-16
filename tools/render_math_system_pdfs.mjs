#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { PDFDocument } from "pdf-lib";

const siteDir = path.resolve(process.argv[2] || "mathSystem");
const downloadsDir = path.join(siteDir, "downloads");
const manifestPath = path.join(downloadsDir, "manifest.json");
const outputs = [
  { source: "poster.html", target: "math-atlas-a2-zh.pdf", language: "zh-Hans" },
  { source: path.join("de", "poster.html"), target: "math-atlas-a2-de.pdf", language: "de" },
];

async function sha256Files(files) {
  const hash = crypto.createHash("sha256");
  for (const file of files) {
    const relative = path.relative(siteDir, file).replaceAll(path.sep, "/");
    const data = await fs.readFile(file);
    hash.update(`${relative.length}:${relative}:${data.length}:`);
    hash.update(data);
  }
  hash.update("math-system-a2-renderer-v1");
  return hash.digest("hex");
}

async function validatePdf(buffer, label) {
  const document = await PDFDocument.load(buffer);
  if (document.getPageCount() !== 1) {
    throw new Error(`${label} must be exactly one page; got ${document.getPageCount()}`);
  }
  const { width, height } = document.getPage(0).getSize();
  const landscape = width > height;
  if (!landscape || width < 1680 || width > 1690 || height < 1185 || height > 1196) {
    throw new Error(`${label} is not A2 landscape; got ${width.toFixed(2)} x ${height.toFixed(2)} pt`);
  }
  return { pages: 1, width_points: width, height_points: height };
}

async function existingOutputsAreCurrent(sourceHash) {
  try {
    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    if (manifest.poster_source_sha256 !== sourceHash) return false;
    for (const item of outputs) {
      const buffer = await fs.readFile(path.join(downloadsDir, item.target));
      await validatePdf(buffer, item.target);
    }
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const inputFiles = [
    path.join(siteDir, "poster.html"),
    path.join(siteDir, "de", "poster.html"),
    path.join(siteDir, "assets", "atlas.css"),
  ];
  const sourceHash = await sha256Files(inputFiles);
  await fs.mkdir(downloadsDir, { recursive: true });
  if (await existingOutputsAreCurrent(sourceHash)) {
    console.log(`A2 PDFs already match poster source ${sourceHash.slice(0, 12)}`);
    return;
  }

  const siteManifest = JSON.parse(await fs.readFile(path.join(siteDir, "manifest.json"), "utf8"));
  const browser = await chromium.launch({ headless: true });
  const records = [];
  try {
    const page = await browser.newPage();
    for (const item of outputs) {
      const sourcePath = path.join(siteDir, item.source);
      await page.goto(pathToFileURL(sourcePath).href, { waitUntil: "load" });
      const buffer = await page.pdf({
        format: "A2",
        landscape: true,
        printBackground: true,
        preferCSSPageSize: false,
      });
      const details = await validatePdf(buffer, item.target);
      await fs.writeFile(path.join(downloadsDir, item.target), buffer);
      records.push({
        file: item.target,
        language: item.language,
        ...details,
      });
    }
  } finally {
    await browser.close();
  }

  const manifest = {
    project: "mathSystem",
    format: "A2 landscape",
    poster_source_sha256: sourceHash,
    source_content_sha256: siteManifest.source_content_sha256,
    generated_at: siteManifest.source_commit_date,
    files: records,
  };
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`rendered and validated ${records.length} single-page A2 PDFs`);
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
