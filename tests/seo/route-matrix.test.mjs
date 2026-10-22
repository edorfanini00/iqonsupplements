// Indexability route matrix against the real production build (`npm run build:vercel`).
// Shopify is a MOCK (tests/seo/fake-shopify-hook.mjs); Host headers simulate the domains
// served by the one Vercel deployment. Proves routing/metadata behavior, NOT live Shopify.
//
//   npm run build:vercel && node --test --test-concurrency=1 tests/seo/route-matrix.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";

const root = fileURLToPath(new URL("../..", import.meta.url));
const WWW = "www.iqondaily.com";
const INDEXNOW_KEY = "4ebd9e4e989144ffebac389bceb45ce1785f3eb39a69832a0abf358c14c740e9";
const ALIASES = ["iqondaily.com", "www.iqonbody.com", "iqon-supplements-git-main.vercel.app"];
const work = fs.mkdtempSync(path.join(os.tmpdir(), "iqon-seo-matrix-"));
let nextPort = Number(process.env.SEO_MATRIX_PORT || 3961);

async function startServer(name, env) {
  const port = nextPort++;
  const out = fs.openSync(path.join(work, `${name}.log`), "a");
  const child = spawn(path.join(root, "node_modules/.bin/next"), ["start", "-p", String(port)], {cwd: root, stdio: ["ignore", out, out], env: {
    ...process.env, NODE_ENV: "production", SHOPIFY_STORE_DOMAIN: "", SHOPIFY_STOREFRONT_PRIVATE_TOKEN: "", NEXT_PUBLIC_META_PIXEL_ID: "",
    NODE_OPTIONS: `--import ${pathToFileURL(path.join(root, "tests/seo/fake-shopify-hook.mjs")).href}`, ...env,
  }});
  process.on("exit", () => child.kill("SIGTERM"));
  for (let i = 0; ; i++) {
    try {if ((await get(port, "/journal")).status) break;} catch {}
    if (i > 120) throw new Error(`next start (${name}) did not become ready; see ${work}/${name}.log`);
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return {port, stop: () => child.kill("SIGTERM")};
}
const live = {VERCEL_ENV: "production", FAKE_SHOPIFY: "live", SHOPIFY_STORE_DOMAIN: "iqon-test.myshopify.com", SHOPIFY_STOREFRONT_PRIVATE_TOKEN: "test-token"};

// fetch() cannot set Host; use http.request so each domain is simulated exactly.
function get(port, pathname, host = WWW, userAgent = "Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)") {
  return new Promise((resolve, reject) => {
    const req = http.request({host: "127.0.0.1", port, path: pathname, headers: {host, "user-agent": userAgent, accept: "text/html"}}, res => {
      let body = ""; res.setEncoding("utf8"); res.on("data", c => body += c);
      res.on("end", () => resolve({status: res.statusCode, headers: res.headers, body}));
    });
    req.on("error", reject); req.end();
  });
}
const head = html => html.split("</head>")[0];
const robotsMeta = html => head(html).match(/<meta name="robots" content="([^"]+)"/)?.[1];
// Next writes the root canonical without its trailing slash; compare normalized URLs.
const canonical = html => {const href = head(html).match(/<link rel="canonical" href="([^"]+)"/)?.[1]; return href && new URL(href).href;};
const jsonLd = html => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap(m => [JSON.parse(m[1])].flat());
const locs = xml => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
function assertIndexable(r, url) {
  assert.equal(r.status, 200, url);
  assert.equal(r.headers["x-robots-tag"], undefined, `${url} X-Robots-Tag`);
  assert.equal(robotsMeta(r.body), "index, follow", `${url} robots meta (in <head>)`);
  assert.equal(canonical(r.body), `https://${WWW}${url}`, `${url} canonical`);
}
function assertNoindex(r, url, {status = 200} = {}) {
  assert.equal(r.status, status, url);
  const meta = robotsMeta(r.body) || "";
  assert.ok(/noindex/.test(meta) || /noindex/.test(r.headers["x-robots-tag"] || ""), `${url} must be noindex (meta=${meta}, header=${r.headers["x-robots-tag"]})`);
}
const POLICY = slug => `/policies/${slug}`;
// Shopify's own page titles; the subscription policy page is titled "Cancellation policy".
const STORE_POLICY_LINKS = [["Shipping policy", POLICY("shipping-policy")], ["Refund policy", POLICY("refund-policy")], ["Cancellation policy", POLICY("subscription-policy")],
  ["Terms of service", POLICY("terms-of-service")], ["Contact information", POLICY("contact-information")]];
const PUBLIC = ["/", "/approach", "/help", "/journal", "/journal/reading-a-supplement-label", "/skincare", "/collections/all", "/collections/supplements", "/collections/skincare", "/products/creatine-monohydrate", "/products/anti-aging-cleanser-with-peptides", "/products/daily-travel-kit"];
const dom = html => new JSDOM(html).window.document;
/** In-page links whose target id is not in the server-rendered document. */
const brokenHashLinks = doc => [...doc.querySelectorAll('a[href^="#"]')].map(a => a.getAttribute("href")).filter(h => h.length > 1 && !doc.getElementById(decodeURIComponent(h.slice(1))));
/** Exact H1 copy: every `<br>` line break must still read as two words in textContent. */
const H1_TEXT = {"/": "For the life you want to live.", "/skincare": "A little care. A lot of you.", "/journal": "A little more understanding.",
  "/approach": "The everyday deserves attention.", "/reviews": "Your experience has a place here.", "/affiliates": "Good routines. Shared together."};
const h1s = doc => [...doc.querySelectorAll("h1")].map(h => h.textContent);
const SHIPPING_NOTE = "Shipping usually takes 3 to 5 days. Available shipping options and costs are shown at checkout.";
const SHOP_TRACKING_NOTE = "Tracking updates are available through Shop once your order is on its way.";
const PRIVATE = ["/checkout", "/account", "/account/orders", "/affiliates", "/affiliates/login", "/api/cart", "/api/affiliates/me", "/api/account/session"];

test("production, live catalog, canonical and alias hosts", async t => {
  const server = await startServer("live", live);
  t.after(server.stop);
  const {port} = server;

  await t.test("IndexNow key is served as exact public text and aliases remain noindex", async () => {
    const keyPath = `/${INDEXNOW_KEY}.txt`;
    const r = await get(port, keyPath);
    assert.equal(r.status, 200);
    assert.match(r.headers["content-type"] || "", /^text\/plain(?:;|$)/i);
    assert.equal(r.body, INDEXNOW_KEY, "no HTML wrapper, BOM or newline");
    assert.equal(r.headers.location, undefined, "canonical verification URL does not redirect");
    assert.equal(r.headers["x-robots-tag"], undefined);
    assert.ok(!locs((await get(port, "/sitemap.xml")).body).includes(`https://${WWW}${keyPath}`));
    for (const host of ALIASES) {
      const alias = await get(port, keyPath, host);
      assert.equal(alias.status, 200, host);
      assert.equal(alias.headers["x-robots-tag"], "noindex", host);
    }
  });
  await t.test("public pages are indexable with www canonical in <head>", async () => {
    for (const url of PUBLIC) assertIndexable(await get(port, url), url);
  });
  await t.test("query parameters canonicalize to the clean URL", async () => {
    const r = await get(port, "/collections/supplements?format=powder&sort=price");
    assert.equal(canonical(r.body), `https://${WWW}/collections/supplements`);
  });
  await t.test("thin, placeholder and missing pages stay out", async () => {
    assertNoindex(await get(port, "/reviews"), "/reviews");
    assertNoindex(await get(port, "/reviews?collection=skincare"), "/reviews?collection");
    assertNoindex(await get(port, "/products/keto-5"), "editorial-only product");
    assertNoindex(await get(port, "/products/not-a-product"), "missing product", {status: 404});
    assertNoindex(await get(port, "/journal/not-an-article"), "missing article", {status: 404});
    assertNoindex(await get(port, "/collections/nope"), "missing collection", {status: 404});
  });
  await t.test("private paths send X-Robots-Tag noindex, nofollow", async () => {
    for (const url of PRIVATE) {
      const r = await get(port, url);
      assert.match(r.headers["x-robots-tag"] || "", /noindex, nofollow/, `${url} (status ${r.status})`);
    }
  });
  await t.test("legacy and Vercel hosts: same 200 page, no redirect, noindex + www canonical", async () => {
    for (const host of ALIASES) for (const url of ["/", "/products/creatine-monohydrate", "/journal"]) {
      const r = await get(port, url, host);
      assert.equal(r.status, 200, `${host}${url} must not redirect`);
      assert.equal(r.headers["x-robots-tag"], "noindex", `${host}${url}`);
      assert.equal(robotsMeta(r.body), "noindex, follow", `${host}${url}`);
      assert.match(canonical(r.body), new RegExp(`^https://${WWW.replace(/\./g, "\\.")}/`));
    }
  });
  await t.test("robots.txt and sitemap.xml are valid and in sync", async () => {
    const robots = await get(port, "/robots.txt");
    assert.equal(robots.status, 200);
    assert.match(robots.body, /User-Agent: \*\nAllow: \/\nDisallow: \/account\nDisallow: \/affiliates\nDisallow: \/checkout\nDisallow: \/api\//);
    assert.match(robots.body, /Sitemap: https:\/\/www\.iqondaily\.com\/sitemap\.xml/);
    assert.doesNotMatch(robots.body, /Disallow: \/\n|GPTBot|ClaudeBot|PerplexityBot/);
    const sitemap = await get(port, "/sitemap.xml");
    assert.equal(sitemap.status, 200);
    assert.match(sitemap.headers["content-type"], /xml/);
    assert.doesNotMatch(sitemap.body, /<lastmod>/, "no fabricated lastmod");
    const urls = locs(sitemap.body);
    // Complete, not just valid: every catalog page and exactly the listed Shopify products.
    for (const page of ["/", "/help", "/skincare", "/collections/all", "/collections/supplements", "/collections/skincare", "/approach", "/journal", "/journal/reading-a-supplement-label"])
      assert.ok(urls.includes(`https://${WWW}${page === "/" ? "/" : page}`), page);
    assert.deepEqual(urls.filter(u => u.includes("/products/")).map(u => new URL(u).pathname).sort(),
      ["/products/anti-aging-cleanser-with-peptides", "/products/creatine-monohydrate", "/products/daily-travel-kit", "/products/liver-support", "/products/nmn"]);
    for (const handle of ["gentle-cleanser", "peptide-serum", "barrier-cream"]) {
      assert.equal((await get(port, `/products/${handle}`)).status, 308, `${handle} redirects`);
      assert.ok(!urls.some(u => u.endsWith(`/products/${handle}`)), `${handle} not in sitemap`);
    }
    assert.ok(!urls.some(u => /keto-5|\/reviews|\/checkout|\/account|\/affiliates|\/api\/|\?/.test(u)), urls.join("\n"));
    for (const url of urls) {
      const {pathname} = new URL(url);
      assert.ok(url.startsWith(`https://${WWW}/`));
      const r = await get(port, pathname);
      assertIndexable(r, pathname);
      for (const disallowed of ["/account", "/affiliates", "/checkout", "/api/"]) assert.ok(!pathname.startsWith(disallowed), `${pathname} blocked by robots.txt`);
    }
    for (const host of ALIASES) {
      assert.doesNotMatch((await get(port, "/robots.txt", host)).body, /Sitemap:/);
      assert.deepEqual(locs((await get(port, "/sitemap.xml", host)).body), []);
    }
  });
  await t.test("structured data matches visible facts", async () => {
    const r = await get(port, "/products/creatine-monohydrate");
    const [product, crumbs] = jsonLd(r.body);
    assert.equal(product["@type"], "Product");
    assert.equal(product.offers.price, "39.00");
    // Subscription is selected by default (headline shows $33.15); the offer is the visible one-time option.
    assert.match(r.body, /<strong>One time purchase<\/strong>.*?<\/span><b>\$39<\/b>/, "visible one-time price");
    assert.match(r.body, /\$33\.15/, "subscription price is visible too");
    assert.notEqual(product.offers.price, "33.15");
    assert.equal(product.offers.availability, "https://schema.org/InStock");
    assert.deepEqual(crumbs.itemListElement.map(i => i.name), ["IQON", "supplements", "Creatine Monohydrate"]);
    assert.ok(!/aggregateRating|"review"|gtin/.test(JSON.stringify(product)));
    // No verifiable one-time offer: breadcrumb only, never an offer-less Product item.
    for (const [url, category] of [["/products/anti-aging-cleanser-with-peptides", "skincare"], ["/products/liver-support", "supplements"]]) {
      const page = await get(port, url);
      assertIndexable(page, url);
      assert.deepEqual(jsonLd(page.body).map(x => x["@type"]), ["BreadcrumbList"], url);
      assert.equal(jsonLd(page.body)[0].itemListElement[1].name, category);
    }
    assert.doesNotMatch((await get(port, "/products/liver-support")).body, /One time purchase/, "subscription-only page shows no one-time price");
    const sold = await get(port, "/products/nmn");
    assert.equal(jsonLd(sold.body)[0].offers.availability, "https://schema.org/OutOfStock");
    assert.doesNotMatch(sold.body, /<\/script><script>alert/, "catalog text cannot break out of JSON-LD");
    const article = jsonLd((await get(port, "/journal/reading-a-supplement-label")).body)[0];
    assert.equal(article["@type"], "Article");
    assert.equal(article.headline, "Read the label with confidence.");
    assert.ok(!("datePublished" in article));
    const home = jsonLd((await get(port, "/")).body);
    assert.deepEqual(home.map(x => x["@type"]), ["Organization", "WebSite"]);
    assert.deepEqual(home[0].contactPoint, {"@type": "ContactPoint", contactType: "customer support", email: "info@iqonhealth.com"});
  });
  await t.test("support inbox is a visible mailto link on /help and in every footer", async () => {
    const help = dom((await get(port, "/help")).body);
    const contact = help.querySelector("main address.help-contact a[href='mailto:info@iqonhealth.com']");
    assert.equal(contact?.textContent, "info@iqonhealth.com", "address visible on /help, outside the collapsed answers");
    assert.equal(contact.closest("[data-slot=accordion-content]"), null);
    for (const url of PUBLIC) {
      const links = [...dom((await get(port, url)).body).querySelectorAll("footer.store-footer a[href^='mailto:']")];
      assert.deepEqual(links.map(a => [a.getAttribute("href"), a.textContent]), [["mailto:info@iqonhealth.com", "Contact us"]], url);
    }
    assert.doesNotMatch((await get(port, "/help")).body, /tel:|within \d+ (hours|business days) of your email/i, "no phone or response-time promise");
  });
  await t.test("PDP section links point at sections that exist", async () => {
    // Generic Shopify product (no editorial productContent): no ingredient/routine jump links at all.
    const generic = dom((await get(port, "/products/daily-travel-kit")).body);
    assert.equal(generic.querySelector("h1")?.textContent, "Daily Travel Kit");
    assert.equal(generic.querySelector(".product-jump-links"), null);
    assert.equal(generic.querySelector('a[href="#product-formula"], a[href="#product-routine"]'), null);
    assert.ok(generic.querySelector(".add-to-bag-row button"), "purchase path still rendered");
    // Editorial products keep their working links.
    for (const url of ["/products/creatine-monohydrate", "/products/anti-aging-cleanser-with-peptides"]) {
      const doc = dom((await get(port, url)).body);
      assert.deepEqual([...doc.querySelectorAll(".product-jump-links a")].map(a => a.getAttribute("href")), ["#product-formula", "#product-routine"], url);
      assert.ok(doc.getElementById("product-formula") && doc.getElementById("product-routine"), url);
    }
    for (const url of PUBLIC) assert.deepEqual(brokenHashLinks(dom((await get(port, url)).body)), [], url);
  });
  await t.test("journal guides are titled as IQON Journal; H1 and citations unchanged", async () => {
    const doc = dom((await get(port, "/journal/reading-a-supplement-label")).body);
    assert.equal(doc.title, "Read the label with confidence | IQON Journal");
    assert.equal(doc.querySelector('meta[property="og:title"]').getAttribute("content"), doc.title);
    assert.deepEqual([...doc.querySelectorAll("h1")].map(h => h.textContent), ["Read the label with confidence."]);
    const article = jsonLd(doc.documentElement.outerHTML)[0];
    assert.ok(article.citation.length > 0 && article.citation.every(url => /^https:\/\//.test(url)));
    assert.equal(dom((await get(port, "/journal")).body).title, "Supplement & skincare guides | IQON");
  });
  await t.test("label guide explains blend arithmetic in server HTML with its FDA source", async () => {
    const response = await get(port, "/journal/reading-a-supplement-label");
    assertIndexable(response, "/journal/reading-a-supplement-label");
    const doc = dom(response.body);
    const section = [...doc.querySelectorAll(".article-body > section")].find(s => s.querySelector("h2")?.textContent === "Does a 600 mg blend mean 200 mg of each ingredient?");
    assert.ok(section, "question is in article HTML, not only serialized React data");
    const paragraphs = [...section.querySelectorAll("p")].map(p => p.textContent);
    assert.match(paragraphs[0], /^No, .*three ingredients does not necessarily contain 200 mg of each\./);
    assert.match(paragraphs[1], /hypothetical Supplement Facts panel/);
    assert.match(paragraphs[1], /600 mg is their combined weight per serving/);
    assert.match(paragraphs[1], /descending order by weight, but does not require their individual weights/);
    assert.match(paragraphs[1], /Ingredients with established Daily Values must be listed separately/);
    assert.match(paragraphs[2], /Do not divide the total equally or infer exact amounts/);
    assert.match(paragraphs[2], /amount as undisclosed instead of guessing/);
    assert.match(paragraphs[2], /question 34/);
    const fda = "https://www.fda.gov/food/dietary-supplements-guidance-documents-regulatory-information/dietary-supplement-labeling-guide-chapter-iv-nutrition-labeling";
    assert.ok(doc.querySelector(`.article-sources a[href="${fda}"]`), "Further reading keeps the primary source");
    assert.ok(jsonLd(response.body).find(item => item["@type"] === "Article").citation.includes(fda));
    assert.equal(section.querySelector(".guide-products"), null, "hypothetical blend is not attached to an IQON product");
  });
  await t.test("help and product pages state the owner's 3 to 5 day window; help adds Shop tracking", async () => {
    const answerOf = doc => [...doc.querySelectorAll("main [data-slot=accordion-item]")].find(item => /How long does shipping take/.test(item.textContent))?.querySelector("[data-slot=accordion-content]")?.textContent.trim();
    // Raw server HTML: the help answer is the shared statement plus the Shop tracking note, verbatim.
    assert.equal(answerOf(dom((await get(port, "/help")).body)), `${SHIPPING_NOTE} ${SHOP_TRACKING_NOTE}`);
    for (const url of ["/products/creatine-monohydrate", "/products/liver-support", "/products/daily-travel-kit"]) {
      const shipping = [...dom((await get(port, url)).body).querySelectorAll("[data-slot=accordion-item]")].find(item => /^Shipping/.test(item.textContent.trim()));
      assert.equal(shipping?.querySelector("[data-slot=accordion-content]")?.textContent.trim(), SHIPPING_NOTE, `${url}: PDP shipping statement`);
    }
    for (const url of ["/help", "/products/creatine-monohydrate"]) {
      const body = (await get(port, url)).body;
      assert.doesNotMatch(body, /business days?|guaranteed (delivery|shipping)|ships within|free shipping/i, url);
      assert.ok(!body.includes("Processing and delivery can vary"), `${url}: superseded wording removed`);
    }
    assert.ok(!(await get(port, "/products/creatine-monohydrate")).body.includes(SHOP_TRACKING_NOTE), "tracking note is help-only");
    // Products that cannot be ordered now (coming-soon skincare, sold-out NMN) carry no shipping window or accordion.
    for (const url of ["/products/anti-aging-cleanser-with-peptides", "/products/nmn"]) {
      const body = (await get(port, url)).body; const doc = dom(body);
      assert.ok(![...doc.querySelectorAll("[data-slot=accordion-trigger]")].some(t => t.textContent.trim() === "Shipping"), `${url}: no Shipping accordion`);
      assert.ok(!body.includes("3 to 5 days") && !body.includes("options and costs are shown at checkout"), `${url}: no window`);
    }
    const skin = dom((await get(port, "/products/anti-aging-cleanser-with-peptides")).body);
    assert.equal(skin.querySelector(".add-to-bag-row, .sticky-purchase"), null, "no purchase affordance on coming-soon skincare");
    assert.ok(skin.querySelector(".skincare-launch-note button[disabled]")?.textContent.includes("Not available to order yet"));
  });
  await t.test("first-party policies are linked from every footer, /help and subscription terms; native policy routes", async () => {
    const links = (doc, selector) => [...doc.querySelectorAll(selector)].map(a => [a.textContent, a.getAttribute("href")]);
    for (const url of PUBLIC) {
      const doc = dom((await get(port, url)).body);
      assert.equal(doc.querySelector("footer.store-footer nav.footer-policies").getAttribute("aria-label"), "Store policies", url);
      assert.deepEqual(links(doc, "footer.store-footer .footer-policies a"), STORE_POLICY_LINKS, url);
      assert.ok(doc.querySelector('footer.store-footer a[href="/account/privacy"]'), `${url}: footer Privacy link kept`);
      assert.equal(doc.querySelector('footer .footer-policies a[href^="https:"]'), null, url);
    }
    for (const [title, path] of STORE_POLICY_LINKS) {
      const r = await get(port, path); assertIndexable(r, path);
      const doc = dom(r.body);
      assert.deepEqual(h1s(doc), [title]);
      assert.equal(doc.title, `${title} | IQON`);
      assert.match(doc.querySelector("article.policy-body").textContent, new RegExp(`Published synthetic ${path.split("/").pop()} content`));
      assert.equal(doc.querySelector("article script, article img"), null);
      assert.equal(doc.querySelector('.policy-nav [aria-current="page"]').getAttribute("href"), path);
      assertNoindex(await get(port, path, ALIASES[0]), path);
    }
    assertNoindex(await get(port, "/policies/not-a-policy"), "unknown policy", {status: 404});
    assertNoindex(await get(port, "/policies/privacy-policy"), "privacy stays hosted", {status: 404});
    const help = dom((await get(port, "/help")).body);
    const helpPolicies = help.querySelector("main nav.help-policies");
    assert.equal(helpPolicies.getAttribute("aria-labelledby"), "help-policies-title");
    assert.equal(help.getElementById("help-policies-title").textContent, "STORE POLICIES");
    assert.deepEqual(links(help, "main .help-policies a"), STORE_POLICY_LINKS);
    assert.equal(helpPolicies.closest("[data-slot=accordion-content]"), null, "visible without opening an answer");
    // Subscription terms link the cancellation policy; one-time-only and coming-soon products have no subscription terms.
    const pdp = dom((await get(port, "/products/creatine-monohydrate")).body);
    assert.deepEqual(links(pdp, ".subscription-terms a").at(-1), ["cancellation policy", POLICY("subscription-policy")]);
    assert.equal(dom((await get(port, "/products/anti-aging-cleanser-with-peptides")).body).querySelector(".subscription-terms"), null);
    assert.doesNotMatch(helpPolicies.textContent + help.querySelector("footer .footer-policies").textContent, /[\u2013\u2014]| - /, "no dashes in policy link copy");
  });
  await t.test("guides link only to orderable products, and those products link back", async () => {
    const sectionLinks = doc => Object.fromEntries([...doc.querySelectorAll(".article-body > section")].map(section =>
      [section.querySelector("h2").textContent, [...section.querySelectorAll(".guide-products a")].map(a => a.getAttribute("href"))]));
    const format = dom((await get(port, "/journal/finding-your-supplement-format")).body);
    assert.deepEqual(sectionLinks(format), {
      "Picture an ordinary day": [], "Powders make preparation part of the ritual": ["/products/creatine-monohydrate"],
      // NMN is a sold-out capsule; the generic Daily Travel Kit has no format; Keto-5 is an editorial placeholder.
      "Capsules keep the process compact": ["/products/liver-support"], "Sachets are easy to take along": [], "Gummies put taste and texture first": [],
    });
    assert.match(format.querySelector('.guide-products a[href="/products/creatine-monohydrate"]').textContent, /Creatine Monohydrate.*281 g powder/);
    const label = dom((await get(port, "/journal/reading-a-supplement-label")).body);
    // Colostrum and both collagens are not in this mock catalog: their links fail closed.
    assert.deepEqual(Object.values(sectionLinks(label)).flat(), ["/products/creatine-monohydrate"]);
    assert.match(label.querySelector(".guide-products a").textContent, /Single-ingredient, unflavored powder/);
    assert.equal(dom((await get(port, "/journal/a-simple-skincare-routine")).body).querySelector(".guide-products"), null, "coming-soon skincare is never a purchase link");
    for (const href of ["/products/creatine-monohydrate", "/products/liver-support"]) {
      const r = await get(port, href);
      assertIndexable(r, href);
      assert.match(dom(r.body).querySelector(".add-to-bag-row button.button-dark").textContent, /^Add (subscription|to bag)/, `${href} is orderable`);
    }
    const guides = async url => [...dom((await get(port, url)).body).querySelectorAll(".product-guides a")].map(a => a.getAttribute("href"));
    assert.deepEqual(await guides("/products/creatine-monohydrate"), ["/journal/reading-a-supplement-label", "/journal/finding-your-supplement-format"]);
    assert.deepEqual(await guides("/products/liver-support"), ["/journal/finding-your-supplement-format"]);
    for (const url of ["/products/anti-aging-cleanser-with-peptides", "/products/daily-travel-kit"]) assert.deepEqual(await guides(url), [], url);
  });
  await t.test("collections separate orderable supplements from the skincare preview and link the guides", async () => {
    const all = dom((await get(port, "/collections/all")).body);
    assert.equal(all.querySelector(".catalog-heading p:last-child").textContent, "Supplements are available to order now. Skincare is shown as a preview and can’t be ordered yet.");
    assert.deepEqual([...all.querySelectorAll(".catalog-departments a")].map(a => a.textContent), ["Supplements", "Skincare preview"]);
    assert.equal(all.querySelector('meta[name="description"]').getAttribute("content"), "Shop IQON supplements and preview the skincare collection, coming soon.");
    const supplements = dom((await get(port, "/collections/supplements")).body);
    assert.doesNotMatch(supplements.querySelector(".catalog-heading").textContent, /\d/, "no hardcoded count");
    assert.deepEqual([...supplements.querySelectorAll(".catalog-guides a")].map(a => [a.getAttribute("href"), a.textContent]),
      [["/journal/finding-your-supplement-format", "Find a format that fits"], ["/journal/reading-a-supplement-label", "Read the label with confidence"]]);
    // Only formats with an orderable product (NMN, the other capsule, is sold out; Liver Support is orderable).
    const formats = [...supplements.querySelectorAll(".catalog-formats a")].map(a => [a.getAttribute("href"), a.textContent]);
    assert.deepEqual(formats, [["/collections/supplements?format=powder", "Powders"], ["/collections/supplements?format=capsules", "Capsules"]]);
    const filtered = dom((await get(port, "/collections/supplements?format=powder")).body);
    assert.deepEqual([...filtered.querySelectorAll(".catalog-formats a[aria-current]")].map(a => a.getAttribute("href")), ["/collections/supplements"]);
    assert.equal(dom((await get(port, "/collections/skincare")).body).querySelector(".catalog-selection"), null);
    // Every new buyer-path link resolves: format filters canonicalize to the clean collection.
    const hrefs = new Set();
    for (const url of ["/collections/supplements", "/journal/finding-your-supplement-format", "/journal/reading-a-supplement-label", "/products/creatine-monohydrate"])
      for (const a of dom((await get(port, url)).body).querySelectorAll(".catalog-selection a, .guide-products a, .product-guides a")) hrefs.add(a.getAttribute("href"));
    assert.ok(hrefs.size >= 6, [...hrefs].join(","));
    for (const href of hrefs) {
      const r = await get(port, href);
      assert.equal(r.status, 200, href);
      assert.equal(canonical(r.body), `https://${WWW}${href.split("?")[0]}`, href);
    }
  });
  await t.test("headings with a visual <br> keep a word space in the server HTML", async () => {
    for (const [url, h1] of Object.entries(H1_TEXT)) assert.deepEqual(h1s(dom((await get(port, url)).body)), [h1], url);
    assert.equal(dom((await get(port, "/journal")).body).querySelector(".journal-heading h1 + p").textContent,
      "Useful details. Everyday routines. A closer look at supplements and skincare.");
    for (const url of PUBLIC) for (const text of h1s(dom((await get(port, url)).body))) assert.doesNotMatch(text, /[a-z.][A-Z]|[a-z]\.[a-z]/, `${url}: ${text}`);
  });
  await t.test("browsers get the same head metadata as crawlers", async () => {
    const r = await get(port, "/products/creatine-monohydrate", WWW, "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140 Safari/537.36");
    assert.equal(canonical(r.body), `https://${WWW}/products/creatine-monohydrate`);
  });
});

test("production, successful but empty Shopify response: editorial placeholders are not indexed or listed", async t => {
  const server = await startServer("empty", {...live, FAKE_SHOPIFY: "empty"});
  t.after(server.stop);
  for (const url of ["/", "/help", "/skincare", "/collections/all", "/collections/supplements", "/collections/skincare", "/products/creatine-monohydrate", "/products/keto-5"]) {
    const r = await get(server.port, url);
    assertNoindex(r, url);
    assert.ok(!jsonLd(r.body).some(x => x["@type"] === "Product"), url);
  }
  for (const url of ["/approach", "/journal"]) assertIndexable(await get(server.port, url), url);
  const urls = locs((await get(server.port, "/sitemap.xml")).body).map(u => new URL(u).pathname);
  assert.ok(urls.length > 0 && urls.every(p => p === "/approach" || p.startsWith("/journal")), urls.join(","));
});

test("production, Shopify outage: shopping pages fail closed, static pages stay indexable", async t => {
  const server = await startServer("down", {...live, FAKE_SHOPIFY: "down"});
  t.after(server.stop);
  for (const url of ["/", "/help", "/skincare", "/collections/all", "/collections/supplements"]) assertNoindex(await get(server.port, url), url);
  for (const [title, path] of STORE_POLICY_LINKS) {
    const r = await get(server.port, path); assertNoindex(r, path);
    assert.equal(canonical(r.body), `https://${WWW}${path}`);
    const doc = dom(r.body);
    assert.deepEqual(h1s(doc), [title]);
    assert.equal(doc.querySelector("article.policy-body"), null);
    assert.match(doc.querySelector(".policy-fallback").textContent, /couldn’t load this policy/);
    assert.equal(doc.querySelector(".policy-fallback a").getAttribute("href"), `https://nr9zd0-t5.myshopify.com${path}`);
  }
  const product = await get(server.port, "/products/creatine-monohydrate");
  assertNoindex(product, "product during outage");
  // Existing behavior: during an outage any product slug gets the 200 "back shortly" page (noindex), not a 404.
  assertNoindex(await get(server.port, "/products/not-a-product"), "unknown slug during outage");
  assert.equal(jsonLd(product.body).length, 0);
  for (const url of ["/approach", "/journal", "/journal/reading-a-supplement-label"]) assertIndexable(await get(server.port, url), url);
  // Guides stay indexable but offer no product as a next purchase step while Shopify is down.
  for (const url of ["/journal/reading-a-supplement-label", "/journal/finding-your-supplement-format"]) assert.equal(dom((await get(server.port, url)).body).querySelector(".guide-products"), null, url);
  const urls = locs((await get(server.port, "/sitemap.xml")).body).map(u => new URL(u).pathname);
  assert.ok(urls.length > 0 && urls.every(p => p === "/approach" || p.startsWith("/journal")), urls.join(","));
});

test("production without Shopify configuration: preview fixtures are never indexed or enumerated", async t => {
  const server = await startServer("unconfigured", {VERCEL_ENV: "production"});
  t.after(server.stop);
  for (const url of ["/", "/collections/all", "/products/creatine-monohydrate", "/help"]) assertNoindex(await get(server.port, url), url);
  // Published policy JSON remains usable without any server-side Shopify credentials.
  for (const [, path] of STORE_POLICY_LINKS) assertIndexable(await get(server.port, path), path);
  // Preview-fixture homepage modes render the same hero headings.
  for (const url of ["/", "/skincare"]) assert.deepEqual(h1s(dom((await get(server.port, url)).body)), [H1_TEXT[url]], url);
  assert.ok(!(await get(server.port, "/sitemap.xml")).body.includes("/products/"));
  // Preview fixtures are never linked as orderable; the preview help answer gives the window but no Shop tracking claim.
  for (const url of ["/journal/reading-a-supplement-label", "/journal/finding-your-supplement-format", "/collections/supplements"])
    assert.equal(dom((await get(server.port, url)).body).querySelector(".guide-products, .catalog-formats"), null, url);
  assert.ok(!(await get(server.port, "/products/creatine-monohydrate")).body.includes("3 to 5 days"), "preview PDP: not orderable, no window");
  const previewHelp = (await get(server.port, "/help")).body;
  assert.ok(previewHelp.includes("Shipping usually takes 3 to 5 days. Shipping options and costs will be shown at checkout once orders open."));
  assert.doesNotMatch(previewHelp, /business days|through Shop/);
});

test("preview deployment: nothing is indexable and robots.txt blocks crawling", async t => {
  const server = await startServer("preview", {...live, VERCEL_ENV: "preview"});
  t.after(server.stop);
  for (const url of [...PUBLIC, ...STORE_POLICY_LINKS.map(([, path]) => path)]) assertNoindex(await get(server.port, url), url);
  assert.match((await get(server.port, "/robots.txt")).body, /User-Agent: \*\nDisallow: \/\n/);
  assert.deepEqual(locs((await get(server.port, "/sitemap.xml")).body), []);
});
