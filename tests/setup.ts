import { afterAll } from "vitest";

import { pool } from "@/database";

process.env.FRONTEND_ORIGIN ??= "http://localhost:3001";

afterAll(async () => {
    await pool.end();
});
