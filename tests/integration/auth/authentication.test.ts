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

async function loginUser() {
    const response = await request(app).post("/auth/login").send({
        email: credentials.email,
        password: credentials.password,
    });

    expect(response.status).toBe(200);
    return response.body as { accessToken: string; refreshToken: string };
}

describe("Authentication", () => {
    afterEach(async () => {
        await db.delete(users);
    });

    it("logs in with valid credentials", async () => {
        await registerUser();

        const authentication = await loginUser();

        expect(authentication.accessToken).toEqual(expect.any(String));
        expect(authentication.refreshToken).toEqual(expect.any(String));
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
            .set("Authorization", `Bearer ${authentication.accessToken}`);

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
        const authentication = await loginUser();

        const refreshResponse = await request(app).post("/auth/refresh").send({
            refreshToken: authentication.refreshToken,
        });

        expect(refreshResponse.status).toBe(200);
        expect(refreshResponse.body.accessToken).toEqual(expect.any(String));
        expect(refreshResponse.body.refreshToken).toEqual(expect.any(String));
        expect(refreshResponse.body.refreshToken).not.toBe(authentication.refreshToken);

        const replayResponse = await request(app).post("/auth/refresh").send({
            refreshToken: authentication.refreshToken,
        });

        expect(replayResponse.status).toBe(401);
        expect(replayResponse.body.error.code).toBe("INVALID_REFRESH_TOKEN");
    });

    it("revokes a refresh token on logout", async () => {
        await registerUser();
        const authentication = await loginUser();

        const logoutResponse = await request(app).post("/auth/logout").send({
            refreshToken: authentication.refreshToken,
        });

        expect(logoutResponse.status).toBe(204);

        const refreshResponse = await request(app).post("/auth/refresh").send({
            refreshToken: authentication.refreshToken,
        });

        expect(refreshResponse.status).toBe(401);
        expect(refreshResponse.body.error.code).toBe("INVALID_REFRESH_TOKEN");
    });
});
