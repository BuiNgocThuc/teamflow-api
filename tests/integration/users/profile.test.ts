import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";

import app from "@/app";
import { db, users } from "@/database";

const primaryUser = {
    name: "Jane Doe",
    email: "jane@example.com",
    password: "secure-password",
};

async function registerAndLogin(input = primaryUser) {
    const registration = await request(app).post("/auth/register").send(input);

    expect(registration.status).toBe(201);

    const login = await request(app).post("/auth/login").send({
        email: input.email,
        password: input.password,
    });

    expect(login.status).toBe(200);

    return {
        user: registration.body.user as { id: string; email: string },
        accessToken: login.body.accessToken as string,
    };
}

describe("User profile", () => {
    afterEach(async () => {
        await db.delete(users);
    });

    it("returns the authenticated user's persisted profile", async () => {
        const { user, accessToken } = await registerAndLogin();

        const response = await request(app)
            .get("/users/me")
            .set("Authorization", `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.user).toMatchObject({
            id: user.id,
            name: primaryUser.name,
            email: primaryUser.email,
        });
        expect(response.body.user.passwordHash).toBeUndefined();
    });

    it("updates the current user's name and email", async () => {
        const { user, accessToken } = await registerAndLogin();

        const response = await request(app)
            .patch("/users/me")
            .set("Authorization", `Bearer ${accessToken}`)
            .send({
                name: "Jane Smith",
                email: "JANE.SMITH@example.com",
            });

        expect(response.status).toBe(200);
        expect(response.body.user).toMatchObject({
            id: user.id,
            name: "Jane Smith",
            email: "jane.smith@example.com",
        });
    });

    it("rejects unauthenticated profile access", async () => {
        const response = await request(app).get("/users/me");

        expect(response.status).toBe(401);
        expect(response.body.error.code).toBe("AUTHENTICATION_REQUIRED");
    });

    it("rejects an empty update and protected fields", async () => {
        const { accessToken } = await registerAndLogin();

        const emptyUpdate = await request(app)
            .patch("/users/me")
            .set("Authorization", `Bearer ${accessToken}`)
            .send({});

        expect(emptyUpdate.status).toBe(400);
        expect(emptyUpdate.body.error.code).toBe("INVALID_INPUT");

        const protectedFieldUpdate = await request(app)
            .patch("/users/me")
            .set("Authorization", `Bearer ${accessToken}`)
            .send({ passwordHash: "not-allowed" });

        expect(protectedFieldUpdate.status).toBe(400);
        expect(protectedFieldUpdate.body.error.code).toBe("INVALID_INPUT");
    });

    it("rejects an email already owned by another user", async () => {
        const { accessToken } = await registerAndLogin();

        const secondRegistration = await request(app).post("/auth/register").send({
            name: "Other User",
            email: "other@example.com",
            password: "secure-password",
        });

        expect(secondRegistration.status).toBe(201);

        const response = await request(app)
            .patch("/users/me")
            .set("Authorization", `Bearer ${accessToken}`)
            .send({ email: "other@example.com" });

        expect(response.status).toBe(409);
        expect(response.body.error.code).toBe("EMAIL_ALREADY_EXISTS");
    });
});
