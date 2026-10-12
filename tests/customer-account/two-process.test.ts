// Two separate Node processes (no shared memory) refresh the same expired session at the same
// instant against one PostgreSQL and a strictly rotating MOCK provider.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import { createFakeProvider } from "./fake-provider.mjs";
import { env, handlers, Jar, ORIGIN, request, SESSION_COOKIE, store } from "./harness";

const run = promisify(execFile);

test("two real processes, strict rotation: exactly one refresh, both signed in, no cookie writes", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "iqb-two-process-"));
  const stateFile = path.join(dir, "provider.json");
  const provider = createFakeProvider({origin: ORIGIN, file: stateFile});
  provider.configure({expiresIn: 120, rotateRefresh: true});
  const now = Date.now();
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => (await provider.fetch(String(input), init)) ?? Promise.reject(new Error("unexpected"))) as typeof fetch;
  const deps = {env, fetcher, now: () => now, store};
  const jar = new Jar();
  const login = jar.take(await handlers.loginRoute(request("/account/login", jar), deps));
  const callback = new URL(provider.authorize(login.headers.get("location")!));
  jar.take(await handlers.callbackRoute(request(callback.pathname + callback.search, jar), deps));
  const later = now + 5 * 60 * 1000;
  const input = {ORIGIN, ENV: env, COOKIE: jar.header(), NOW: later, START_AT: Date.now() + 1500, STATE_FILE: stateFile};
  const worker = path.join(path.dirname(new URL(import.meta.url).pathname), "two-process-worker.ts");
  const spawnWorker = () => run(process.execPath, ["--import", "tsx", worker], {env: {...process.env, WORKER_INPUT: JSON.stringify(input)}, timeout: 30000});
  const [one, two] = (await Promise.all([spawnWorker(), spawnWorker()])).map(r => JSON.parse(r.stdout));
  assert.notEqual(one.pid, two.pid);
  for (const result of [one, two]) {
    assert.equal(result.status, 200);
    assert.equal(result.body.status, "signed_in");
    assert.equal(result.setCookies, 0);
  }
  assert.equal(provider.ledger().filter((e: {op: string}) => e.op === "refresh").length, 1, "the database lease admitted one refresher");
  const row = (await store.get(jar.cookies.get(SESSION_COOKIE)!.split(".")[0]))!;
  assert.equal(row.generation, 1);
  assert.equal(row.revokedAt, null);
  fs.rmSync(dir, {recursive: true, force: true});
});
