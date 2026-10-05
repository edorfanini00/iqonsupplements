/**
 * Send the three order email previews to the owner's inbox for visual QA.
 *
 *   RESEND_API_KEY=... node --import tsx scripts/send-order-email-preview.ts \
 *     [--to edorfanini@icloud.com] [--from "IQON <orders@iqonhealth.com>"] [--asset-base https://...]
 *
 * Hard allowlist: refuses any recipient other than the owner. Subjects are
 * prefixed with [TEST]. --asset-base lets previews load images from a pushed
 * commit (raw.githubusercontent.com/.../public) before /images/email/* is
 * deployed to www.iqonbody.com. Never prints the API key.
 */
import { Resend } from "resend";
import { brandConfig } from "../lib/orders/emails/format";
import { buildPreviews } from "./order-email-preview-data";

const ALLOWED_RECIPIENTS = new Set(["edorfanini@icloud.com"]);

const args = process.argv.slice(2);
const flag = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const to = (flag("--to") ?? "edorfanini@icloud.com").trim().toLowerCase();
const from = flag("--from") ?? "IQON <orders@iqonhealth.com>";
const assetBase = flag("--asset-base");

if (!ALLOWED_RECIPIENTS.has(to)) {
  console.error(`Refusing to send to ${to}: preview emails may only go to the owner allowlist.`);
  process.exit(2);
}
const apiKey = process.env.RESEND_API_KEY?.trim() || process.env.SUPPLEMENTS_RESEND_API_KEY?.trim();
if (!apiKey) {
  console.error("Set RESEND_API_KEY (or SUPPLEMENTS_RESEND_API_KEY) to send previews.");
  process.exit(2);
}
if (assetBase && !/^https:\/\//.test(assetBase)) {
  console.error("--asset-base must be an https URL.");
  process.exit(2);
}

const brand = { ...brandConfig({}), ...(assetBase ? { assetOrigin: assetBase.replace(/\/$/, "") } : {}) };
const resend = new Resend(apiKey);
const runId = new Date().toISOString();
let failed = false;
for (const { slug, email } of buildPreviews(brand)) {
  const result = await resend.emails.send(
    { from, to, subject: `[TEST] ${email.subject}`, html: email.html, text: email.text, replyTo: brand.supportEmail, tags: [{ name: "category", value: "order_email_preview" }] },
    { idempotencyKey: `preview/${slug}/${runId}` },
  );
  if (result.error) {
    failed = true;
    console.error(`${slug}: FAILED ${result.error.name} ${result.error.message}`);
  } else {
    console.log(`${slug}: sent id=${result.data?.id}`);
  }
}
process.exit(failed ? 1 : 0);
