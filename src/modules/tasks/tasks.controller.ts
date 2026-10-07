import type { Request, Response } from "express";

import { getAuthenticatedUserId } from "@/shared";

import {
    createTaskSchema,
    listTasksQuerySchema,
    projectTasksParamsSchema,
    taskParamsSchema,
    updateTaskSchema,
} from "./tasks.schema.js";
import {
    createTask,
    deleteTask,
    getTask,
    listTasks,
    updateTask,
} from "./tasks.service.js";

export async function create(request: Request, response: Response): Promise<Response> {
    const { projectId } = projectTasksParamsSchema.parse(request.params);
    const input = createTaskSchema.parse(request.body);
    const task = await createTask(getAuthenticatedUserId(request), projectId, input);

    return response.status(201).json({ task });
}

export async function list(request: Request, response: Response): Promise<Response> {
    const { projectId } = projectTasksParamsSchema.parse(request.params);
    const query = listTasksQuerySchema.parse(request.query);
    const result = await listTasks(getAuthenticatedUserId(request), projectId, query);

    return response.status(200).json(result);
}

export async function getById(request: Request, response: Response): Promise<Response> {
    const { id } = taskParamsSchema.parse(request.params);
    const task = await getTask(getAuthenticatedUserId(request), id);

    return response.status(200).json({ task });
}

export async function update(request: Request, response: Response): Promise<Response> {
    const { id } = taskParamsSchema.parse(request.params);
    const input = updateTaskSchema.parse(request.body);
    const task = await updateTask(getAuthenticatedUserId(request), id, input);

    return response.status(200).json({ task });
}

export async function remove(request: Request, response: Response): Promise<void> {
    const { id } = taskParamsSchema.parse(request.params);

    await deleteTask(getAuthenticatedUserId(request), id);
    response.status(204).end();
}
