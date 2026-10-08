import request from "supertest";
import { describe, expect, it } from "vitest";

import app from "@/app";

describe("GET /health", () => {
    it("returns an OK health status", async () => {
        const response = await request(app).get("/health");

        expect(response.status).toBe(200);
        expect(response.headers["content-type"]).toMatch(/application\/json/);
        expect(response.body).toEqual({
            status: "ok",
        });
    });

    it("allows credentialed browser requests only from the configured frontend origin", async () => {
        const response = await request(app)
            .get("/health")
            .set("Origin", "http://localhost:3001");

        expect(response.headers["access-control-allow-origin"]).toBe(
            "http://localhost:3001",
        );
        expect(response.headers["access-control-allow-credentials"]).toBe("true");
    });

    it("does not grant credentialed CORS access to another origin", async () => {
        const response = await request(app)
            .get("/health")
            .set("Origin", "http://localhost:4000");

        expect(response.headers["access-control-allow-origin"]).toBeUndefined();
        expect(response.headers["access-control-allow-credentials"]).toBeUndefined();
    });
});
