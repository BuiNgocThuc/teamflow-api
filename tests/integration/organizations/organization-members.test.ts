import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";

import app from "@/app";
import { db, organizations, users } from "@/database";

let nextUserNumber = 1;

function createCredentials() {
    const number = nextUserNumber++;

    return {
        name: `Member User ${number}`,
        email: `member-user-${number}@example.com`,
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
        user: registration.body.user as { id: string; name: string; email: string },
        accessToken: login.body.accessToken as string,
    };
}

async function createOrganization(accessToken: string) {
    const response = await request(app)
        .post("/organizations")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name: "Engineering" });

    expect(response.status).toBe(201);

    return response.body.organization as { id: string };
}

async function addMember(accessToken: string, organizationId: string, userId: string) {
    const response = await request(app)
        .post(`/organizations/${organizationId}/members`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ userId });

    expect(response.status).toBe(201);

    return response.body.member as {
        user: { id: string; name: string; email: string };
        role: "MEMBER";
    };
}

async function updateMemberRole(
    accessToken: string,
    organizationId: string,
    userId: string,
    role: "ADMIN" | "MEMBER",
) {
    return request(app)
        .patch(`/organizations/${organizationId}/members/${userId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ role });
}

describe("Organization members and RBAC", () => {
    afterEach(async () => {
        await db.delete(organizations);
        await db.delete(users);
    });

    it("allows an owner to add a member and list organization members", async () => {
        const owner = await registerAndLogin();
        const member = await registerAndLogin();
        const organization = await createOrganization(owner.accessToken);

        const addedMember = await addMember(
            owner.accessToken,
            organization.id,
            member.user.id,
        );

        expect(addedMember).toMatchObject({
            user: {
                id: member.user.id,
                name: member.user.name,
                email: member.user.email,
            },
            role: "MEMBER",
        });

        const response = await request(app)
            .get(`/organizations/${organization.id}/members`)
            .set("Authorization", `Bearer ${member.accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.members).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    user: expect.objectContaining({ id: owner.user.id }),
                    role: "OWNER",
                }),
                expect.objectContaining({
                    user: expect.objectContaining({ id: member.user.id }),
                    role: "MEMBER",
                }),
            ]),
        );
    });

    it("allows an owner to promote a member to ADMIN and demote the admin", async () => {
        const owner = await registerAndLogin();
        const member = await registerAndLogin();
        const organization = await createOrganization(owner.accessToken);

        await addMember(owner.accessToken, organization.id, member.user.id);

        const promotion = await updateMemberRole(
            owner.accessToken,
            organization.id,
            member.user.id,
            "ADMIN",
        );

        expect(promotion.status).toBe(200);
        expect(promotion.body.member.role).toBe("ADMIN");

        const demotion = await updateMemberRole(
            owner.accessToken,
            organization.id,
            member.user.id,
            "MEMBER",
        );

        expect(demotion.status).toBe(200);
        expect(demotion.body.member.role).toBe("MEMBER");
    });

    it("allows an admin to add and remove a member", async () => {
        const owner = await registerAndLogin();
        const admin = await registerAndLogin();
        const member = await registerAndLogin();
        const organization = await createOrganization(owner.accessToken);

        await addMember(owner.accessToken, organization.id, admin.user.id);
        await updateMemberRole(
            owner.accessToken,
            organization.id,
            admin.user.id,
            "ADMIN",
        );

        await addMember(admin.accessToken, organization.id, member.user.id);

        const removal = await request(app)
            .delete(`/organizations/${organization.id}/members/${member.user.id}`)
            .set("Authorization", `Bearer ${admin.accessToken}`);

        expect(removal.status).toBe(204);
    });

    it("allows an owner to remove a member", async () => {
        const owner = await registerAndLogin();
        const member = await registerAndLogin();
        const organization = await createOrganization(owner.accessToken);

        await addMember(owner.accessToken, organization.id, member.user.id);

        const removal = await request(app)
            .delete(`/organizations/${organization.id}/members/${member.user.id}`)
            .set("Authorization", `Bearer ${owner.accessToken}`);

        expect(removal.status).toBe(204);
    });

    it("rejects member management actions from a MEMBER", async () => {
        const owner = await registerAndLogin();
        const member = await registerAndLogin();
        const targetUser = await registerAndLogin();
        const organization = await createOrganization(owner.accessToken);

        await addMember(owner.accessToken, organization.id, member.user.id);

        const response = await request(app)
            .post(`/organizations/${organization.id}/members`)
            .set("Authorization", `Bearer ${member.accessToken}`)
            .send({ userId: targetUser.user.id });

        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe("ORGANIZATION_MEMBER_MANAGEMENT_DENIED");
    });

    it("rejects an admin attempting to manage an owner or promote a member", async () => {
        const owner = await registerAndLogin();
        const admin = await registerAndLogin();
        const member = await registerAndLogin();
        const organization = await createOrganization(owner.accessToken);

        await addMember(owner.accessToken, organization.id, admin.user.id);
        await addMember(owner.accessToken, organization.id, member.user.id);
        await updateMemberRole(
            owner.accessToken,
            organization.id,
            admin.user.id,
            "ADMIN",
        );

        const removeOwner = await request(app)
            .delete(`/organizations/${organization.id}/members/${owner.user.id}`)
            .set("Authorization", `Bearer ${admin.accessToken}`);

        expect(removeOwner.status).toBe(403);
        expect(removeOwner.body.error.code).toBe(
            "ORGANIZATION_OWNER_CANNOT_BE_MANAGED",
        );

        const promoteMember = await updateMemberRole(
            admin.accessToken,
            organization.id,
            member.user.id,
            "ADMIN",
        );

        expect(promoteMember.status).toBe(403);
        expect(promoteMember.body.error.code).toBe("ORGANIZATION_OWNER_REQUIRED");
    });

    it("rejects duplicate members and invalid role updates", async () => {
        const owner = await registerAndLogin();
        const member = await registerAndLogin();
        const organization = await createOrganization(owner.accessToken);

        await addMember(owner.accessToken, organization.id, member.user.id);

        const duplicate = await request(app)
            .post(`/organizations/${organization.id}/members`)
            .set("Authorization", `Bearer ${owner.accessToken}`)
            .send({ userId: member.user.id });

        expect(duplicate.status).toBe(409);
        expect(duplicate.body.error.code).toBe("ORGANIZATION_MEMBER_ALREADY_EXISTS");

        const invalidRole = await request(app)
            .patch(`/organizations/${organization.id}/members/${member.user.id}`)
            .set("Authorization", `Bearer ${owner.accessToken}`)
            .send({ role: "OWNER" });

        expect(invalidRole.status).toBe(400);
        expect(invalidRole.body.error.code).toBe("INVALID_INPUT");
    });
});
