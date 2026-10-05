/**
 * Render the order email previews to HTML and (optionally) PNG screenshots.
 *
 *   node --import tsx scripts/render-order-email-previews.ts --out docs/emails [--screenshots] [--asset-origin http://127.0.0.1:8765]
 *
 * The saved HTML always points at the production asset origin
 * (https://www.iqonbody.com). --asset-origin only affects screenshots, so they
 * can load public/ from a local static server before the assets are deployed.
 * Screenshots use headless Chrome at 390px (mobile) and 1280px (desktop),
 * plus a dark mode emulation at 390px.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { brandConfig } from "../lib/orders/emails/format";
import { buildPreviews } from "./order-email-preview-data";

const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const args = process.argv.slice(2);
const flag = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const out = resolve(flag("--out") ?? "docs/emails");
const shotOrigin = flag("--asset-origin");
mkdirSync(out, { recursive: true });

const production = brandConfig({});
for (const { slug, email } of buildPreviews(production)) {
  writeFileSync(join(out, `${slug}.html`), email.html);
  writeFileSync(join(out, `${slug}.txt`), `Subject: ${email.subject}\nPreheader: ${email.preheader}\n\n${email.text}\n`);
  console.log(`wrote ${slug}.html / .txt  subject="${email.subject}"`);
}

if (args.includes("--screenshots")) {
  if (!existsSync(CHROME)) throw new Error(`Chrome not found at ${CHROME}`);
  const brand = shotOrigin ? { ...production, assetOrigin: shotOrigin.replace(/\/$/, "") } : production;
  const tmp = mkdtempSync(join(tmpdir(), "iqon-email-shots-"));
  const variants = [
    { suffix: "mobile-390", width: 390, dark: false },
    { suffix: "desktop-1280", width: 1280, dark: false },
    { suffix: "mobile-390-dark", width: 390, dark: true },
  ];
  for (const { slug, email } of buildPreviews(brand)) {
    const file = join(tmp, `${slug}.html`);
    writeFileSync(file, email.html);
    for (const v of variants) {
      const png = join(out, `${slug}-${v.suffix}.png`);
      execFileSync(CHROME, [
        "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check",
        `--user-data-dir=${mkdtempSync(join(tmp, "profile-"))}`,
        ...(v.dark ? ["--force-dark-mode", "--blink-settings=preferredColorScheme=0"] : ["--blink-settings=preferredColorScheme=1"]),
        "--virtual-time-budget=4000", "--force-device-scale-factor=2",
        `--window-size=${v.width},2400`, `--screenshot=${png}`, `file://${file}`,
      ], { stdio: "ignore", timeout: 60_000 });
      console.log(`shot ${png}`);
    }
  }
}
