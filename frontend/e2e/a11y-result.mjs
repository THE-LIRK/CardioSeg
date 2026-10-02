// Audit axe-core de /result avec un résultat de segmentation (volumes NIfTI synthétiques,
// 32³ voxels, labels 0-9). Usage : BASE_URL=http://localhost:3000 node e2e/a11y-result.mjs
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { gzipSync } from "node:zlib";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const N = 32;

function nifti(fill) {
  const buf = Buffer.alloc(352 + N * N * N);
  buf.writeInt32LE(348, 0);
  [3, N, N, N, 1, 1, 1, 1].forEach((v, i) => buf.writeInt16LE(v, 40 + 2 * i));
  buf.writeInt16LE(2, 70); // uint8
  buf.writeInt16LE(8, 72);
  [1, 1, 1, 1, 1, 1, 1, 1].forEach((v, i) => buf.writeFloatLE(v, 76 + 4 * i));
  buf.writeFloatLE(352, 108);
  buf.writeFloatLE(1, 112);
  buf.writeInt16LE(0, 252);
  buf.writeInt16LE(1, 254); // sform
  buf.writeFloatLE(1, 280);
  buf.writeFloatLE(1, 304);
  buf.writeFloatLE(1, 328);
  buf.write("n+1\0", 344, "binary");
  for (let z = 0; z < N; z++)
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) buf[352 + x + N * (y + N * z)] = fill(x, y, z);
  return gzipSync(buf);
}
// IRM/scanner factice : dégradé ; masque : 9 blocs étiquetés 1..9
const original = nifti((x, y, z) => 40 + ((x + y + z) * 2) % 200);
const mask = nifti((x, y, z) => {
  const bx = Math.floor(x / 8), by = Math.floor(y / 8);
  if (z < 8 || z > 24 || bx === 0 || bx === 3 || by === 0 || by === 3) return 0;
  return 1 + ((bx - 1) * 2 + (by - 1)) % 9;
});

let failures = 0;
async function audit(page, label) {
  const r = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  console.log(`== ${label} : ${r.violations.length} violation(s)`);
  for (const v of r.violations) {
    failures++;
    console.log(`  [${v.impact}] ${v.id} — ${v.help}`);
    for (const n of v.nodes.slice(0, 4)) {
      console.log(`     ${n.target.join(" ")}`);
      console.log(`     ${(n.failureSummary || "").split("\n").slice(1, 3).join(" | ")}`);
    }
  }
}

const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
for (const scheme of ["light", "dark"]) {
  const context = await browser.newContext({ colorScheme: scheme, viewport: { width: 1200, height: 1000 } });
  await context.addInitScript(
    ({ o, m }) => {
      const blob = (b64) => {
        const bin = atob(b64);
        const u8 = Uint8Array.from(bin, (c) => c.charCodeAt(0));
        return URL.createObjectURL(new Blob([u8]));
      };
      sessionStorage.setItem(
        "segResult",
        JSON.stringify({
          downloadUrl: blob(m),
          originalUrl: blob(o),
          fileName: "scan_seg.nii.gz",
          originalName: "scan.nii.gz",
          originalSize: 93.8 * 1024 * 1024,
          resultSize: 41 * 1024,
          processingTime: "58.3s",
        })
      );
    },
    { o: original.toString("base64"), m: mask.toString("base64") }
  );
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(`${BASE}/result`);
  await page.getByText("Structures segmentées").waitFor();
  await page.waitForTimeout(1800);
  await audit(page, `/result choix du mode [${scheme}]`);

  await page.getByRole("button", { name: /Coupes 2D/ }).click();
  await page.getByText("Chargement du viewer...").waitFor({ state: "detached", timeout: 30000 });
  await page.waitForTimeout(1000);
  await audit(page, `/result viewer 2D [${scheme}]`);

  await page.getByRole("button", { name: /Activer la vue 3D/ }).click();
  await page.getByText("Chargement du viewer...").waitFor({ state: "detached", timeout: 30000 });
  await page.waitForTimeout(1000);
  await page.mouse.wheel(0, 3000);
  await page.getByText("Comment visualiser le résultat").waitFor();
  await page.waitForTimeout(1200);
  await audit(page, `/result viewer 3D + aide [${scheme}]`);
  if (scheme === "light") await page.screenshot({ path: process.env.SHOT || "result-light.png", fullPage: true });
  if (errors.length) console.log("  erreurs page :", errors.slice(0, 3));
  await context.close();
}
await browser.close();
console.log(failures ? `\n${failures} violation(s)` : "\nAucune violation");
process.exit(failures ? 1 : 0);
