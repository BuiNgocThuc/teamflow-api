import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";

import app from "@/app";
import { db, organizations, users } from "@/database";

let nextUserNumber = 1;

function createCredentials() {
    const number = nextUserNumber++;

    return {
        name: `Assignment User ${number}`,
        email: `assignment-user-${number}@example.com`,
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

async function createTask(accessToken: string, projectId: string) {
    const response = await request(app)
        .post(`/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ title: "Implement assignment" });
    expect(response.status).toBe(201);

    return response.body.task as { id: string };
}

async function addMember(accessToken: string, organizationId: string, userId: string) {
    const response = await request(app)
        .post(`/organizations/${organizationId}/members`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ userId });
    expect(response.status).toBe(201);
}

describe("Task assignment", () => {
    afterEach(async () => {
        await db.delete(organizations);
        await db.delete(users);
    });

    it("assigns a task to an organization member", async () => {
        const owner = await registerAndLogin();
        const assignee = await registerAndLogin();
        const organization = await createOrganization(owner.accessToken);
        const project = await createProject(owner.accessToken, organization.id);
        const task = await createTask(owner.accessToken, project.id);
        await addMember(owner.accessToken, organization.id, assignee.user.id);

        const response = await request(app)
            .patch(`/tasks/${task.id}/assignee`)
            .set("Authorization", `Bearer ${owner.accessToken}`)
            .send({ assigneeId: assignee.user.id });

        expect(response.status).toBe(200);
        expect(response.body.task).toMatchObject({
            id: task.id,
            assigneeId: assignee.user.id,
        });
    });

    it("allows a project manager to reassign a task", async () => {
        const owner = await registerAndLogin();
        const firstAssignee = await registerAndLogin();
        const nextAssignee = await registerAndLogin();
        const organization = await createOrganization(owner.accessToken);
        const project = await createProject(owner.accessToken, organization.id);
        const task = await createTask(owner.accessToken, project.id);
        await addMember(owner.accessToken, organization.id, firstAssignee.user.id);
        await addMember(owner.accessToken, organization.id, nextAssignee.user.id);

        await request(app)
            .patch(`/tasks/${task.id}/assignee`)
            .set("Authorization", `Bearer ${owner.accessToken}`)
            .send({ assigneeId: firstAssignee.user.id })
            .expect(200);

        const response = await request(app)
            .patch(`/tasks/${task.id}/assignee`)
            .set("Authorization", `Bearer ${owner.accessToken}`)
            .send({ assigneeId: nextAssignee.user.id });

        expect(response.status).toBe(200);
        expect(response.body.task.assigneeId).toBe(nextAssignee.user.id);
    });

    it("rejects an assignee who is outside the task organization", async () => {
        const owner = await registerAndLogin();
        const outsider = await registerAndLogin();
        const organization = await createOrganization(owner.accessToken);
        const project = await createProject(owner.accessToken, organization.id);
        const task = await createTask(owner.accessToken, project.id);

        const response = await request(app)
            .patch(`/tasks/${task.id}/assignee`)
            .set("Authorization", `Bearer ${owner.accessToken}`)
            .send({ assigneeId: outsider.user.id });

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe("TASK_ASSIGNEE_NOT_ORGANIZATION_MEMBER");
    });

    it("rejects assignment by a MEMBER", async () => {
        const owner = await registerAndLogin();
        const member = await registerAndLogin();
        const assignee = await registerAndLogin();
        const organization = await createOrganization(owner.accessToken);
        const project = await createProject(owner.accessToken, organization.id);
        const task = await createTask(owner.accessToken, project.id);
        await addMember(owner.accessToken, organization.id, member.user.id);
        await addMember(owner.accessToken, organization.id, assignee.user.id);

        const response = await request(app)
            .patch(`/tasks/${task.id}/assignee`)
            .set("Authorization", `Bearer ${member.accessToken}`)
            .send({ assigneeId: assignee.user.id });

        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe("PROJECT_MANAGEMENT_DENIED");
    });
});
