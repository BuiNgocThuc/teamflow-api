import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";

import app from "@/app";
import { db, organizations, users } from "@/database";

let nextUserNumber = 1;

function createCredentials() {
    const number = nextUserNumber++;

    return {
        name: `Workflow User ${number}`,
        email: `workflow-user-${number}@example.com`,
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

async function createTaskForOwner(accessToken: string) {
    const organizationResponse = await request(app)
        .post("/organizations")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name: "Engineering" });
    expect(organizationResponse.status).toBe(201);

    const projectResponse = await request(app)
        .post(`/organizations/${organizationResponse.body.organization.id}/projects`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name: "Platform" });
    expect(projectResponse.status).toBe(201);

    const taskResponse = await request(app)
        .post(`/projects/${projectResponse.body.project.id}/tasks`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ title: "Implement workflow" });
    expect(taskResponse.status).toBe(201);

    return taskResponse.body.task as { id: string; status: "TODO" };
}

function updateStatus(accessToken: string, taskId: string, status: string) {
    return request(app)
        .patch(`/tasks/${taskId}/status`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ status });
}

describe("Task workflow", () => {
    afterEach(async () => {
        await db.delete(organizations);
        await db.delete(users);
    });

    it("allows every valid status transition", async () => {
        const owner = await registerAndLogin();
        const task = await createTaskForOwner(owner.accessToken);

        const inProgress = await updateStatus(
            owner.accessToken,
            task.id,
            "IN_PROGRESS",
        );
        const done = await updateStatus(owner.accessToken, task.id, "DONE");
        const resumed = await updateStatus(owner.accessToken, task.id, "IN_PROGRESS");
        const returnedToTodo = await updateStatus(owner.accessToken, task.id, "TODO");

        expect(inProgress.status).toBe(200);
        expect(inProgress.body.task.status).toBe("IN_PROGRESS");
        expect(done.status).toBe(200);
        expect(done.body.task.status).toBe("DONE");
        expect(resumed.status).toBe(200);
        expect(resumed.body.task.status).toBe("IN_PROGRESS");
        expect(returnedToTodo.status).toBe(200);
        expect(returnedToTodo.body.task.status).toBe("TODO");
    });

    it("rejects invalid, repeated, and malformed status transitions", async () => {
        const owner = await registerAndLogin();
        const task = await createTaskForOwner(owner.accessToken);

        const invalid = await updateStatus(owner.accessToken, task.id, "DONE");
        const valid = await updateStatus(owner.accessToken, task.id, "IN_PROGRESS");
        const repeated = await updateStatus(owner.accessToken, task.id, "IN_PROGRESS");
        const malformed = await updateStatus(owner.accessToken, task.id, "BLOCKED");

        expect(invalid.status).toBe(400);
        expect(invalid.body.error.code).toBe("INVALID_TASK_STATUS_TRANSITION");
        expect(valid.status).toBe(200);
        expect(repeated.status).toBe(400);
        expect(repeated.body.error.code).toBe("INVALID_TASK_STATUS_TRANSITION");
        expect(malformed.status).toBe(400);
        expect(malformed.body.error.code).toBe("INVALID_INPUT");
    });

    it("allows only one competing TODO to IN_PROGRESS transition", async () => {
        const owner = await registerAndLogin();
        const task = await createTaskForOwner(owner.accessToken);

        const results = await Promise.all([
            updateStatus(owner.accessToken, task.id, "IN_PROGRESS"),
            updateStatus(owner.accessToken, task.id, "IN_PROGRESS"),
        ]);

        expect(results.map((response) => response.status).sort()).toEqual([200, 400]);

        const taskResponse = await request(app)
            .get(`/tasks/${task.id}`)
            .set("Authorization", `Bearer ${owner.accessToken}`);

        expect(taskResponse.status).toBe(200);
        expect(taskResponse.body.task.status).toBe("IN_PROGRESS");
    });
});
