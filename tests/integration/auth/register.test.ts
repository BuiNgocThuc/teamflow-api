import argon2 from "argon2";
import { eq } from "drizzle-orm";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";

import app from "@/app";
import { db, users } from "@/database";

const validInput = {
    name: "John Doe",
    email: "john@example.com",
    password: "secure-password",
};

describe("POST /auth/register", () => {
    afterEach(async () => {
        await db.delete(users);
    });

    it("creates a user and does not return password data", async () => {
        const response = await request(app).post("/auth/register").send(validInput);

        expect(response.status).toBe(201);
        expect(response.body.user).toMatchObject({
            name: validInput.name,
            email: validInput.email,
        });
        expect(response.body.user.password).toBeUndefined();
        expect(response.body.user.passwordHash).toBeUndefined();

        const [storedUser] = await db
            .select()
            .from(users)
            .where(eq(users.email, validInput.email));

        expect(storedUser).toBeDefined();
        expect(storedUser?.passwordHash).not.toBe(validInput.password);
        await expect(
            argon2.verify(storedUser?.passwordHash ?? "", validInput.password),
        ).resolves.toBe(true);
    });

    it("rejects an invalid email", async () => {
        const response = await request(app)
            .post("/auth/register")
            .send({
                ...validInput,
                email: "not-an-email",
            });

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe("INVALID_INPUT");
    });

    it("rejects a password shorter than 8 characters", async () => {
        const response = await request(app)
            .post("/auth/register")
            .send({
                ...validInput,
                password: "short",
            });

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe("INVALID_INPUT");
    });

    it("rejects malformed JSON", async () => {
        const response = await request(app)
            .post("/auth/register")
            .set("Content-Type", "application/json")
            .send('{"name":');

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe("INVALID_JSON");
    });

    it("rejects a duplicate email", async () => {
        await request(app).post("/auth/register").send(validInput);

        const response = await request(app).post("/auth/register").send(validInput);

        expect(response.status).toBe(409);
        expect(response.body.error.code).toBe("EMAIL_ALREADY_EXISTS");
    });
});
