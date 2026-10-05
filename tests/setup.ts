import { afterAll } from "vitest";

import { pool } from "@/database";

afterAll(async () => {
    await pool.end();
});
