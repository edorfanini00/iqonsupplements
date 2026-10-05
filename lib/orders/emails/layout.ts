/**
 * Shared IQON email chrome: table layout, 600px max, inline styles, Outlook
 * conditionals, dark mode handling and a hidden preheader. Every dynamic value
 * that reaches these helpers is escaped here or by the caller via escapeHtml.
 *
 * Palette and type follow app/globals.css: ink #242526 on paper #fbfcfd,
 * hairlines #dbdcdd, muted #707172, serif headings (Lora, Georgia fallback),
 * Inter/Helvetica body, small tracked uppercase eyebrows.
 */
import { addressLines, escapeHtml, formatMoney, isZero } from "./format";
import type { EmailAddress, EmailBrandConfig, EmailLineItem, OrderSnapshot } from "./types";

export const INK = "#242526";
export const PAPER = "#fbfcfd";
export const CARD = "#ffffff";
export const LINE = "#dbdcdd";
export const MUTED = "#707172";
export const TILE = "#f0f1f2";

const SANS = "Inter,'Helvetica Neue',Helvetica,Arial,sans-serif";
const SERIF = "Lora,Georgia,'Times New Roman',serif";

export function lineItemPlaceholder(brand: EmailBrandConfig): string {
  return `${brand.assetOrigin}/images/email/products/placeholder.jpg`;
}

export function shell(opts: { title: string; preheader: string; body: string; brand: EmailBrandConfig }): string {
  const { brand } = opts;
  const logo = `${brand.assetOrigin}/images/email/iqon-wordmark-ink.png`;
  // Filler stops clients pulling body copy into the inbox preview after the preheader.
  const filler = "&#847;&zwnj;&nbsp;".repeat(60);
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no, url=no">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(opts.title)}</title>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<style>table,td,div,p,a,span{font-family:Arial,Helvetica,sans-serif !important;}</style>
<![endif]-->
<style>
@font-face{font-family:Lora;font-style:normal;font-weight:400;src:url('${brand.assetOrigin}/fonts/lora-latin.woff2') format('woff2');}
@font-face{font-family:Inter;font-style:normal;font-weight:100 900;src:url('${brand.assetOrigin}/fonts/inter-latin.woff2') format('woff2');}
:root{color-scheme:light dark;supported-color-schemes:light dark;}
body{margin:0 !important;padding:0 !important;width:100% !important;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
table{border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;}
img{border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;display:block;}
a{text-decoration:none;}
a[x-apple-data-detectors]{color:inherit !important;text-decoration:none !important;}
u + #body a{color:inherit;text-decoration:none;}
@media screen and (max-width:620px){
  .container{width:100% !important;}
  .pad{padding-left:24px !important;padding-right:24px !important;}
  .stack{display:block !important;width:100% !important;max-width:100% !important;box-sizing:border-box;}
  .stack-gap{padding-top:24px !important;}
  .h1{font-size:30px !important;line-height:36px !important;}
  .thumb img{width:64px !important;height:80px !important;}
  .btn-full{width:100% !important;}
}
@media (prefers-color-scheme:dark){
  .bg-page{background:#121314 !important;}
  .bg-card{background:#1c1d1e !important;}
  .bg-tile{background:#262728 !important;}
  .t-ink{color:#f2f3f4 !important;}
  .t-muted{color:#a9aaab !important;}
  .b-line{border-color:#3a3b3c !important;}
  .btn-bg{background:#f2f3f4 !important;border-color:#f2f3f4 !important;}
  .btn-t{color:#242526 !important;}
}
[data-ogsc] .t-ink{color:#f2f3f4 !important;}
[data-ogsc] .t-muted{color:#a9aaab !important;}
[data-ogsb] .bg-page{background:#121314 !important;}
[data-ogsb] .bg-card{background:#1c1d1e !important;}
[data-ogsb] .bg-tile{background:#262728 !important;}
[data-ogsb] .btn-bg{background:#f2f3f4 !important;}
[data-ogsc] .btn-t{color:#242526 !important;}
</style>
</head>
<body id="body" class="bg-page" style="margin:0;padding:0;background:${PAPER};">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;color:${PAPER};">${escapeHtml(opts.preheader)}${filler}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="bg-page" bgcolor="${PAPER}" style="background:${PAPER};">
<tr><td align="center" style="padding:32px 12px 40px 12px;">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td><![endif]-->
<table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">
<tr><td bgcolor="${INK}" style="background:${INK};padding:26px 40px;" class="pad">
<a href="${escapeHtml(brand.siteUrl)}" target="_blank" style="display:inline-block;"><img src="${escapeHtml(logo)}" width="96" height="33" alt="IQON" style="width:96px;height:33px;color:#ffffff;font-family:${SERIF};font-size:24px;letter-spacing:4px;"></a>
</td></tr>
<tr><td class="bg-card pad b-line" bgcolor="${CARD}" style="background:${CARD};padding:44px 40px 40px 40px;border-left:1px solid ${LINE};border-right:1px solid ${LINE};">
${opts.body}
</td></tr>
<tr><td class="bg-card pad b-line" bgcolor="${CARD}" style="background:${CARD};padding:28px 40px 32px 40px;border:1px solid ${LINE};border-top:1px solid ${LINE};">
<p class="t-muted" style="margin:0 0 8px 0;font-family:${SANS};font-size:12px;line-height:18px;letter-spacing:1.4px;text-transform:uppercase;color:${MUTED};">IQON Supplements &amp; Skincare</p>
<p class="t-muted" style="margin:0;font-family:${SANS};font-size:12px;line-height:18px;color:${MUTED};">You are receiving this email because you placed an order with IQON.<br><a href="${escapeHtml(brand.siteUrl)}" class="t-muted" style="color:${MUTED};text-decoration:underline;">${escapeHtml(displayHost(brand.siteUrl))}</a></p>
</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>`;
}

function displayHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function eyebrow(text: string): string {
  return `<p class="t-muted" style="margin:0 0 14px 0;font-family:${SANS};font-size:12px;line-height:18px;letter-spacing:1.4px;text-transform:uppercase;color:${MUTED};">${escapeHtml(text)}</p>`;
}

export function heading(text: string): string {
  return `<h1 class="h1 t-ink" style="margin:0 0 18px 0;font-family:${SERIF};font-size:34px;line-height:40px;font-weight:400;letter-spacing:-0.8px;color:${INK};">${escapeHtml(text)}</h1>`;
}

export function paragraph(text: string, opts: { muted?: boolean; last?: boolean } = {}): string {
  const color = opts.muted ? MUTED : INK;
  return `<p class="${opts.muted ? "t-muted" : "t-ink"}" style="margin:0 0 ${opts.last ? 0 : 16}px 0;font-family:${SANS};font-size:15px;line-height:24px;color:${color};">${escapeHtml(text)}</p>`;
}

export function sectionTitle(text: string): string {
  return `<p class="t-muted" style="margin:0 0 4px 0;font-family:${SANS};font-size:12px;line-height:18px;letter-spacing:1.4px;text-transform:uppercase;color:${MUTED};">${escapeHtml(text)}</p>`;
}

export function spacer(px: number): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="height:${px}px;line-height:${px}px;font-size:0;">&nbsp;</td></tr></table>`;
}

/** Bulletproof button: VML roundrect for Outlook, padded link everywhere else. */
export function button(href: string, label: string): string {
  const safeHref = escapeHtml(href);
  const safeLabel = escapeHtml(label);
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" class="btn-full"><tr><td>
<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safeHref}" style="height:48px;v-text-anchor:middle;width:260px;" arcsize="6%" stroke="f" fillcolor="${INK}"><w:anchorlock/><center style="color:#ffffff;font-family:Arial,sans-serif;font-size:15px;">${safeLabel}</center></v:roundrect><![endif]-->
<!--[if !mso]><!--><a href="${safeHref}" target="_blank" class="btn-bg btn-t btn-full" style="display:inline-block;box-sizing:border-box;background:${INK};border:1px solid ${INK};border-radius:3px;color:#ffffff;font-family:${SANS};font-size:15px;line-height:20px;font-weight:500;letter-spacing:0.2px;text-align:center;padding:14px 32px;mso-hide:all;"><span class="btn-t" style="color:#ffffff;">${safeLabel}</span></a><!--<![endif]-->
</td></tr></table>`;
}

export function textLink(href: string, label: string): string {
  return `<p style="margin:0;font-family:${SANS};font-size:14px;line-height:22px;"><a href="${escapeHtml(href)}" target="_blank" class="t-ink" style="color:${INK};text-decoration:underline;">${escapeHtml(label)}</a></p>`;
}

function hiddenVariant(title: string | null): boolean {
  return !title || title.trim().toLowerCase() === "default title";
}

export function lineItemMeta(item: EmailLineItem): string[] {
  const meta: string[] = [];
  if (!hiddenVariant(item.variantTitle)) meta.push(item.variantTitle!.trim());
  meta.push(`Qty ${item.quantity}`);
  return meta;
}

export function subscriptionLabel(item: EmailLineItem): string | null {
  return item.sellingPlanName ? `Subscription: ${item.sellingPlanName}` : null;
}

export function lineItemsTable(items: EmailLineItem[], opts: { currency: string; showPrices: boolean; brand: EmailBrandConfig }): string {
  const rows = items
    .map((item, index) => {
      const img = item.imageUrl ?? lineItemPlaceholder(opts.brand);
      const border = index === 0 ? "" : `border-top:1px solid ${LINE};`;
      const plan = subscriptionLabel(item);
      const price = opts.showPrices
        ? `<td class="t-ink b-line" valign="top" align="right" style="padding:18px 0 18px 12px;${border}font-family:${SANS};font-size:15px;line-height:22px;color:${INK};white-space:nowrap;">${escapeHtml(formatMoney(item.lineTotal, opts.currency))}</td>`
        : "";
      return `<tr>
<td class="thumb b-line" valign="top" width="72" style="width:72px;padding:18px 0;${border}"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td class="bg-tile" bgcolor="${TILE}" style="background:${TILE};border-radius:3px;"><img src="${escapeHtml(img)}" width="72" height="90" alt="${escapeHtml(item.title)}" style="width:72px;height:90px;border-radius:3px;object-fit:cover;font-family:${SANS};font-size:11px;color:${MUTED};"></td></tr></table></td>
<td class="b-line" valign="top" style="padding:18px 0 18px 16px;${border}">
<p class="t-ink" style="margin:0 0 4px 0;font-family:${SANS};font-size:15px;line-height:22px;font-weight:500;color:${INK};">${escapeHtml(item.title)}</p>
<p class="t-muted" style="margin:0;font-family:${SANS};font-size:13px;line-height:20px;color:${MUTED};">${lineItemMeta(item).map(escapeHtml).join(" &nbsp;&middot;&nbsp; ")}</p>
${plan ? `<p class="t-muted" style="margin:4px 0 0 0;font-family:${SANS};font-size:13px;line-height:20px;color:${MUTED};">${escapeHtml(plan)}</p>` : ""}
</td>
${price}
</tr>`;
    })
    .join("\n");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>`;
}

export interface TotalRow {
  label: string;
  value: string;
  strong?: boolean;
}

export function totalRows(order: OrderSnapshot): TotalRow[] {
  const c = order.currency;
  const rows: TotalRow[] = [{ label: "Subtotal", value: formatMoney(order.subtotal, c) }];
  if (!isZero(order.discounts)) {
    const codes = order.discountCodes.filter(Boolean);
    rows.push({ label: codes.length ? `Discount (${codes.join(", ")})` : "Discount", value: `${formatMoney(order.discounts, c)} off` });
  }
  rows.push({ label: "Shipping", value: isZero(order.shipping) ? "Free" : formatMoney(order.shipping, c) });
  if (order.taxesIncluded) rows.push({ label: "Tax", value: isZero(order.tax) ? "Included" : `${formatMoney(order.tax, c)} included` });
  else rows.push({ label: "Tax", value: formatMoney(order.tax, c) });
  rows.push({ label: "Total", value: `${formatMoney(order.total, c)} ${c}`, strong: true });
  return rows;
}

export function totalsTable(order: OrderSnapshot): string {
  const rows = totalRows(order)
    .map((row) => {
      const size = row.strong ? 17 : 14;
      const pad = row.strong ? `padding:16px 0 0 0;border-top:1px solid ${LINE};` : "padding:5px 0;";
      const color = row.strong ? INK : MUTED;
      const cls = row.strong ? "t-ink b-line" : "t-muted";
      const weight = row.strong ? 500 : 400;
      return `<tr><td class="${cls}" style="${pad}font-family:${SANS};font-size:${size}px;line-height:22px;font-weight:${weight};color:${color};">${escapeHtml(row.label)}</td><td class="${row.strong ? "t-ink b-line" : "t-ink"}" align="right" style="${pad}font-family:${SANS};font-size:${size}px;line-height:22px;font-weight:${weight};color:${INK};white-space:nowrap;">${escapeHtml(row.value)}</td></tr>`;
    })
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="b-line" style="border-top:1px solid ${LINE};"><tr><td style="height:14px;line-height:14px;font-size:0;" colspan="2">&nbsp;</td></tr>${rows}</table>`;
}

export function addressHtml(address: EmailAddress | null): string {
  const lines = addressLines(address);
  if (!lines.length) return "";
  return `<p class="t-ink" style="margin:6px 0 0 0;font-family:${SANS};font-size:14px;line-height:22px;color:${INK};">${lines.map(escapeHtml).join("<br>")}</p>`;
}

/** Two columns on desktop that stack on phones. */
export function twoColumns(left: string, right: string): string {
  if (!right) return left;
  if (!left) return right;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td class="stack" valign="top" width="50%" style="width:50%;padding-right:16px;">${left}</td>
<td class="stack stack-gap" valign="top" width="50%" style="width:50%;">${right}</td>
</tr></table>`;
}

export function detailBlock(title: string, valueHtml: string): string {
  return `${sectionTitle(title)}${valueHtml}`;
}

export function detailValue(text: string): string {
  return `<p class="t-ink" style="margin:6px 0 0 0;font-family:${SANS};font-size:14px;line-height:22px;color:${INK};word-break:break-word;">${escapeHtml(text)}</p>`;
}

export function supportBlock(brand: EmailBrandConfig): string {
  const email = escapeHtml(brand.supportEmail);
  return detailBlock("Need a hand?", `<p class="t-ink" style="margin:6px 0 0 0;font-family:${SANS};font-size:14px;line-height:22px;color:${INK};">Reply to this email or write to us at<br><a href="mailto:${email}" class="t-ink" style="color:${INK};text-decoration:underline;">${email}</a></p>`);
}

export function supportText(brand: EmailBrandConfig): string {
  return `Need a hand? Reply to this email or write to us at ${brand.supportEmail}.`;
}

export function textAddress(address: EmailAddress | null): string {
  return addressLines(address).join("\n");
}

export function textLineItems(items: EmailLineItem[], currency: string, showPrices: boolean): string {
  return items
    .map((item) => {
      const meta = lineItemMeta(item).join(", ");
      const plan = subscriptionLabel(item);
      const price = showPrices ? `  ${formatMoney(item.lineTotal, currency)}` : "";
      return `${item.title}${price}\n  ${meta}${plan ? `\n  ${plan}` : ""}`;
    })
    .join("\n\n");
}
