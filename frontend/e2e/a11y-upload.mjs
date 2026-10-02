// Audit axe-core de /upload dans ses différents états (thèmes clair et sombre du système).
// Usage : node e2e/a11y-upload.mjs  (serveur Next sur BASE_URL, par défaut http://localhost:3100)
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const BASE = process.env.BASE_URL || "http://localhost:3100";
const SUPABASE_REF = "dummy"; // https://dummy.supabase.co

const session = {
  access_token: "a.b.c",
  refresh_token: "r",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: {
    id: "00000000-0000-0000-0000-000000000001",
    aud: "authenticated",
    role: "authenticated",
    email: "test@example.com",
    app_metadata: {},
    user_metadata: {},
    created_at: new Date().toISOString(),
  },
};
const cookieValue =
  "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");

let failures = 0;

async function audit(page, label) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  console.log(`\n== ${label} : ${results.violations.length} violation(s)`);
  for (const v of results.violations) {
    failures++;
    console.log(`  [${v.impact}] ${v.id} — ${v.help}`);
    for (const n of v.nodes.slice(0, 4)) {
      console.log(`     ${n.target.join(" ")}`);
      console.log(`     ${(n.failureSummary || "").split("\n").slice(1, 3).join(" | ")}`);
    }
  }
}

const browser = await chromium.launch();
for (const scheme of ["light", "dark"]) {
  const context = await browser.newContext({ colorScheme: scheme });
  await context.addCookies([
    { name: `sb-${SUPABASE_REF}-auth-token`, value: cookieValue, url: BASE },
  ]);
  const page = await context.newPage();
  await page.route("**/api/credits?**", (r) =>
    r.fulfill({
      json: { credits: 1, freeUsedThisMonth: 0, freeRemaining: 2, totalAvailable: 2 },
    })
  );
  await page.goto(`${BASE}/upload`);
  await page.getByText("Crédits :").waitFor();
  await page.waitForTimeout(1500); // fin des animations d'entrée

  await audit(page, `/upload idle [${scheme}]`);

  // Fichier sélectionné
  await page.setInputFiles('input[type="file"]', {
    name: "scan_cardiaque.nii.gz",
    mimeType: "application/gzip",
    buffer: Buffer.alloc(1024 * 1024 * 3),
  });
  await page.getByText("scan_cardiaque.nii.gz").waitFor();
  await page.waitForTimeout(1000);
  await audit(page, `/upload fichier sélectionné [${scheme}]`);

  // Erreur : format invalide
  await page.getByText("Changer de fichier").click();
  await page.setInputFiles('input[type="file"]', {
    name: "image.png",
    mimeType: "image/png",
    buffer: Buffer.from("x"),
  });
  await page.waitForTimeout(500);
  await audit(page, `/upload après fichier invalide [${scheme}]`);

  // Erreur serveur : upload d'un fichier valide, API simulée en 500
  await page.route("**/api/credits/consume", (r) => r.fulfill({ json: { ok: true } }));
  await page.route("**/modal.run/**", (r) => r.fulfill({ status: 500, body: "err" }));
  await page.setInputFiles('input[type="file"]', {
    name: "scan.nii.gz",
    mimeType: "application/gzip",
    buffer: Buffer.alloc(1024 * 1024),
  });
  await page.getByRole("button", { name: /Lancer la segmentation/ }).click();
  await page.getByRole("alert").waitFor({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(800);
  await audit(page, `/upload erreur serveur [${scheme}]`);

  await context.close();
}
await browser.close();
console.log(failures ? `\n${failures} violation(s)` : "\nAucune violation");
process.exit(failures ? 1 : 0);
