#!/usr/bin/env node

import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";

const siteDir = path.resolve(process.argv[2] || "mathSystem");
const publicRoot = path.dirname(siteDir);
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
};

async function filesUnder(root, suffix) {
  const found = [];
  async function visit(folder) {
    for (const entry of await fs.readdir(folder, { withFileTypes: true })) {
      const full = path.join(folder, entry.name);
      if (entry.isDirectory()) await visit(full);
      else if (entry.name.endsWith(suffix)) found.push(full);
    }
  }
  await visit(root);
  return found.sort();
}

function startServer() {
  const server = http.createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
      let target = path.resolve(publicRoot, `.${pathname}`);
      if (!target.startsWith(publicRoot + path.sep) && target !== publicRoot) throw new Error("outside root");
      const stat = await fs.stat(target);
      if (stat.isDirectory()) target = path.join(target, "index.html");
      const data = await fs.readFile(target);
      response.writeHead(200, { "content-type": mime[path.extname(target)] || "application/octet-stream" });
      response.end(data);
    } catch {
      response.writeHead(404, { "content-type": "text/plain" });
      response.end("Not found");
    }
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function sweepLabs(page) {
  return page.evaluate(() => {
    const result = { states: 0, issues: [] };
    function values(input) {
      const output = [];
      const min = +input.min, max = +input.max, step = +input.step;
      for (let value = min; value <= max + step / 10; value += step) output.push(+value.toFixed(8));
      return output;
    }
    function fire(input, value) {
      input.value = value;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
    function check(lab, label) {
      result.states++;
      if (/NaN|Infinity/.test(lab.textContent)) result.issues.push(`${label}: non-finite value`);
      lab.querySelectorAll("svg").forEach((svg, svgIndex) => {
        const view = svg.viewBox.baseVal;
        const elements = Array.from(svg.querySelectorAll("text")).filter((item) => item.getBBox().width > 0);
        const boxes = elements.map((item) => item.getBBox());
        boxes.forEach((box, index) => {
          if (box.x < view.x - 1 || box.y < view.y - 1 ||
              box.x + box.width > view.x + view.width + 1 ||
              box.y + box.height > view.y + view.height + 1) {
            result.issues.push(`${label}: SVG ${svgIndex} text ${index} outside viewBox`);
          }
        });
        for (let first = 0; first < boxes.length; first++) {
          for (let second = first + 1; second < boxes.length; second++) {
            const a = boxes[first], b = boxes[second];
            const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
            const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
            if (overlapX > 1 && overlapY > 1) {
              result.issues.push(`${label}: SVG ${svgIndex} text ${first}/${second} overlap`);
            }
          }
        }
      });
    }

    const labs = Array.from(document.querySelectorAll(".lab[data-widget]"));
    if (labs.length !== 7) result.issues.push(`expected 7 labs, found ${labs.length}`);
    const lineInputs = Array.from(labs[0].querySelectorAll('input[type="range"]'));
    for (const slope of values(lineInputs[0])) {
      for (const intercept of values(lineInputs[1])) {
        fire(lineInputs[0], slope); fire(lineInputs[1], intercept);
        check(labs[0], `line ${slope}/${intercept}`);
        if (result.issues.length) return result;
      }
    }
    for (let labIndex = 1; labIndex < labs.length - 1; labIndex++) {
      const lab = labs[labIndex];
      const ranges = Array.from(lab.querySelectorAll('input[type="range"]'));
      const selects = Array.from(lab.querySelectorAll("select"));
      for (let rangeIndex = 0; rangeIndex < ranges.length; rangeIndex++) {
        for (const value of values(ranges[rangeIndex])) {
          fire(ranges[rangeIndex], value);
          check(lab, `${lab.dataset.widget} range ${rangeIndex}/${value}`);
          if (result.issues.length) return result;
        }
      }
      for (let selectIndex = 0; selectIndex < selects.length; selectIndex++) {
        for (let value = 0; value < selects[selectIndex].options.length; value++) {
          selects[selectIndex].value = value;
          selects[selectIndex].dispatchEvent(new Event("input", { bubbles: true }));
          check(lab, `${lab.dataset.widget} select ${selectIndex}/${value}`);
          if (result.issues.length) return result;
        }
      }
    }
    return result;
  });
}

async function main() {
  const htmlFiles = await filesUnder(siteDir, ".html");
  if (htmlFiles.length !== 28) throw new Error(`expected 28 HTML pages, found ${htmlFiles.length}`);
  const server = await startServer();
  const address = server.address();
  const origin = `http://127.0.0.1:${address.port}`;
  const browser = await chromium.launch({ headless: true });
  const errors = [];
  try {
    const page = await browser.newPage();
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(`console: ${message.text()}`);
    });
    page.on("pageerror", (error) => errors.push(`page: ${error.message}`));

    for (const file of htmlFiles) {
      const relative = path.relative(publicRoot, file).replaceAll(path.sep, "/");
      for (const viewport of [{ width: 1440, height: 1000 }, { width: 375, height: 812 }]) {
        await page.setViewportSize(viewport);
        const response = await page.goto(`${origin}/${relative}`, { waitUntil: "load" });
        if (!response || response.status() !== 200) errors.push(`${relative}: HTTP ${response?.status()}`);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth
        );
        if (overflow) errors.push(`${relative}: page overflow at ${viewport.width}px`);
        if (await page.locator("h1").count() === 0) errors.push(`${relative}: missing h1`);
      }
    }

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${origin}/mathSystem/lab.html`, { waitUntil: "load" });
    const sweep = await sweepLabs(page);
    errors.push(...sweep.issues);

    await page.goto(`${origin}/mathSystem/progress.html`, { waitUntil: "load" });
    await page.evaluate(() => localStorage.removeItem("atlas.progress.v1"));
    await page.reload({ waitUntil: "load" });
    if (await page.locator("button.chip").count() !== 114) errors.push("Chinese progress page does not have 114 items");
    const first = page.locator("button.chip").first();
    await first.click(); await first.click();
    if (await first.getAttribute("data-s") !== "2") errors.push("progress state did not reach mastered");
    await page.goto(`${origin}/mathSystem/de/fortschritt.html`, { waitUntil: "load" });
    if (await page.locator("button.chip").count() !== 114) errors.push("German progress page does not have 114 items");
    if (await page.locator("button.chip").first().getAttribute("data-s") !== "2") {
      errors.push("progress state did not persist across languages");
    }
    await page.evaluate(() => localStorage.removeItem("atlas.progress.v1"));

    if (errors.length) throw new Error(errors.join("\n"));
    console.log(`browser validation passed: ${htmlFiles.length} pages, ${sweep.states} lab states, 114 bilingual progress items`);
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
