import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { shopifyAdmin } from '../../lib/affiliates/shopify-admin';

const SHOP = 'nr9zd0-t5.myshopify.com';
const savedEnv = { ...process.env };
const originalFetch = globalThis.fetch;
let sequence = 0;
beforeEach(() => {
  process.env.SUPPLEMENTS_SHOPIFY_STORE_DOMAIN = SHOP;
  process.env.SUPPLEMENTS_SHOPIFY_CLIENT_ID = `fixture-client-${++sequence}`;
  process.env.SUPPLEMENTS_SHOPIFY_CLIENT_SECRET = 'fixture-secret&=+';
  delete process.env.SUPPLEMENTS_SHOPIFY_ADMIN_TOKEN;
});
afterEach(() => { process.env = { ...savedEnv }; globalThis.fetch = originalFetch; });
const grant = () => Response.json({ access_token: 'fixture-access', expires_in: 86400, scope: 'read_orders,read_discounts' });

test('exchanges client credentials with the fixed Shopify endpoint before GraphQL', async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return calls.length === 1 ? grant() : Response.json({ data: { ok: true } });
  };
  assert.deepEqual(await shopifyAdmin('query { shop { id } }'), { ok: true });
  assert.equal(calls[0].url, `https://${SHOP}/admin/oauth/access_token`);
  assert.equal(calls[0].init?.method, 'POST');
  assert.equal(calls[0].init?.redirect, 'error');
  assert.equal(calls[0].init?.cache, 'no-store');
  assert.ok(calls[0].init?.signal);
  assert.deepEqual(Object.fromEntries(new URLSearchParams(String(calls[0].init?.body))), {
    grant_type: 'client_credentials', client_id: process.env.SUPPLEMENTS_SHOPIFY_CLIENT_ID,
    client_secret: 'fixture-secret&=+',
  });
  assert.equal(new Headers(calls[1].init?.headers).get('X-Shopify-Access-Token'), 'fixture-access');
});

test('shares an exchange across concurrent calls and caches until the expiry skew', async () => {
  const realNow = Date.now;
  let now = realNow(); let exchanges = 0;
  Date.now = () => now;
  globalThis.fetch = async (url) => {
    if (String(url).endsWith('access_token')) { exchanges++; await Promise.resolve(); return grant(); }
    return Response.json({ data: { ok: true } });
  };
  try {
    await Promise.all(Array.from({ length: 12 }, () => shopifyAdmin('query { shop { id } }')));
    assert.equal(exchanges, 1);
    now += 86339 * 1000;
    await shopifyAdmin('query { shop { id } }');
    assert.equal(exchanges, 1);
    now += 1000;
    await shopifyAdmin('query { shop { id } }');
    assert.equal(exchanges, 2);
  } finally { Date.now = realNow; }
});

for (const bad of [null, {}, {access_token: ''}, {access_token: 'fixture', expires_in: 0, scope: 'read_orders'}, {access_token: 'fixture', expires_in: '86400', scope: 'read_orders'}, {access_token: 'fixture', expires_in: 86400, scope: ''}, {access_token: 'fixture', expires_in: 86400, scope: ['read_orders']}]) {
  test(`rejects malformed/unscoped grants: ${JSON.stringify(bad)}`, async () => {
    let calls = 0;
    globalThis.fetch = async () => { calls++; return Response.json(bad); };
    await assert.rejects(shopifyAdmin('query { shop { id } }'), /SHOPIFY_AUTH_/);
    assert.equal(calls, 1);
  });
}

test('failed exchange is sanitized and a later call can recover', async () => {
  let exchanges = 0;
  globalThis.fetch = async (url) => {
    if (String(url).endsWith('access_token')) {
      if (++exchanges === 1) throw new Error('fixture-secret&=+ provider payload');
      return grant();
    }
    return Response.json({data: {ok: true}});
  };
  await assert.rejects(shopifyAdmin('query { shop { id } }'), /^Error: SHOPIFY_AUTH_FAILED$/);
  assert.deepEqual(await shopifyAdmin('query { shop { id } }'), {ok: true});
  assert.equal(exchanges, 2);
});

test('rejects non-success exchange even if its body looks like a grant', async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({access_token: 'fixture', expires_in: 86400, scope: 'read_orders'}, {status: 401}); };
  await assert.rejects(shopifyAdmin('query { shop { id } }'), /SHOPIFY_AUTH_FAILED/);
  assert.equal(calls, 1);
});

test('sanitizes a rejected singleflight for every concurrent waiter', async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; await Promise.resolve(); throw new Error('fixture-secret&=+'); };
  const results = await Promise.allSettled([shopifyAdmin('query { shop { id } }'), shopifyAdmin('query { shop { id } }')]);
  assert.equal(calls, 1);
  for (const result of results) {
    assert.equal(result.status, 'rejected');
    if (result.status === 'rejected') assert.equal(result.reason.message, 'SHOPIFY_AUTH_FAILED');
  }
});

test('read-only 401 renews once, and a second 401 invalidates without looping', async () => {
  let exchanges = 0; let requests = 0;
  globalThis.fetch = async (url) => {
    if (String(url).endsWith('access_token')) { exchanges++; return grant(); }
    requests++; return new Response('', {status: 401});
  };
  await assert.rejects(shopifyAdmin('query { shop { id } }'));
  assert.equal(exchanges, 2); assert.equal(requests, 2);
  globalThis.fetch = async (url) => {
    if (String(url).endsWith('access_token')) { exchanges++; return grant(); }
    return Response.json({data: {ok: true}});
  };
  await shopifyAdmin('query { shop { id } }');
  assert.equal(exchanges, 3);
});

for (const query of ['mutation { discountCodeDeactivate(id: "fixture") { userErrors { message } } }', '# comment\nmutation Change { x }', 'query Read { shop { id } } mutation Change { x }', '{ shop { id } } mutation Change { x }']) {
  test(`never replays mutation documents: ${query}`, async () => {
    let exchanges = 0; let requests = 0;
    globalThis.fetch = async (url) => {
      if (String(url).endsWith('access_token')) { exchanges++; return grant(); }
      requests++; return new Response('', {status: 401});
    };
    await assert.rejects(shopifyAdmin(query));
    assert.equal(exchanges, 1); assert.equal(requests, 1);
    globalThis.fetch = async (url) => {
      if (String(url).endsWith('access_token')) { exchanges++; return grant(); }
      return Response.json({data: {ok: true}});
    };
    await shopifyAdmin('query { shop { id } }');
    assert.equal(exchanges, 2);
  });
}

test('late 401 cannot evict a newer token generation even when token text is identical', async () => {
  let exchanges = 0; let requests = 0; let release!: (response: Response) => void;
  let entered!: () => void; const enteredPromise = new Promise<void>(r => {entered = r;});
  globalThis.fetch = async (url) => {
    if (String(url).endsWith('access_token')) { exchanges++; return grant(); }
    if (++requests === 1) { entered(); return new Promise<Response>(r => {release = r;}); }
    if (requests === 2) return new Response('', {status: 401});
    return Response.json({data: {ok: true}});
  };
  const late = shopifyAdmin('query { shop { id } }');
  await enteredPromise;
  await shopifyAdmin('query { shop { id } }');
  release(new Response('', {status: 401}));
  await late;
  assert.equal(exchanges, 2); assert.equal(requests, 4);
});

for (const query of ['query { shop { id } }', 'mutation { x }']) {
  test(`transport and JSON failures never leak secrets or replay: ${query}`, async () => {
    let calls = 0;
    globalThis.fetch = async (url) => {
      if (String(url).endsWith('access_token')) return grant();
      calls++; throw new Error('fixture-access fixture-secret&=+');
    };
    await assert.rejects(shopifyAdmin(query), error => error instanceof Error && !error.message.includes('fixture'));
    assert.equal(calls, 1);
    globalThis.fetch = async () => new Response('fixture-access fixture-secret&=+');
    await assert.rejects(shopifyAdmin(query), error => error instanceof Error && !error.message.includes('fixture'));
  });
}

test('static token remains supported without exchange or retry', async () => {
  delete process.env.SUPPLEMENTS_SHOPIFY_CLIENT_ID; delete process.env.SUPPLEMENTS_SHOPIFY_CLIENT_SECRET;
  process.env.SUPPLEMENTS_SHOPIFY_ADMIN_TOKEN = 'fixture-static';
  let calls = 0;
  globalThis.fetch = async (url, init) => {
    calls++; assert.ok(String(url).endsWith('/graphql.json'));
    assert.equal(new Headers(init?.headers).get('X-Shopify-Access-Token'), 'fixture-static');
    assert.equal(init?.redirect, 'error');
    return new Response('', {status: 401});
  };
  await assert.rejects(shopifyAdmin('query { shop { id } }'));
  assert.equal(calls, 1);
});

for (const missing of ['SUPPLEMENTS_SHOPIFY_CLIENT_ID', 'SUPPLEMENTS_SHOPIFY_CLIENT_SECRET']) {
  test(`partial credentials fail closed despite static fallback: ${missing}`, async () => {
    delete process.env[missing]; process.env.SUPPLEMENTS_SHOPIFY_ADMIN_TOKEN = 'fixture-static';
    let calls = 0; globalThis.fetch = async () => { calls++; return grant(); };
    await assert.rejects(shopifyAdmin('query { shop { id } }'));
    assert.equal(calls, 0);
  });
}

for (const domain of ['other.myshopify.com', 'https://nr9zd0-t5.myshopify.com', 'nr9zd0-t5.myshopify.com.evil.example', ' nr9zd0-t5.myshopify.com', '']) {
  test(`rejects nonexact store without network: ${domain}`, async () => {
    process.env.SUPPLEMENTS_SHOPIFY_STORE_DOMAIN = domain;
    let calls = 0; globalThis.fetch = async () => { calls++; return grant(); };
    await assert.rejects(shopifyAdmin('query { shop { id } }'));
    assert.equal(calls, 0);
  });
}

for (const status of [403, 429, 500]) {
  test(`does not renew or replay HTTP ${status}`, async () => {
    let exchanges = 0; let requests = 0;
    globalThis.fetch = async (url) => {
      if (String(url).endsWith('access_token')) { exchanges++; return grant(); }
      requests++; return new Response('fixture-secret provider error', {status});
    };
    await assert.rejects(shopifyAdmin('query { shop { id } }'));
    assert.equal(exchanges, 1); assert.equal(requests, 1);
    await assert.rejects(shopifyAdmin('mutation { x }'));
    assert.equal(exchanges, 1); assert.equal(requests, 2);
  });
}

test('credentials take precedence over static fallback', async () => {
  process.env.SUPPLEMENTS_SHOPIFY_ADMIN_TOKEN = 'fixture-static';
  let exchanges = 0;
  globalThis.fetch = async (url, init) => {
    if (String(url).endsWith('access_token')) { exchanges++; return grant(); }
    assert.equal(new Headers(init?.headers).get('X-Shopify-Access-Token'), 'fixture-access');
    return Response.json({data: {ok: true}});
  };
  await shopifyAdmin('query { shop { id } }'); assert.equal(exchanges, 1);
});

test('credential rotation isolates in-flight exchanges from the new cache', async () => {
  let exchanges = 0; let release!: (response: Response) => void;
  const tokens: string[] = [];
  globalThis.fetch = async (url, init) => {
    if (String(url).endsWith('access_token')) {
      if (++exchanges === 1) return new Promise<Response>(r => {release = r;});
      return Response.json({access_token: 'fixture-new', expires_in: 86400, scope: 'read_orders'});
    }
    tokens.push(new Headers(init?.headers).get('X-Shopify-Access-Token')!);
    return Response.json({data: {ok: true}});
  };
  const old = shopifyAdmin('query { shop { id } }');
  process.env.SUPPLEMENTS_SHOPIFY_CLIENT_SECRET = 'fixture-rotated';
  await shopifyAdmin('query { shop { id } }');
  release(grant()); await old;
  await shopifyAdmin('query { shop { id } }');
  assert.equal(exchanges, 2);
  assert.deepEqual(tokens, ['fixture-new', 'fixture-access', 'fixture-new']);
});

test('GraphQL authorization errors are sanitized and do not refresh', async () => {
  let exchanges = 0; let requests = 0;
  globalThis.fetch = async (url) => {
    if (String(url).endsWith('access_token')) {exchanges++; return grant();}
    requests++; return Response.json({errors: [{message: 'fixture-access', extensions: {code: 'ACCESS_DENIED'}}]});
  };
  await assert.rejects(shopifyAdmin('query { shop { id } }'), error => error instanceof Error && !error.message.includes('fixture'));
  assert.equal(exchanges, 1); assert.equal(requests, 1);
});

test('successful 401 recovery replays reads with the renewed token', async () => {
  let exchanges = 0; const tokens: string[] = [];
  globalThis.fetch = async (url, init) => {
    if (String(url).endsWith('access_token')) return Response.json({access_token: `fixture-${++exchanges}`, expires_in: 86400, scope: 'read_orders'});
    tokens.push(new Headers(init?.headers).get('X-Shopify-Access-Token')!);
    return tokens.length === 1 ? new Response('', {status: 401}) : Response.json({data: {ok: true}});
  };
  assert.deepEqual(await shopifyAdmin('query { shop { id } }'), {ok: true});
  assert.deepEqual(tokens, ['fixture-1', 'fixture-2']);
});

test('does not leak rejected response-stream cancellation errors', async () => {
  globalThis.fetch = async (url) => {
    if (String(url).endsWith('access_token')) return grant();
    return new Response(new ReadableStream({cancel() { throw new Error('fixture-secret&=+'); }}), {status: 401});
  };
  await assert.rejects(shopifyAdmin('query { shop { id } }'), error => error instanceof Error && !error.message.includes('fixture'));
});

test('concurrent 401s use a single renewal exchange', async () => {
  let exchanges = 0;
  globalThis.fetch = async (url, init) => {
    if (String(url).endsWith('access_token')) return Response.json({access_token: `fixture-${++exchanges}`, expires_in: 86400, scope: 'read_orders'});
    return new Headers(init?.headers).get('X-Shopify-Access-Token') === 'fixture-1'
      ? new Response('', {status: 401}) : Response.json({data: {ok: true}});
  };
  const results = await Promise.all(Array.from({length: 12}, () => shopifyAdmin('query { shop { id } }')));
  assert.equal(results.length, 12); assert.equal(exchanges, 2);
});
