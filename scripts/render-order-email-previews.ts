/**
 * Render the order email previews to HTML and (optionally) PNG screenshots.
 *
 *   node --import tsx scripts/render-order-email-previews.ts --out docs/emails [--screenshots] [--asset-origin http://127.0.0.1:8765]
 *
 * The saved HTML always points at the production asset origin
 * (https://www.iqonbody.com). --asset-origin only affects screenshots, so they
 * can load public/ from a local static server before the assets are deployed.
 * Screenshots: 390px (mobile) and 1280px (desktop), plus prefers-color-scheme
 * dark at 390px, all at 2x.
 *
 * Engine: Playwright (exact viewport, full page) when playwright-core can be
 * imported, from the project or from PLAYWRIGHT_CORE_PATH (for example an npx
 * cache copy); it drives the local Chrome. Otherwise plain headless Chrome
 * renders the email inside an iframe of the exact width (desktop headless
 * Chrome widens narrow windows) and the process is killed as soon as the PNG
 * is written, because `--screenshot` sometimes never exits.
 */
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
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

interface Variant { suffix: string; width: number; dark: boolean }
const VARIANTS: Variant[] = [
  { suffix: "mobile-390", width: 390, dark: false },
  { suffix: "desktop-1280", width: 1280, dark: false },
  { suffix: "mobile-390-dark", width: 390, dark: true },
];

type Shot = { file: string; png: string; v: Variant };

// Minimal slice of the playwright-core API used here (not a project dependency).
interface PwPage { goto(url: string, o: object): Promise<unknown>; screenshot(o: object): Promise<unknown> }
interface PwContext { newPage(): Promise<PwPage>; close(): Promise<void> }
interface PwBrowser { newContext(o: object): Promise<PwContext>; close(): Promise<void> }
interface Pw { chromium: { launch(o: object): Promise<PwBrowser> } }

async function loadPlaywright(): Promise<Pw | null> {
  for (const specifier of [process.env.PLAYWRIGHT_CORE_PATH, "playwright-core", "playwright"].filter(Boolean) as string[]) {
    try {
      const target = specifier.startsWith("/") ? pathToFileURL(join(specifier, "index.mjs")).href : specifier;
      const mod = (await import(target)) as Pw & { default?: Pw };
      return mod.chromium ? mod : mod.default ?? null;
    } catch {
      // try the next one
    }
  }
  return null;
}

async function shootWithPlaywright(pw: Pw, shots: Shot[]) {
  const browser = await pw.chromium.launch({ headless: true, ...(existsSync(CHROME) ? { executablePath: CHROME } : {}) });
  try {
    for (const { file, png, v } of shots) {
      const context = await browser.newContext({ viewport: { width: v.width, height: 900 }, deviceScaleFactor: 2, colorScheme: v.dark ? "dark" : "light" });
      try {
        const page = await context.newPage();
        await page.goto(pathToFileURL(file).href, { waitUntil: "networkidle", timeout: 30_000 });
        await page.screenshot({ path: png, fullPage: true });
      } finally {
        await context.close();
      }
      console.log(`shot ${png} (playwright)`);
    }
  } finally {
    await browser.close();
  }
}

/** Resolves once the PNG exists and its size has stopped changing, then kills Chrome. */
function chromeShot(argv: string[], png: string, timeoutMs = 60_000): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(CHROME, argv, { stdio: "ignore" });
    const started = Date.now();
    let lastSize = -1;
    const finish = (error?: Error) => {
      clearInterval(poll);
      if (child.exitCode === null) child.kill("SIGKILL");
      if (error) reject(error); else resolvePromise();
    };
    const poll = setInterval(() => {
      const size = existsSync(png) ? statSync(png).size : -1;
      if (size > 0 && size === lastSize) return finish();
      lastSize = size;
      if (Date.now() - started > timeoutMs) finish(new Error(`Chrome timed out on ${png}`));
    }, 500);
    child.on("error", (error) => finish(error));
  });
}

async function shootWithChrome(shots: Shot[], tmp: string) {
  if (!existsSync(CHROME)) throw new Error(`Chrome not found at ${CHROME}`);
  for (const { file, png, v } of shots) {
    const height = 3200;
    const wrapper = join(tmp, `frame-${v.suffix}-${Date.now()}.html`);
    writeFileSync(wrapper, `<!doctype html><html><body style="margin:0"><iframe src="${pathToFileURL(file).href}" style="display:block;border:0;width:${v.width}px;height:${height}px"></iframe></body></html>`);
    rmSync(png, { force: true });
    await chromeShot([
      "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check", "--allow-file-access-from-files",
      `--user-data-dir=${mkdtempSync(join(tmp, "profile-"))}`,
      `--blink-settings=preferredColorScheme=${v.dark ? 0 : 1}`,
      "--virtual-time-budget=4000", "--force-device-scale-factor=2",
      `--window-size=${Math.max(v.width, 600)},${height}`, `--screenshot=${png}`, pathToFileURL(wrapper).href,
    ], png);
    // Keep only the iframe column (2x scale); the height includes trailing page background.
    execFileSync("sips", ["--cropToHeightWidth", String(height * 2), String(v.width * 2), "--cropOffset", "0", "0", png], { stdio: "ignore" });
    console.log(`shot ${png} (chrome)`);
  }
}

if (args.includes("--screenshots")) {
  const brand = shotOrigin ? { ...production, assetOrigin: shotOrigin.replace(/\/$/, "") } : production;
  const tmp = mkdtempSync(join(tmpdir(), "iqon-email-shots-"));
  const shots: Shot[] = [];
  for (const { slug, email } of buildPreviews(brand)) {
    const file = join(tmp, `${slug}.html`);
    writeFileSync(file, email.html);
    for (const v of VARIANTS) shots.push({ file, png: join(out, `${slug}-${v.suffix}.png`), v });
  }
  const pw = args.includes("--chrome") ? null : await loadPlaywright();
  await (pw ? shootWithPlaywright(pw, shots) : shootWithChrome(shots, tmp));
  rmSync(tmp, { recursive: true, force: true });
}
