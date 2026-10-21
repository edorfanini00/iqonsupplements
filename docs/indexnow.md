# IndexNow discovery notifications

This change prepares a public IndexNow verification file for `https://www.iqondaily.com`. It does not submit URLs, verify the Bing Webmaster account, or establish that any page is indexed. Bing Webmaster sign-in was blocked by Google/server errors; its property verification remains unconfirmed. IndexNow receipt does not guarantee crawling or indexation. See the [IndexNow documentation](https://www.indexnow.org/documentation) and [FAQ](https://www.indexnow.org/faq).

## Public verification material

- Key: `4ebd9e4e989144ffebac389bceb45ce1785f3eb39a69832a0abf358c14c740e9`
- Source: `public/4ebd9e4e989144ffebac389bceb45ce1785f3eb39a69832a0abf358c14c740e9.txt`
- Canonical key URL: `https://www.iqondaily.com/4ebd9e4e989144ffebac389bceb45ce1785f3eb39a69832a0abf358c14c740e9.txt`

The key was generated once with Node's cryptographic `randomBytes(32).toString("hex")`. Its 64 lowercase hexadecimal characters satisfy the protocol's 8–128 character constraint. The UTF-8 file contains exactly those 64 bytes, with no BOM or trailing newline. Hosting the matching file allows IndexNow engines to check control of the submitted host. This is deliberately public protocol verification material, not an application authentication secret: it belongs in source and must be retrievable without login. It does not grant access to accounts, checkout, Shopify, or deployment systems.

The existing static-file serving path needs no middleware exception. Existing alias-host `X-Robots-Tag: noindex` behavior is preserved. Static assets can be reachable on deployment aliases; that does not make those aliases the canonical host or authorize submitting them. Always use `www.iqondaily.com` in `host`, `keyLocation`, and every submitted URL. The key file is excluded from the sitemap and from submission lists. Preserve the separate permanent Google verification file.

## Release-owner procedure

The builder opens a PR only. The parent/release owner must independently review the exact PR head before merging and releasing. No automatic submission, build hook, scheduled job, or application sender is added.

1. Record the approved commit and actual released revision. After release, fetch the canonical key URL without following redirects. Require HTTP 200, a `text/plain` content type, and an exact byte match to the released file. Save the response headers and body as evidence. A local build, an alias response, or a successful deployment alone does not prove that the canonical key is live.

   ```sh
   curl --silent --show-error --max-time 30 \
     --dump-header /tmp/iqondaily-indexnow-key.headers \
     --output /tmp/iqondaily-indexnow-key.body \
     --write-out '%{http_code}\n' \
     'https://www.iqondaily.com/4ebd9e4e989144ffebac389bceb45ce1785f3eb39a69832a0abf358c14c740e9.txt'
   cmp public/4ebd9e4e989144ffebac389bceb45ce1785f3eb39a69832a0abf358c14c740e9.txt /tmp/iqondaily-indexnow-key.body
   ```

2. Derive an explicit, deduplicated list from actual newly released public content changes. For every URL, record the change and verify the live response is 200, self-canonical on HTTPS `www.iqondaily.com`, allowed by robots.txt, and free of `noindex` in both headers and rendered/server metadata. Catalog pages additionally require a real live, eligible Shopify product/catalog. Cross-check the current canonical sitemap, but do not use the entire sitemap as a submission queue. A key-only release creates no eligible content changes; if the list is empty, stop without POSTing.

3. Exclude noindex skincare pages (including skincare landing, collection, or product URLs that are currently noindex), drafts, unavailable/placeholder products, nonexistent routes, private/account pages, APIs, checkout, affiliates, preview deployments, aliases, duplicate URLs, tracking/query/fragment variants, redirect sources, and the verification file. Do not infer eligibility from an HTTP 200 or from a mock test fixture. This workflow deliberately limits submissions to changed public canonical indexable pages; it does not implement the protocol's separate deletion/redirect notification capability. No preapproved candidate URL list is supplied.

4. Only after the live checks pass, the parent/release owner prepares a UTF-8 JSON payload with these fields and fills `urlList` with the reviewed list. The empty template below must not be submitted. The protocol permits at most 10,000 URLs per request; a larger list needs a separately reviewed batching plan.

   ```json
   {
     "host": "www.iqondaily.com",
     "key": "4ebd9e4e989144ffebac389bceb45ce1785f3eb39a69832a0abf358c14c740e9",
     "keyLocation": "https://www.iqondaily.com/4ebd9e4e989144ffebac389bceb45ce1785f3eb39a69832a0abf358c14c740e9.txt",
     "urlList": []
   }
   ```

5. Manually POST that reviewed payload once to `https://api.indexnow.org/indexnow` with `Content-Type: application/json; charset=utf-8`. Use this one endpoint only: participating engines share notifications, so do not duplicate the request to Bing or another endpoint. Do not submit to Google. Record UTC time, released commit, exact URL list and count, endpoint, HTTP status, response headers, and response body (including an empty body). Do not submit on every build or resend unchanged URLs.

6. Interpret HTTP 200 as receipt, and 202 as receipt with key validation pending. Neither proves indexing or Bing Webmaster property verification. Investigate 400 (format), 403 (key validation), 422 (host/key mismatch), or 429 (rate limiting); retain evidence and avoid blind retries or duplicate submissions after a timeout. Record any later retry decision separately. These response meanings follow the [protocol response table](https://www.indexnow.org/documentation).

## Verification and rollback

`npm run test:seo` checks exact file bytes, sitemap exclusion, HTTP text serving, and existing alias protections against the local production build with mocked Shopify. It cannot prove production reachability or search-engine acceptance. The storefront UI and application behavior are unchanged.

No migration, environment variable, credential, or dependency is required. To withdraw this setup, revert the key-file change through the normal reviewed release process and stop future submissions. Removing a key does not undo a previously accepted notification or remove indexed content. Any future key rotation must update its filename, contents, tests, and this document together, and repeat live GET verification before using the replacement.
