import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";

import app from "@/app";
import { db, organizationMembers, organizations, users } from "@/database";

let nextUserNumber = 1;

function createCredentials() {
    const number = nextUserNumber++;

    return {
        name: `Organization User ${number}`,
        email: `organization-user-${number}@example.com`,
        password: "secure-password",
    };
}

async function registerAndLogin() {
    const credentials = createCredentials();
    const registration = await request(app).post("/auth/register").send(credentials);

    expect(registration.status).toBe(201);

    const login = await request(app).post("/auth/login").send({
        email: credentials.email,
        password: credentials.password,
    });

    expect(login.status).toBe(200);

    return {
        user: registration.body.user as { id: string },
        accessToken: login.body.accessToken as string,
    };
}

async function createOrganization(accessToken: string, name = "Engineering") {
    const response = await request(app)
        .post("/organizations")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name });

    expect(response.status).toBe(201);

    return response.body.organization as { id: string; name: string };
}

describe("Organization management", () => {
    afterEach(async () => {
        await db.delete(organizations);
        await db.delete(users);
    });

    it("creates an organization and makes its creator the OWNER", async () => {
        const { user, accessToken } = await registerAndLogin();
        const organization = await createOrganization(accessToken);

        expect(organization.name).toBe("Engineering");

        const [membership] = await db
            .select({ role: organizationMembers.role })
            .from(organizationMembers)
            .where(
                and(
                    eq(organizationMembers.organizationId, organization.id),
                    eq(organizationMembers.userId, user.id),
                ),
            );

        expect(membership).toEqual({ role: "OWNER" });
    });

    it("lists only organizations that belong to the authenticated user", async () => {
        const { accessToken } = await registerAndLogin();
        const organization = await createOrganization(accessToken);
        const otherUser = await registerAndLogin();

        await createOrganization(otherUser.accessToken, "Other Organization");

        const response = await request(app)
            .get("/organizations")
            .set("Authorization", `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data).toEqual([
            expect.objectContaining({
                id: organization.id,
                name: "Engineering",
                role: "OWNER",
            }),
        ]);
        expect(response.body.pagination).toEqual({
            page: 1,
            limit: 20,
            total: 1,
            totalPages: 1,
            hasNextPage: false,
            hasPreviousPage: false,
        });
    });

    it("uses default pagination values", async () => {
        const { accessToken } = await registerAndLogin();

        for (let index = 1; index <= 21; index += 1) {
            await createOrganization(accessToken, `Organization ${index}`);
        }

        const response = await request(app)
            .get("/organizations")
            .set("Authorization", `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(20);
        expect(response.body.pagination).toEqual({
            page: 1,
            limit: 20,
            total: 21,
            totalPages: 2,
            hasNextPage: true,
            hasPreviousPage: false,
        });
    });

    it("returns the data and metadata for the requested page", async () => {
        const { accessToken } = await registerAndLogin();

        for (let index = 1; index <= 11; index += 1) {
            await createOrganization(accessToken, `Organization ${index}`);
        }

        const allOrganizationsResponse = await request(app)
            .get("/organizations?limit=100")
            .set("Authorization", `Bearer ${accessToken}`);
        const pageResponse = await request(app)
            .get("/organizations?page=2&limit=5")
            .set("Authorization", `Bearer ${accessToken}`);

        expect(pageResponse.status).toBe(200);
        expect(
            pageResponse.body.data.map(
                (organization: { id: string }) => organization.id,
            ),
        ).toEqual(
            allOrganizationsResponse.body.data
                .slice(5, 10)
                .map((organization: { id: string }) => organization.id),
        );
        expect(pageResponse.body.pagination).toEqual({
            page: 2,
            limit: 5,
            total: 11,
            totalPages: 3,
            hasNextPage: true,
            hasPreviousPage: true,
        });
    });

    it("rejects invalid pagination query values", async () => {
        const { accessToken } = await registerAndLogin();

        const invalidPageResponse = await request(app)
            .get("/organizations?page=0")
            .set("Authorization", `Bearer ${accessToken}`);
        const invalidLimitResponse = await request(app)
            .get("/organizations?limit=101")
            .set("Authorization", `Bearer ${accessToken}`);

        expect(invalidPageResponse.status).toBe(400);
        expect(invalidPageResponse.body.error.code).toBe("INVALID_INPUT");
        expect(invalidLimitResponse.status).toBe(400);
        expect(invalidLimitResponse.body.error.code).toBe("INVALID_INPUT");
    });

    it("gets an organization for an organization member", async () => {
        const { accessToken } = await registerAndLogin();
        const organization = await createOrganization(accessToken, "Product");

        const response = await request(app)
            .get(`/organizations/${organization.id}`)
            .set("Authorization", `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.organization).toMatchObject({
            id: organization.id,
            name: "Product",
        });
    });

    it("returns not found for an organization ID that does not exist", async () => {
        const { accessToken } = await registerAndLogin();

        const response = await request(app)
            .get(`/organizations/${randomUUID()}`)
            .set("Authorization", `Bearer ${accessToken}`);

        expect(response.status).toBe(404);
        expect(response.body.error.code).toBe("ORGANIZATION_NOT_FOUND");
    });

    it("updates an organization when requested by its owner", async () => {
        const { accessToken } = await registerAndLogin();
        const organization = await createOrganization(accessToken);

        const response = await request(app)
            .patch(`/organizations/${organization.id}`)
            .set("Authorization", `Bearer ${accessToken}`)
            .send({ name: "Platform Engineering" });

        expect(response.status).toBe(200);
        expect(response.body.organization).toMatchObject({
            id: organization.id,
            name: "Platform Engineering",
        });
    });

    it("rejects an update from a user without organization access", async () => {
        const owner = await registerAndLogin();
        const organization = await createOrganization(owner.accessToken);
        const otherUser = await registerAndLogin();

        const response = await request(app)
            .patch(`/organizations/${organization.id}`)
            .set("Authorization", `Bearer ${otherUser.accessToken}`)
            .send({ name: "Unauthorized change" });

        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe("ORGANIZATION_ACCESS_DENIED");
    });

    it("deletes an organization when requested by its owner", async () => {
        const { accessToken } = await registerAndLogin();
        const organization = await createOrganization(accessToken);

        const response = await request(app)
            .delete(`/organizations/${organization.id}`)
            .set("Authorization", `Bearer ${accessToken}`);

        expect(response.status).toBe(204);

        const [deletedOrganization] = await db
            .select({ id: organizations.id })
            .from(organizations)
            .where(eq(organizations.id, organization.id));

        expect(deletedOrganization).toBeUndefined();
    });

    it("rejects an unauthenticated or invalid create request", async () => {
        const unauthenticatedResponse = await request(app)
            .post("/organizations")
            .send({ name: "Engineering" });

        expect(unauthenticatedResponse.status).toBe(401);
        expect(unauthenticatedResponse.body.error.code).toBe("AUTHENTICATION_REQUIRED");

        const { accessToken } = await registerAndLogin();
        const invalidResponse = await request(app)
            .post("/organizations")
            .set("Authorization", `Bearer ${accessToken}`)
            .send({ name: "" });

        expect(invalidResponse.status).toBe(400);
        expect(invalidResponse.body.error.code).toBe("INVALID_INPUT");
    });
});
