import { config } from "dotenv";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

config({
    path: ".env.test",
    override: true,
});

export default defineConfig({
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
        },
    },
    test: {
        include: ["tests/**/*.test.ts"],
        fileParallelism: false,
        setupFiles: ["./tests/setup.ts"],
    },
});
