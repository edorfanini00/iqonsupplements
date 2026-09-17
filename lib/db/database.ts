/** True when Prisma can connect (affiliate portal Postgres). */
export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.SUPPLEMENTS_DATABASE_URL?.trim());
}

/** Prisma failed to open a connection (host down, wrong URL, firewall, paused DB). */
export function isPrismaConnectionError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { name?: string; message?: string; code?: string };
  // P1001 can't reach server, P1002 server timeout, P1017 server closed connection
  if (e.code === "P1001" || e.code === "P1002" || e.code === "P1017") return true;
  if (e.name === "PrismaClientInitializationError") return true;
  return (
    typeof e.message === "string" &&
    (e.message.includes("Can't reach database server") ||
      e.message.includes("Connection timed out") ||
      e.message.includes("ECONNREFUSED"))
  );
}

const DB_RETRY_ATTEMPTS = 3;
const DB_RETRY_BASE_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Retry transient Prisma connection failures (cold start, brief network blips). */
export async function withDbRetry<T>(fn: () => Promise<T>): Promise<T> {
  let last: unknown;
  for (let attempt = 1; attempt <= DB_RETRY_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (!isPrismaConnectionError(err) || attempt === DB_RETRY_ATTEMPTS) {
        throw err;
      }
      await sleep(DB_RETRY_BASE_MS * attempt);
    }
  }
  throw last;
}
