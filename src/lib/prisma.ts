import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is required for Prisma");
}

const adapterFactory = new PrismaPg(databaseUrl);

const prismaGlobal = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  prismaGlobal.prisma ??
  new PrismaClient({
    adapter: adapterFactory,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  prismaGlobal.prisma = prisma;
}

