import { PrismaClient } from '@prisma/client';
const globalForPrisma = globalThis as unknown as { supplementsPrisma?: PrismaClient };
export const prisma=globalForPrisma.supplementsPrisma??new PrismaClient();
if(process.env.NODE_ENV!=='production')globalForPrisma.supplementsPrisma=prisma;
export type PrismaClientExtended=PrismaClient;
