import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { createRateLimit } from "@/middleware";

describe("createRateLimit", () => {
    it("returns 429 and Retry-After after the limit is exceeded", async () => {
        const app = express();
        app.get(
            "/limited",
            createRateLimit({ maxRequests: 2, windowMs: 60_000 }),
            (_request, response) => response.status(204).end(),
        );
        app.use(
            (
                error: unknown,
                _request: express.Request,
                response: express.Response,
                _next: express.NextFunction,
            ) => {
                if (
                    error instanceof Error &&
                    "code" in error &&
                    error.code === "RATE_LIMIT_EXCEEDED"
                ) {
                    response
                        .status(429)
                        .json({ error: { code: "RATE_LIMIT_EXCEEDED" } });
                    return;
                }

                response.status(500).end();
            },
        );

        await request(app).get("/limited").expect(204);
        await request(app).get("/limited").expect(204);

        const limited = await request(app).get("/limited").expect(429);

        expect(limited.headers["retry-after"]).toBe("60");
        expect(limited.body.error.code).toBe("RATE_LIMIT_EXCEEDED");
    });
});
