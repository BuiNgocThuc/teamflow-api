import { randomUUID } from "node:crypto";

import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";

import app from "@/app";
import { db, organizations, users } from "@/database";

let nextUserNumber = 1;

function createCredentials() {
    const number = nextUserNumber++;

    return {
        name: `Task User ${number}`,
        email: `task-user-${number}@example.com`,
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

async function createOrganization(accessToken: string) {
    const response = await request(app)
        .post("/organizations")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name: "Engineering" });

    expect(response.status).toBe(201);

    return response.body.organization as { id: string };
}

async function createProject(accessToken: string, organizationId: string) {
    const response = await request(app)
        .post(`/organizations/${organizationId}/projects`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name: "Platform" });

    expect(response.status).toBe(201);

    return response.body.project as { id: string };
}

async function addMember(accessToken: string, organizationId: string, userId: string) {
    const response = await request(app)
        .post(`/organizations/${organizationId}/members`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ userId });

    expect(response.status).toBe(201);
}

describe("Task management", () => {
    afterEach(async () => {
        await db.delete(organizations);
        await db.delete(users);
    });

    it("creates a task with TODO status and MEDIUM priority by default", async () => {
        const owner = await registerAndLogin();
        const organization = await createOrganization(owner.accessToken);
        const project = await createProject(owner.accessToken, organization.id);

        const response = await request(app)
            .post(`/projects/${project.id}/tasks`)
            .set("Authorization", `Bearer ${owner.accessToken}`)
            .send({ title: "Design task API" });

        expect(response.status).toBe(201);
        expect(response.body.task).toMatchObject({
            projectId: project.id,
            creatorId: owner.user.id,
            title: "Design task API",
            description: null,
            assigneeId: null,
            status: "TODO",
            priority: "MEDIUM",
            dueDate: null,
        });
    });

    it("allows a member to list and get tasks in their organization", async () => {
        const owner = await registerAndLogin();
        const member = await registerAndLogin();
        const organization = await createOrganization(owner.accessToken);
        const project = await createProject(owner.accessToken, organization.id);
        await addMember(owner.accessToken, organization.id, member.user.id);

        const creation = await request(app)
            .post(`/projects/${project.id}/tasks`)
            .set("Authorization", `Bearer ${owner.accessToken}`)
            .send({ title: "Read architecture" });

        const taskId = creation.body.task.id as string;

        const listResponse = await request(app)
            .get(`/projects/${project.id}/tasks`)
            .set("Authorization", `Bearer ${member.accessToken}`);
        const getResponse = await request(app)
            .get(`/tasks/${taskId}`)
            .set("Authorization", `Bearer ${member.accessToken}`);

        expect(listResponse.status).toBe(200);
        expect(listResponse.body.data).toEqual([
            expect.objectContaining({ id: taskId, title: "Read architecture" }),
        ]);
        expect(listResponse.body.pagination).toMatchObject({ total: 1 });
        expect(getResponse.status).toBe(200);
        expect(getResponse.body.task).toMatchObject({ id: taskId });
    });

    it("updates task details without allowing a direct status update", async () => {
        const owner = await registerAndLogin();
        const organization = await createOrganization(owner.accessToken);
        const project = await createProject(owner.accessToken, organization.id);
        const creation = await request(app)
            .post(`/projects/${project.id}/tasks`)
            .set("Authorization", `Bearer ${owner.accessToken}`)
            .send({ title: "Initial title" });

        const taskId = creation.body.task.id as string;
        const response = await request(app)
            .patch(`/tasks/${taskId}`)
            .set("Authorization", `Bearer ${owner.accessToken}`)
            .send({
                title: "Updated title",
                description: "Describe the implementation.",
                priority: "HIGH",
                dueDate: "2026-12-01T09:00:00Z",
            });

        expect(response.status).toBe(200);
        expect(response.body.task).toMatchObject({
            id: taskId,
            title: "Updated title",
            description: "Describe the implementation.",
            priority: "HIGH",
            status: "TODO",
        });

        const statusUpdate = await request(app)
            .patch(`/tasks/${taskId}`)
            .set("Authorization", `Bearer ${owner.accessToken}`)
            .send({ status: "DONE" });

        expect(statusUpdate.status).toBe(400);
        expect(statusUpdate.body.error.code).toBe("INVALID_INPUT");
    });

    it("deletes a task when requested by a project manager", async () => {
        const owner = await registerAndLogin();
        const organization = await createOrganization(owner.accessToken);
        const project = await createProject(owner.accessToken, organization.id);
        const creation = await request(app)
            .post(`/projects/${project.id}/tasks`)
            .set("Authorization", `Bearer ${owner.accessToken}`)
            .send({ title: "Remove me" });

        const taskId = creation.body.task.id as string;
        const deletion = await request(app)
            .delete(`/tasks/${taskId}`)
            .set("Authorization", `Bearer ${owner.accessToken}`);
        const getResponse = await request(app)
            .get(`/tasks/${taskId}`)
            .set("Authorization", `Bearer ${owner.accessToken}`);

        expect(deletion.status).toBe(204);
        expect(getResponse.status).toBe(404);
        expect(getResponse.body.error.code).toBe("TASK_NOT_FOUND");
    });

    it("rejects an invalid project ID and a user outside the organization", async () => {
        const owner = await registerAndLogin();
        const outsider = await registerAndLogin();
        const organization = await createOrganization(owner.accessToken);
        const project = await createProject(owner.accessToken, organization.id);

        const invalidProject = await request(app)
            .post(`/projects/${randomUUID()}/tasks`)
            .set("Authorization", `Bearer ${owner.accessToken}`)
            .send({ title: "Unknown project" });
        const unauthorized = await request(app)
            .post(`/projects/${project.id}/tasks`)
            .set("Authorization", `Bearer ${outsider.accessToken}`)
            .send({ title: "Unauthorized task" });

        expect(invalidProject.status).toBe(404);
        expect(invalidProject.body.error.code).toBe("PROJECT_NOT_FOUND");
        expect(unauthorized.status).toBe(403);
        expect(unauthorized.body.error.code).toBe("ORGANIZATION_ACCESS_DENIED");
    });

    it("rejects task creation by a MEMBER and invalid task input", async () => {
        const owner = await registerAndLogin();
        const member = await registerAndLogin();
        const organization = await createOrganization(owner.accessToken);
        const project = await createProject(owner.accessToken, organization.id);
        await addMember(owner.accessToken, organization.id, member.user.id);

        const memberCreate = await request(app)
            .post(`/projects/${project.id}/tasks`)
            .set("Authorization", `Bearer ${member.accessToken}`)
            .send({ title: "Not allowed" });
        const invalidInput = await request(app)
            .post(`/projects/${project.id}/tasks`)
            .set("Authorization", `Bearer ${owner.accessToken}`)
            .send({ title: "", priority: "URGENT" });

        expect(memberCreate.status).toBe(403);
        expect(memberCreate.body.error.code).toBe("PROJECT_MANAGEMENT_DENIED");
        expect(invalidInput.status).toBe(400);
        expect(invalidInput.body.error.code).toBe("INVALID_INPUT");
    });
});
