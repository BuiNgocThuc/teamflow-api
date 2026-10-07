import {
    organizationMembersRepository,
    requireMembership,
    requireProjectManager,
} from "@/modules/organizations";
import { projectsRepository } from "@/modules/projects";
import { AppError, createPaginationMetadata } from "@/shared";

import { tasksRepository } from "./tasks.repository.js";
import type {
    AssignTaskInput,
    CreateTaskInput,
    ListTasksQuery,
    TaskStatus,
    UpdateTaskInput,
    UpdateTaskStatusInput,
} from "./tasks.schema.js";

const allowedStatusTransitions: Record<TaskStatus, readonly TaskStatus[]> = {
    TODO: ["IN_PROGRESS"],
    IN_PROGRESS: ["TODO", "DONE"],
    DONE: ["IN_PROGRESS"],
} as const;

async function getProjectOrThrow(projectId: string) {
    const project = await projectsRepository.findById(projectId);

    if (!project) {
        throw new AppError("PROJECT_NOT_FOUND");
    }

    return project;
}

async function getTaskOrThrow(taskId: string) {
    const task = await tasksRepository.findById(taskId);

    if (!task) {
        throw new AppError("TASK_NOT_FOUND");
    }

    return task;
}

export async function createTask(
    userId: string,
    projectId: string,
    input: CreateTaskInput,
) {
    const project = await getProjectOrThrow(projectId);
    await requireProjectManager(userId, project.organizationId);

    return tasksRepository.create({
        projectId,
        creatorId: userId,
        ...input,
    });
}

export async function listTasks(
    userId: string,
    projectId: string,
    query: ListTasksQuery,
) {
    const project = await getProjectOrThrow(projectId);
    await requireMembership(userId, project.organizationId);

    const { data, total } = await tasksRepository.listForProject(projectId, query);

    return {
        data,
        pagination: createPaginationMetadata(query, total),
    };
}

export async function getTask(userId: string, taskId: string) {
    const task = await getTaskOrThrow(taskId);
    const project = await getProjectOrThrow(task.projectId);
    await requireMembership(userId, project.organizationId);

    return task;
}

export async function updateTask(
    userId: string,
    taskId: string,
    input: UpdateTaskInput,
) {
    const task = await getTaskOrThrow(taskId);
    const project = await getProjectOrThrow(task.projectId);
    await requireProjectManager(userId, project.organizationId);

    const updatedTask = await tasksRepository.update(taskId, input);

    if (!updatedTask) {
        throw new AppError("TASK_NOT_FOUND");
    }

    return updatedTask;
}

export async function assignTask(
    userId: string,
    taskId: string,
    input: AssignTaskInput,
) {
    const task = await getTaskOrThrow(taskId);
    const project = await getProjectOrThrow(task.projectId);
    await requireProjectManager(userId, project.organizationId);

    const assigneeMembership =
        await organizationMembersRepository.findByUserAndOrganization(
            input.assigneeId,
            project.organizationId,
        );

    if (!assigneeMembership) {
        throw new AppError("TASK_ASSIGNEE_NOT_ORGANIZATION_MEMBER");
    }

    const assignedTask = await tasksRepository.assignAssignee({
        taskId,
        organizationId: project.organizationId,
        assigneeId: input.assigneeId,
    });

    if (!assignedTask) {
        throw new AppError("TASK_ASSIGNEE_NOT_ORGANIZATION_MEMBER");
    }

    return assignedTask;
}

export async function updateTaskStatus(
    userId: string,
    taskId: string,
    input: UpdateTaskStatusInput,
) {
    const task = await getTaskOrThrow(taskId);
    const project = await getProjectOrThrow(task.projectId);
    await requireProjectManager(userId, project.organizationId);

    const allowedNextStatuses = allowedStatusTransitions[task.status];

    if (!allowedNextStatuses.includes(input.status)) {
        throw new AppError("INVALID_TASK_STATUS_TRANSITION");
    }

    const updatedTask = await tasksRepository.updateStatus({
        taskId,
        expectedStatus: task.status,
        status: input.status,
    });

    if (!updatedTask) {
        throw new AppError("INVALID_TASK_STATUS_TRANSITION");
    }

    return updatedTask;
}

export async function deleteTask(userId: string, taskId: string) {
    const task = await getTaskOrThrow(taskId);
    const project = await getProjectOrThrow(task.projectId);
    await requireProjectManager(userId, project.organizationId);

    const deletedTask = await tasksRepository.deleteById(taskId);

    if (!deletedTask) {
        throw new AppError("TASK_NOT_FOUND");
    }
}
