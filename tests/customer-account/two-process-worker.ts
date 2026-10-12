// One "serverless instance" for the two-process refresh test: its own Node process and module
// heap, the shared owned PostgreSQL, and the shared file-backed MOCK provider.
import { PrismaClient } from "@prisma/client";
import { createFakeProvider } from "./fake-provider.mjs";
import { sessionApi } from "@/lib/customer-account/handlers";
import { prismaSessionStore } from "@/lib/customer-account/store";

const {ORIGIN, ENV, COOKIE, NOW, START_AT, STATE_FILE} = JSON.parse(process.env.WORKER_INPUT!);
const prisma = new PrismaClient({datasourceUrl: process.env.ACCOUNT_TEST_DATABASE_URL});
const provider = createFakeProvider({origin: ORIGIN, file: STATE_FILE});
const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => (await provider.fetch(String(input), init)) ?? Promise.reject(new Error("unexpected request"))) as typeof fetch;
await new Promise(resolve => setTimeout(resolve, Math.max(0, START_AT - Date.now())));
const response = await sessionApi(new Request(`${ORIGIN}/api/account/session`, {headers: {cookie: COOKIE}}), {env: ENV, fetcher, now: () => NOW, store: prismaSessionStore(prisma), pollMs: 20, waitMs: 8000});
process.stdout.write(JSON.stringify({pid: process.pid, status: response.status, body: await response.json(), setCookies: response.headers.getSetCookie().length}));
await prisma.$disconnect();
