const path = require("path");
const { config } = require("dotenv");
const { defineConfig } = require("prisma/config");

const envFile = process.env.DOTENV_CONFIG_PATH
  ? path.resolve(process.cwd(), process.env.DOTENV_CONFIG_PATH)
  : path.resolve(process.cwd(), ".env");

config({ path: envFile, quiet: true });

// Fallback URL keeps prisma generate working when DATABASE_URL is absent
const databaseUrl = process.env.DATABASE_URL || "postgresql://dummy:dummy@localhost:5432/dummy";

module.exports = defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: databaseUrl,
  },
});