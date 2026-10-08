import { SignJWT } from "jose";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";

import app from "@/app";
import { db, users } from "@/database";

const credentials = {
    name: "Jane Doe",
    email: "jane@example.com",
    password: "secure-password",
};

async function registerUser() {
    const response = await request(app).post("/auth/register").send(credentials);

    expect(response.status).toBe(201);
    return response.body.user as { id: string; email: string };
}

async function loginUser(agent = request(app)) {
    const response = await agent.post("/auth/login").send({
        email: credentials.email,
        password: credentials.password,
    });

    expect(response.status).toBe(200);
    return response;
}

function getRefreshTokenCookie(response: { headers: Record<string, unknown> }) {
    const setCookie = response.headers["set-cookie"];

    if (!Array.isArray(setCookie) || !setCookie[0]) {
        throw new Error("Expected the response to set a refresh-token cookie.");
    }

    return setCookie[0].split(";")[0];
}

describe("Authentication", () => {
    afterEach(async () => {
        await db.delete(users);
    });

    it("logs in with valid credentials", async () => {
        await registerUser();

        const response = await loginUser();

        expect(response.body.accessToken).toEqual(expect.any(String));
        expect(response.body.refreshToken).toBeUndefined();
        expect(getRefreshTokenCookie(response)).toMatch(/^teamflow_refresh_token=/);
        expect(response.headers["set-cookie"][0]).toContain("HttpOnly");
        expect(response.headers["set-cookie"][0]).toContain("SameSite=Lax");
        expect(response.headers["set-cookie"][0]).toContain("Path=/auth");
    });

    it("rejects an unknown email without disclosing which credential failed", async () => {
        const response = await request(app).post("/auth/login").send({
            email: "unknown@example.com",
            password: credentials.password,
        });

        expect(response.status).toBe(401);
        expect(response.body.error.code).toBe("INVALID_CREDENTIALS");
    });

    it("rejects an incorrect password", async () => {
        await registerUser();

        const response = await request(app).post("/auth/login").send({
            email: credentials.email,
            password: "incorrect-password",
        });

        expect(response.status).toBe(401);
        expect(response.body.error.code).toBe("INVALID_CREDENTIALS");
    });

    it("allows a valid access token to reach the protected endpoint", async () => {
        const user = await registerUser();
        const authentication = await loginUser();

        const response = await request(app)
            .get("/users/me")
            .set("Authorization", `Bearer ${authentication.body.accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.user).toMatchObject({
            id: user.id,
            email: user.email,
        });
        expect(response.body.user.passwordHash).toBeUndefined();
    });

    it("rejects an invalid access token", async () => {
        const response = await request(app)
            .get("/users/me")
            .set("Authorization", "Bearer invalid-token");

        expect(response.status).toBe(401);
        expect(response.body.error.code).toBe("INVALID_ACCESS_TOKEN");
    });

    it("rejects an expired access token", async () => {
        const user = await registerUser();
        const secret = process.env.JWT_ACCESS_SECRET;

        if (!secret) {
            throw new Error("JWT_ACCESS_SECRET is required for authentication tests.");
        }

        const expiredToken = await new SignJWT({ email: user.email })
            .setProtectedHeader({ alg: "HS256", typ: "JWT" })
            .setSubject(user.id)
            .setIssuedAt()
            .setExpirationTime("-1s")
            .sign(new TextEncoder().encode(secret));

        const response = await request(app)
            .get("/users/me")
            .set("Authorization", `Bearer ${expiredToken}`);

        expect(response.status).toBe(401);
        expect(response.body.error.code).toBe("INVALID_ACCESS_TOKEN");
    });

    it("rotates a refresh token and rejects its previous value", async () => {
        await registerUser();
        const agent = request.agent(app);
        const loginResponse = await loginUser(agent);
        const previousCookie = getRefreshTokenCookie(loginResponse);

        const refreshResponse = await agent.post("/auth/refresh");

        expect(refreshResponse.status).toBe(200);
        expect(refreshResponse.body.accessToken).toEqual(expect.any(String));
        expect(refreshResponse.body.refreshToken).toBeUndefined();
        expect(getRefreshTokenCookie(refreshResponse)).not.toBe(previousCookie);

        const replayResponse = await request(app)
            .post("/auth/refresh")
            .set("Cookie", previousCookie);

        expect(replayResponse.status).toBe(401);
        expect(replayResponse.body.error.code).toBe("INVALID_REFRESH_TOKEN");
    });

    it("does not accept a refresh token from a JSON request body", async () => {
        await registerUser();
        const loginResponse = await loginUser();
        const refreshCookie = getRefreshTokenCookie(loginResponse);
        const refreshToken = refreshCookie.slice("teamflow_refresh_token=".length);

        const response = await request(app)
            .post("/auth/refresh")
            .send({ refreshToken });

        expect(response.status).toBe(401);
        expect(response.body.error.code).toBe("INVALID_REFRESH_TOKEN");
    });

    it("revokes a refresh token on logout", async () => {
        await registerUser();
        const agent = request.agent(app);
        const loginResponse = await loginUser(agent);
        const refreshCookie = getRefreshTokenCookie(loginResponse);

        const logoutResponse = await agent.post("/auth/logout");

        expect(logoutResponse.status).toBe(204);
        expect(logoutResponse.headers["set-cookie"][0]).toContain(
            "teamflow_refresh_token=;",
        );

        const refreshResponse = await request(app)
            .post("/auth/refresh")
            .set("Cookie", refreshCookie);

        expect(refreshResponse.status).toBe(401);
        expect(refreshResponse.body.error.code).toBe("INVALID_REFRESH_TOKEN");
    });
});
