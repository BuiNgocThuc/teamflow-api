import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

const isTestEnvironment = process.env.NODE_ENV === "test";

config({
    path: isTestEnvironment ? ".env.test" : ".env",
    override: isTestEnvironment,
});

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    throw new Error("DATABASE_URL is required.");
}

export default defineConfig({
    dialect: "postgresql",
    schema: "./src/database/schema.ts",
    out: "./drizzle",
    dbCredentials: {
        url: databaseUrl,
    },
    verbose: true,
    strict: true,
});
